export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hesapGuard, gunParse, sayi } from '@/lib/personel-hesap-guard'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  const g = await hesapGuard(req)
  if (!g.ok) return g.res
  const { id } = await params
  const b = await req.json()
  const data: any = {}
  if (b.tarih !== undefined) data.tarih = gunParse(b.tarih)
  if (b.tur !== undefined) data.tur = String(b.tur)
  if (b.aciklama !== undefined) data.aciklama = b.aciklama ? String(b.aciklama).slice(0, 500) : null
  if (b.hakedilen !== undefined) data.hakedilen = Math.max(0, sayi(b.hakedilen))
  if (b.odenen !== undefined) data.odenen = Math.max(0, sayi(b.odenen))
  if (b.sirket !== undefined) data.sirket = b.sirket ? String(b.sirket) : null
  return NextResponse.json(await prisma.personelHesapHareket.update({ where: { id }, data }))
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const g = await hesapGuard(req)
  if (!g.ok) return g.res
  const { id } = await params
  await prisma.personelHesapHareket.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
