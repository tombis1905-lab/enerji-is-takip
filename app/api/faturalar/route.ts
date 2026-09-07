export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { faturaTokenGecerliMi, FATURA_COOKIE_NAME } from '@/lib/fatura-auth'

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

function hesaplaKdv(tutar: number, kdvOrani: number, kdvDahilTutarGirisi: number | undefined) {
  if (kdvDahilTutarGirisi !== undefined && kdvDahilTutarGirisi !== null && kdvDahilTutarGirisi !== ('' as any)) {
    const kdvDahilTutar = Number(kdvDahilTutarGirisi)
    const kdvTutari = kdvDahilTutar - tutar
    return { kdvTutari, kdvDahilTutar }
  }
  const kdvTutari = tutar * (kdvOrani / 100)
  return { kdvTutari, kdvDahilTutar: tutar + kdvTutari }
}

export async function GET(req: NextRequest) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const faturalar = await prisma.fatura.findMany({
    include: { sirket: { select: { ad: true } } },
    orderBy: { tarih: 'desc' },
  })
  return NextResponse.json(faturalar)
}

export async function POST(req: NextRequest) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const body = await req.json()
  const {
    tur, faturaNo, tarih, aciklama, karsiTaraf, tutar, kdvOrani,
    kdvDahilTutar, tevkifatTutari, vadeTarihi, odemeDurumu, sirketId,
  } = body

  if (!tur || (tur !== 'KESILEN' && tur !== 'ALINAN')) {
    return NextResponse.json({ error: 'Fatura türü (kestiğimiz/aldığımız) zorunludur' }, { status: 400 })
  }
  if (!tutar || Number(tutar) <= 0) {
    return NextResponse.json({ error: 'Geçerli bir tutar girin' }, { status: 400 })
  }
  if (!tarih) {
    return NextResponse.json({ error: 'Tarih zorunludur' }, { status: 400 })
  }

  const oran = kdvOrani !== undefined && kdvOrani !== '' ? Number(kdvOrani) : 20
  const { kdvTutari, kdvDahilTutar: hesaplananDahil } = hesaplaKdv(Number(tutar), oran, kdvDahilTutar)

  try {
    const fatura = await prisma.fatura.create({
      data: {
        tur,
        faturaNo: faturaNo?.trim() || null,
        tarih: new Date(tarih),
        aciklama: aciklama?.trim() || null,
        karsiTaraf: karsiTaraf?.trim() || null,
        tutar: Number(tutar),
        kdvOrani: oran,
        kdvTutari,
        kdvDahilTutar: hesaplananDahil,
        tevkifatTutari: tevkifatTutari !== undefined && tevkifatTutari !== '' ? Number(tevkifatTutari) : null,
        vadeTarihi: vadeTarihi ? new Date(vadeTarihi) : null,
        odemeDurumu: odemeDurumu || 'BEKLIYOR',
        sirketId: sirketId || null,
      },
    })
    return NextResponse.json(fatura, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: 'Hata oluştu' }, { status: 500 })
  }
}
