export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hesapGuard, gunParse, sayi } from '@/lib/personel-hesap-guard'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const g = await hesapGuard(req)
  if (!g.ok) return g.res
  const { id } = await params
  const h = await prisma.personelHesap.findUnique({
    where: { id },
    include: { hareketler: { orderBy: [{ tarih: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }] } },
  })
  if (!h) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 })
  return NextResponse.json(h)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const g = await hesapGuard(req)
  if (!g.ok) return g.res
  const { id } = await params
  const b = await req.json()
  const data: any = {}
  if (b.ad !== undefined) data.ad = String(b.ad).trim()
  if (b.maas !== undefined) data.maas = b.maas === '' || b.maas === null ? null : sayi(b.maas)
  if (b.iseBaslama !== undefined) data.iseBaslama = gunParse(b.iseBaslama)
  if (b.istenCikis !== undefined) data.istenCikis = gunParse(b.istenCikis)
  if (b.notlar !== undefined) data.notlar = b.notlar ? String(b.notlar) : null
  if (b.aktif !== undefined) data.aktif = !!b.aktif
  try {
    return NextResponse.json(await prisma.personelHesap.update({ where: { id }, data }))
  } catch {
    return NextResponse.json({ error: 'Güncellenemedi (aynı isim olabilir)' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const g = await hesapGuard(req)
  if (!g.ok) return g.res
  const { id } = await params
  await prisma.personelHesap.delete({ where: { id } }) // hareketler cascade
  return NextResponse.json({ success: true })
}
