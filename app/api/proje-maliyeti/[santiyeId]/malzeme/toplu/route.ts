export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { pmTokenGecerliMi, PM_COOKIE_NAME } from '@/lib/proje-maliyeti-auth'

// Body: { kalemler: [{ kalem: string, birim: string, gerekliMiktar?: number, birimFiyat?: number }] }
// Bir Excel/CSV'den okunan iş kalemi listesini (ör. bir sözleşmenin birim fiyat
// teklif cetveli) toplu olarak bu şantiyenin Malzeme bölümüne ekler. Her kalem
// "gerekli miktar" (sözleşme miktarı) olarak, kullanılan miktar 0 ile başlar —
// böylece iş ilerledikçe gerçekleşen miktarla karşılaştırılabilir.
export async function POST(req: NextRequest, { params }: { params: Promise<{ santiyeId: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }
  const userId = (session.user as any).id as string
  if (!pmTokenGecerliMi(req.cookies.get(PM_COOKIE_NAME)?.value, userId)) {
    return NextResponse.json({ error: 'PIN gerekli', code: 'PIN_GEREKLI' }, { status: 401 })
  }

  const { santiyeId } = await params
  const santiye = await prisma.santiye.findUnique({ where: { id: santiyeId } })
  if (!santiye) return NextResponse.json({ error: 'Şantiye bulunamadı' }, { status: 404 })

  const body = await req.json()
  const kalemler = Array.isArray(body?.kalemler) ? body.kalemler : []
  if (kalemler.length === 0) {
    return NextResponse.json({ error: 'Eklenecek kalem bulunamadı' }, { status: 400 })
  }

  const gecerli = kalemler
    .map((k: any) => ({
      kalem: String(k.kalem ?? '').trim(),
      birim: String(k.birim ?? '').trim(),
      gerekliMiktar:
        k.gerekliMiktar !== undefined && k.gerekliMiktar !== null && k.gerekliMiktar !== ''
          ? Number(k.gerekliMiktar)
          : null,
      birimFiyat: k.birimFiyat ? Number(k.birimFiyat) || 0 : 0,
    }))
    .filter((k: any) => k.kalem && k.birim)

  if (gecerli.length === 0) {
    return NextResponse.json({ error: 'Geçerli kalem bulunamadı (Kalem ve Birim zorunludur)' }, { status: 400 })
  }

  const maxSira = await prisma.projeMalzeme.aggregate({
    where: { santiyeId },
    _max: { siraNo: true },
  })
  let sira = maxSira._max.siraNo ?? 0

  const olusturulan = await prisma.$transaction(
    gecerli.map((k: any) => {
      sira += 1
      return prisma.projeMalzeme.create({
        data: {
          santiyeId,
          kalem: k.kalem,
          birim: k.birim,
          gerekliMiktar: k.gerekliMiktar,
          kullanilanMiktar: 0,
          birimFiyat: k.birimFiyat,
          siraNo: sira,
        },
      })
    })
  )

  return NextResponse.json({ eklenen: olusturulan.length }, { status: 201 })
}
