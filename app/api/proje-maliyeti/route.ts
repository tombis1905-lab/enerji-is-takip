export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { pmTokenGecerliMi, PM_COOKIE_NAME } from '@/lib/proje-maliyeti-auth'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }
  const userId = (session.user as any).id as string
  if (!pmTokenGecerliMi(req.cookies.get(PM_COOKIE_NAME)?.value, userId)) {
    return NextResponse.json({ error: 'PIN gerekli', code: 'PIN_GEREKLI' }, { status: 401 })
  }

  const [santiyeler, akaryakitGruplari, ekMaliyetGruplari] = await Promise.all([
    prisma.santiye.findMany({
      orderBy: { ad: 'asc' },
      include: {
        projeMalzemeleri: true,
        projeAraclar: true,
        projeAracGunleri: true,
        projeMaliyetOzeti: true,
        projePersonelHarcamalari: true,
      },
    }),
    // Şantiyeye etiketlenmiş akaryakıt fişlerinin toplamı — elle girilen
    // akaryakitTutar'ın üstüne otomatik olarak eklenir.
    prisma.akaryakitKaydi.groupBy({
      by: ['santiyeId'],
      where: { santiyeId: { not: null } },
      _sum: { tutar: true },
    }),
    prisma.projeEkMaliyet.groupBy({
      by: ['santiyeId'],
      _sum: { tutar: true },
    }),
  ])
  const ekMaliyetMap = new Map<string, number>()
  for (const g of ekMaliyetGruplari) {
    ekMaliyetMap.set(g.santiyeId, g._sum.tutar ?? 0)
  }
  const akaryakitEtiketliMap = new Map<string, number>()
  for (const g of akaryakitGruplari) {
    if (g.santiyeId) akaryakitEtiketliMap.set(g.santiyeId, g._sum.tutar ?? 0)
  }

  const sonuc = santiyeler.map((s) => {
    const malzemeToplam = s.projeMalzemeleri.reduce(
      (acc, m) => acc + m.kullanilanMiktar * m.birimFiyat,
      0
    )

    const gunSayisi: Record<string, number> = {}
    for (const g of s.projeAracGunleri) {
      if (!g.calisti) continue
      gunSayisi[g.aracId] = (gunSayisi[g.aracId] ?? 0) + 1
    }
    const aracToplam = s.projeAraclar.reduce(
      (acc, a) => acc + (gunSayisi[a.aracId] ?? 0) * a.gunlukBedel,
      0
    )

    const ozet = s.projeMaliyetOzeti
    const nakliyeToplam = ozet ? ozet.seferSayisi * ozet.seferBasiUcret : 0
    const personelHarcamaToplam = s.projePersonelHarcamalari.reduce((acc, h) => acc + h.tutar, 0)
    const personelToplam = (ozet
      ? ozet.personelSayisi * ozet.calisilanGun * ozet.gunlukUcret + ozet.digerHarcamalar
      : 0) + personelHarcamaToplam
    const akaryakitEtiketliToplam = akaryakitEtiketliMap.get(s.id) ?? 0
    const akaryakitToplam = (ozet ? ozet.akaryakitTutar : 0) + akaryakitEtiketliToplam
    const ekMaliyetToplam = ekMaliyetMap.get(s.id) ?? 0
    const gelir = ozet?.gelir ?? 0

    const toplamGider = malzemeToplam + aracToplam + nakliyeToplam + personelToplam + akaryakitToplam + ekMaliyetToplam
    const netKarZarar = gelir - toplamGider

    return {
      id: s.id,
      ad: s.ad,
      konum: s.konum,
      aktif: s.aktif,
      kategori: s.kategori,
      malzemeToplam,
      aracToplam,
      nakliyeToplam,
      personelToplam,
      akaryakitToplam,
      ekMaliyetToplam,
      toplamGider,
      gelir,
      netKarZarar,
    }
  })

  return NextResponse.json(sonuc)
}
