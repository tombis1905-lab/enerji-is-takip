export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { cekTokenGecerliMi, CEK_COOKIE_NAME } from '@/lib/cek-auth'

async function guard(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return { ok: false as const, res: NextResponse.json({ error: 'Yetkisiz' }, { status: 403 }) }
  }
  const userId = (session.user as any).id as string
  const token = req.cookies.get(CEK_COOKIE_NAME)?.value
  if (!cekTokenGecerliMi(token, userId)) {
    return { ok: false as const, res: NextResponse.json({ error: 'PIN gerekli', code: 'PIN_GEREKLI' }, { status: 401 }) }
  }
  return { ok: true as const }
}

type Gelen = {
  tur: 'ALINAN' | 'VERILEN'
  cekNo: string | null
  banka: string | null
  karsiTaraf: string | null
  tutar: number
  vadeTarihi: string // YYYY-MM-DD
  duzenlemeTarihi: string | null
  durum: 'BEKLEMEDE' | 'TAHSIL_EDILDI' | 'CIRO_EDILDI' | 'KARSILIKSIZ' | 'IPTAL'
  aciklama: string | null
}

const DURUMLAR = ['BEKLEMEDE', 'TAHSIL_EDILDI', 'CIRO_EDILDI', 'KARSILIKSIZ', 'IPTAL']

function tr(s: string | null | undefined) {
  return (s || '').trim().toLocaleLowerCase('tr-TR')
}

// Aynı çek (tür + çek no + vade + tutar + karşı taraf) tekrar eklenmez; böylece
// aynı Excel iki kez yüklense bile çift kayıt oluşmaz. uygula=false → sadece önizleme.
function anahtar(k: { tur: string; cekNo: string | null; vadeTarihi: string; tutar: number; karsiTaraf: string | null }) {
  return `${k.tur}|${tr(k.cekNo)}|${k.vadeTarihi}|${Math.round(k.tutar * 100)}|${tr(k.karsiTaraf)}`
}

export async function POST(req: NextRequest) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const body = await req.json()
  const kayitlar: Gelen[] = Array.isArray(body?.kayitlar) ? body.kayitlar : []
  const uygula = !!body?.uygula

  const gecerli = kayitlar.filter(
    (k) =>
      (k?.tur === 'ALINAN' || k?.tur === 'VERILEN') &&
      /^\d{4}-\d{2}-\d{2}$/.test(k.vadeTarihi || '') &&
      Number.isFinite(Number(k.tutar)) &&
      Number(k.tutar) > 0 &&
      DURUMLAR.includes(k.durum),
  )

  type Mevcut = { tur: string; cekNo: string | null; vadeTarihi: Date; tutar: number; karsiTaraf: string | null }
  const mevcutlar: Mevcut[] = await prisma.cek.findMany({
    select: { tur: true, cekNo: true, vadeTarihi: true, tutar: true, karsiTaraf: true },
  })
  const sayac = new Map<string, number>()
  for (const m of mevcutlar) {
    const a = anahtar({ ...m, vadeTarihi: m.vadeTarihi.toISOString().slice(0, 10) })
    sayac.set(a, (sayac.get(a) || 0) + 1)
  }

  const eklenecek: Gelen[] = []
  let atlanan = 0
  for (const k of gecerli) {
    const a = anahtar({ ...k, tutar: Number(k.tutar) })
    const n = sayac.get(a) || 0
    if (n > 0) {
      sayac.set(a, n - 1)
      atlanan++
      continue
    }
    eklenecek.push(k)
  }

  if (uygula && eklenecek.length > 0) {
    await prisma.cek.createMany({
      data: eklenecek.map((k) => ({
        tur: k.tur,
        cekNo: k.cekNo?.toString().trim() || null,
        banka: k.banka?.trim() || null,
        karsiTaraf: k.karsiTaraf?.trim() || null,
        tutar: Number(k.tutar),
        vadeTarihi: new Date(k.vadeTarihi),
        duzenlemeTarihi: k.duzenlemeTarihi ? new Date(k.duzenlemeTarihi) : null,
        durum: k.durum,
        aciklama: k.aciklama?.trim() || null,
      })),
    })
  }

  const say = (f: (k: Gelen) => boolean) => eklenecek.filter(f)
  return NextResponse.json({
    uygulandiMi: uygula,
    gelenSatir: kayitlar.length,
    gecersiz: kayitlar.length - gecerli.length,
    eklenecek: eklenecek.length,
    atlanan,
    verilen: say((k) => k.tur === 'VERILEN').length,
    alinan: say((k) => k.tur === 'ALINAN').length,
    bekleyen: say((k) => k.durum === 'BEKLEMEDE').length,
    tamamlanan: say((k) => k.durum !== 'BEKLEMEDE').length,
    bekleyenToplam: say((k) => k.durum === 'BEKLEMEDE').reduce((a, k) => a + Number(k.tutar), 0),
  })
}
