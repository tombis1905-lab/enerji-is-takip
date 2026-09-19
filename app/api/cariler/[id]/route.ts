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
  const { ad, ibanBilgisi, aciklama } = body

  const data: any = {}
  if (ad !== undefined) data.ad = String(ad).trim()
  if (ibanBilgisi !== undefined) data.ibanBilgisi = ibanBilgisi?.trim() || null
  if (aciklama !== undefined) data.aciklama = aciklama?.trim() || null

  try {
    const cari = await prisma.cari.update({ where: { id }, data })
    return NextResponse.json(cari)
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Bu isimde bir cari zaten var' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const { id } = await params
  const faturaSayisi = await prisma.fatura.count({ where: { cariId: id } })
  if (faturaSayisi > 0) {
    return NextResponse.json({ error: 'Bu cariye bağlı faturalar var, önce onları başka bir cariye taşıyın veya cari bağlantısını kaldırın' }, { status: 400 })
  }
  await prisma.cariOdeme.deleteMany({ where: { cariId: id } })
  await prisma.cari.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
