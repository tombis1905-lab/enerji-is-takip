export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

// Devam takibi: ASIL personel her iş günü otomatik "geldi" sayılır; burada
// yalnızca GELMEDİĞİ günler (izinli / raporlu / mazeretsiz) tutulur.

const TURLER = ['IZINLI', 'RAPORLU', 'GELMEDI']

async function yetkili() {
  const session = await auth()
  return !!session?.user && (session.user as any).role === 'ADMIN'
}

function gunBaslangici(tarih: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(tarih || '')
  if (!m) return null
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

// GET ?yil=2026&ay=10  → o aya ait devamsızlık kayıtları
export async function GET(req: NextRequest) {
  if (!(await yetkili())) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const yil = Number(searchParams.get('yil'))
  const ay = Number(searchParams.get('ay'))
  if (!yil || !ay || ay < 1 || ay > 12) {
    return NextResponse.json({ error: 'yil ve ay zorunludur' }, { status: 400 })
  }

  const bas = new Date(Date.UTC(yil, ay - 1, 1))
  const bit = new Date(Date.UTC(yil, ay, 1))
  const kayitlar = await prisma.personelDevamsizlik.findMany({
    where: { tarih: { gte: bas, lt: bit } },
    select: { id: true, calisanId: true, tarih: true, tur: true, aciklama: true },
  })
  return NextResponse.json(kayitlar)
}

// POST { calisanId, tarih: 'YYYY-MM-DD', tur, aciklama } → kaydı oluşturur ya da günceller
export async function POST(req: NextRequest) {
  if (!(await yetkili())) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const body = await req.json()
  const calisanId: string = body?.calisanId
  const tur: string = TURLER.includes(body?.tur) ? body.tur : 'IZINLI'
  const tarih = gunBaslangici(body?.tarih)
  if (!calisanId) return NextResponse.json({ error: 'Personel zorunludur' }, { status: 400 })
  if (!tarih) return NextResponse.json({ error: 'Geçerli tarih zorunludur' }, { status: 400 })

  const calisan = await prisma.calisan.findUnique({ where: { id: calisanId }, select: { id: true } })
  if (!calisan) return NextResponse.json({ error: 'Personel bulunamadı' }, { status: 404 })

  const aciklama: string | null = body?.aciklama?.trim() || null
  const kayit = await prisma.personelDevamsizlik.upsert({
    where: { calisanId_tarih: { calisanId, tarih } },
    create: { calisanId, tarih, tur, aciklama },
    update: { tur, aciklama },
    select: { id: true, calisanId: true, tarih: true, tur: true, aciklama: true },
  })
  return NextResponse.json(kayit)
}

// DELETE ?calisanId=...&tarih=YYYY-MM-DD → o gün tekrar "geldi" sayılır
export async function DELETE(req: NextRequest) {
  if (!(await yetkili())) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const calisanId = searchParams.get('calisanId')
  const tarih = gunBaslangici(searchParams.get('tarih') || '')
  if (!calisanId || !tarih) return NextResponse.json({ error: 'calisanId ve tarih zorunludur' }, { status: 400 })

  await prisma.personelDevamsizlik.deleteMany({ where: { calisanId, tarih } })
  return NextResponse.json({ ok: true })
}
