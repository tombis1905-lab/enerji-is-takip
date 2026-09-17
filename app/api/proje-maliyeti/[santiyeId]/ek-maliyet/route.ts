export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { pmTokenGecerliMi, PM_COOKIE_NAME } from '@/lib/proje-maliyeti-auth'

function pmErisimVarMi(req: NextRequest, userId: string) {
  return pmTokenGecerliMi(req.cookies.get(PM_COOKIE_NAME)?.value, userId)
}

// Tom'un Proje Maliyeti'ne kendi eklediği serbest/ekstra maliyet kalemleri
// (malzeme/araç/nakliye/personel/akaryakıt kategorilerine girmeyen her türlü
// ek gider — ör. izin harcı, keşif bedeli, ceza vb.)
export async function POST(req: NextRequest, { params }: { params: Promise<{ santiyeId: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }
  const userId = (session.user as any).id as string
  if (!pmErisimVarMi(req, userId)) {
    return NextResponse.json({ error: 'PIN gerekli', code: 'PIN_GEREKLI' }, { status: 401 })
  }

  const { santiyeId } = await params
  const santiye = await prisma.santiye.findUnique({ where: { id: santiyeId } })
  if (!santiye) return NextResponse.json({ error: 'Şantiye bulunamadı' }, { status: 404 })

  const body = await req.json()
  const { ad, tutar, aciklama, tarih } = body

  if (!ad?.trim()) {
    return NextResponse.json({ error: 'Kalem adı zorunludur' }, { status: 400 })
  }

  const kalem = await prisma.projeEkMaliyet.create({
    data: {
      santiyeId,
      ad: ad.trim(),
      tutar: tutar ? Number(tutar) : 0,
      aciklama: aciklama?.trim() || null,
      tarih: tarih ? new Date(tarih) : new Date(),
    },
  })

  return NextResponse.json(kalem, { status: 201 })
}
