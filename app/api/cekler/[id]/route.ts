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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const { id } = await params
  const body = await req.json()
  const { tur, cekNo, banka, sube, karsiTaraf, tutar, vadeTarihi, duzenlemeTarihi, durum, sirketId, aciklama } = body

  const data: any = {}
  if (tur !== undefined) data.tur = tur
  if (cekNo !== undefined) data.cekNo = cekNo?.trim() || null
  if (banka !== undefined) data.banka = banka?.trim() || null
  if (sube !== undefined) data.sube = sube?.trim() || null
  if (karsiTaraf !== undefined) data.karsiTaraf = karsiTaraf?.trim() || null
  if (tutar !== undefined) data.tutar = Number(tutar)
  if (vadeTarihi !== undefined) data.vadeTarihi = new Date(vadeTarihi)
  if (duzenlemeTarihi !== undefined) data.duzenlemeTarihi = duzenlemeTarihi ? new Date(duzenlemeTarihi) : null
  if (durum !== undefined) data.durum = durum
  if (sirketId !== undefined) data.sirketId = sirketId || null
  if (aciklama !== undefined) data.aciklama = aciklama?.trim() || null

  try {
    const cek = await prisma.cek.update({ where: { id }, data })
    return NextResponse.json(cek)
  } catch (e: any) {
    return NextResponse.json({ error: 'Hata oluştu' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const { id } = await params
  await prisma.cek.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
