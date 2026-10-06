export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

const norm = (s: string) =>
  String(s || '')
    .toLocaleUpperCase('tr-TR')
    .replace(/[^\p{L}\p{N}]+/gu, '')

// Excel'den toplu akaryakıt aktarımı. uygula=false → sadece önizleme.
// Aynı kayıt (tarih+araç+tutar+fiş no) tekrar yüklenirse çoğaltılmaz.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }
  const { kayitlar, uygula, eksikAracOlustur } = await req.json()
  if (!Array.isArray(kayitlar) || kayitlar.length === 0) {
    return NextResponse.json({ error: 'Kayıt yok' }, { status: 400 })
  }
  if (kayitlar.length > 5000) return NextResponse.json({ error: 'En fazla 5000 satır' }, { status: 400 })

  const [araclar, santiyeler] = await Promise.all([
    prisma.arac.findMany({ select: { id: true, plaka: true } }),
    prisma.santiye.findMany({ select: { id: true, ad: true } }),
  ])
  const aracMap = new Map<string, string>(araclar.map((a: any) => [norm(a.plaka), a.id]))
  const santiyeMap = new Map<string, string>(santiyeler.map((s: any) => [norm(s.ad), s.id]))

  const bulunamayanPlakalar = new Map<string, string>() // norm -> gösterim
  const bulunamayanSantiyeler = new Set<string>()
  const gecerli: any[] = []
  let gecersiz = 0

  for (const k of kayitlar as any[]) {
    const tutar = Number(k.tutar)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(k.tarih)) || !(tutar > 0) || !String(k.plaka || '').trim()) {
      gecersiz++
      continue
    }
    gecerli.push({ ...k, tutar })
    const pn = norm(k.plaka)
    if (!aracMap.has(pn)) bulunamayanPlakalar.set(pn, String(k.plaka).trim())
    if (k.santiye && !santiyeMap.has(norm(k.santiye))) bulunamayanSantiyeler.add(String(k.santiye).trim())
  }

  // Mevcut kayıtlarla çoğaltma kontrolü (multiset)
  const tarihler = gecerli.map((k) => k.tarih).sort()
  const mevcut = gecerli.length
    ? await prisma.akaryakitKaydi.findMany({
        where: {
          tarih: { gte: new Date(tarihler[0] + 'T00:00:00.000Z'), lte: new Date(tarihler[tarihler.length - 1] + 'T23:59:59.999Z') },
        },
        select: { tarih: true, aracId: true, tutar: true, fisNo: true },
      })
    : []
  const sayac = new Map<string, number>()
  const anahtar = (tarih: string, aracId: string, tutar: number, fisNo: string) =>
    `${tarih}|${aracId}|${Math.round(tutar * 100)}|${fisNo}`
  for (const m of mevcut as any[]) {
    const key = anahtar(m.tarih.toISOString().slice(0, 10), m.aracId, m.tutar, m.fisNo || '')
    sayac.set(key, (sayac.get(key) || 0) + 1)
  }

  const eklenecek: any[] = []
  let atlanan = 0
  let aracsiz = 0
  for (const k of gecerli) {
    const pn = norm(k.plaka)
    const aracId = aracMap.get(pn)
    if (!aracId && !eksikAracOlustur) {
      aracsiz++
      continue
    }
    const key = anahtar(k.tarih, aracId || `yeni:${pn}`, k.tutar, String(k.fisNo || '').trim())
    const var_ = sayac.get(key) || 0
    if (var_ > 0) {
      sayac.set(key, var_ - 1)
      atlanan++
      continue
    }
    eklenecek.push({ ...k, pn, aracId })
  }

  const ozet = {
    toplamSatir: kayitlar.length,
    gecersiz,
    atlanan,
    aracsiz,
    eklenecek: eklenecek.length,
    eklenecekToplam: eklenecek.reduce((t, k) => t + k.tutar, 0),
    bulunamayanPlakalar: [...bulunamayanPlakalar.values()],
    bulunamayanSantiyeler: [...bulunamayanSantiyeler],
  }

  if (!uygula) return NextResponse.json({ ...ozet, uygulandi: false })

  const userId = (session.user as any).id
  // Eksik araçları oluştur
  if (eksikAracOlustur) {
    for (const [pn, gosterim] of bulunamayanPlakalar) {
      const yeni = await prisma.arac.upsert({
        where: { plaka: gosterim.toLocaleUpperCase('tr-TR') },
        update: {},
        create: { plaka: gosterim.toLocaleUpperCase('tr-TR') },
        select: { id: true },
      })
      aracMap.set(pn, yeni.id)
    }
  }
  const veri = eklenecek
    .map((k) => ({
      tarih: new Date(k.tarih + 'T00:00:00.000Z'),
      tutar: k.tutar,
      fisNo: String(k.fisNo || '').trim() || null,
      aciklama: String(k.aciklama || '').trim() || null,
      aracId: k.aracId || aracMap.get(k.pn)!,
      santiyeId: k.santiye ? santiyeMap.get(norm(k.santiye)) || null : null,
      userId,
    }))
    .filter((v) => v.aracId)
  if (veri.length) await prisma.akaryakitKaydi.createMany({ data: veri })
  return NextResponse.json({ ...ozet, eklenecek: veri.length, uygulandi: true })
}
