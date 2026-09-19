export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
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

// Karşılaştırma için boşluk/Türkçe karakter/nbsp farklarını sadeleştirir.
function normalizeKey(k: any): string {
  return String(k ?? '')
    .replace(/ /g, ' ')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '')
}

function temizle(v: any): string {
  return String(v ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
}

// "-", boş veya sadece boşluk -> dolu sayılmaz.
function bosMu(v: any): boolean {
  const t = temizle(v)
  return t === '' || t === '-'
}

function excelTarihCoz(v: any): Date | null {
  if (v === undefined || v === null || v === '') return null
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v
  if (typeof v === 'number') {
    // Excel seri tarih numarası (1900 tabanlı)
    const ms = Math.round((v - 25569) * 86400 * 1000)
    const d = new Date(ms)
    return isNaN(d.getTime()) ? null : d
  }
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

function sayiCoz(v: any): number | null {
  if (v === undefined || v === null || v === '') return null
  if (typeof v === 'number') return isNaN(v) ? null : v
  const temiz = String(v).replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')
  if (temiz === '' || temiz === '-') return null
  const n = Number(temiz)
  return isNaN(n) ? null : n
}

// Tom'un gerçek "Haftalık Ödemeler / Cari" Excel dosyası, tek bir düz tablo
// değil — her şirket+hafta için ayrı bir blok halinde tekrar eden, sabit 9
// sütunlu (FATURA NO, TARİH, ÖDEME TARİHİ, YAPILAN İŞ, FİRMA, IBAN BİLGİSİ,
// KDV DAHİL TUTAR, ÖDEME YAPAN FİRMA, YÜKLENİCİ) bir yapı. Aralarda hafta
// başlığı, şirket başlığı, tekrar eden sütun başlığı, "GENEL TOPLAM" ve
// "KALAN ÖDEME TOPLAM" satırları var. Bunların hepsini elemek yerine, gerçek
// bir ödeme satırının her zaman geçerli bir TARİH (B sütunu) ve bir KDV DAHİL
// TUTAR (G sütunu) taşıdığı gözlemine dayanıyoruz: ikisi de doluysa gerçek
// satır, değilse yapısal satır (başlık/toplam/boş) kabul edilip sessizce
// atlanır.
function eslesenSirket(odemeYapanTemiz: string, sirketMap: Map<string, string>): string | null {
  const norm = normalizeKey(odemeYapanTemiz)
  if (!norm) return null
  if (sirketMap.has(norm)) return sirketMap.get(norm)!
  for (const [sirketNorm, id] of sirketMap.entries()) {
    if (norm.startsWith(sirketNorm) || sirketNorm.startsWith(norm)) return id
  }
  return null
}

export async function POST(req: NextRequest) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const body = await req.json().catch(() => ({}))
  const satirlar: any[][] = Array.isArray(body?.satirlar) ? body.satirlar : []
  const cariEklensinMi = !!body?.cariEklensinMi

  if (satirlar.length === 0) {
    return NextResponse.json({ error: 'Aktarılacak satır bulunamadı' }, { status: 400 })
  }

  const [sirketler, santiyeler] = await Promise.all([
    prisma.sirket.findMany(),
    prisma.santiye.findMany(),
  ])
  const sirketMap = new Map(sirketler.map((s: any) => [normalizeKey(s.ad), s.id as string]))
  const santiyeMap = new Map(santiyeler.map((s: any) => [normalizeKey(s.ad), s.id as string]))
  const cariCache = new Map<string, string | null>()

  let eklenen = 0
  let yapisalAtlanan = 0
  const hatalar: string[] = []

  for (let i = 0; i < satirlar.length; i++) {
    const satir = satirlar[i]
    if (!Array.isArray(satir)) continue
    const excelSatirNo = i + 1

    const [faturaNoRaw, tarihRaw, odemeTarihiRaw, isRaw, firmaRaw, ibanRaw, tutarRaw, odemeYapanRaw, yukleniciRaw] = satir

    // "GENEL TOPLAM" / "KALAN ÖDEME TOPLAM" gibi haftalık özet satırları IBAN
    // sütununun yerinde bu etiketi taşır — bunlar gerçek bir ödeme kaydı
    // değil, o haftanın toplamı, o yüzden sessizce atlanır (hata sayılmaz).
    const ibanNormOnce = normalizeKey(ibanRaw)
    if (ibanNormOnce.includes('genel toplam'.replace(/\s/g, '')) || ibanNormOnce.includes('kalanodeme')) {
      continue
    }

    const tarih = excelTarihCoz(tarihRaw)
    const kdvDahilTutar = sayiCoz(tutarRaw)

    // Gerçek bir ödeme/fatura satırının her zaman tarihi ve tutarı olur —
    // ikisi de yoksa bu bir başlık/toplam/boş satırdır, sessizce atla.
    if (!tarih && kdvDahilTutar === null) {
      continue
    }
    if (!tarih || kdvDahilTutar === null) {
      yapisalAtlanan++
      hatalar.push(`Excel satırı ${excelSatirNo}: tarih veya tutardan biri eksik, atlandı`)
      continue
    }

    const faturaNo = bosMu(faturaNoRaw) ? null : temizle(faturaNoRaw)
    const aciklama = bosMu(isRaw) ? null : temizle(isRaw)
    const firmaTemiz = bosMu(firmaRaw) ? null : temizle(firmaRaw)
    const yuklenici = bosMu(yukleniciRaw) ? null : temizle(yukleniciRaw)
    const odemeTarihi = excelTarihCoz(odemeTarihiRaw)

    // IBAN sütunu bazen gerçek IBAN yerine "ÖDENDİ" durum bilgisi ya da
    // "Kendi İbanı" notu taşıyor.
    const ibanTemiz = temizle(ibanRaw)
    const ibanNorm = normalizeKey(ibanTemiz)
    let odemeDurumu: 'BEKLIYOR' | 'ODENDI' = 'BEKLIYOR'
    let ibanBilgisi: string | null = null
    if (ibanNorm === 'odendi') {
      odemeDurumu = 'ODENDI'
    } else if (!bosMu(ibanTemiz)) {
      ibanBilgisi = ibanTemiz
    }

    // Fatura numarası olan satırlar gerçek tedarikçi faturaları (KDV'li);
    // fatura numarası olmayanlar çoğunlukla maaş/avans gibi KDV'siz ödemeler.
    const kdvOrani = faturaNo ? 20 : 0
    const tutar = kdvDahilTutar / (1 + kdvOrani / 100)
    const kdvTutari = kdvDahilTutar - tutar

    const sirketId = odemeYapanRaw && !bosMu(odemeYapanRaw) ? eslesenSirket(temizle(odemeYapanRaw), sirketMap) : null

    let cariId: string | null = null
    if (firmaTemiz) {
      const norm = normalizeKey(firmaTemiz)
      if (cariCache.has(norm)) {
        cariId = cariCache.get(norm)!
      } else {
        let cari = await prisma.cari.findUnique({ where: { ad: firmaTemiz } })
        if (!cari && cariEklensinMi) {
          const ibanGercekMi = ibanBilgisi && /^TR/i.test(ibanBilgisi.replace(/\s/g, ''))
          cari = await prisma.cari.create({
            data: { ad: firmaTemiz, ibanBilgisi: ibanGercekMi ? ibanBilgisi : null },
          }).catch(() => null)
        }
        cariId = cari?.id ?? null
        cariCache.set(norm, cariId)
      }
    }

    try {
      await prisma.fatura.create({
        data: {
          tur: 'ALINAN',
          faturaNo,
          tarih,
          aciklama,
          karsiTaraf: firmaTemiz,
          tutar,
          kdvOrani,
          kdvTutari,
          kdvDahilTutar,
          odemeDurumu,
          sirketId,
          santiyeId: null,
          odemeTarihi,
          ibanBilgisi,
          yuklenici,
          cariId,
          cariEklensinMi: !!cariId && cariEklensinMi,
        },
      })
      eklenen++
    } catch (e: any) {
      hatalar.push(`Excel satırı ${excelSatirNo}: kaydedilemedi (${e.message ?? 'hata'})`)
    }
  }

  return NextResponse.json({ eklenen, atlanan: yapisalAtlanan, hatalar })
}
