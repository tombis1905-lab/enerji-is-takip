export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return null
  }
  return session
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ santiyeId: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const { santiyeId } = await params

  const santiye = await prisma.santiye.findUnique({ where: { id: santiyeId } })
  if (!santiye) return NextResponse.json({ error: 'Şantiye bulunamadı' }, { status: 404 })

  const [malzemeler, projeAraclar, aracGunleri, ozet] = await Promise.all([
    prisma.projeMalzeme.findMany({
      where: { santiyeId },
      orderBy: [{ siraNo: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.projeArac.findMany({
      where: { santiyeId },
      include: { arac: { select: { id: true, plaka: true, isim: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.projeAracGun.findMany({
      where: { santiyeId },
      orderBy: { tarih: 'desc' },
    }),
    prisma.projeMaliyetOzet.findUnique({ where: { santiyeId } }),
  ])

  const toplamGunPerArac: Record<string, number> = {}
  for (const g of aracGunleri) {
    if (!g.calisti) continue
    toplamGunPerArac[g.aracId] = (toplamGunPerArac[g.aracId] ?? 0) + 1
  }

  // Günlere göre grupla: her tarih için hangi araçlar çalıştı
  const gunlukMap = new Map<string, { tarih: string; aracIdler: string[] }>()
  for (const g of aracGunleri) {
    if (!g.calisti) continue
    const key = g.tarih.toISOString().slice(0, 10)
    if (!gunlukMap.has(key)) gunlukMap.set(key, { tarih: key, aracIdler: [] })
    gunlukMap.get(key)!.aracIdler.push(g.aracId)
  }
  const gunlukTakip = Array.from(gunlukMap.values()).sort((a, b) => (a.tarih < b.tarih ? 1 : -1))

  return NextResponse.json({
    santiye: { id: santiye.id, ad: santiye.ad, konum: santiye.konum },
    malzemeler,
    araclar: projeAraclar.map((a) => ({
      id: a.id,
      aracId: a.aracId,
      plaka: a.arac.plaka,
      isim: a.arac.isim,
      gunlukBedel: a.gunlukBedel,
      toplamGun: toplamGunPerArac[a.aracId] ?? 0,
    })),
    gunlukTakip,
    ozet: ozet ?? {
      gelir: 0,
      seferSayisi: 0,
      seferBasiUcret: 0,
      personelSayisi: 0,
      calisilanGun: 0,
      gunlukUcret: 0,
      digerHarcamalar: 0,
      akaryakitLitre: 0,
      akaryakitBirimFiyat: 0,
    },
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ santiyeId: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const { santiyeId } = await params
  const santiye = await prisma.santiye.findUnique({ where: { id: santiyeId } })
  if (!santiye) return NextResponse.json({ error: 'Şantiye bulunamadı' }, { status: 404 })

  const body = await req.json()
  const fields = [
    'gelir',
    'seferSayisi',
    'seferBasiUcret',
    'personelSayisi',
    'calisilanGun',
    'gunlukUcret',
    'digerHarcamalar',
    'akaryakitLitre',
    'akaryakitBirimFiyat',
  ] as const

  const data: Record<string, number> = {}
  for (const f of fields) {
    if (body[f] !== undefined && body[f] !== null && body[f] !== '') {
      data[f] = Number(body[f])
      if (Number.isNaN(data[f])) {
        return NextResponse.json({ error: `Geçersiz değer: ${f}` }, { status: 400 })
      }
    }
  }

  const ozet = await prisma.projeMaliyetOzet.upsert({
    where: { santiyeId },
    update: data,
    create: {
      santiyeId,
      gelir: 0,
      seferSayisi: 0,
      seferBasiUcret: 0,
      personelSayisi: 0,
      calisilanGun: 0,
      gunlukUcret: 0,
      digerHarcamalar: 0,
      akaryakitLitre: 0,
      akaryakitBirimFiyat: 0,
      ...data,
    },
  })

  return NextResponse.json(ozet)
}
