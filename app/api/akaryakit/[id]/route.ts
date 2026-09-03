export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const { id } = await params
  await prisma.akaryakitKaydi.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { tarih, tutar, fisNo, aciklama, aracId } = body

  const kayit = await prisma.akaryakitKaydi.update({
    where: { id },
    data: {
      ...(tarih && { tarih: new Date(tarih) }),
      ...(tutar !== undefined && { tutar: Number(tutar) }),
      ...(fisNo !== undefined && { fisNo: fisNo?.trim() || null }),
      ...(aciklama !== undefined && { aciklama: aciklama?.trim() || null }),
      ...(aracId && { aracId }),
    },
    include: {
      arac: { select: { plaka: true } },
      user: { select: { name: true } },
    },
  })

  return NextResponse.json(kayit)
}
