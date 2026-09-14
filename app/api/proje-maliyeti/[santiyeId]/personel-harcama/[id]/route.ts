export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { phTokenGecerliMi, PH_COOKIE_NAME } from '@/lib/personel-harcama-auth'

async function guard(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return { ok: false as const, res: NextResponse.json({ error: 'Yetkisiz' }, { status: 403 }) }
  }
  const userId = (session.user as any).id as string
  const token = req.cookies.get(PH_COOKIE_NAME)?.value
  if (!phTokenGecerliMi(token, userId)) {
    return { ok: false as const, res: NextResponse.json({ error: 'PIN gerekli', code: 'PIN_GEREKLI' }, { status: 401 }) }
  }
  return { ok: true as const }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ santiyeId: string; id: string }> }) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const { santiyeId, id } = await params
  const existing = await prisma.projePersonelHarcama.findUnique({ where: { id } })
  if (!existing || existing.santiyeId !== santiyeId) {
    return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 })
  }

  const body = await req.json()
  const { tarih, personelAdi, bolge, aciklama, tutar } = body

  try {
    const kayit = await prisma.projePersonelHarcama.update({
      where: { id },
      data: {
        ...(tarih !== undefined && { tarih: new Date(tarih) }),
        ...(personelAdi !== undefined && { personelAdi: String(personelAdi).trim() }),
        ...(bolge !== undefined && { bolge: bolge?.trim() || null }),
        ...(aciklama !== undefined && { aciklama: aciklama?.trim() || null }),
        ...(tutar !== undefined && { tutar: Number(tutar) || 0 }),
      },
    })
    return NextResponse.json(kayit)
  } catch {
    return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ santiyeId: string; id: string }> }) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const { santiyeId, id } = await params
  const existing = await prisma.projePersonelHarcama.findUnique({ where: { id } })
  if (!existing || existing.santiyeId !== santiyeId) {
    return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 })
  }

  await prisma.projePersonelHarcama.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
