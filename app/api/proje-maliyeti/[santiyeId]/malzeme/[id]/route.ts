export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ santiyeId: string; id: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const { santiyeId, id } = await params
  const existing = await prisma.projeMalzeme.findUnique({ where: { id } })
  if (!existing || existing.santiyeId !== santiyeId) {
    return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 })
  }

  const body = await req.json()
  const { kalem, uzunluk, genislik, derinlik, gerekliMiktar, kullanilanMiktar, birim, birimFiyat, aciklama } = body

  try {
    const malzeme = await prisma.projeMalzeme.update({
      where: { id },
      data: {
        ...(kalem !== undefined && { kalem: kalem.trim() }),
        ...(uzunluk !== undefined && { uzunluk: uzunluk === '' || uzunluk === null ? null : Number(uzunluk) }),
        ...(genislik !== undefined && { genislik: genislik === '' || genislik === null ? null : Number(genislik) }),
        ...(derinlik !== undefined && { derinlik: derinlik === '' || derinlik === null ? null : Number(derinlik) }),
        ...(gerekliMiktar !== undefined && {
          gerekliMiktar: gerekliMiktar === '' || gerekliMiktar === null ? null : Number(gerekliMiktar),
        }),
        ...(kullanilanMiktar !== undefined && { kullanilanMiktar: Number(kullanilanMiktar) || 0 }),
        ...(birim !== undefined && { birim: birim.trim() }),
        ...(birimFiyat !== undefined && { birimFiyat: Number(birimFiyat) || 0 }),
        ...(aciklama !== undefined && { aciklama: aciklama?.trim() || null }),
      },
    })
    return NextResponse.json(malzeme)
  } catch {
    return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ santiyeId: string; id: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const { santiyeId, id } = await params
  const existing = await prisma.projeMalzeme.findUnique({ where: { id } })
  if (!existing || existing.santiyeId !== santiyeId) {
    return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 })
  }

  await prisma.projeMalzeme.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
