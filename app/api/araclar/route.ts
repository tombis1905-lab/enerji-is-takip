export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const araclar = await prisma.arac.findMany({
    orderBy: { plaka: 'asc' },
    include: { _count: { select: { akaryakitKayitlari: true } } },
  })
  return NextResponse.json(araclar)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const body = await req.json()
  const { plaka, isim, marka, model: modelAd, sigortaBitisTarihi, muayeneBitisTarihi } = body

  if (!plaka?.trim()) {
    return NextResponse.json({ error: 'Plaka zorunludur' }, { status: 400 })
  }

  try {
    const arac = await prisma.arac.create({
      data: {
        plaka: plaka.trim().toUpperCase(),
        isim: isim?.trim() || null,
        marka: marka?.trim() || null,
        model: modelAd?.trim() || null,
        sigortaBitisTarihi: sigortaBitisTarihi ? new Date(sigortaBitisTarihi) : null,
        muayeneBitisTarihi: muayeneBitisTarihi ? new Date(muayeneBitisTarihi) : null,
      },
    })
    return NextResponse.json(arac, { status: 201 })
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Bu plaka zaten kayıtlı' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Hata oluştu' }, { status: 500 })
  }
}
