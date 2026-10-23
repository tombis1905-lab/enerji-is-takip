// "2026 HARCAMA VE MAAŞ TAKİP" Excel'ini okur: her sayfa = bir personel.
// Üst bilgi: A1 ad, "İŞE BAŞLAMA / İŞTEN ÇIKIŞ TARİHİ", "ANLAŞILAN MAAŞ".
// Tablo: TARİH | AÇIKLAMA | Harcanan-Hakedilen | Alınan-Ödenen. TOPLAM satırları atlanır.
import * as XLSX from 'xlsx'

export interface HesapHareketSatir {
  tarih: string | null
  tur: string
  aciklama: string
  hakedilen: number
  odenen: number
}
export interface HesapSatir {
  ad: string
  maas: number | null
  iseBaslama: string | null
  istenCikis: string | null
  hareketler: HesapHareketSatir[]
}

const fold = (v: any) =>
  String(v ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '')

function iso(v: any): string | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    return d && d.y >= 2000 ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : null
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const t = String(v).trim()
  let m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

const num = (v: any): number => {
  if (typeof v === 'number') return v
  const n = parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function turBul(aciklama: string, hakedilen: number, odenen: number): string {
  const f = fold(aciklama)
  if (f.includes('devir')) return 'DEVIR'
  if (odenen > 0) {
    if (f.includes('tazminat') && f.includes('avans')) return 'AVANS'
    if (f.includes('avans')) return 'AVANS'
    if (f.includes('tazminat')) return 'TAZMINAT'
    if (f.includes('maas')) return 'MAAS'
    return 'ODEME'
  }
  if (f.includes('maas')) return 'MAAS'
  return 'HARCAMA'
}

export function hesapExceliniOku(buf: ArrayBuffer, tekrarAyikla = true): { hesaplar: HesapSatir[]; mukerrer: number } {
  const wb = XLSX.read(buf, { type: 'array' })
  const hesaplar: HesapSatir[] = []
  let mukerrer = 0

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as any
    const baslikIdx = rows.findIndex(
      (r) => fold(r[0]) === 'tarih' && r.some((c) => fold(c).includes('harcanan') || fold(c).includes('hakedilen')),
    )
    if (baslikIdx < 0) continue

    let ad = String(rows[0]?.[0] ?? '').trim() || sheetName.trim()
    let maas: number | null = null
    let ise: string | null = null
    let cikis: string | null = null
    for (let i = 0; i < baslikIdx; i++) {
      const r = rows[i] || []
      r.forEach((c, j) => {
        const f = fold(c)
        const sonraki = r.slice(j + 1).find((x) => x !== null && x !== '' && !(typeof x === 'string' && /!/.test(x)))
        if (f.includes('isebaslama')) ise = iso(sonraki)
        else if (f.includes('istencikis')) cikis = iso(sonraki)
        else if (f.includes('anlasilanmaas') && typeof sonraki === 'number') maas = sonraki
      })
    }

    const hareketler: HesapHareketSatir[] = []
    const gorulen = new Set<string>()
    for (let i = baslikIdx + 1; i < rows.length; i++) {
      const r = rows[i] || []
      const aciklama = String(r[1] ?? '').trim()
      const fa = fold(aciklama)
      if (fa.startsWith('toplam') || fa.startsWith('genel') || fold(r[0]).includes('toplam')) continue
      const hak = Math.max(0, num(r[2]))
      const ode = Math.max(0, num(r[3]))
      if (hak === 0 && ode === 0) continue
      const tarih = iso(r[0])
      const satir = { tarih, tur: turBul(aciklama, hak, ode), aciklama, hakedilen: hak, odenen: ode }
      if (tekrarAyikla && satir.tur !== 'DEVIR') {
        const k = `${tarih}|${fa}|${hak}|${ode}`
        if (gorulen.has(k)) { mukerrer++; continue }
        gorulen.add(k)
      }
      hareketler.push(satir)
    }
    if (hareketler.length || maas || ise) hesaplar.push({ ad, maas, iseBaslama: ise, istenCikis: cikis, hareketler })
  }
  return { hesaplar, mukerrer }
}
