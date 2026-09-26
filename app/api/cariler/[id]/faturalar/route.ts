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

// Bir cariye ("karşı taraf") ait tüm faturaların listesi — Tom'un bir cariye
// tıkladığında kaç fatura kesilmiş/alınmış, ne tutarda ve hangi tarihlerde
// olduğunu görebilmesi için. cariEklensinMi işaretli olsun olmasın, o cariye
// bağlı TÜM faturalar gösterilir (bakiye hesaplaması sadece işaretli olanları
// sayar, ama burada tam geçmiş görülsün istendi).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (!g.ok) return g.res
  const { id } = await params

  const faturalar = await prisma.fatura.findMany({
    where: { cariId: id },
    orderBy: { tarih: 'desc' },
    select: {
      id: true,
      tur: true,
      faturaNo: true,
      tarih: true,
      odemeTarihi: true,
      aciklama: true,
      kdvDahilTutar: true,
      odemeDurumu: true,
      cariEklensinMi: true,
    },
  })
  return NextResponse.json(faturalar)
}
