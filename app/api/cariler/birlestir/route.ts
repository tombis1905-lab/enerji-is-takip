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

// Excel'den aktarım sırasında aynı firma farklı yazımlarla (ör. "ADIM OTO" /
// "ADIM OTOMOTİV") iki ayrı cari olarak oluşmuş olabilir. Bu uç nokta,
// "kaynak" cariye bağlı tüm fatura ve ödeme/tahsilat kayıtlarını "hedef"
// cariye taşıyıp kaynak cariyi siler — böylece bakiyeler tek bir cari altında
// birleşir.
export async function POST(req: NextRequest) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const body = await req.json()
  const { kaynakId, hedefId } = body
  if (!kaynakId || !hedefId) {
    return NextResponse.json({ error: 'Birleştirilecek iki cari de seçilmeli' }, { status: 400 })
  }
  if (kaynakId === hedefId) {
    return NextResponse.json({ error: 'Aynı cariyi kendisiyle birleştiremezsiniz' }, { status: 400 })
  }

  const [kaynak, hedef] = await Promise.all([
    prisma.cari.findUnique({ where: { id: kaynakId } }),
    prisma.cari.findUnique({ where: { id: hedefId } }),
  ])
  if (!kaynak || !hedef) {
    return NextResponse.json({ error: 'Cari bulunamadı' }, { status: 404 })
  }

  const [faturaSonuc, odemeSonuc] = await prisma.$transaction([
    prisma.fatura.updateMany({ where: { cariId: kaynakId }, data: { cariId: hedefId } }),
    prisma.cariOdeme.updateMany({ where: { cariId: kaynakId }, data: { cariId: hedefId } }),
  ])

  // Hedefin IBAN/açıklama bilgisi boşsa kaynaktan doldur — bilgi kaybolmasın.
  if (!hedef.ibanBilgisi && kaynak.ibanBilgisi) {
    await prisma.cari.update({ where: { id: hedefId }, data: { ibanBilgisi: kaynak.ibanBilgisi } })
  }

  await prisma.cari.delete({ where: { id: kaynakId } })

  return NextResponse.json({
    success: true,
    tasinanFatura: faturaSonuc.count,
    tasinanOdeme: odemeSonuc.count,
    hedefAd: hedef.ad,
  })
}
