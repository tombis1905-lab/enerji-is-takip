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

// Excel başlıkları elden ele farklı yazılabiliyor (KDV Dahil Tutar / kdv dahil
// tutar / KDV_DAHIL_TUTAR gibi) — karşılaştırma için boşluk/alt çizgi/Türkçe
// karakterleri sadeleştiriyoruz.
function normalizeKey(k: string): string {
  return String(k)
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '')
}

// normalize edilmiş başlık -> Fatura alanı eşlemesi. Tom'un "Haftalık
// Ödemeler" tablosundaki gerçek sütun adlarını (FATURA NO, TARİH, ÖDEME
// TARİHİ, YAPILAN İŞ, FİRMA, IBAN BİLGİSİ, KDV DAHİL TUTAR, ÖDEME YAPAN
// FİRMA, YÜKLENİCİ) ve olası benzer varyasyonları kapsar. Tom'un göndereceği
// gerçek örnek dosyaya göre bu liste genişletilebilir.
const ALAN_ESLEME: Record<string, string> = {
  faturano: 'faturaNo',
  fatura: 'faturaNo',
  tarih: 'tarih',
  faturatarihi: 'tarih',
  odemetarihi: 'odemeTarihi',
  vadetarihi: 'odemeTarihi',
  yapilanis: 'aciklama',
  aciklama: 'aciklama',
  is: 'aciklama',
  firma: 'karsiTaraf',
  karsitaraf: 'karsiTaraf',
  kimden: 'karsiTaraf',
  kime: 'karsiTaraf',
  ibanbilgisi: 'ibanBilgisi',
  iban: 'ibanBilgisi',
  kdvdahiltutar: 'kdvDahilTutar',
  tutarkdvdahil: 'kdvDahilTutar',
  dahiltutar: 'kdvDahilTutar',
  tutar: 'tutar',
  kdvharictutar: 'tutar',
  harictutar: 'tutar',
  kdvorani: 'kdvOrani',
  kdv: 'kdvOrani',
  odemeyapanfirma: 'sirketAdi',
  sirket: 'sirketAdi',
  sirketi: 'sirketAdi',
  odeyen: 'sirketAdi',
  yuklenici: 'yuklenici',
  santiye: 'santiyeAdi',
  santiyesi: 'santiyeAdi',
  tur: 'tur',
}

function satiriEslestir(satir: Record<string, any>): Record<string, any> {
  const sonuc: Record<string, any> = {}
  for (const [k, v] of Object.entries(satir)) {
    const norm = normalizeKey(k)
    const alan = ALAN_ESLEME[norm]
    if (alan && v !== undefined && v !== null && String(v).trim() !== '') {
      sonuc[alan] = v
    }
  }
  return sonuc
}

