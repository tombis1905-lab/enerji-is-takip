export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { faturaTokenGecerliMi, FATURA_COOKIE_NAME } from '@/lib/fatura-auth'

async function guard(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return { ok: false as const, res: NextResponse.json({ error: 'Yetkisiz' }, { status: 403 }) }
  }
  const userId = (session.user as any).id as string
  const token = req.cookies.get(FATURA_COOKIE_NAME)?.value
  if (!faturaTokenGecerliMi(token, userId)) {
    return { ok: false as const, res: NextResponse.json({ error: 'PIN gerekli', code: 'PIN_GEREKLI' }, { status: 401 }) }
  }
  return { ok: true as const }
}

type GelenSatir = {
  cariAd: string
  ibanBilgisi: string | null
  tarih: string | null
  faturaNo: string | null
  aciklama: string | null
  tutar: number
  odeyenFirma: string | null
  durum: string
  sonOdemeTarihi: string | null
}

const SIRKET_KODLARI = ['MAREL', 'BERKTEK', 'OKTAY']

function sirketKoduBul(odeyenFirma: string | null): string | null {
  if (!odeyenFirma) return null
  const buyuk = odeyenFirma.toUpperCase()
  return SIRKET_KODLARI.find((kod) => buyuk.includes(kod)) || null
}

