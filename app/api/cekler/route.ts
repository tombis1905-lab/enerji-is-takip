export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { cekTokenGecerliMi, CEK_COOKIE_NAME } from '@/lib/cek-auth'

async function guard(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return { ok: false as const, res: NextResponse.json({ error: 'Yetkisiz' }, { status: 403 }) }
  }
  const userId = (session.user as any).id as string
  const token = req.cookies.get(CEK_COOKIE_NAME)?.value
  if (!cekTokenGecerliMi(token, userId)) {
    return { ok: false as const, res: NextResponse.json({ error: 'PIN gerekli', code: 'PIN_GEREKLI' }, { status: 401 }) }
  }
  return { ok: true as const }
}

export async function GET(req: NextRequest) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const cekler = await prisma.cek.findMany({
    include: { sirket: { select: { ad: true } } },
    orderBy: { vadeTarihi: 'asc' },
  })
  return NextResponse.json(cekler)
}

export async function POST(req: NextRequest) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const body = await req.json()
  const { tur, cekNo, banka, sube, karsiTaraf, tutar, vadeTarihi, duzenlemeTarihi, durum, sirketId, aciklama } = body

  if (!tur || (tur !== 'ALINAN' && tur !== 'VERILEN')) {
    return NextResponse.json({ error: 'Çek türü (alınan/verilen) zorunludur' }, { status: 400 })
  }
  if (!tutar || Number(tutar) <= 0) {
    return NextResponse.json({ error: 'Geçerli bir tutar girin' }, { status: 400 })
  }
  if (!vadeTarihi) {
    return NextResponse.json({ error: 'Vade tarihi zorunludur' }, { status: 400 })
  }

  try {
    const cek = await prisma.cek.create({
      data: {
        tur,
        cekNo: cekNo?.trim() || null,
        banka: banka?.trim() || null,
        sube: sube?.trim() || null,
        karsiTaraf: karsiTaraf?.trim() || null,
        tutar: Number(tutar),
        vadeTarihi: new Date(vadeTarihi),
        duzenlemeTarihi: duzenlemeTarihi ? new Date(duzenlemeTarihi) : null,
        durum: durum || 'BEKLEMEDE',
        sirketId: sirketId || null,
        aciklama: aciklama?.trim() || null,
      },
    })
    return NextResponse.json(cek, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: 'Hata oluştu' }, { status: 500 })
  }
}
