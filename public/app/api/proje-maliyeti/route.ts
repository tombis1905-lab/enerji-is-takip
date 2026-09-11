export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const santiyeler = await prisma.santiye.findMany({
    orderBy: { ad: 'asc' },
    include: {
      projeMalzemeleri: true,
      projeAraclar: true,
      projeAracGunleri: true,
      projeMaliyetOzeti: true,
    },
  })

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
    const personelToplam = ozet
      ? ozet.personelSayisi * ozet.calisilanGun * ozet.gunlukUcret + ozet.digerHarcamalar
      : 0
    const akaryakitToplam = ozet ? ozet.akaryakitLitre * ozet.akaryakitBirimFiyat : 0
    const gelir = ozet?.gelir ?? 0

    const toplamGider = malzemeToplam + aracToplam + nakliyeToplam + personelToplam + akaryakitToplam
    const netKarZarar = gelir - toplamGider

    return {
      id: s.id,
      ad: s.ad,
      konum: s.konum,
      aktif: s.aktif,
      malzemeToplam,
      aracToplam,
      nakliyeToplam,
      personelToplam,
      akaryakitToplam,
      toplamGider,
      gelir,
      netKarZarar,
    }
  })

  return NextResponse.json(sonuc)
}
