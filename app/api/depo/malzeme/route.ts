export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const malzemeler = await prisma.depoMalzeme.findMany({
    orderBy: { ad: 'asc' },
    include: { _count: { select: { hareketler: true } } },
  })
  return NextResponse.json(malzemeler)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const body = await req.json()
  const { ad, birim, minStok, aciklama, stokMiktari } = body

  if (!ad?.trim() || !birim?.trim()) {
    return NextResponse.json({ error: 'Malzeme adı ve birim zorunludur' }, { status: 400 })
  }

  try {
    const malzeme = await prisma.depoMalzeme.create({
      data: {
        ad: ad.trim(),
        birim: birim.trim(),
        stokMiktari: stokMiktari !== undefined && stokMiktari !== null ? Number(stokMiktari) : 0,
        minStok: minStok !== undefined && minStok !== null && minStok !== '' ? Number(minStok) : null,
        aciklama: aciklama?.trim() || null,
      },
    })
    return NextResponse.json(malzeme, { status: 201 })
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Bu malzeme zaten kayıtlı' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Hata oluştu' }, { status: 500 })
  }
}
