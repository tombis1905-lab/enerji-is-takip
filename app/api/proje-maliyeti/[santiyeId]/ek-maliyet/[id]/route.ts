export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { pmTokenGecerliMi, PM_COOKIE_NAME } from '@/lib/proje-maliyeti-auth'

function pmErisimVarMi(req: NextRequest, userId: string) {
  return pmTokenGecerliMi(req.cookies.get(PM_COOKIE_NAME)?.value, userId)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ santiyeId: string; id: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }
  const userId = (session.user as any).id as string
  if (!pmErisimVarMi(req, userId)) {
    return NextResponse.json({ error: 'PIN gerekli', code: 'PIN_GEREKLI' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const { ad, tutar, aciklama, tarih } = body

  const kalem = await prisma.projeEkMaliyet.update({
    where: { id },
    data: {
      ...(ad !== undefined && { ad: String(ad).trim() }),
      ...(tutar !== undefined && { tutar: Number(tutar) }),
      ...(aciklama !== undefined && { aciklama: aciklama?.trim() || null }),
      ...(tarih !== undefined && { tarih: new Date(tarih) }),
    },
  })

  return NextResponse.json(kalem)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ santiyeId: string; id: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }
  const userId = (session.user as any).id as string
  if (!pmErisimVarMi(req, userId)) {
    return NextResponse.json({ error: 'PIN gerekli', code: 'PIN_GEREKLI' }, { status: 401 })
  }

  const { id } = await params
  await prisma.projeEkMaliyet.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
