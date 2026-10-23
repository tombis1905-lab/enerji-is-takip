// "HAFTALIK ÖDEMELER" Excel'ini (haftalık bloklar halinde: başlık satırı +
// kolon başlıkları + fatura satırları + GENEL TOPLAM) okuyup düz satırlara çevirir.
// Blok başlığı: "16.01.2026 MAREL ÖDEMELER", "09.02.2026-13.02.2026 MAREL ÖDEMELER",
// "BERKTEK ENERJİ ÖDEMELER 12.10.2026 - 16.10.2026". Kolon başlıkları blok
// bazında farklı olabilir; isimden bulunur.
import * as XLSX from 'xlsx'

export interface HaftalikSatir {
  odemeTarihi: string // YYYY-MM-DD (satırda yoksa blok başlığındaki son tarih)
  tarih: string // fatura tarihi (yoksa ödeme tarihi)
  sirketKodu: string // MAREL | BERKTEK | OKTAY | ''
  faturaNo: string
  yapilanIs: string
  firma: string
  iban: string
  tutar: number
  yuklenici: string
  blok: string
}

const fold = (v: any) =>
  String(v ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '')

const KODLAR = ['MAREL', 'BERKTEK', 'OKTAY', 'UMTEK']
export const sirketKoduBul = (s: any): string => {
  const b = String(s ?? '').toLocaleUpperCase('tr-TR')
  return KODLAR.find((k) => b.includes(k)) || ''
}

function iso(v: any): string {
  if (v === null || v === undefined || v === '') return ''
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    return d && d.y >= 2000 ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : ''
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const t = String(v).trim()
  let m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : ''
}

const temiz = (v: any) => String(v ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

function sayi(v: any): number {
  if (typeof v === 'number') return v
  let t = String(v ?? '').replace(/[^\d,.\-]/g, '')
  if (!t) return 0
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  const n = Number(t)
  return isNaN(n) ? 0 : n
}

export function haftalikExceliniOku(buf: ArrayBuffer): HaftalikSatir[] {
  const wb = XLSX.read(buf, { type: 'array' })
  const out: HaftalikSatir[] = []
  for (const ad of wb.SheetNames) {
    const aoa: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[ad], { header: 1, raw: true, defval: null })
    let blokBaslik = ''
    let blokTarih = ''
    let blokKod = ''
    let kol: Record<string, number> | null = null
    for (const r of aoa) {
      const a = r[0]
      // Blok başlığı: tek hücreli, "ÖDEME" geçen metin
      if (typeof a === 'string' && r.slice(1).every((x) => x === null || x === '') && fold(a).includes('odeme')) {
        blokBaslik = temiz(a)
        const tarihler = [...a.matchAll(/(\d{1,2})\.(\d{1,2})\.(\d{4})/g)]
        const son = tarihler[tarihler.length - 1]
        blokTarih = son ? `${son[3]}-${son[2].padStart(2, '0')}-${son[1].padStart(2, '0')}` : ''
        blokKod = sirketKoduBul(a)
        kol = null
        continue
      }
      // Kolon başlık satırı
      if (typeof a === 'string' && fold(a) === 'faturano') {
        kol = {}
        r.forEach((x, i) => {
          const f = fold(x)
          if (!f) return
          if (f === 'faturano') kol!.faturaNo = i
          else if (f === 'tarih') kol!.tarih = i
          else if (f.startsWith('odemetarihi')) kol!.odemeTarihi = i
          else if (f.startsWith('yapilanis')) kol!.is = i
          else if (f.startsWith('firma')) kol!.firma = i
          else if (f.startsWith('iban')) kol!.iban = i
          else if (f.startsWith('kdvdahil') || f.startsWith('tutar')) kol!.tutar = i
          else if (f.startsWith('odemeyapan')) kol!.odeyen = i
          else if (f.startsWith('yuklenici')) kol!.yuklenici = i
        })
        continue
      }
      if (!kol || kol.tutar === undefined) continue
      // GENEL TOPLAM / boş satır
      const tutar = sayi(r[kol.tutar])
      const isMetni = kol.is !== undefined ? temiz(r[kol.is]) : ''
      const firma = kol.firma !== undefined ? temiz(r[kol.firma]) : ''
      if (!(tutar > 0) || (!isMetni && !firma)) continue
      if (fold(r.map((x) => x ?? '').join(' ')).includes('genel toplam'.replace(/ /g, ''))) continue
      const odemeSatir = kol.odemeTarihi !== undefined ? iso(r[kol.odemeTarihi]) : ''
      const faturaTarihHam = kol.tarih !== undefined ? iso(r[kol.tarih]) : ''
      // Blok başlığı yoksa (düz liste) ve satırda ödeme tarihi boşsa fatura tarihine düş
      const odemeTarihi = odemeSatir || blokTarih || faturaTarihHam
      if (!odemeTarihi) continue
      const faturaTarih = faturaTarihHam || odemeTarihi
      const odeyen = kol.odeyen !== undefined ? sirketKoduBul(r[kol.odeyen]) : ''
      out.push({
        odemeTarihi,
        tarih: faturaTarih,
        sirketKodu: odeyen || blokKod,
        faturaNo: kol.faturaNo !== undefined ? temiz(r[kol.faturaNo]) : '',
        yapilanIs: isMetni || firma,
        firma,
        iban: kol.iban !== undefined ? temiz(r[kol.iban]) : '',
        tutar,
        yuklenici: kol.yuklenici !== undefined ? temiz(r[kol.yuklenici]) : '',
        blok: blokBaslik,
      })
    }
  }
  return out
}
