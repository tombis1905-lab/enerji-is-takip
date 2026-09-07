export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { faturaTokenGecerliMi, FATURA_COOKIE_NAME } from '@/lib/fatura-auth'
import { faturaPdfKaydet, faturaPdfSil } from '@/lib/local-storage'

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

// PDF'i yerel diske (Railway Volume) kaydeder ve ilgili fatura kaydına bağlar.
// multipart/form-data: alanlar "faturaId" ve "dosya".
export async function POST(req: NextRequest) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const form = await req.formData()
  const faturaId = String(form.get('faturaId') || '')
  const dosya = form.get('dosya') as File | null

  if (!faturaId) return NextResponse.json({ error: 'faturaId gerekli' }, { status: 400 })
  if (!dosya) return NextResponse.json({ error: 'Dosya gerekli' }, { status: 400 })
  if (dosya.type !== 'application/pdf' && !dosya.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Sadece PDF dosyası yüklenebilir' }, { status: 400 })
  }
  if (dosya.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'Dosya 20MB\'tan büyük olamaz' }, { status: 400 })
  }

  const mevcut = await prisma.fatura.findUnique({ where: { id: faturaId } })
  if (!mevcut) return NextResponse.json({ error: 'Fatura bulunamadı' }, { status: 404 })

  try {
    const buffer = Buffer.from(await dosya.arrayBuffer())
    const { storedName } = await faturaPdfKaydet(buffer, dosya.name)

    // eski dosya varsa temizle
    if (mevcut.pdfYolu) {
      await faturaPdfSil(mevcut.pdfYolu)
    }

    const fatura = await prisma.fatura.update({
      where: { id: faturaId },
      data: { pdfYolu: storedName, pdfDosyaAdi: dosya.name },
    })
    return NextResponse.json(fatura)
  } catch (e: any) {
    return NextResponse.json({ error: 'Yükleme başarısız oldu' }, { status: 500 })
  }
}
