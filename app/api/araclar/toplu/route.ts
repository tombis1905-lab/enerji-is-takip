export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

const norm = (s: string) =>
  String(s || '').toLocaleUpperCase('tr-TR').replace(/[^\p{L}\p{N}]+/gu, '')

// "46BF653" → "46 BF 653" (uygulamadaki gösterim biçimi)
function plakaBicimle(p: string) {
  const m = String(p).toLocaleUpperCase('tr-TR').replace(/\s+/g, '').match(/^(\d{2})([A-ZÇĞİÖŞÜ]{1,3})(\d{2,4})$/)
  return m ? `${m[1]} ${m[2]} ${m[3]}` : String(p).trim().toLocaleUpperCase('tr-TR')
}

const tarih = (v: any) => (v && /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? new Date(String(v) + 'T00:00:00.000Z') : undefined)

// Şirket Araç Takip Excel'inden araç listesi aktarımı. Plaka (boşluksuz
// karşılaştırma) mevcutsa yalnızca Excel'de DOLU olan alanlar güncellenir
// (boş hücre mevcut veriyi silmez); yoksa yeni araç eklenir.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }
  const { satirlar, uygula } = await req.json()
  if (!Array.isArray(satirlar) || satirlar.length === 0) return NextResponse.json({ error: 'Satır yok' }, { status: 400 })

  const mevcut = await prisma.arac.findMany({ select: { id: true, plaka: true } })
  const harita = new Map<string, string>(mevcut.map((a: any) => [norm(a.plaka), a.id]))

  let yeni = 0
  let guncel = 0
  const yeniPlakalar: string[] = []
  const veriler: { id?: string; data: any; plaka: string }[] = []
  for (const s of satirlar as any[]) {
    if (!String(s.plaka || '').trim()) continue
    const data: any = {}
    if (s.marka) data.marka = String(s.marka).trim()
    if (s.isim) data.isim = String(s.isim).trim()
    const t1 = tarih(s.sigorta); if (t1) data.sigortaBitisTarihi = t1
    const t2 = tarih(s.muayene); if (t2) data.muayeneBitisTarihi = t2
    const t3 = tarih(s.kasko); if (t3) data.kaskoBitisTarihi = t3
    const t4 = tarih(s.akuTarih); if (t4) data.akuDegisimTarihi = t4
    if (Number(s.akuFiyat) > 0) data.akuFiyati = Number(s.akuFiyat)
    if (s.ceza) data.cezaNotu = String(s.ceza).trim()
    const id = harita.get(norm(s.plaka))
    if (id) guncel++
    else { yeni++; yeniPlakalar.push(plakaBicimle(s.plaka)) }
    veriler.push({ id, data, plaka: plakaBicimle(s.plaka) })
  }

  if (!uygula) return NextResponse.json({ yeni, guncel, yeniPlakalar, uygulandi: false })

  for (const v of veriler) {
    if (v.id) await prisma.arac.update({ where: { id: v.id }, data: v.data })
    else {
      const olusan = await prisma.arac.create({ data: { plaka: v.plaka, ...v.data }, select: { id: true } })
      harita.set(norm(v.plaka), olusan.id)
    }
  }
  return NextResponse.json({ yeni, guncel, yeniPlakalar, uygulandi: true })
}
