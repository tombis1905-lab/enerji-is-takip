export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { ad, telefon, bolge, aciklama, aktif, personelTipi } = body

  // bolge gerçekten DEĞİŞTİYSE (yeni atama ya da farklı bir değere düzenlendiyse)
  // bolgeBaslangicTarihi'ni şimdiye çekiyoruz, böylece "kaç gündür burada"
  // sayacı sıfırlanıyor. Aynı değer tekrar gönderilirse tarihe dokunmuyoruz.
  let bolgeBaslangicGuncelle: Date | null | undefined = undefined
  if (bolge !== undefined) {
    const yeniBolge = bolge?.trim() || null
    const mevcut = await prisma.calisan.findUnique({ where: { id }, select: { bolge: true } })
    if (mevcut && mevcut.bolge !== yeniBolge) {
      bolgeBaslangicGuncelle = yeniBolge ? new Date() : null
    }
  }

  const calisan = await prisma.calisan.update({
    where: { id },
    data: {
      ...(ad !== undefined && { ad: ad.trim() }),
      ...(telefon !== undefined && { telefon: telefon?.trim() || null }),
      ...(bolge !== undefined && { bolge: bolge?.trim() || null }),
      ...(bolgeBaslangicGuncelle !== undefined && { bolgeBaslangicTarihi: bolgeBaslangicGuncelle }),
      ...(aciklama !== undefined && { aciklama: aciklama?.trim() || null }),
      ...(aktif !== undefined && { aktif }),
      ...(personelTipi !== undefined && { personelTipi: personelTipi === 'TASERON' ? 'TASERON' : 'ASIL' }),
    },
  })
  return NextResponse.json(calisan)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const { id } = await params

  const count = await prisma.personelSirket.count({ where: { calisanId: id } })
  if (count > 0) {
    return NextResponse.json({ error: `Bu çalışana ait ${count} şirket geçmişi kaydı var. Önce onları silin ya da çalışanı pasif yapın.` }, { status: 400 })
  }

  await prisma.calisan.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
