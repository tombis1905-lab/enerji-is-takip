export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hesapGuard } from '@/lib/personel-hesap-guard'

// Aktif ve anlaşılan maaşı tanımlı herkese seçilen ay için "maaş hakedişi" yazar.
// Aynı ay iki kez işlenirse çoğalmaz.
export async function POST(req: NextRequest) {
  const g = await hesapGuard(req)
  if (!g.ok) return g.res
  const { ay, uygula } = await req.json() // ay: YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(String(ay))) return NextResponse.json({ error: 'Ay geçersiz' }, { status: 400 })
  const baslangic = new Date(`${ay}-01T00:00:00.000Z`)
  const etiket = `${ay} maaş hakedişi`
  const hesaplar = await prisma.personelHesap.findMany({
    where: { aktif: true, maas: { gt: 0 } },
    include: { hareketler: { where: { aciklama: etiket }, select: { id: true } } },
  })
  const uygun = hesaplar.filter((h: any) => {
    if (h.hareketler.length > 0) return false
    if (h.iseBaslama && h.iseBaslama > new Date(baslangic.getTime() + 31 * 86400000)) return false
    if (h.istenCikis && h.istenCikis < baslangic) return false
    return true
  })
  if (uygula && uygun.length) {
    await prisma.personelHesapHareket.createMany({
      data: uygun.map((h: any) => ({ hesapId: h.id, tarih: baslangic, tur: 'MAAS', aciklama: etiket, hakedilen: h.maas, odenen: 0 })),
    })
  }
  return NextResponse.json({
    islenecek: uygun.length,
    toplam: uygun.reduce((t: number, h: any) => t + h.maas, 0),
    zatenVar: hesaplar.length - uygun.length,
    uygulandi: !!uygula,
  })
}
