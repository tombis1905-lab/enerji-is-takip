export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const calisanlar = await prisma.calisan.findMany({
    orderBy: { ad: 'asc' },
    include: {
      sirketGecmisi: {
        where: { bitisTarihi: null },
        select: { id: true, baslangicTarihi: true, sirket: { select: { id: true, ad: true } } },
        take: 1,
      },
    },
  })

  const sonuc = calisanlar.map((c) => {
    const { sirketGecmisi, ...rest } = c
    const acik = sirketGecmisi[0]
    return {
      ...rest,
      aktifSirketId: acik?.sirket.id ?? null,
      aktifSirket: acik?.sirket.ad ?? null,
      aktifSirketBaslangic: acik?.baslangicTarihi ?? null,
    }
  })

  return NextResponse.json(sonuc)
}

// Yeni çalışan ekler. Şifre / kullanıcı adı gerekmez. sirketId + baslangicTarihi
// verilirse aynı anda ilk şirket ataması da yapılır.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const body = await req.json()
  const { ad, telefon, aciklama, sirketId, baslangicTarihi } = body

  if (!ad?.trim()) {
    return NextResponse.json({ error: 'Çalışan adı zorunludur' }, { status: 400 })
  }

  try {
    const calisan = await prisma.$transaction(async (tx) => {
      const yeni = await tx.calisan.create({
        data: {
          ad: ad.trim(),
          telefon: telefon?.trim() || null,
          aciklama: aciklama?.trim() || null,
        },
      })

      if (sirketId && baslangicTarihi) {
        await tx.personelSirket.create({
          data: {
            calisanId: yeni.id,
            sirketId,
            baslangicTarihi: new Date(baslangicTarihi),
          },
        })
      }

      return yeni
    })

    return NextResponse.json(calisan, { status: 201 })
  } catch (e: any) {
    if (e.code === 'P2003') {
      return NextResponse.json({ error: 'Geçersiz şirket seçimi' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Hata oluştu' }, { status: 500 })
  }
}
