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
  tarih: string | null
  tutar: number
  durum: string
  sonOdemeTarihi: string | null
}

// Tom'un "hesap hareketleri" ile eşleştirerek hazırladığı CARİ_HESAPLAR
// raporundaki "ne zaman ödendi" bilgisini, uygulamada zaten var olan ALINAN
// faturalara geri işler. Cari adı + tutar eşleşmesiyle en uygun faturayı
// bulur; sadece "Ödendi" (tamamen ödenmiş) satırları işler, "Kısmen ödendi"
// ve "ÖDENMEDİ" satırlarına dokunmaz (bunlar sadece bilgi amaçlı rapora
// yazılır). uygula=false iken hiçbir şey yazılmaz, sadece önizleme raporu
// döner.
export async function POST(req: NextRequest) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const body = await req.json()
  const satirlar: GelenSatir[] = Array.isArray(body?.satirlar) ? body.satirlar : []
  const uygula = !!body?.uygula

  const cariCache = new Map<string, { id: string } | null>()
  const kullanilanFaturaId = new Set<string>()

  let guncellenen = 0
  let zatenOdendi = 0
  let kismenOdendi = 0
  let odenmedi = 0
  const cariBulunamadi: Record<string, number> = {}
  const faturaBulunamadi: { cariAd: string; tarih: string | null; tutar: number }[] = []
  const guncellemeler: { id: string; odemeTarihi: string }[] = []

  for (const s of satirlar) {
    const cariAd = (s.cariAd || '').trim()
    if (!cariAd) continue

    if (!cariCache.has(cariAd)) {
      const c = await prisma.cari.findFirst({
        where: { ad: { equals: cariAd, mode: 'insensitive' } },
        select: { id: true },
      })
      cariCache.set(cariAd, c)
    }
    const cari = cariCache.get(cariAd)
    if (!cari) {
      cariBulunamadi[cariAd] = (cariBulunamadi[cariAd] || 0) + 1
      continue
    }

    if (s.durum !== 'Ödendi') {
      if (s.durum?.startsWith('Kısmen')) kismenOdendi++
      else odenmedi++
      continue
    }
    if (!s.sonOdemeTarihi) {
      faturaBulunamadi.push({ cariAd, tarih: s.tarih, tutar: s.tutar })
      continue
    }

    type FaturaAday = { id: string; kdvDahilTutar: number; tarih: Date; odemeDurumu: string }
    const adaylar: FaturaAday[] = await prisma.fatura.findMany({
      where: { cariId: cari.id, tur: 'ALINAN' },
      select: { id: true, kdvDahilTutar: true, tarih: true, odemeDurumu: true },
    })
    const uygunlar = adaylar.filter(
      (f: FaturaAday) => !kullanilanFaturaId.has(f.id) && Math.abs(f.kdvDahilTutar - s.tutar) < 1
    )
    if (uygunlar.length === 0) {
      faturaBulunamadi.push({ cariAd, tarih: s.tarih, tutar: s.tutar })
      continue
    }

    let secilen = uygunlar[0]
    if (s.tarih) {
      const hedef = new Date(s.tarih).getTime()
      secilen = uygunlar.reduce((best: FaturaAday, f: FaturaAday) => {
        const d1 = Math.abs(new Date(f.tarih).getTime() - hedef)
        const d0 = Math.abs(new Date(best.tarih).getTime() - hedef)
        return d1 < d0 ? f : best
      }, uygunlar[0])
    }
    kullanilanFaturaId.add(secilen.id)

    if (secilen.odemeDurumu === 'ODENDI') {
      zatenOdendi++
      continue
    }

    guncellenen++
    guncellemeler.push({ id: secilen.id, odemeTarihi: s.sonOdemeTarihi })
  }

  if (uygula && guncellemeler.length > 0) {
    await prisma.$transaction(
      guncellemeler.map((g) =>
        prisma.fatura.update({
          where: { id: g.id },
          data: { odemeDurumu: 'ODENDI', odemeTarihi: new Date(g.odemeTarihi) },
        })
      )
    )
  }

  return NextResponse.json({
    toplamSatir: satirlar.length,
    guncellenen,
    zatenOdendi,
    kismenOdendi,
    odenmedi,
    cariBulunamadi,
    faturaBulunamadiSayisi: faturaBulunamadi.length,
    faturaBulunamadiOrnek: faturaBulunamadi.slice(0, 30),
    uygulandiMi: uygula,
  })
}
