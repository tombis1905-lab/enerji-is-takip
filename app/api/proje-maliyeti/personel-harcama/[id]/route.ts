export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { phTokenGecerliMi, PH_COOKIE_NAME } from '@/lib/personel-harcama-auth'

async function guard(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return { ok: false as const, res: NextResponse.json({ error: 'Yetkisiz' }, { status: 403 }) }
  }
  const userId = (session.user as any).id as string
  const token = req.cookies.get(PH_COOKIE_NAME)?.value
  if (!phTokenGecerliMi(token, userId)) {
    return { ok: false as const, res: NextResponse.json({ error: 'PIN gerekli', code: 'PIN_GEREKLI' }, { status: 401 }) }
  }
  return { ok: true as const }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const { id } = await params
  const existing = await prisma.projePersonelHarcama.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 })

  const body = await req.json()
  const { tarih, personelAdi, bolge, aciklama, tutar, santiyeId } = body

  if (santiyeId !== undefined && santiyeId) {
    const santiye = await prisma.santiye.findUnique({ where: { id: santiyeId } })
    if (!santiye) return NextResponse.json({ error: 'Şantiye bulunamadı' }, { status: 404 })
  }

  try {
    const kayit = await prisma.projePersonelHarcama.update({
      where: { id },
      data: {
        ...(tarih !== undefined && { tarih: new Date(tarih) }),
        ...(personelAdi !== undefined && { personelAdi: String(personelAdi).trim() }),
        ...(bolge !== undefined && { bolge: bolge?.trim() || null }),
        ...(aciklama !== undefined && { aciklama: aciklama?.trim() || null }),
        ...(tutar !== undefined && { tutar: Number(tutar) || 0 }),
        ...(santiyeId !== undefined && santiyeId && { santiyeId }),
      },
      include: { santiye: { select: { id: true, ad: true } } },
    })
    return NextResponse.json({ ...kayit, santiyeAdi: kayit.santiye.ad })
  } catch {
    return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const { id } = await params
  const existing = await prisma.projePersonelHarcama.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 })

  await prisma.projePersonelHarcama.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
