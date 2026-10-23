export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

// Ana sayfa uyarısı: sigorta / muayene / kasko bitişi 30 gün içinde olan
// (veya süresi geçmiş) aktif araçlar. Tutar/ceza gibi detay döndürmez.
export async function GET() {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }
  const araclar = await prisma.arac.findMany({
    where: { aktif: true, NOT: { plaka: 'MİSAFİR ARAÇ' } },
    select: { id: true, plaka: true, isim: true, sigortaBitisTarihi: true, muayeneBitisTarihi: true, kaskoBitisTarihi: true },
  })
  const bugun = new Date()
  bugun.setUTCHours(0, 0, 0, 0)
  const gunFarki = (d: Date) => Math.round((d.getTime() - bugun.getTime()) / 86400000)
  const sonuc: { id: string; plaka: string; isim: string | null; tur: string; bitis: string; gunKaldi: number }[] = []
  for (const a of araclar as any[]) {
    for (const [tur, d] of [['Sigorta', a.sigortaBitisTarihi], ['Muayene', a.muayeneBitisTarihi], ['Kasko', a.kaskoBitisTarihi]] as const) {
      if (!d) continue
      const g = gunFarki(new Date(d))
      if (g <= 30) sonuc.push({ id: a.id, plaka: a.plaka, isim: a.isim, tur, bitis: new Date(d).toISOString().slice(0, 10), gunKaldi: g })
    }
  }
  sonuc.sort((x, y) => x.gunKaldi - y.gunKaldi)
  return NextResponse.json(sonuc)
}
