export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { ad, birim, minStok, aciklama, aktif } = body

  try {
    const malzeme = await prisma.depoMalzeme.update({
      where: { id },
      data: {
        ...(ad !== undefined && { ad: ad.trim() }),
        ...(birim !== undefined && { birim: birim.trim() }),
        ...(minStok !== undefined && { minStok: minStok === '' || minStok === null ? null : Number(minStok) }),
        ...(aciklama !== undefined && { aciklama: aciklama?.trim() || null }),
        ...(aktif !== undefined && { aktif }),
      },
    })
    return NextResponse.json(malzeme)
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Bu malzeme zaten kayıtlı' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Hata oluştu' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const { id } = await params

  const count = await prisma.depoHareketi.count({ where: { malzemeId: id } })
  if (count > 0) {
    return NextResponse.json({ error: `Bu malzemeye ait ${count} depo hareketi var. Önce hareketleri silin.` }, { status: 400 })
  }

  await prisma.depoMalzeme.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
