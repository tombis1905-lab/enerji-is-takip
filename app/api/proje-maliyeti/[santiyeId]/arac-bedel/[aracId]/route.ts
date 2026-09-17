export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { pmTokenGecerliMi, PM_COOKIE_NAME } from '@/lib/proje-maliyeti-auth'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ santiyeId: string; aracId: string }> }
) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }
  if (!pmTokenGecerliMi(req.cookies.get(PM_COOKIE_NAME)?.value, (session.user as any).id)) {
    return NextResponse.json({ error: 'PIN gerekli', code: 'PIN_GEREKLI' }, { status: 401 })
  }

  const { santiyeId, aracId } = await params

  await prisma.$transaction([
    prisma.projeAracGun.deleteMany({ where: { santiyeId, aracId } }),
    prisma.projeArac.deleteMany({ where: { santiyeId, aracId } }),
  ])

  return NextResponse.json({ success: true })
}
