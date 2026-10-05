export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { phTokenGecerliMi, PH_COOKIE_NAME } from '@/lib/personel-harcama-auth'

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

type GelenKayit = {
  personelAdi: string
  tarih: string // YYYY-MM-DD
  aciklama: string | null
  tutar: number
  odendi: boolean
  odemeTarihi: string | null // YYYY-MM-DD
}

function anahtar(personelAdi: string, tarih: string, aciklama: string | null, tutar: number) {
  return `${personelAdi.trim().toLocaleLowerCase('tr-TR')}|${tarih}|${(aciklama || '').trim().toLocaleLowerCase('tr-TR')}|${Math.round(tutar * 100)}`
}

// Tom'un "PERSONEL HAFTALIK HARCAMA TABLOSU" Excel'indeki tüm personel
// sayfalarını tek seferde aktarır. Aynı kayıt (personel + tarih + açıklama +
// tutar) veritabanında zaten varsa tekrar eklenmez — böylece aynı dosya iki
// kez yüklense bile çift kayıt oluşmaz. Aynı günde birebir aynı iki satır
// (ör. iki ayrı "EKMEK 200") varsa, mevcut kayıt sayısı kadarı atlanır, fazlası
// eklenir. uygula=false iken hiçbir şey yazılmaz, sadece önizleme döner.
export async function POST(req: NextRequest) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const body = await req.json()
  const kayitlar: GelenKayit[] = Array.isArray(body?.kayitlar) ? body.kayitlar : []
  const santiyeId: string | null = body?.santiyeId || null
  const uygula = !!body?.uygula

  if (santiyeId) {
    const santiye = await prisma.santiye.findUnique({ where: { id: santiyeId } })
    if (!santiye) return NextResponse.json({ error: 'Şantiye bulunamadı' }, { status: 404 })
  }

  type Mevcut = { personelAdi: string; tarih: Date; aciklama: string | null; tutar: number }
  const mevcutlar: Mevcut[] = await prisma.projePersonelHarcama.findMany({
    select: { personelAdi: true, tarih: true, aciklama: true, tutar: true },
  })
  const mevcutSayac = new Map<string, number>()
  for (const m of mevcutlar) {
    const k = anahtar(m.personelAdi, m.tarih.toISOString().slice(0, 10), m.aciklama, m.tutar)
    mevcutSayac.set(k, (mevcutSayac.get(k) || 0) + 1)
  }

  const eklenecekler: GelenKayit[] = []
  let atlanan = 0
  for (const k of kayitlar) {
    if (!k?.personelAdi || !k?.tarih || !Number.isFinite(Number(k.tutar)) || !Number(k.tutar)) continue
    const key = anahtar(k.personelAdi, k.tarih, k.aciklama, Number(k.tutar))
    const kalan = mevcutSayac.get(key) || 0
    if (kalan > 0) {
      mevcutSayac.set(key, kalan - 1)
      atlanan++
      continue
    }
    eklenecekler.push(k)
  }

  const personelOzet = new Map<string, { kayit: number; toplam: number; odenen: number }>()
  for (const k of eklenecekler) {
    const o = personelOzet.get(k.personelAdi) || { kayit: 0, toplam: 0, odenen: 0 }
    o.kayit += 1
    o.toplam += Number(k.tutar)
    if (k.odendi) o.odenen += Number(k.tutar)
    personelOzet.set(k.personelAdi, o)
  }

  if (uygula && eklenecekler.length > 0) {
    await prisma.projePersonelHarcama.createMany({
      data: eklenecekler.map((k) => ({
        santiyeId,
        tarih: new Date(k.tarih),
        personelAdi: k.personelAdi.trim(),
        bolge: null,
        aciklama: k.aciklama?.trim() || null,
        tutar: Number(k.tutar),
        odendi: !!k.odendi,
        odemeTarihi: k.odendi && k.odemeTarihi ? new Date(k.odemeTarihi) : null,
      })),
    })
  }

  return NextResponse.json({
    uygulandiMi: uygula,
    gelenSatir: kayitlar.length,
    eklenecek: eklenecekler.length,
    atlanan,
    toplamTutar: eklenecekler.reduce((a, k) => a + Number(k.tutar), 0),
    personeller: Array.from(personelOzet.entries()).map(([ad, v]) => ({ ad, ...v })),
  })
}

// Seçilen harcama kayıtlarını toplu olarak "Ödendi" / "Bekliyor" yapar
// (ör. bir haftanın tüm harcamalarını aynı gün personele ödedikten sonra).
export async function PUT(req: NextRequest) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const body = await req.json()
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === 'string') : []
  const odendi = !!body?.odendi
  const odemeTarihi: string | null = body?.odemeTarihi || null

  if (ids.length === 0) return NextResponse.json({ error: 'Kayıt seçilmedi' }, { status: 400 })
  if (odendi && !odemeTarihi) return NextResponse.json({ error: 'Ödeme tarihi zorunludur' }, { status: 400 })

  const sonuc = await prisma.projePersonelHarcama.updateMany({
    where: { id: { in: ids } },
    data: { odendi, odemeTarihi: odendi && odemeTarihi ? new Date(odemeTarihi) : null },
  })
  return NextResponse.json({ guncellenen: sonuc.count })
}
