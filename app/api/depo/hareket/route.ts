export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const malzemeId = searchParams.get('malzemeId')
  const tip = searchParams.get('tip') // GIRIS | CIKIS
  const ay = searchParams.get('ay') // YYYY-MM format
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')

  const where: any = {}
  if (malzemeId) where.malzemeId = malzemeId
  if (tip === 'GIRIS' || tip === 'CIKIS') where.tip = tip
  if (ay) {
    const [yil, ayNo] = ay.split('-').map(Number)
    where.tarih = {
      gte: new Date(yil, ayNo - 1, 1),
      lt: new Date(yil, ayNo, 1),
    }
  }

  const [hareketler, total] = await Promise.all([
    prisma.depoHareketi.findMany({
      where,
      include: {
        malzeme: { select: { ad: true, birim: true } },
        user: { select: { name: true } },
      },
      orderBy: { tarih: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.depoHareketi.count({ where }),
  ])

  return NextResponse.json({
    hareketler,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await req.json()
  const { tarih, tip, miktar, aciklama, malzemeId } = body

  if (!tarih || !tip || miktar === undefined || miktar === null || !malzemeId) {
    return NextResponse.json({ error: 'Tarih, tip, miktar ve malzeme zorunludur' }, { status: 400 })
  }
  if (tip !== 'GIRIS' && tip !== 'CIKIS') {
    return NextResponse.json({ error: 'Geçersiz hareket tipi' }, { status: 400 })
  }
  if (Number(miktar) <= 0) {
    return NextResponse.json({ error: 'Miktar sıfırdan büyük olmalıdır' }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const malzeme = await tx.depoMalzeme.findUnique({ where: { id: malzemeId } })
      if (!malzeme) throw new Error('MALZEME_YOK')

      if (tip === 'CIKIS' && malzeme.stokMiktari - Number(miktar) < 0) {
        throw new Error('YETERSIZ_STOK')
      }

      const hareket = await tx.depoHareketi.create({
        data: {
          tarih: new Date(tarih),
          tip,
          miktar: Number(miktar),
          aciklama: aciklama?.trim() || null,
          malzemeId,
          userId: (session.user as any).id,
        },
        include: {
          malzeme: { select: { ad: true, birim: true } },
          user: { select: { name: true } },
        },
      })

      await tx.depoMalzeme.update({
        where: { id: malzemeId },
        data: {
          stokMiktari: tip === 'GIRIS' ? malzeme.stokMiktari + Number(miktar) : malzeme.stokMiktari - Number(miktar),
        },
      })

      return hareket
    })

    return NextResponse.json(result, { status: 201 })
  } catch (e: any) {
    if (e.message === 'MALZEME_YOK') {
      return NextResponse.json({ error: 'Geçersiz malzeme seçimi' }, { status: 400 })
    }
    if (e.message === 'YETERSIZ_STOK') {
      return NextResponse.json({ error: 'Yetersiz stok: bu kadar çıkış yapılamaz' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Hata oluştu' }, { status: 500 })
  }
}
