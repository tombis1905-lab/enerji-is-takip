export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { faturaTokenGecerliMi, FATURA_COOKIE_NAME } from '@/lib/fatura-auth'
import { faturaPdfSil } from '@/lib/local-storage'

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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const { id } = await params
  const body = await req.json()
  const {
    tur, faturaNo, tarih, aciklama, karsiTaraf, tutar, kdvOrani,
    kdvDahilTutar, tevkifatTutari, vadeTarihi, odemeDurumu, sirketId,
    odemeTarihi, ibanBilgisi, yuklenici,
  } = body

  const data: any = {}
  if (tur !== undefined) data.tur = tur
  if (faturaNo !== undefined) data.faturaNo = faturaNo?.trim() || null
  if (tarih !== undefined) data.tarih = new Date(tarih)
  if (aciklama !== undefined) data.aciklama = aciklama?.trim() || null
  if (karsiTaraf !== undefined) data.karsiTaraf = karsiTaraf?.trim() || null
  if (vadeTarihi !== undefined) data.vadeTarihi = vadeTarihi ? new Date(vadeTarihi) : null
  if (odemeDurumu !== undefined) data.odemeDurumu = odemeDurumu
  if (sirketId !== undefined) data.sirketId = sirketId || null
  if (odemeTarihi !== undefined) data.odemeTarihi = odemeTarihi ? new Date(odemeTarihi) : null
  if (ibanBilgisi !== undefined) data.ibanBilgisi = ibanBilgisi?.trim() || null
  if (yuklenici !== undefined) data.yuklenici = yuklenici?.trim() || null
  if (tevkifatTutari !== undefined) data.tevkifatTutari = tevkifatTutari !== '' ? Number(tevkifatTutari) : null

  // Tutar veya KDV oranı değiştiyse KDV'yi yeniden hesapla
  if (tutar !== undefined || kdvOrani !== undefined || kdvDahilTutar !== undefined) {
    const mevcut = await prisma.fatura.findUnique({ where: { id } })
    if (!mevcut) return NextResponse.json({ error: 'Fatura bulunamadı' }, { status: 404 })
    const yeniTutar = tutar !== undefined ? Number(tutar) : mevcut.tutar
    const yeniOran = kdvOrani !== undefined && kdvOrani !== '' ? Number(kdvOrani) : mevcut.kdvOrani
    const { kdvTutari, kdvDahilTutar: hesaplananDahil } = hesaplaKdv(yeniTutar, yeniOran, kdvDahilTutar)
    data.tutar = yeniTutar
    data.kdvOrani = yeniOran
    data.kdvTutari = kdvTutari
    data.kdvDahilTutar = hesaplananDahil
  }

  try {
    const fatura = await prisma.fatura.update({ where: { id }, data })
    return NextResponse.json(fatura)
  } catch (e: any) {
    return NextResponse.json({ error: 'Hata oluştu' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const { id } = await params
  const mevcut = await prisma.fatura.findUnique({ where: { id } })
  if (mevcut?.pdfYolu) {
    await faturaPdfSil(mevcut.pdfYolu)
  }
  await prisma.fatura.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
