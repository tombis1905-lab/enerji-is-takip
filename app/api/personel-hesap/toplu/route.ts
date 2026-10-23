export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hesapGuard, gunParse, sayi } from '@/lib/personel-hesap-guard'

// Excel'den toplu aktarım. Gövde: { hesaplar: [{ad, maas, iseBaslama, istenCikis, hareketler:[{tarih,tur,aciklama,hakedilen,odenen}]}], uygula }
// Aynı (hesap + tarih + açıklama + tutarlar) satır tekrar yüklenirse eklenmez.
const norm = (s: any) => String(s || '').toLocaleUpperCase('tr-TR').replace(/[^\p{L}\p{N}]+/gu, '')

export async function POST(req: NextRequest) {
  const g = await hesapGuard(req)
  if (!g.ok) return g.res
  const { hesaplar, uygula } = await req.json()
  if (!Array.isArray(hesaplar) || hesaplar.length === 0) return NextResponse.json({ error: 'Veri yok' }, { status: 400 })

  const mevcut = await prisma.personelHesap.findMany({
    include: { hareketler: { select: { tarih: true, aciklama: true, hakedilen: true, odenen: true } } },
  })
  const byNorm = new Map<string, any>(mevcut.map((h: any) => [norm(h.ad), h]))
  const key = (t: string | null, a: string, h: number, o: number) => `${t || ''}|${norm(a)}|${Math.round(h * 100)}|${Math.round(o * 100)}`

  let yeniHesap = 0, yeniHareket = 0, atlanan = 0
  let yeniHakedilen = 0, yeniOdenen = 0
  const plan: { hesap: any; ad: string; maas: any; iseBaslama: any; istenCikis: any; ekle: any[] }[] = []

  for (const h of hesaplar) {
    const ad = String(h.ad || '').trim()
    if (!ad) continue
    const var_ = byNorm.get(norm(ad))
    const sayac = new Map<string, number>()
    for (const m of var_?.hareketler || []) {
      const k = key(m.tarih ? m.tarih.toISOString().slice(0, 10) : null, m.aciklama || '', m.hakedilen, m.odenen)
      sayac.set(k, (sayac.get(k) || 0) + 1)
    }
    const ekle: any[] = []
    for (const m of h.hareketler || []) {
      const hak = Math.max(0, sayi(m.hakedilen)), ode = Math.max(0, sayi(m.odenen))
      if (hak === 0 && ode === 0) continue
      const t = gunParse(m.tarih) ? String(m.tarih).slice(0, 10) : null
      const k = key(t, m.aciklama || '', hak, ode)
      const n = sayac.get(k) || 0
      if (n > 0) { sayac.set(k, n - 1); atlanan++; continue }
      ekle.push({ tarih: t, tur: String(m.tur || 'DIGER'), aciklama: m.aciklama ? String(m.aciklama).slice(0, 500) : null, hakedilen: hak, odenen: ode })
      yeniHakedilen += hak; yeniOdenen += ode
    }
    if (!var_) yeniHesap++
    yeniHareket += ekle.length
    plan.push({ hesap: var_, ad, maas: h.maas, iseBaslama: h.iseBaslama, istenCikis: h.istenCikis, ekle })
  }

  const ozet = { hesapSayisi: plan.length, yeniHesap, yeniHareket, atlanan, yeniHakedilen, yeniOdenen }
  if (!uygula) return NextResponse.json({ ...ozet, uygulandi: false })

  for (const p of plan) {
    let hesapId = p.hesap?.id as string | undefined
    if (!hesapId) {
      const yeni = await prisma.personelHesap.create({
        data: {
          ad: p.ad,
          maas: p.maas ? sayi(p.maas) : null,
          iseBaslama: gunParse(p.iseBaslama),
          istenCikis: gunParse(p.istenCikis),
        },
      })
      hesapId = yeni.id
    } else {
      const data: any = {}
      if (p.maas && !p.hesap.maas) data.maas = sayi(p.maas)
      if (gunParse(p.iseBaslama) && !p.hesap.iseBaslama) data.iseBaslama = gunParse(p.iseBaslama)
      if (gunParse(p.istenCikis) && !p.hesap.istenCikis) data.istenCikis = gunParse(p.istenCikis)
      if (Object.keys(data).length) await prisma.personelHesap.update({ where: { id: hesapId }, data })
    }
    if (p.ekle.length) {
      await prisma.personelHesapHareket.createMany({
        data: p.ekle.map((m) => ({ hesapId: hesapId!, tarih: gunParse(m.tarih), tur: m.tur, aciklama: m.aciklama, hakedilen: m.hakedilen, odenen: m.odenen })),
      })
    }
  }
  return NextResponse.json({ ...ozet, uygulandi: true })
}
