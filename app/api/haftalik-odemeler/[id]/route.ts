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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const { id } = await params
  const body = await req.json()
  const { tarih, odemeTarihi, yapilanIs, firma, ibanBilgisi, tutar, yuklenici, sirketId } = body

  const data: any = {}
  if (tarih !== undefined) data.tarih = new Date(tarih)
  if (odemeTarihi !== undefined) data.odemeTarihi = odemeTarihi ? new Date(odemeTarihi) : null
  if (yapilanIs !== undefined) data.yapilanIs = yapilanIs.trim()
  if (firma !== undefined) data.firma = firma?.trim() || null
  if (ibanBilgisi !== undefined) data.ibanBilgisi = ibanBilgisi?.trim() || null
  if (tutar !== undefined) data.tutar = Number(tutar)
  if (yuklenici !== undefined) data.yuklenici = yuklenici?.trim() || null
  if (sirketId !== undefined) data.sirketId = sirketId

  try {
    const kalem = await prisma.haftalikOdeme.update({ where: { id }, data })
    return NextResponse.json(kalem)
  } catch (e: any) {
    return NextResponse.json({ error: 'Hata oluştu' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const { id } = await params
  await prisma.haftalikOdeme.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
