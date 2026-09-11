export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: Promise<{ santiyeId: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const { santiyeId } = await params
  const santiye = await prisma.santiye.findUnique({ where: { id: santiyeId } })
  if (!santiye) return NextResponse.json({ error: 'Şantiye bulunamadı' }, { status: 404 })

  const body = await req.json()
  const { kalem, uzunluk, genislik, derinlik, gerekliMiktar, kullanilanMiktar, birim, birimFiyat, aciklama } = body

  if (!kalem?.trim() || !birim?.trim()) {
    return NextResponse.json({ error: 'Kalem adı ve birim zorunludur' }, { status: 400 })
  }

  const maxSira = await prisma.projeMalzeme.aggregate({
    where: { santiyeId },
    _max: { siraNo: true },
  })

  const malzeme = await prisma.projeMalzeme.create({
    data: {
      santiyeId,
      kalem: kalem.trim(),
      uzunluk: uzunluk !== undefined && uzunluk !== null && uzunluk !== '' ? Number(uzunluk) : null,
      genislik: genislik !== undefined && genislik !== null && genislik !== '' ? Number(genislik) : null,
      derinlik: derinlik !== undefined && derinlik !== null && derinlik !== '' ? Number(derinlik) : null,
      gerekliMiktar:
        gerekliMiktar !== undefined && gerekliMiktar !== null && gerekliMiktar !== ''
          ? Number(gerekliMiktar)
          : null,
      kullanilanMiktar: kullanilanMiktar ? Number(kullanilanMiktar) : 0,
      birim: birim.trim(),
      birimFiyat: birimFiyat ? Number(birimFiyat) : 0,
      aciklama: aciklama?.trim() || null,
      siraNo: (maxSira._max.siraNo ?? 0) + 1,
    },
  })

  return NextResponse.json(malzeme, { status: 201 })
}
