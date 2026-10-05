export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

// Giriş yapan yönetici için "yaklaşan çek" hatırlatması. Çekler bölümü PIN ile
// kilitli olduğu için burada KASITLI olarak yalnızca "kime ait" ve "ne zaman"
// bilgisi döner — tutar, banka, çek no, açıklama asla dönmez. Böylece PIN
// girilmeden de "şu tarihte şu firmayla çek ödemesi var" uyarısı gösterilebilir.
// Kapsam: bekleyen çekler; vadesi en fazla 30 gün geçmiş olanlar + önümüzdeki 7 gün.

const ILERI_GUN = 7
const GERI_GUN = 30

export async function GET() {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const simdi = new Date()
  const bugun = new Date(Date.UTC(simdi.getFullYear(), simdi.getMonth(), simdi.getDate()))
  const bas = new Date(bugun.getTime() - GERI_GUN * 86400000)
  const bit = new Date(bugun.getTime() + (ILERI_GUN + 1) * 86400000)

  const cekler = await prisma.cek.findMany({
    where: { durum: 'BEKLEMEDE', vadeTarihi: { gte: bas, lt: bit } },
    select: { id: true, tur: true, karsiTaraf: true, vadeTarihi: true },
    orderBy: { vadeTarihi: 'asc' },
  })

  return NextResponse.json(
    cekler.map((c: { id: string; tur: string; karsiTaraf: string | null; vadeTarihi: Date }) => ({
      id: c.id,
      tur: c.tur, // ALINAN = ödeme alınacak, VERILEN = ödeme yapılacak
      kime: c.karsiTaraf || 'Belirtilmemiş',
      vade: c.vadeTarihi.toISOString().slice(0, 10),
      gunKaldi: Math.round((c.vadeTarihi.getTime() - bugun.getTime()) / 86400000),
    })),
  )
}
