export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getISOWeek, getISOWeekYear } from 'date-fns'
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

const norm = (s: any) => String(s || '').toLocaleUpperCase('tr-TR').replace(/[^\p{L}\p{N}]+/gu, '')
const hafta = (d: Date) => `${getISOWeekYear(d)}-${getISOWeek(d)}`
const gun = (s: string) => new Date(s + 'T00:00:00.000Z')
const gunStr = (d: Date) => d.toISOString().slice(0, 10)

// Excel'den toplu Haftalık Ödeme aktarımı. uygula=false → önizleme.
// Çoğaltma koruması:
//  1) Aynı (ödeme tarihi + firma + tutar + şirket) kayıt tekrar yüklenirse eklenmez.
//  2) Faturalar'da zaten kayıtlı bir ALINAN fatura (aynı firma + tutar + fatura
//     tarihi, ya da aynı ödeme haftası) haftalık tabloda otomatik göründüğü için
//     o satırlar atlanır — aynı ödeme tabloda iki kez çıkmasın.
export async function POST(req: NextRequest) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const { satirlar, uygula, varsayilanSirketId } = await req.json()
  if (!Array.isArray(satirlar) || satirlar.length === 0) return NextResponse.json({ error: 'Satır yok' }, { status: 400 })
  if (satirlar.length > 5000) return NextResponse.json({ error: 'En fazla 5000 satır' }, { status: 400 })

  const sirketler = await prisma.sirket.findMany({ select: { id: true, ad: true } })
  const sirketBul = (kod: string) => (kod ? sirketler.find((s: any) => norm(s.ad).includes(norm(kod)))?.id : undefined)

  const gecerli: any[] = []
  let sirketsiz = 0
  const bilinmeyenKodlar = new Set<string>()
  for (const s of satirlar as any[]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s.odemeTarihi)) || !(Number(s.tutar) > 0)) continue
    let sirketId = sirketBul(s.sirketKodu)
    if (!sirketId && s.sirketKodu) bilinmeyenKodlar.add(s.sirketKodu)
    if (!sirketId) sirketId = varsayilanSirketId || undefined
    if (!sirketId) { sirketsiz++; continue }
    gecerli.push({ ...s, tutar: Number(s.tutar), sirketId })
  }

  const tumTarihler = gecerli.flatMap((s) => [s.odemeTarihi, /^\d{4}-\d{2}-\d{2}$/.test(String(s.tarih)) ? s.tarih : s.odemeTarihi]).sort()
  const aralik = gecerli.length ? { gte: gun(tumTarihler[0]), lte: gun(tumTarihler[tumTarihler.length - 1]) } : null
  const [mevcutHO, mevcutFat] = aralik
    ? await Promise.all([
        prisma.haftalikOdeme.findMany({
          where: { odemeTarihi: aralik },
          select: { odemeTarihi: true, firma: true, tutar: true, sirketId: true },
        }),
        prisma.fatura.findMany({
          where: { tur: 'ALINAN', OR: [{ odemeTarihi: aralik }, { tarih: aralik }] },
          select: { tarih: true, odemeTarihi: true, karsiTaraf: true, kdvDahilTutar: true },
        }),
      ])
    : [[], []]

  const sayac = new Map<string, number>()
  for (const m of mevcutHO as any[]) {
    if (!m.odemeTarihi) continue
    const k = `${gunStr(m.odemeTarihi)}|${norm(m.firma)}|${Math.round(m.tutar * 100)}|${m.sirketId}`
    sayac.set(k, (sayac.get(k) || 0) + 1)
  }
  const faturaTarihli = new Set<string>()
  const faturaHaftali = new Set<string>()
  for (const f of mevcutFat as any[]) {
    const c = Math.round(f.kdvDahilTutar * 100)
    faturaTarihli.add(`${norm(f.karsiTaraf)}|${c}|${gunStr(f.tarih)}`)
    if (f.odemeTarihi) faturaHaftali.add(`${hafta(f.odemeTarihi)}|${norm(f.karsiTaraf)}|${c}`)
  }

  const eklenecek: any[] = []
  let atlanan = 0
  let faturadaVar = 0
  for (const s of gecerli) {
    const c = Math.round(s.tutar * 100)
    const fatTarih = /^\d{4}-\d{2}-\d{2}$/.test(String(s.tarih)) ? s.tarih : s.odemeTarihi
    if (s.firma && (faturaTarihli.has(`${norm(s.firma)}|${c}|${fatTarih}`) || faturaHaftali.has(`${hafta(gun(s.odemeTarihi))}|${norm(s.firma)}|${c}`))) {
      faturadaVar++
      continue
    }
    const k = `${s.odemeTarihi}|${norm(s.firma)}|${c}|${s.sirketId}`
    const n = sayac.get(k) || 0
    if (n > 0) { sayac.set(k, n - 1); atlanan++; continue }
    eklenecek.push(s)
  }

  const ozet = {
    toplamSatir: satirlar.length,
    eklenecek: eklenecek.length,
    eklenecekToplam: eklenecek.reduce((t, s) => t + s.tutar, 0),
    haftaSayisi: new Set(eklenecek.map((s) => hafta(gun(s.odemeTarihi)))).size,
    atlanan,
    faturadaVar,
    sirketsiz,
    bilinmeyenKodlar: [...bilinmeyenKodlar],
  }
  if (!uygula) return NextResponse.json({ ...ozet, uygulandi: false })

  const veri = eklenecek.map((s) => ({
    tarih: gun(/^\d{4}-\d{2}-\d{2}$/.test(String(s.tarih)) ? s.tarih : s.odemeTarihi),
    odemeTarihi: gun(s.odemeTarihi),
    yapilanIs: String(s.yapilanIs || s.firma || '-').slice(0, 300),
    firma: String(s.firma || '').trim() || null,
    ibanBilgisi: String(s.iban || '').trim() || null,
    tutar: s.tutar,
    yuklenici: String(s.yuklenici || '').trim() || null,
    sirketId: s.sirketId,
  }))
  if (veri.length) await prisma.haftalikOdeme.createMany({ data: veri })
  return NextResponse.json({ ...ozet, uygulandi: true })
}