// Tom'un "hesap hareketleri" ile eşleştirerek hazırladığı CARİ_HESAPLAR
// raporundaki fatura/ödeme-talebi satırlarını uygulamaya işler. Bu rapor
// ayrı bir kaynaktan (Haftalık Ödemeler.xlsx + banka ekstreleri) üretildiği
// için uygulamada bu cari/fatura kayıtları hiç olmayabilir — bu durumda cari
// ve fatura (tur=ALINAN) OLUŞTURULUR. Eğer cari zaten varsa ve aynı tutarda
// eşleşen bir ALINAN fatura bulunursa (henüz bu çalıştırmada kullanılmamış),
// yeni kayıt açmak yerine o fatura güncellenir — aynı veriyi iki kez
// işlememek için. "Ödendi" satırları Ödendi + ödeme tarihiyle,
// "Kısmen ödendi"/"ÖDENMEDİ" satırları Bekliyor olarak (kalan tutar notu
// açıklamaya eklenerek) işlenir. uygula=false iken hiçbir şey yazılmaz,
// sadece önizleme raporu döner.
export async function POST(req: NextRequest) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const body = await req.json()
  const satirlar: GelenSatir[] = Array.isArray(body?.satirlar) ? body.satirlar : []
  const uygula = !!body?.uygula

  type IdAd = { id: string; ad: string }
  const sirketler: IdAd[] = await prisma.sirket.findMany({ select: { id: true, ad: true } })
  const sirketIdByKod = new Map(sirketler.map((s: IdAd) => [s.ad.toUpperCase(), s.id]))

  const tumCariler: IdAd[] = await prisma.cari.findMany({ select: { id: true, ad: true } })
  const cariByAdLower = new Map<string, IdAd>(tumCariler.map((c: IdAd) => [c.ad.trim().toLocaleLowerCase('tr-TR'), c]))
  // Bu çalıştırmada yeni oluşturulacak cariler (henüz DB'ye yazılmadıysa
  // dry-run'da da aynı isimle tekrar "yeni cari" sayılmasın diye).
  const yeniCariler = new Map<string, { ad: string; ibanBilgisi: string | null }>()

  type FaturaAday = { id: string; kdvDahilTutar: number; tarih: Date; odemeDurumu: string }
  const tumAlinanFaturalar: (FaturaAday & { cariId: string | null })[] = await prisma.fatura.findMany({
    where: { tur: 'ALINAN', cariId: { not: null } },
    select: { id: true, kdvDahilTutar: true, tarih: true, odemeDurumu: true, cariId: true },
  })
  const faturalarByCariId = new Map<string, FaturaAday[]>()
  tumAlinanFaturalar.forEach((f) => {
    if (!f.cariId) return
    const liste = faturalarByCariId.get(f.cariId) || []
    liste.push(f)
    faturalarByCariId.set(f.cariId, liste)
  })
  const kullanilanFaturaId = new Set<string>()

  let cariOlusturulacak = 0
  let faturaOlusturulacak = 0
  let faturaGuncellenecek = 0
  let faturaDegismeyecek = 0
  let kismenOdendi = 0
  let odenmedi = 0

  const cariOlusturmalar: { ad: string; ibanBilgisi: string | null }[] = []
  const faturaOlusturmalar: any[] = []
  const faturaGuncellemeler: { id: string; odemeDurumu: 'ODENDI'; odemeTarihi: string }[] = []

  for (const s of satirlar) {
    const cariAdHam = (s.cariAd || '').trim()
    if (!cariAdHam || !s.tarih || !s.tutar) continue
    const anahtar = cariAdHam.toLocaleLowerCase('tr-TR')

    let cari = cariByAdLower.get(anahtar)
    let cariIdGecici: string | null = cari?.id ?? null

    if (!cari && !yeniCariler.has(anahtar)) {
      yeniCariler.set(anahtar, { ad: cariAdHam, ibanBilgisi: s.ibanBilgisi || null })
      cariOlusturulacak++
      cariOlusturmalar.push({ ad: cariAdHam, ibanBilgisi: s.ibanBilgisi || null })
    }

    const kismenMi = s.durum?.startsWith('Kısmen')
    const odendiMi = s.durum === 'Ödendi'
    if (!odendiMi) {
      if (kismenMi) kismenOdendi++
      else odenmedi++
    }

    // Mevcut cari ise, aynı tutarda daha önce bu çalıştırmada kullanılmamış
    // bir ALINAN fatura var mı diye bak — varsa yeni kayıt açmak yerine onu
    // kullan (çift kayıt oluşmasın).
    let eslesen: FaturaAday | null = null
    if (cariIdGecici) {
      const adaylar = (faturalarByCariId.get(cariIdGecici) || []).filter(
        (f) => !kullanilanFaturaId.has(f.id) && Math.abs(f.kdvDahilTutar - s.tutar) < 1
      )
      if (adaylar.length > 0) {
        const hedef = new Date(s.tarih).getTime()
        eslesen = adaylar.reduce((best, f) => {
          const d1 = Math.abs(new Date(f.tarih).getTime() - hedef)
          const d0 = Math.abs(new Date(best.tarih).getTime() - hedef)
          return d1 < d0 ? f : best
        }, adaylar[0])
      }
    }

    if (eslesen) {
      kullanilanFaturaId.add(eslesen.id)
      if (odendiMi && s.sonOdemeTarihi && eslesen.odemeDurumu !== 'ODENDI') {
        faturaGuncellenecek++
        faturaGuncellemeler.push({ id: eslesen.id, odemeDurumu: 'ODENDI', odemeTarihi: s.sonOdemeTarihi })
      } else {
        faturaDegismeyecek++
      }
      continue
    }

    // Eşleşen fatura yok — yeni bir ALINAN fatura kaydı açılacak (cari yeni
    // ise cariId, ilgili cari oluşturulduktan sonra uygulama anında atanır;
    // önizlemede sadece sayaç artırılır).
    let aciklama = s.aciklama || ''
    if (kismenMi) aciklama = `${aciklama} (${s.durum})`.trim()
    faturaOlusturulacak++
    faturaOlusturmalar.push({
      cariAnahtar: anahtar,
      cariAdHam,
      tur: 'ALINAN',
      faturaNo: s.faturaNo && s.faturaNo !== '-' ? s.faturaNo : null,
      tarih: s.tarih,
      aciklama: aciklama || null,
      tutar: s.tutar,
      kdvOrani: 0,
      kdvTutari: 0,
      kdvDahilTutar: s.tutar,
      odemeDurumu: odendiMi ? 'ODENDI' : 'BEKLIYOR',
      odemeTarihi: odendiMi ? s.sonOdemeTarihi : null,
      sirketId: sirketIdByKod.get(sirketKoduBul(s.odeyenFirma) || '') || null,
      cariEklensinMi: true,
    })
  }

  if (uygula) {
    // 1) Yeni carileri oluştur, anahtar -> gerçek id eşlemesini kur.
    const anahtarToCariId = new Map<string, string>()
    for (const yc of cariOlusturmalar) {
      const olusan = await prisma.cari.create({
        data: { ad: yc.ad, ibanBilgisi: yc.ibanBilgisi || undefined },
        select: { id: true },
      })
      anahtarToCariId.set(yc.ad.trim().toLocaleLowerCase('tr-TR'), olusan.id)
    }
    // 2) Yeni faturaları, doğru cariId ile toplu oluştur.
    const faturaCreateData = faturaOlusturmalar.map((f) => {
      const cariId = cariByAdLower.get(f.cariAnahtar)?.id || anahtarToCariId.get(f.cariAnahtar)
      return {
        tur: f.tur,
        faturaNo: f.faturaNo,
        tarih: new Date(f.tarih),
        aciklama: f.aciklama,
        tutar: f.tutar,
        kdvOrani: f.kdvOrani,
        kdvTutari: f.kdvTutari,
        kdvDahilTutar: f.kdvDahilTutar,
        odemeDurumu: f.odemeDurumu,
        odemeTarihi: f.odemeTarihi ? new Date(f.odemeTarihi) : null,
        sirketId: f.sirketId,
        cariEklensinMi: f.cariEklensinMi,
        cariId: cariId || null,
      }
    })
    if (faturaCreateData.length > 0) {
      await prisma.fatura.createMany({ data: faturaCreateData })
    }
    // 3) Mevcut faturaları güncelle (Ödendi + ödeme tarihi).
    if (faturaGuncellemeler.length > 0) {
      await prisma.$transaction(
        faturaGuncellemeler.map((gf) =>
          prisma.fatura.update({
            where: { id: gf.id },
            data: { odemeDurumu: gf.odemeDurumu, odemeTarihi: new Date(gf.odemeTarihi) },
          })
        )
      )
    }
  }

  return NextResponse.json({
    toplamSatir: satirlar.length,
    cariOlusturulacak,
    faturaOlusturulacak,
    faturaGuncellenecek,
    faturaDegismeyecek,
    kismenOdendi,
    odenmedi,
    cariOlusturulanListe: cariOlusturmalar.map((c) => c.ad).slice(0, 50),
    uygulandiMi: uygula,
  })
}
