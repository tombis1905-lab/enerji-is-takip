export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const aracId = searchParams.get('aracId')
  const ay = searchParams.get('ay') // YYYY-MM format
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')

  const where: any = {}
  if (aracId) where.aracId = aracId
  if (ay) {
    const [yil, ayNo] = ay.split('-').map(Number)
    where.tarih = {
      gte: new Date(yil, ayNo - 1, 1),
      lt: new Date(yil, ayNo, 1),
    }
  }

  const [kayitlar, total] = await Promise.all([
    prisma.akaryakitKaydi.findMany({
      where,
      include: {
        arac: { select: { plaka: true, isim: true, marka: true, model: true } },
        user: { select: { name: true } },
      },
      orderBy: { tarih: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.akaryakitKaydi.count({ where }),
  ])

  // Aylık özet: araç bazlı toplam
  const aracOzet = await prisma.akaryakitKaydi.groupBy({
    by: ['aracId'],
    where,
    _sum: { tutar: true },
    _count: true,
  })

  const genelToplam = aracOzet.reduce((t: number, a: any) => t + (a._sum.tutar || 0), 0)

  return NextResponse.json({
    kayitlar,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    aracOzet,
    genelToplam,
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await req.json()
  const { tarih, tutar, fisNo, aciklama, aracId } = body

  if (!tarih || tutar === undefined || tutar === null || !aracId) {
    return NextResponse.json({ error: 'Tarih, tutar ve araç zorunludur' }, { status: 400 })
  }

  if (Number(tutar) <= 0) {
    return NextResponse.json({ error: 'Tutar sıfırdan büyük olmalıdır' }, { status: 400 })
  }

  try {
    const kayit = await prisma.akaryakitKaydi.create({
      data: {
        tarih: new Date(tarih),
        tutar: Number(tutar),
        fisNo: fisNo?.trim() || null,
        aciklama: aciklama?.trim() || null,
        aracId,
        userId: (session.user as any).id,
      },
      include: {
        arac: { select: { plaka: true, isim: true } },
        user: { select: { name: true } },
      },
    })
    return NextResponse.json(kayit, { status: 201 })
  } catch (e: any) {
    if (e.code === 'P2003') {
      return NextResponse.json({ error: 'Geçersiz araç seçimi' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Hata oluştu' }, { status: 500 })
  }
}
