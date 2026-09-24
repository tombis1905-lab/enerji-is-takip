export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { startOfISOWeek, endOfISOWeek, getISOWeek } from 'date-fns'
import nodemailer from 'nodemailer'

// Her Cumartesi Tom'un belirlediği e-posta adresine haftalık özet gönderen
// uç nokta. Kimse tarayıcıdan tıklayarak tetiklemesin diye bir "secret" query
// parametresiyle korunuyor — bunu bilmeyen biri bu adrese istek atsa bile
// hiçbir şey olmaz. Gerçek tetikleme, Claude'un kurduğu haftalık zamanlanmış
// görev üzerinden (Cumartesi sabahı bu URL'e istek atarak) yapılıyor.
function paraStr(n: number) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n) + ' ₺'
}

function tarihStr(d: Date) {
  return d.toLocaleDateString('tr-TR')
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const alici = process.env.OZET_ALICI_EMAIL || 'oktaydilekci@gmail.com'
  const simdi = new Date()
  const haftaBaslangic = startOfISOWeek(simdi)
  const haftaBitis = endOfISOWeek(simdi)
  const haftaNo = getISOWeek(simdi)

  // --- 1) Bekleyen alacak / borç (Faturalar sekmesindeki kartlarla aynı mantık) ---
  const bekleyenGruplari = await prisma.fatura.groupBy({
    by: ['tur'],
    where: { odemeDurumu: { not: 'ODENDI' } },
    _sum: { kdvDahilTutar: true },
  })
  const bekleyenAlacak = bekleyenGruplari.find((g) => g.tur === 'KESILEN')?._sum.kdvDahilTutar ?? 0
  const bekleyenBorc = bekleyenGruplari.find((g) => g.tur === 'ALINAN')?._sum.kdvDahilTutar ?? 0

  // --- 2) Cari durum özeti (Cari Durum sekmesiyle aynı netBakiye mantığı) ---
  const [cariler, cariFaturaGruplari, cariOdemeGruplari] = await Promise.all([
    prisma.cari.findMany({ orderBy: { ad: 'asc' } }),
    prisma.fatura.groupBy({
      by: ['cariId', 'tur'],
      where: { cariId: { not: null }, cariEklensinMi: true, odemeDurumu: { not: 'ODENDI' } },
      _sum: { kdvDahilTutar: true },
    }),
    prisma.cariOdeme.groupBy({
      by: ['cariId', 'yon'],
      _sum: { tutar: true },
    }),
  ])
  const cariFaturaMap = new Map<string, { kesilen: number; alinan: number }>()
  for (const g of cariFaturaGruplari) {
    if (!g.cariId) continue
    const kayit = cariFaturaMap.get(g.cariId) ?? { kesilen: 0, alinan: 0 }
    if (g.tur === 'KESILEN') kayit.kesilen += g._sum.kdvDahilTutar ?? 0
    else kayit.alinan += g._sum.kdvDahilTutar ?? 0
    cariFaturaMap.set(g.cariId, kayit)
  }
  const cariOdemeMap = new Map<string, { tahsilat: number; odeme: number }>()
  for (const g of cariOdemeGruplari) {
    const kayit = cariOdemeMap.get(g.cariId) ?? { tahsilat: 0, odeme: 0 }
    if (g.yon === 'TAHSILAT') kayit.tahsilat += g._sum.tutar ?? 0
    else kayit.odeme += g._sum.tutar ?? 0
    cariOdemeMap.set(g.cariId, kayit)
  }
  const cariDurumlari = cariler
    .map((c) => {
      const f = cariFaturaMap.get(c.id) ?? { kesilen: 0, alinan: 0 }
      const o = cariOdemeMap.get(c.id) ?? { tahsilat: 0, odeme: 0 }
      const netBakiye = (f.kesilen + o.odeme) - (f.alinan + o.tahsilat)
      return { ad: c.ad, netBakiye }
    })
    .filter((c) => Math.abs(c.netBakiye) > 0.01)
  const toplamAlacakli = cariDurumlari.filter((c) => c.netBakiye > 0).reduce((s, c) => s + c.netBakiye, 0)
  const toplamBorclu = cariDurumlari.filter((c) => c.netBakiye < 0).reduce((s, c) => s - c.netBakiye, 0)
  const enBuyukBorclular = [...cariDurumlari].filter((c) => c.netBakiye < 0).sort((a, b) => a.netBakiye - b.netBakiye).slice(0, 5)
  const enBuyukAlacaklilar = [...cariDurumlari].filter((c) => c.netBakiye > 0).sort((a, b) => b.netBakiye - a.netBakiye).slice(0, 5)

  // --- 3) Bu haftanın haftalık ödemeleri (Haftalık Ödemeler sekmesiyle aynı gruplama) ---
  const haftaFiltre = {
    OR: [
      { odemeTarihi: { gte: haftaBaslangic, lte: haftaBitis } },
      { odemeTarihi: null, tarih: { gte: haftaBaslangic, lte: haftaBitis } },
    ],
  }
  const [faturaKalemleri, manuelKalemler] = await Promise.all([
    prisma.fatura.findMany({
      where: { tur: 'ALINAN', sirketId: { not: null }, ...haftaFiltre },
      include: { sirket: { select: { ad: true } } },
    }),
    prisma.haftalikOdeme.findMany({
      where: haftaFiltre,
      include: { sirket: { select: { ad: true } } },
    }),
  ])
  const sirketBazinda = new Map<string, { toplam: number; bekleyen: number }>()
  for (const f of faturaKalemleri) {
    const ad = f.sirket?.ad || 'Bilinmeyen'
    const kayit = sirketBazinda.get(ad) ?? { toplam: 0, bekleyen: 0 }
    kayit.toplam += f.kdvDahilTutar
    if (f.odemeDurumu !== 'ODENDI') kayit.bekleyen += f.kdvDahilTutar
    sirketBazinda.set(ad, kayit)
  }
  for (const k of manuelKalemler) {
    const ad = k.sirket?.ad || 'Bilinmeyen'
    const kayit = sirketBazinda.get(ad) ?? { toplam: 0, bekleyen: 0 }
    kayit.toplam += k.tutar
    // Manuel kalemlerin ayrı bir ödeme durumu yok, elden/manuel ödendiği varsayılır — bekleyene eklemiyoruz.
    sirketBazinda.set(ad, kayit)
  }

  // --- E-posta HTML'i oluştur ---
  const satir = (etiket: string, deger: string, renk = '#1f2937') =>
    `<tr><td style="padding:4px 0;color:#6b7280;">${etiket}</td><td style="padding:4px 0;text-align:right;font-weight:600;color:${renk};">${deger}</td></tr>`

  const haftalikOdemelerHtml = sirketBazinda.size === 0
    ? '<p style="color:#6b7280;">Bu hafta için kayıtlı bir ödeme yok.</p>'
    : `<table style="width:100%;border-collapse:collapse;">${Array.from(sirketBazinda.entries())
        .map(([ad, k]) => satir(ad, `${paraStr(k.toplam)}${k.bekleyen > 0 ? ` (bekleyen: ${paraStr(k.bekleyen)})` : ''}`, k.bekleyen > 0 ? '#b45309' : '#15803d'))
        .join('')}</table>`

  const borclularHtml = enBuyukBorclular.length === 0
    ? '<p style="color:#6b7280;">Borçlu olduğumuz cari yok.</p>'
    : `<table style="width:100%;border-collapse:collapse;">${enBuyukBorclular.map((c) => satir(c.ad, paraStr(-c.netBakiye), '#b91c1c')).join('')}</table>`

  const alacaklilarHtml = enBuyukAlacaklilar.length === 0
    ? '<p style="color:#6b7280;">Alacaklı olduğumuz cari yok.</p>'
    : `<table style="width:100%;border-collapse:collapse;">${enBuyukAlacaklilar.map((c) => satir(c.ad, paraStr(c.netBakiye), '#15803d')).join('')}</table>`

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
    <h2 style="margin-bottom:4px;">Enerji İş Takip — Haftalık Özet</h2>
    <p style="color:#6b7280;margin-top:0;">${tarihStr(haftaBaslangic)} – ${tarihStr(haftaBitis)} (${haftaNo}. hafta)</p>

    <h3 style="margin-bottom:6px;border-bottom:2px solid #e5e7eb;padding-bottom:4px;">Bekleyen Alacak / Borç</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      ${satir('Bekleyen Alacak (Kestiğimiz)', paraStr(bekleyenAlacak), '#15803d')}
      ${satir('Bekleyen Borç (Aldığımız)', paraStr(bekleyenBorc), '#b91c1c')}
    </table>

    <h3 style="margin-bottom:6px;border-bottom:2px solid #e5e7eb;padding-bottom:4px;">Bu Haftanın Ödemeleri (Şirket Bazında)</h3>
    ${haftalikOdemelerHtml}

    <h3 style="margin:16px 0 6px;border-bottom:2px solid #e5e7eb;padding-bottom:4px;">Cari Durum Özeti</h3>
    <p style="margin:4px 0;">Toplam alacaklı olduğumuz: <b style="color:#15803d;">${paraStr(toplamAlacakli)}</b> · Toplam borçlu olduğumuz: <b style="color:#b91c1c;">${paraStr(toplamBorclu)}</b></p>
    <p style="margin:12px 0 4px;font-weight:600;">En çok borçlu olduğumuz cariler</p>
    ${borclularHtml}
    <p style="margin:12px 0 4px;font-weight:600;">En çok alacaklı olduğumuz cariler</p>
    ${alacaklilarHtml}

    <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Bu e-posta Enerji İş Takip uygulaması tarafından her Cumartesi otomatik gönderilir.</p>
  </div>`

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return NextResponse.json({ error: 'SMTP_USER / SMTP_PASS tanımlı değil' }, { status: 500 })
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
    await transporter.sendMail({
      from: `Enerji İş Takip <${process.env.SMTP_USER}>`,
      to: alici,
      subject: `Haftalık Özet — ${tarihStr(haftaBaslangic)} / ${tarihStr(haftaBitis)}`,
      html,
    })
    return NextResponse.json({ success: true, alici })
  } catch (e: any) {
    console.error('haftalik-ozet e-posta hatası:', e?.message || e)
    return NextResponse.json({ error: 'E-posta gönderilemedi', detay: e?.message }, { status: 500 })
  }
}
