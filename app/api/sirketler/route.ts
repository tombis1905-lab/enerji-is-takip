export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const sirketler = await prisma.sirket.findMany({
    orderBy: { ad: 'asc' },
  })
  return NextResponse.json(sirketler)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const body = await req.json()
  const { ad } = body

  if (!ad?.trim()) {
    return NextResponse.json({ error: 'Şirket adı zorunludur' }, { status: 400 })
  }

  try {
    const sirket = await prisma.sirket.create({
      data: { ad: ad.trim().toUpperCase() },
    })
    return NextResponse.json(sirket, { status: 201 })
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Bu şirket zaten kayıtlı' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Hata oluştu' }, { status: 500 })
  }
}
