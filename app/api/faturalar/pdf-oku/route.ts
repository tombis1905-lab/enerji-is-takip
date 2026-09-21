export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { faturaTokenGecerliMi, FATURA_COOKIE_NAME } from '@/lib/fatura-auth'
import { PDFParse } from 'pdf-parse'

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

function sayiCoz(v: string): number | null {
  const temiz = v.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')
  const n = Number(temiz)
  return Number.isFinite(n) && n > 0 ? n : null
}

// Tarihi gg.aa.yyyy / gg/aa/yyyy / gg-aa-yyyy formatlarından yyyy-mm-dd'ye çevirir.
function tarihCoz(gun: string, ay: string, yil: string): string | null {
  const g = Number(gun), a = Number(ay), y = Number(yil)
  if (!g || !a || !y || g > 31 || a > 12 || y < 2015 || y > 2100) return null
  return `${y}-${String(a).padStart(2, '0')}-${String(g).padStart(2, '0')}`
}

// Türkiye e-Fatura/e-Arşiv numarası standart olarak 3 harf/rakam ön ek + 4
// haneli yıl + 8-10 haneli sıra numarasından oluşur (ör. KEA2026000000299).
// Kesin bir kural yok, bu yüzden en olası adayı seçen bir tahmin.
function faturaNoTahminEt(metin: string): string | null {
  const adaylar = metin.match(/\b[A-ZÇĞİÖŞÜ0-9]{3}20[12]\d\d{8,10}\b/g)
  if (adaylar && adaylar.length > 0) return adaylar[0]
  return null
}

function ibanTahminEt(metin: string): string | null {
  const m = metin.match(/TR\d{2}\s?(?:\d{4}\s?){5}\d{2}/)
  if (!m) return null
  return m[0].replace(/\s+/g, '')
}

function tarihTahminEt(metin: string): string | null {
  // Önce "Fatura Tarihi" gibi bir etiketin hemen yakınındaki tarihi dene.
  const etiketli = metin.match(/(fatura\s*tarihi|düzenleme\s*tarihi)[^\d]{0,20}(\d{1,2})[./-](\d{1,2})[./-](\d{4})/i)
  if (etiketli) {
    const t = tarihCoz(etiketli[2], etiketli[3], etiketli[4])
    if (t) return t
  }
  const ilkTarih = metin.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/)
  if (ilkTarih) {
    const t = tarihCoz(ilkTarih[1], ilkTarih[2], ilkTarih[3])
    if (t) return t
  }
  return null
}

function tutarTahminEt(metin: string): number | null {
  // Sırasıyla en güvenilir etiketten en genele doğru dene.
  const etiketler = [
    /ödenecek\s*tutar[^\d]{0,10}([\d.,]+)/i,
    /vergiler\s*dahil\s*toplam\s*tutar[^\d]{0,10}([\d.,]+)/i,
    /genel\s*toplam[^\d]{0,10}([\d.,]+)/i,
    /toplam\s*tutar[^\d]{0,10}([\d.,]+)/i,
  ]
  for (const re of etiketler) {
    const m = metin.match(re)
    if (m) {
      const n = sayiCoz(m[1])
      if (n) return n
    }
  }
  return null
}

// Yüklenen PDF'in metnini çıkarır ve fatura no / tarih / KDV dahil tutar /
// IBAN alanlarını en olası tahminleriyle döner. Hiçbir şeyi kaydetmez — Tom
// "Yeni Fatura" formunda tahminleri kontrol edip düzelterek kaydeder. Böylece
// yanlış okunan bir alan sessizce veritabanına yazılmaz.
export async function POST(req: NextRequest) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const form = await req.formData()
  const dosya = form.get('dosya') as File | null
  if (!dosya) return NextResponse.json({ error: 'Dosya gerekli' }, { status: 400 })
  if (dosya.type !== 'application/pdf' && !dosya.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Sadece PDF dosyası yüklenebilir' }, { status: 400 })
  }
  if (dosya.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "Dosya 20MB'tan büyük olamaz" }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await dosya.arrayBuffer())
    const parser = new PDFParse({ data: buffer })
    const sonuc = await parser.getText()
    const metin = sonuc.text || ''

    if (!metin.trim()) {
      return NextResponse.json({
        faturaNo: null, tarih: null, kdvDahilTutar: null, ibanBilgisi: null,
        uyari: 'PDF içinden metin okunamadı (muhtemelen taranmış görsel bir PDF). Alanları elle doldurmanız gerekecek.',
      })
    }

    return NextResponse.json({
      faturaNo: faturaNoTahminEt(metin),
      tarih: tarihTahminEt(metin),
      kdvDahilTutar: tutarTahminEt(metin),
      ibanBilgisi: ibanTahminEt(metin),
    })
  } catch (e: any) {
    // Tanı için sunucu loguna tam hatayı yazıyoruz; kullanıcıya kısa mesaj dönüyoruz.
    console.error('pdf-oku hata:', e?.message || e, e?.stack || '')
    return NextResponse.json({ error: `PDF okunamadı: ${e?.message || 'bilinmeyen hata'}` }, { status: 500 })
  }
}
