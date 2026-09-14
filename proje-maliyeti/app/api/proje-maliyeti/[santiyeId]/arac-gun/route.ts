export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

// Body: { tarih: 'YYYY-MM-DD', calisanAracIdler: string[] }
// O tarih için, bu şantiyede takip edilen HER araca bir kayıt yazılır:
// calisanAracIdler içindeyse calisti=true, değilse calisti=false.
export async function POST(req: NextRequest, { params }: { params: Promise<{ santiyeId: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const { santiyeId } = await params
  const body = await req.json()
  const { tarih, calisanAracIdler } = body

  if (!tarih) return NextResponse.json({ error: 'Tarih zorunludur' }, { status: 400 })
  const tarihDate = new Date(tarih)
  if (Number.isNaN(tarihDate.getTime())) {
    return NextResponse.json({ error: 'Geçersiz tarih' }, { status: 400 })
  }

  const takipEdilenler = await prisma.projeArac.findMany({ where: { santiyeId } })
  if (takipEdilenler.length === 0) {
    return NextResponse.json({ error: 'Önce bu şantiyede takip edilecek araçları ekleyin' }, { status: 400 })
  }

  const calisanSet = new Set<string>(Array.isArray(calisanAracIdler) ? calisanAracIdler : [])

  await prisma.$transaction(
    takipEdilenler.map((pa) =>
      prisma.projeAracGun.upsert({
        where: { santiyeId_aracId_tarih: { santiyeId, aracId: pa.aracId, tarih: tarihDate } },
        update: { calisti: calisanSet.has(pa.aracId) },
        create: { santiyeId, aracId: pa.aracId, tarih: tarihDate, calisti: calisanSet.has(pa.aracId) },
      })
    )
  )

  return NextResponse.json({ success: true })
}

// Query: ?tarih=YYYY-MM-DD — o güne ait tüm araç kayıtlarını siler.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ santiyeId: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const { santiyeId } = await params
  const tarih = req.nextUrl.searchParams.get('tarih')
  if (!tarih) return NextResponse.json({ error: 'Tarih zorunludur' }, { status: 400 })
  const tarihDate = new Date(tarih)
  if (Number.isNaN(tarihDate.getTime())) {
    return NextResponse.json({ error: 'Geçersiz tarih' }, { status: 400 })
  }

  await prisma.projeAracGun.deleteMany({ where: { santiyeId, tarih: tarihDate } })
  return NextResponse.json({ success: true })
}
