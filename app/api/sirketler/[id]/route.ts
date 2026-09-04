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

  const count = await prisma.personelSirket.count({ where: { sirketId: id } })
  if (count > 0) {
    return NextResponse.json({ error: `Bu şirkete ait ${count} personel geçmişi kaydı var. Önce onları silin.` }, { status: 400 })
  }

  await prisma.sirket.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
