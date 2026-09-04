export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

// Personelin o an açık olan şirket kaydını, yeni bir şirkete geçmeden kapatır
// (tamamen ayrıldı / şu an hiçbir şirkette çalışmıyor anlamına gelir).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const tarih = body?.tarih ? new Date(body.tarih) : new Date()

  const acikKayit = await prisma.personelSirket.findFirst({
    where: { personelId: id, bitisTarihi: null },
  })

  if (!acikKayit) {
    return NextResponse.json({ error: 'Bu personelin şu an açık bir şirket kaydı yok' }, { status: 400 })
  }

  const kapatilan = await prisma.personelSirket.update({
    where: { id: acikKayit.id },
    data: { bitisTarihi: tarih },
    include: { sirket: { select: { ad: true } } },
  })

  return NextResponse.json(kapatilan)
}