function excelTarihCoz(v: any): Date | null {
  if (v === undefined || v === null || v === '') return null
  if (typeof v === 'number') {
    // Excel seri tarih numarası (1900 tabanlı)
    const ms = Math.round((v - 25569) * 86400 * 1000)
    return new Date(ms)
  }
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

function sayiCoz(v: any): number | null {
  if (v === undefined || v === null || v === '') return null
  if (typeof v === 'number') return v
  const temiz = String(v).replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')
  const n = Number(temiz)
  return isNaN(n) ? null : n
}

export async function POST(req: NextRequest) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const body = await req.json().catch(() => ({}))
  const satirlar: any[] = Array.isArray(body?.satirlar) ? body.satirlar : []
  const varsayilanTur: 'KESILEN' | 'ALINAN' = body?.varsayilanTur === 'KESILEN' ? 'KESILEN' : 'ALINAN'
  const cariEklensinMi = !!body?.cariEklensinMi

  if (satirlar.length === 0) {
    return NextResponse.json({ error: 'Aktarılacak satır bulunamadı' }, { status: 400 })
  }

  const [sirketler, santiyeler] = await Promise.all([
    prisma.sirket.findMany(),
    prisma.santiye.findMany(),
  ])
  const sirketMap = new Map(sirketler.map((s: any) => [normalizeKey(s.ad), s.id]))
  const santiyeMap = new Map(santiyeler.map((s: any) => [normalizeKey(s.ad), s.id]))
  const cariCache = new Map<string, string>()

  let eklenen = 0
  const hatalar: string[] = []

  for (let i = 0; i < satirlar.length; i++) {
    const ham = satirlar[i]
    const s = satiriEslestir(ham)
    const satirNo = i + 2 // Excel'de genelde 1. satır başlık olur

    const tarih = excelTarihCoz(s.tarih)
    if (!tarih) {
      hatalar.push(`Satır ${satirNo}: geçerli bir tarih bulunamadı, atlandı`)
      continue
    }

    const kdvOrani = sayiCoz(s.kdvOrani) ?? 20
    let tutar = sayiCoz(s.tutar)
    let kdvDahilTutar = sayiCoz(s.kdvDahilTutar)
    let kdvTutari: number

    if (tutar === null && kdvDahilTutar !== null) {
      tutar = kdvDahilTutar / (1 + kdvOrani / 100)
      kdvTutari = kdvDahilTutar - tutar
    } else if (tutar !== null && kdvDahilTutar === null) {
      kdvTutari = tutar * (kdvOrani / 100)
      kdvDahilTutar = tutar + kdvTutari
    } else if (tutar !== null && kdvDahilTutar !== null) {
      kdvTutari = kdvDahilTutar - tutar
    } else {
      hatalar.push(`Satır ${satirNo}: tutar bulunamadı, atlandı`)
      continue
    }

    let cariId: string | null = null
    const karsiTarafAdi = s.karsiTaraf ? String(s.karsiTaraf).trim() : null
    if (karsiTarafAdi) {
      const norm = normalizeKey(karsiTarafAdi)
      if (cariCache.has(norm)) {
        cariId = cariCache.get(norm)!
      } else {
        let cari = await prisma.cari.findUnique({ where: { ad: karsiTarafAdi } })
        if (!cari && cariEklensinMi) {
          cari = await prisma.cari.create({
            data: { ad: karsiTarafAdi, ibanBilgisi: s.ibanBilgisi ? String(s.ibanBilgisi).trim() : null },
          })
        }
        if (cari) {
          cariId = cari.id
          cariCache.set(norm, cari.id)
        }
      }
    }

    const sirketId = s.sirketAdi ? sirketMap.get(normalizeKey(String(s.sirketAdi))) ?? null : null
    const santiyeId = s.santiyeAdi ? santiyeMap.get(normalizeKey(String(s.santiyeAdi))) ?? null : null
    const tur = s.tur && normalizeKey(String(s.tur)).includes('kes') ? 'KESILEN' : (s.tur && normalizeKey(String(s.tur)).includes('al') ? 'ALINAN' : varsayilanTur)

    try {
      await prisma.fatura.create({
        data: {
          tur,
          faturaNo: s.faturaNo ? String(s.faturaNo).trim() : null,
          tarih,
          aciklama: s.aciklama ? String(s.aciklama).trim() : null,
          karsiTaraf: karsiTarafAdi,
          tutar,
          kdvOrani,
          kdvTutari,
          kdvDahilTutar,
          odemeDurumu: 'BEKLIYOR',
          sirketId,
          santiyeId,
          odemeTarihi: excelTarihCoz(s.odemeTarihi),
          ibanBilgisi: s.ibanBilgisi ? String(s.ibanBilgisi).trim() : null,
          yuklenici: s.yuklenici ? String(s.yuklenici).trim() : null,
          cariId,
          cariEklensinMi: !!cariId && cariEklensinMi,
        },
      })
      eklenen++
    } catch (e: any) {
      hatalar.push(`Satır ${satirNo}: kaydedilemedi (${e.message ?? 'hata'})`)
    }
  }

  return NextResponse.json({ eklenen, atlanan: satirlar.length - eklenen, hatalar })
}
