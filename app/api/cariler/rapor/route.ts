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

// Tom'un eski elle tuttuğu "Piyasa Cari 2026" Excel şablonuna benzer, tek
// seferde her carinin özetini + o cariye ait tüm fatura ve ödeme/tahsilat
// kayıtlarını döner. Excele Aktar butonu bu veriyle Özet Tablo + her cari
// için ayrı bir sayfa oluşturur, N+1 istek atmasın diye tek endpoint'te
// toplanıyor.
export async function GET(req: NextRequest) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const cariler = await prisma.cari.findMany({
    orderBy: { ad: 'asc' },
    include: {
      faturalar: {
        orderBy: { tarih: 'desc' },
        select: {
          tur: true,
          faturaNo: true,
          tarih: true,
          aciklama: true,
          tutar: true,
          kdvDahilTutar: true,
          ibanBilgisi: true,
          odemeDurumu: true,
          cariEklensinMi: true,
          sirket: { select: { ad: true } },
        },
      },
      odemeler: {
        orderBy: { tarih: 'desc' },
        select: { tarih: true, tutar: true, yon: true, odemeSekli: true, aciklama: true },
      },
    },
  })

  const sonuc = cariler.map((c) => {
    // Sadece "cari eklensin mi" işaretli ve Ödendi olmayan faturalar bakiyeye
    // girer — cariler listesindeki (/api/cariler) hesapla aynı mantık.
    const bakiyeFaturalari = c.faturalar.filter((f) => f.cariEklensinMi && f.odemeDurumu !== 'ODENDI')
    const kesilenToplam = bakiyeFaturalari.filter((f) => f.tur === 'KESILEN').reduce((s, f) => s + f.kdvDahilTutar, 0)
    const alinanToplam = bakiyeFaturalari.filter((f) => f.tur === 'ALINAN').reduce((s, f) => s + f.kdvDahilTutar, 0)
    const tahsilatToplam = c.odemeler.filter((o) => o.yon === 'TAHSILAT').reduce((s, o) => s + o.tutar, 0)
    const odemeToplam = c.odemeler.filter((o) => o.yon === 'ODEME').reduce((s, o) => s + o.tutar, 0)
    const netBakiye = (kesilenToplam + odemeToplam) - (alinanToplam + tahsilatToplam)
    const alacak = Math.max(0, netBakiye)
    const borc = Math.max(0, -netBakiye)

    return {
      id: c.id,
      ad: c.ad,
      ibanBilgisi: c.ibanBilgisi,
      aciklama: c.aciklama,
      kesilenToplam,
      alinanToplam,
      tahsilatToplam,
      odemeToplam,
      alacak,
      borc,
      netBakiye,
      faturalar: c.faturalar.map((f) => ({
        tur: f.tur,
        faturaNo: f.faturaNo,
        tarih: f.tarih,
        aciklama: f.aciklama,
        tutar: f.tutar,
        kdvDahilTutar: f.kdvDahilTutar,
        ibanBilgisi: f.ibanBilgisi,
        odemeDurumu: f.odemeDurumu,
        cariEklensinMi: f.cariEklensinMi,
        sirketAd: f.sirket?.ad ?? null,
      })),
      odemeler: c.odemeler,
    }
  })

  return NextResponse.json(sonuc)
}
