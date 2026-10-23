export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hesapGuard, gunParse, sayi } from '@/lib/personel-hesap-guard'

// Liste + bakiye özeti. bakiye = hakedilen - ödenen (negatif = personel borçlu)
export async function GET(req: NextRequest) {
  const g = await hesapGuard(req)
  if (!g.ok) return g.res
  const hesaplar = await prisma.personelHesap.findMany({
    orderBy: { ad: 'asc' },
    include: { hareketler: { select: { tur: true, hakedilen: true, odenen: true, tarih: true } } },
  })
  const liste = hesaplar.map((h: any) => {
    const hakedilen = h.hareketler.reduce((t: number, x: any) => t + x.hakedilen, 0)
    const odenen = h.hareketler.reduce((t: number, x: any) => t + x.odenen, 0)
    const son = h.hareketler.map((x: any) => x.tarih).filter(Boolean).sort().pop() || null
    return {
      id: h.id, ad: h.ad, maas: h.maas, iseBaslama: h.iseBaslama, istenCikis: h.istenCikis,
      notlar: h.notlar, aktif: h.aktif,
      hakedilen, odenen, bakiye: hakedilen - odenen, hareketSayisi: h.hareketler.length, sonHareket: son,
    }
  })
  return NextResponse.json(liste)
}

export async function POST(req: NextRequest) {
  const g = await hesapGuard(req)
  if (!g.ok) return g.res
  const b = await req.json()
  const ad = String(b.ad || '').trim()
  if (!ad) return NextResponse.json({ error: 'Ad zorunlu' }, { status: 400 })
  if (await prisma.personelHesap.findUnique({ where: { ad } })) {
    return NextResponse.json({ error: 'Bu isimde hesap var' }, { status: 409 })
  }
  const h = await prisma.personelHesap.create({
    data: {
      ad,
      maas: b.maas === '' || b.maas == null ? null : sayi(b.maas),
      iseBaslama: gunParse(b.iseBaslama),
      istenCikis: gunParse(b.istenCikis),
      notlar: b.notlar ? String(b.notlar) : null,
    },
  })
  return NextResponse.json(h, { status: 201 })
}
