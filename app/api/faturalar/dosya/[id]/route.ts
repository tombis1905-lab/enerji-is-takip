export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { faturaTokenGecerliMi, FATURA_COOKIE_NAME } from '@/lib/fatura-auth'
import { faturaPdfOku } from '@/lib/local-storage'

// Bir faturanın kayıtlı PDF'ini indirir/görüntüler. Aynı PIN kilidiyle korunur.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }
  const userId = (session.user as any).id as string
  const token = req.cookies.get(FATURA_COOKIE_NAME)?.value
  if (!faturaTokenGecerliMi(token, userId)) {
    return NextResponse.json({ error: 'PIN gerekli', code: 'PIN_GEREKLI' }, { status: 401 })
  }

  const { id } = await params
  const fatura = await prisma.fatura.findUnique({ where: { id } })
  if (!fatura?.pdfYolu) {
    return NextResponse.json({ error: 'PDF bulunamadı' }, { status: 404 })
  }

  try {
    const buffer = await faturaPdfOku(fatura.pdfYolu)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${(fatura.pdfDosyaAdi || 'fatura.pdf').replace(/"/g, '')}"`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Dosya okunamadı' }, { status: 500 })
  }
}
