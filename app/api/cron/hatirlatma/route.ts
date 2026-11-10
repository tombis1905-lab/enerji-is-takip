export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { prisma } from '@/lib/db'

// Günlük hatırlatma e-postası:
//  - Araç sigorta / muayene / kasko bitişi 30 gün içinde (veya geçmiş)
//  - Ödenecek (verilen) çeklerden vadesi 7 gün içinde olan veya geçmiş bekleyenler
// Gönderilecek bir şey yoksa e-posta atmaz. CRON_SECRET ile korunur;
// ?test=1 verilirse içerik boş olsa da deneme e-postası gönderir.
const ARAC_GUN = 30
const CEK_GUN = 7

const para = (n: number) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n) + ' ₺'
const tarih = (d: Date) => d.toLocaleDateString('tr-TR', { timeZone: 'UTC' })
const esc = (s: any) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))
const kalanYazi = (g: number) => (g < 0 ? `${-g} gün GEÇTİ` : g === 0 ? 'BUGÜN' : `${g} gün kaldı`)
const renk = (g: number) => (g < 0 ? '#b91c1c' : g <= 7 ? '#c2410c' : '#374151')

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }
  const test = req.nextUrl.searchParams.get('test') === '1'
  const alici = process.env.HATIRLATMA_EMAIL || 'berktek.enerji@gmail.com'

  const bugun = new Date()
  bugun.setUTCHours(0, 0, 0, 0)
  const gun = (d: Date) => Math.round((new Date(d).getTime() - bugun.getTime()) / 86400000)

  // --- Araçlar
  const araclar = await prisma.arac.findMany({
    where: { aktif: true, NOT: { plaka: 'MİSAFİR ARAÇ' } },
    select: { plaka: true, isim: true, sigortaBitisTarihi: true, muayeneBitisTarihi: true, kaskoBitisTarihi: true },
  })
  const aracSatir: { plaka: string; isim: string; tur: string; bitis: Date; g: number }[] = []
  for (const a of araclar as any[]) {
    for (const [tur, d] of [['Sigorta', a.sigortaBitisTarihi], ['Muayene', a.muayeneBitisTarihi], ['Kasko', a.kaskoBitisTarihi]] as const) {
      if (!d) continue
      const g = gun(d)
      if (g <= ARAC_GUN) aracSatir.push({ plaka: a.plaka, isim: a.isim || '', tur, bitis: new Date(d), g })
    }
  }
  aracSatir.sort((x, y) => x.g - y.g)

  // --- Ödenecek çekler
  const sinir = new Date(bugun.getTime() + CEK_GUN * 86400000)
  const cekler = await prisma.cek.findMany({
    where: { tur: 'VERILEN', durum: 'BEKLEMEDE', vadeTarihi: { lte: sinir } },
    orderBy: { vadeTarihi: 'asc' },
    include: { sirket: { select: { ad: true } } },
  })
  const cekToplam = cekler.reduce((t: number, c: any) => t + c.tutar, 0)

  if (aracSatir.length === 0 && cekler.length === 0 && !test) {
    return NextResponse.json({ success: true, gonderildi: false, neden: 'Hatırlatılacak kayıt yok' })
  }

  const th = 'text-align:left;padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;'
  const td = 'padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:14px;'
  const aracHtml = aracSatir.length
    ? `<table style="width:100%;border-collapse:collapse;"><tr><th style="${th}">Araç</th><th style="${th}">Belge</th><th style="${th}">Bitiş</th><th style="${th}">Durum</th></tr>${aracSatir
        .map((r) => `<tr><td style="${td}">${esc(r.plaka)}${r.isim ? ` <span style="color:#6b7280">(${esc(r.isim)})</span>` : ''}</td><td style="${td}">${r.tur}</td><td style="${td}">${tarih(r.bitis)}</td><td style="${td}color:${renk(r.g)};font-weight:600;">${kalanYazi(r.g)}</td></tr>`)
        .join('')}</table>`
    : '<p style="color:#6b7280;font-size:14px;">Yaklaşan araç belgesi yok.</p>'
  const cekHtml = cekler.length
    ? `<table style="width:100%;border-collapse:collapse;"><tr><th style="${th}">Vade</th><th style="${th}">Kime</th><th style="${th}">Banka / No</th><th style="${th}">Tutar</th><th style="${th}">Durum</th></tr>${cekler
        .map((c: any) => { const g = gun(c.vadeTarihi); return `<tr><td style="${td}">${tarih(c.vadeTarihi)}</td><td style="${td}">${esc(c.karsiTaraf)}</td><td style="${td}">${esc([c.banka, c.cekNo].filter(Boolean).join(' / '))}</td><td style="${td}text-align:right;">${para(c.tutar)}</td><td style="${td}color:${renk(g)};font-weight:600;">${kalanYazi(g)}</td></tr>` })
        .join('')}<tr><td colspan="3" style="${td}font-weight:700;">Toplam</td><td style="${td}text-align:right;font-weight:700;">${para(cekToplam)}</td><td></td></tr></table>`
    : '<p style="color:#6b7280;font-size:14px;">Önümüzdeki 7 gün içinde ödenecek çek yok.</p>'

  const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#111827;">
    <h2 style="margin:0 0 4px;">Hatırlatma — ${tarih(bugun)}</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:13px;">Araç belgeleri (${ARAC_GUN} gün) ve ödenecek çekler (${CEK_GUN} gün)</p>
    <h3 style="margin:16px 0 6px;">Araç sigorta / muayene / kasko (${aracSatir.length})</h3>${aracHtml}
    <h3 style="margin:20px 0 6px;">Ödenecek çekler (${cekler.length})</h3>${cekHtml}
    <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Bu e-posta Enerji İş Takip uygulaması tarafından otomatik gönderilir.</p>
  </div>`

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return NextResponse.json({ error: 'SMTP_USER / SMTP_PASS tanımlı değil' }, { status: 500 })
  }
  try {
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } })
    await transporter.sendMail({
      from: `Enerji İş Takip <${process.env.SMTP_USER}>`,
      to: alici,
      subject: `Hatırlatma: ${aracSatir.length} araç belgesi, ${cekler.length} çek ödemesi`,
      html,
    })
    return NextResponse.json({ success: true, gonderildi: true, alici, arac: aracSatir.length, cek: cekler.length })
  } catch (e: any) {
    console.error('hatirlatma e-posta hatası:', e?.message || e)
    return NextResponse.json({ error: 'E-posta gönderilemedi', detay: e?.message }, { status: 500 })
  }
}
