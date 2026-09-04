export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const { id } = await params

  const [gecmisler, sirketler] = await Promise.all([
    prisma.personelSirket.findMany({
      where: { personelId: id },
      include: { sirket: { select: { ad: true } } },
      orderBy: { baslangicTarihi: 'desc' },
    }),
    prisma.sirket.findMany({ where: { aktif: true }, orderBy: { ad: 'asc' } }),
  ])

  return NextResponse.json({ gecmisler, sirketler })
}

// Yeni bir şirkete geçiş kaydı ekler. O personelin hâlâ açık (bitisTarihi boş) bir
// kaydı varsa, yeni geçişin başlangıç tarihiyle otomatik kapatılır.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { sirketId, baslangicTarihi, aciklama } = body

  if (!sirketId || !baslangicTarihi) {
    return NextResponse.json({ error: 'Şirket ve başlangıç tarihi zorunludur' }, { status: 400 })
  }

  try {
    const yeniBaslangic = new Date(baslangicTarihi)

    const result = await prisma.$transaction(async (tx) => {
      const acikKayit = await tx.personelSirket.findFirst({
        where: { personelId: id, bitisTarihi: null },
      })

      if (acikKayit) {
        await tx.personelSirket.update({
          where: { id: acikKayit.id },
          data: { bitisTarihi: yeniBaslangic },
        })
      }

      return tx.personelSirket.create({
        data: {
          personelId: id,
          sirketId,
          baslangicTarihi: yeniBaslangic,
          aciklama: aciklama?.trim() || null,
        },
        include: { sirket: { select: { ad: true } } },
      })
    })

    return NextResponse.json(result, { status: 201 })
  } catch (e: any) {
    if (e.code === 'P2003') {
      return NextResponse.json({ error: 'Geçersiz şirket seçimi' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Hata oluştu' }, { status: 500 })
  }
}
