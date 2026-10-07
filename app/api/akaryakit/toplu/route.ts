export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

const norm = (s: string) =>
  String(s || '')
    .toLocaleUpperCase('tr-TR')
    .replace(/[^\p{L}\p{N}]+/gu, '')

const MISAFIR = 'MİSAFİR ARAÇ'
const PLAKA_BENZERI = /\b\d{2}\s?[A-ZÇĞİÖŞÜ]{1,3}\s?\d{2,4}\b/i

// Excel'den toplu akaryakıt aktarımı. uygula=false → sadece önizleme.
// - Plaka sütunu varsa ona göre araç eşleştirilir.
// - Plaka yoksa (veresiye ekstresi) açıklamadan çözülür: kayıtlı plaka geçiyorsa
//   o araç, değilse (BİDON, KAMYON, isim vb.) Misafir Araç.
// - Aynı kayıt (tarih+araç+tutar+fiş no) tekrar yüklenirse çoğaltılmaz.
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
  const misafirNorm = norm(MISAFIR)
  const kayitliPlakalar = [...aracMap.keys()].filter((n) => n.length >= 5 && n !== misafirNorm)

  const bulunamayanPlakalar = new Map<string, string>() // norm -> gösterim
  const bulunamayanSantiyeler = new Set<string>()
  const gecerli: any[] = []
  let gecersiz = 0
  let misafirSayisi = 0
  let aciklamadanEslesen = 0

  for (const k of kayitlar as any[]) {
    const tutar = Number(k.tutar)
    const aciklama = String(k.aciklama || '').trim()
    let plaka = String(k.plaka || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(k.tarih)) || !(tutar > 0) || (!plaka && !aciklama)) {
      gecersiz++
      continue
    }
    let pn = norm(plaka)
    if (!plaka) {
      // Açıklamadan araç çöz
      const an = norm(aciklama)
      const bulunan = kayitliPlakalar.find((n) => an.includes(n))
      if (bulunan) {
        pn = bulunan
        aciklamadanEslesen++
      } else {
        const m = aciklama.match(PLAKA_BENZERI)
        if (m && eksikAracOlustur) {
          plaka = m[0].trim()
          pn = norm(plaka)
          bulunamayanPlakalar.set(pn, plaka)
        } else {
          if (m) bulunamayanPlakalar.set(norm(m[0]), m[0].trim())
          pn = misafirNorm
          misafirSayisi++
        }
      }
    } else if (!aracMap.has(pn) && pn !== misafirNorm) {
      if (eksikAracOlustur) bulunamayanPlakalar.set(pn, plaka)
      else {
        bulunamayanPlakalar.set(pn, plaka)
        pn = misafirNorm
        misafirSayisi++
      }
    }
    if (k.santiye && !santiyeMap.has(norm(k.santiye))) bulunamayanSantiyeler.add(String(k.santiye).trim())
    // Misafir araca düşenlerde orijinal plaka/yazı kaybolmasın
    const aciklamaSon =
      pn === misafirNorm && k.plaka && String(k.plaka).trim() && norm(k.plaka) !== misafirNorm
        ? [String(k.plaka).trim(), aciklama].filter(Boolean).join(' — ')
        : aciklama
    gecerli.push({ ...k, tutar, pn, aciklama: aciklamaSon })
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
  const idToNorm = new Map<string, string>(araclar.map((a: any) => [a.id, norm(a.plaka)]))
  const anahtar = (tarih: string, aracNorm: string, tutar: number, fisNo: string) =>
    `${tarih}|${aracNorm}|${Math.round(tutar * 100)}|${fisNo}`
  const sayac = new Map<string, number>()
  for (const m of mevcut as any[]) {
    const key = anahtar(m.tarih.toISOString().slice(0, 10), idToNorm.get(m.aracId) || '', m.tutar, m.fisNo || '')
    sayac.set(key, (sayac.get(key) || 0) + 1)
  }

  const eklenecek: any[] = []
  let atlanan = 0
  for (const k of gecerli) {
    const key = anahtar(k.tarih, k.pn, k.tutar, String(k.fisNo || '').trim())
    const var_ = sayac.get(key) || 0
    if (var_ > 0) {
      sayac.set(key, var_ - 1)
      atlanan++
      continue
    }
    eklenecek.push(k)
  }

  const ozet = {
    toplamSatir: kayitlar.length,
    gecersiz,
    atlanan,
    aracsiz: 0,
    misafir: misafirSayisi,
    aciklamadanEslesen,
    eklenecek: eklenecek.length,
    eklenecekToplam: eklenecek.reduce((t, k) => t + k.tutar, 0),
    bulunamayanPlakalar: [...bulunamayanPlakalar.values()],
    bulunamayanSantiyeler: [...bulunamayanSantiyeler],
  }

  if (!uygula) return NextResponse.json({ ...ozet, uygulandi: false })

  const userId = (session.user as any).id
  // Eksik araçları oluştur (yalnızca seçildiyse) ve Misafir Araç'ı garantile
  if (eksikAracOlustur) {
    for (const [pn, gosterim] of bulunamayanPlakalar) {
      if (aracMap.has(pn)) continue
      const plaka = gosterim.toLocaleUpperCase('tr-TR')
      const yeni = await prisma.arac.upsert({ where: { plaka }, update: {}, create: { plaka }, select: { id: true } })
      aracMap.set(pn, yeni.id)
    }
  }
  if (eklenecek.some((k) => k.pn === misafirNorm) && !aracMap.has(misafirNorm)) {
    const m = await prisma.arac.upsert({ where: { plaka: MISAFIR }, update: {}, create: { plaka: MISAFIR }, select: { id: true } })
    aracMap.set(misafirNorm, m.id)
  }
  const veri = eklenecek
    .map((k) => ({
      tarih: new Date(k.tarih + 'T00:00:00.000Z'),
      tutar: k.tutar,
      fisNo: String(k.fisNo || '').trim() || null,
      aciklama: String(k.aciklama || '').trim() || null,
      aracId: aracMap.get(k.pn)!,
      santiyeId: k.santiye ? santiyeMap.get(norm(k.santiye)) || null : null,
      userId,
    }))
    .filter((v) => v.aracId)
  if (veri.length) await prisma.akaryakitKaydi.createMany({ data: veri })
  return NextResponse.json({ ...ozet, eklenecek: veri.length, uygulandi: true })
}
