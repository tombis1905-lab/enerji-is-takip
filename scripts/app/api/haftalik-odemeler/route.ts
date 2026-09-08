export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { faturaTokenGecerliMi, FATURA_COOKIE_NAME } from '@/lib/fatura-auth'

// Haftalık Ödemeler bölümü Faturalar ile aynı PIN kilidini kullanır (aynı
// ekranın bir sekmesi olduğu için ayrı bir kilit gerekmiyor).
async function guard(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return { ok: false as const, res: NextResponse.json({ error: 'Yetkisiz' }, { status: 403 }) }
  }
  const userId = (session.user as any).id as string
  const token = req.cookies.get(FATURA_COOKIE_NAME)?.value
  if (!faturaTokenGecerliMi(token, userId)) {
    return { ok: false as const, res: NextResponse.json({ error: 'PIN gerekli', code: 'PIN_GEREKLI' }, { status: 401 }) }
  }
  return { ok: true as const }
}

export async function GET(req: NextRequest) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const kalemler = await prisma.haftalikOdeme.findMany({
    include: { sirket: { select: { ad: true } } },
    orderBy: { tarih: 'desc' },
  })
  return NextResponse.json(kalemler)
}

export async function POST(req: NextRequest) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const body = await req.json()
  const { tarih, odemeTarihi, yapilanIs, firma, ibanBilgisi, tutar, yuklenici, sirketId } = body

  if (!tarih) {
    return NextResponse.json({ error: 'Tarih zorunludur' }, { status: 400 })
  }
  if (!yapilanIs?.trim()) {
    return NextResponse.json({ error: 'Yapılan iş açıklaması zorunludur' }, { status: 400 })
  }
  if (!tutar || Number(tutar) <= 0) {
    return NextResponse.json({ error: 'Geçerli bir tutar girin' }, { status: 400 })
  }
  if (!sirketId) {
    return NextResponse.json({ error: 'Ödeme yapan şirket zorunludur' }, { status: 400 })
  }

  try {
    const kalem = await prisma.haftalikOdeme.create({
      data: {
        tarih: new Date(tarih),
        odemeTarihi: odemeTarihi ? new Date(odemeTarihi) : null,
        yapilanIs: yapilanIs.trim(),
        firma: firma?.trim() || null,
        ibanBilgisi: ibanBilgisi?.trim() || null,
        tutar: Number(tutar),
        yuklenici: yuklenici?.trim() || null,
        sirketId,
      },
    })
    return NextResponse.json(kalem, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: 'Hata oluştu' }, { status: 500 })
  }
}
