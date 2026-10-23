export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hesapGuard, gunParse, sayi } from '@/lib/personel-hesap-guard'

export async function POST(req: NextRequest) {
  const g = await hesapGuard(req)
  if (!g.ok) return g.res
  const b = await req.json()
  if (!b.hesapId) return NextResponse.json({ error: 'hesapId zorunlu' }, { status: 400 })
  const hakedilen = Math.max(0, sayi(b.hakedilen))
  const odenen = Math.max(0, sayi(b.odenen))
  if (hakedilen === 0 && odenen === 0) return NextResponse.json({ error: 'Tutar giriniz' }, { status: 400 })
  const h = await prisma.personelHesapHareket.create({
    data: {
      hesapId: String(b.hesapId),
      tarih: gunParse(b.tarih),
      tur: String(b.tur || 'DIGER'),
      aciklama: b.aciklama ? String(b.aciklama).slice(0, 500) : null,
      hakedilen, odenen,
      sirket: b.sirket ? String(b.sirket) : null,
    },
  })
  return NextResponse.json(h, { status: 201 })
}
