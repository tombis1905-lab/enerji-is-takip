export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

// Bir aracı bu şantiyede takibe al / günlük bedelini güncelle.
export async function POST(req: NextRequest, { params }: { params: Promise<{ santiyeId: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const { santiyeId } = await params
  const santiye = await prisma.santiye.findUnique({ where: { id: santiyeId } })
  if (!santiye) return NextResponse.json({ error: 'Şantiye bulunamadı' }, { status: 404 })

  const body = await req.json()
  const { aracId, gunlukBedel } = body
  if (!aracId) return NextResponse.json({ error: 'Araç seçimi zorunludur' }, { status: 400 })

  const arac = await prisma.arac.findUnique({ where: { id: aracId } })
  if (!arac) return NextResponse.json({ error: 'Araç bulunamadı' }, { status: 404 })

  const projeArac = await prisma.projeArac.upsert({
    where: { santiyeId_aracId: { santiyeId, aracId } },
    update: { gunlukBedel: gunlukBedel !== undefined ? Number(gunlukBedel) || 0 : undefined },
    create: { santiyeId, aracId, gunlukBedel: gunlukBedel ? Number(gunlukBedel) : 0 },
  })

  return NextResponse.json(projeArac, { status: 201 })
}
