export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { phTokenGecerliMi, PH_COOKIE_NAME } from '@/lib/personel-harcama-auth'

// Personel Harcamaları artık tek bir şantiyeye bağlı değil: Tom bir kişinin
// harcamasını eklerken hangi şantiyeye ait olduğunu satır bazında seçiyor.
// Bu yüzden liste/ekleme artık TÜM şantiyeler genelinde, tek (PIN korumalı)
// endpoint üzerinden yapılıyor — [santiyeId]/personel-harcama eski rotaları
// geriye dönük uyumluluk için duruyor ama artık arayüz bunları kullanmıyor.

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

export async function GET(req: NextRequest) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const kayitlar = await prisma.projePersonelHarcama.findMany({
    include: { santiye: { select: { id: true, ad: true } } },
    orderBy: { tarih: 'desc' },
  })

  return NextResponse.json(
    kayitlar.map((k) => ({
      id: k.id,
      tarih: k.tarih,
      personelAdi: k.personelAdi,
      bolge: k.bolge,
      aciklama: k.aciklama,
      tutar: k.tutar,
      santiyeId: k.santiyeId,
      santiyeAdi: k.santiye.ad,
    })),
  )
}

export async function POST(req: NextRequest) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const body = await req.json()
  const { tarih, personelAdi, bolge, aciklama, tutar, santiyeId } = body

  if (!santiyeId) return NextResponse.json({ error: 'Şantiye seçimi zorunludur' }, { status: 400 })
  if (!tarih) return NextResponse.json({ error: 'Tarih zorunludur' }, { status: 400 })
  if (!personelAdi?.trim()) return NextResponse.json({ error: 'Personel adı zorunludur' }, { status: 400 })
  if (tutar === undefined || tutar === null || tutar === '' || Number.isNaN(Number(tutar))) {
    return NextResponse.json({ error: 'Geçerli bir tutar girin' }, { status: 400 })
  }

  const santiye = await prisma.santiye.findUnique({ where: { id: santiyeId } })
  if (!santiye) return NextResponse.json({ error: 'Şantiye bulunamadı' }, { status: 404 })

  const kayit = await prisma.projePersonelHarcama.create({
    data: {
      santiyeId,
      tarih: new Date(tarih),
      personelAdi: personelAdi.trim(),
      bolge: bolge?.trim() || null,
      aciklama: aciklama?.trim() || null,
      tutar: Number(tutar),
    },
  })

  return NextResponse.json({ ...kayit, santiyeAdi: santiye.ad }, { status: 201 })
}
