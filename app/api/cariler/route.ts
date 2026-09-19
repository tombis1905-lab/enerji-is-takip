export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { faturaTokenGecerliMi, FATURA_COOKIE_NAME } from '@/lib/fatura-auth'

// Piyasa Cari Durumu, Faturalar bölümünün altında yaşıyor — aynı PIN kilidini
// (fatura_erisim çerezi) kullanır, ayrı bir kilit istemez.
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

export async function GET(req: NextRequest) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const [cariler, faturaGruplari, odemeGruplari] = await Promise.all([
    prisma.cari.findMany({ orderBy: { ad: 'asc' } }),
    // Cari eklensin mi işaretli faturaların tür bazında toplamı (KESILEN -> alacak tahakkuku, ALINAN -> borç tahakkuku).
    // "Ödendi" olarak işaretlenen faturalar tamamen kapanmış sayılır ve
    // bakiyeye dahil edilmez — Faturalar listesinde durumu Ödendi yapmak,
    // burada borcu/alacağı doğrudan düşürür. Hâlâ Bekliyor/Gecikti olanlar
    // (kısmen ödenmiş olabilir) toplama girer, kısmi kısmı da CariOdeme
    // kayıtlarından ayrıca düşülür.
    prisma.fatura.groupBy({
      by: ['cariId', 'tur'],
      where: { cariId: { not: null }, cariEklensinMi: true, odemeDurumu: { not: 'ODENDI' } },
      _sum: { kdvDahilTutar: true },
    }),
    // Kısmi ödeme/tahsilat kayıtlarının yön bazında toplamı
    prisma.cariOdeme.groupBy({
      by: ['cariId', 'yon'],
      _sum: { tutar: true },
    }),
  ])

  const faturaMap = new Map<string, { kesilen: number; alinan: number }>()
  for (const g of faturaGruplari) {
    if (!g.cariId) continue
    const kayit = faturaMap.get(g.cariId) ?? { kesilen: 0, alinan: 0 }
    if (g.tur === 'KESILEN') kayit.kesilen += g._sum.kdvDahilTutar ?? 0
    else kayit.alinan += g._sum.kdvDahilTutar ?? 0
    faturaMap.set(g.cariId, kayit)
  }
  const odemeMap = new Map<string, { tahsilat: number; odeme: number }>()
  for (const g of odemeGruplari) {
    const kayit = odemeMap.get(g.cariId) ?? { tahsilat: 0, odeme: 0 }
    if (g.yon === 'TAHSILAT') kayit.tahsilat += g._sum.tutar ?? 0
    else kayit.odeme += g._sum.tutar ?? 0
    odemeMap.set(g.cariId, kayit)
  }

  const sonuc = cariler.map((c) => {
    const f = faturaMap.get(c.id) ?? { kesilen: 0, alinan: 0 }
    const o = odemeMap.get(c.id) ?? { tahsilat: 0, odeme: 0 }
    // Tek bir ortak bakiye üzerinden hesapla: kesilen faturalar ve yaptığımız
    // ödemeler bizi alacaklı yapar; alınan faturalar ve tahsil ettiğimiz
    // paralar bizi borçlu yapar. Örn: hiç faturası olmayan bir cariye 89.725
    // TL çek verdiysek (Ödeme kaydı), bu tutarın karşılığında bir borcumuz
    // yoksa fazladan ödemiş oluruz — bu durumda cari bize borçlanır (alacak).
    // Eskiden kesilen/tahsilat ile alınan/ödeme ayrı ayrı 0'da kırpılıyordu,
    // bu da böyle bir fazla ödemeyi hiçbir yerde göstermiyordu.
    const netBakiye = (f.kesilen + o.odeme) - (f.alinan + o.tahsilat)
    const alacak = Math.max(0, netBakiye)
    const borc = Math.max(0, -netBakiye)
    return {
      id: c.id,
      ad: c.ad,
      ibanBilgisi: c.ibanBilgisi,
      aciklama: c.aciklama,
      kesilenToplam: f.kesilen,
      alinanToplam: f.alinan,
      tahsilatToplam: o.tahsilat,
      odemeToplam: o.odeme,
      alacak,
      borc,
      netBakiye: alacak - borc,
    }
  })

  return NextResponse.json(sonuc)
}

export async function POST(req: NextRequest) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const body = await req.json()
  const { ad, ibanBilgisi, aciklama } = body
  if (!ad || !String(ad).trim()) {
    return NextResponse.json({ error: 'İsim zorunludur' }, { status: 400 })
  }

  try {
    const cari = await prisma.cari.create({
      data: {
        ad: String(ad).trim(),
        ibanBilgisi: ibanBilgisi?.trim() || null,
        aciklama: aciklama?.trim() || null,
      },
    })
    return NextResponse.json(cari, { status: 201 })
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Bu isimde bir cari zaten var' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Hata oluştu' }, { status: 500 })
  }
}
