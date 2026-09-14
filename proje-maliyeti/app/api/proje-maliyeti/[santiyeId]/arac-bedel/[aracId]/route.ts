export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ santiyeId: string; aracId: string }> }
) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const { santiyeId, aracId } = await params

  await prisma.$transaction([
    prisma.projeAracGun.deleteMany({ where: { santiyeId, aracId } }),
    prisma.projeArac.deleteMany({ where: { santiyeId, aracId } }),
  ])

  return NextResponse.json({ success: true })
}
