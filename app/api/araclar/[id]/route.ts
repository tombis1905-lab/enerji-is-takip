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
  const { plaka, isim, marka, model: modelAd, aktif } = body

  try {
    const arac = await prisma.arac.update({
      where: { id },
      data: {
        ...(plaka !== undefined && { plaka: plaka.trim().toUpperCase() }),
        ...(isim !== undefined && { isim: isim?.trim() || null }),
        ...(marka !== undefined && { marka: marka?.trim() || null }),
        ...(modelAd !== undefined && { model: modelAd?.trim() || null }),
        ...(aktif !== undefined && { aktif }),
      },
    })
    return NextResponse.json(arac)
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Bu plaka zaten kayıtlı' }, { status: 409 })
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

  const count = await prisma.akaryakitKaydi.count({ where: { aracId: id } })
  if (count > 0) {
    return NextResponse.json({ error: `Bu araca ait ${count} akaryakıt kaydı var. Önce kayıtları silin.` }, { status: 400 })
  }

  await prisma.arac.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
