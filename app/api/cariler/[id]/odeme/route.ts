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

// Bir carinin kısmi ödeme/tahsilat geçmişi (fatura tutarının hepsi bir kerede
// ödenmemiş/tahsil edilmemiş olabileceği için).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (!g.ok) return g.res
  const { id } = await params
  const odemeler = await prisma.cariOdeme.findMany({ where: { cariId: id }, orderBy: { tarih: 'desc' } })
  return NextResponse.json(odemeler)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (!g.ok) return g.res
  const { id } = await params

  const cari = await prisma.cari.findUnique({ where: { id } })
  if (!cari) return NextResponse.json({ error: 'Cari bulunamadı' }, { status: 404 })

  const body = await req.json()
  const { tarih, tutar, yon, aciklama } = body

  if (!tarih) return NextResponse.json({ error: 'Tarih zorunludur' }, { status: 400 })
  if (!tutar || Number(tutar) <= 0) return NextResponse.json({ error: 'Geçerli bir tutar girin' }, { status: 400 })
  if (yon !== 'TAHSILAT' && yon !== 'ODEME') {
    return NextResponse.json({ error: 'Yön (tahsilat/ödeme) zorunludur' }, { status: 400 })
  }

  const kayit = await prisma.cariOdeme.create({
    data: {
      cariId: id,
      tarih: new Date(tarih),
      tutar: Number(tutar),
      yon,
      aciklama: aciklama?.trim() || null,
    },
  })
  return NextResponse.json(kayit, { status: 201 })
}
