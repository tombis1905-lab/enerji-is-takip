export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

// Puantaj benzeri istisna kayıtları: bir personelin varsayılan bölgesinin
// dışında, belirli bir gün başka bir şantiyede çalıştığını tek satırla not
// etmek için. Tüm personel/şantiyeler genelinde tek liste — Personeller
// sayfasındaki "Puantaj" bölümünün veri kaynağı.

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const calisanId = searchParams.get('calisanId')
  const santiyeId = searchParams.get('santiyeId')

  const where: any = {}
  if (calisanId) where.calisanId = calisanId
  if (santiyeId) where.santiyeId = santiyeId

  const kayitlar = await prisma.calisanGunlukKonum.findMany({
    where,
    include: {
      calisan: { select: { id: true, ad: true } },
      santiye: { select: { id: true, ad: true } },
    },
    orderBy: { tarih: 'desc' },
  })

  return NextResponse.json(
    kayitlar.map((k) => ({
      id: k.id,
      tarih: k.tarih,
      aciklama: k.aciklama,
      calisanId: k.calisanId,
      calisanAdi: k.calisan.ad,
      santiyeId: k.santiyeId,
      santiyeAdi: k.santiye.ad,
    })),
  )
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const body = await req.json()
  const { calisanId, tarih, santiyeId, aciklama } = body

  if (!calisanId) return NextResponse.json({ error: 'Personel seçimi zorunludur' }, { status: 400 })
  if (!tarih) return NextResponse.json({ error: 'Tarih zorunludur' }, { status: 400 })
  if (!santiyeId) return NextResponse.json({ error: 'Şantiye seçimi zorunludur' }, { status: 400 })

  const [calisan, santiye] = await Promise.all([
    prisma.calisan.findUnique({ where: { id: calisanId } }),
    prisma.santiye.findUnique({ where: { id: santiyeId } }),
  ])
  if (!calisan) return NextResponse.json({ error: 'Personel bulunamadı' }, { status: 404 })
  if (!santiye) return NextResponse.json({ error: 'Şantiye bulunamadı' }, { status: 404 })

  const kayit = await prisma.calisanGunlukKonum.create({
    data: {
      calisanId,
      tarih: new Date(tarih),
      santiyeId,
      aciklama: aciklama?.trim() || null,
    },
  })

  return NextResponse.json(
    {
      id: kayit.id,
      tarih: kayit.tarih,
      aciklama: kayit.aciklama,
      calisanId: kayit.calisanId,
      calisanAdi: calisan.ad,
      santiyeId: kayit.santiyeId,
      santiyeAdi: santiye.ad,
    },
    { status: 201 },
  )
}
