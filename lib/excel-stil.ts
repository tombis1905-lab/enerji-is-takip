// Cari Excel çıktıları için ortak stil yardımcıları (exceljs).
// Tom'un kendi Excel dosyasındaki görünüm: lacivert başlık + beyaz kalın yazı,
// ince kenarlıklar, ₺ para biçimi, sarı kalın GENEL TOPLAM satırı.
import type { Workbook, Worksheet, Row, Cell } from 'exceljs'

export const RENK = {
  lacivert: 'FF1F4E78',
  acikMavi: 'FFDDEBF7',
  sari: 'FFFFFF00',
  gri: 'FFF2F2F2',
  kirmiziAcik: 'FFFCE4E4',
  yesilAcik: 'FFE2F0D9',
  kirmizi: 'FFC00000',
  yesil: 'FF2E7D32',
  beyaz: 'FFFFFFFF',
}

export const PARA_FORMAT = '_-"₺"* #,##0.00_-;\\-"₺"* #,##0.00_-;_-"₺"* "-"??_-;_-@_-'

const INCE = { style: 'thin' as const, color: { argb: 'FF808080' } }
export const KENARLIK = { top: INCE, left: INCE, bottom: INCE, right: INCE }

export async function yeniKitap(): Promise<Workbook> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Enerji İş Takip'
  return wb
}

export function sayfaAc(wb: Workbook, ad: string, kolonGenislikleri: number[]): Worksheet {
  const ws = wb.addWorksheet(ad, { views: [{ showGridLines: false }] })
  ws.columns = kolonGenislikleri.map((width) => ({ width }))
  return ws
}

function hucre(c: Cell, o: { kalin?: boolean; renk?: string; dolgu?: string; hiza?: 'left' | 'center' | 'right'; boyut?: number; kenar?: boolean; format?: string; wrap?: boolean }) {
  c.font = { name: 'Calibri', size: o.boyut ?? 11, bold: !!o.kalin, color: { argb: o.renk ?? 'FF000000' } }
  if (o.dolgu) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: o.dolgu } }
  c.alignment = { vertical: 'middle', horizontal: o.hiza ?? 'center', wrapText: o.wrap ?? false }
  if (o.kenar !== false) c.border = KENARLIK
  if (o.format) c.numFmt = o.format
}

/** Birleştirilmiş büyük başlık satırı. */
export function baslikSatiri(ws: Worksheet, metin: string, kolonSayisi: number, dolgu = RENK.lacivert, renk = RENK.beyaz): Row {
  const r = ws.addRow([metin])
  ws.mergeCells(r.number, 1, r.number, kolonSayisi)
  r.height = 28
  hucre(r.getCell(1), { kalin: true, boyut: 15, renk, dolgu, hiza: 'center', kenar: false })
  return r
}

/** Bölüm başlığı (örn. "BORÇ KAYITLARI") — açık mavi, kalın, birleşik. */
export function bolumSatiri(ws: Worksheet, metin: string, kolonSayisi: number, dolgu = RENK.acikMavi): Row {
  const r = ws.addRow([metin])
  ws.mergeCells(r.number, 1, r.number, kolonSayisi)
  r.height = 22
  hucre(r.getCell(1), { kalin: true, boyut: 12, renk: RENK.lacivert, dolgu, hiza: 'left' })
  return r
}

/** Kolon başlık satırı: lacivert zemin, beyaz kalın yazı. */
export function kolonBasliklari(ws: Worksheet, basliklar: string[]): Row {
  const r = ws.addRow(basliklar)
  r.height = 24
  r.eachCell((c) => hucre(c, { kalin: true, renk: RENK.beyaz, dolgu: RENK.lacivert, wrap: true }))
  return r
}

export interface VeriSecenek {
  /** 0-bazlı kolon indeksleri: para biçimi uygulanacaklar */
  paraKolon?: number[]
  /** sola yaslı kolonlar (metinler) */
  solKolon?: number[]
  /** zebra (her ikinci satır gri) */
  zebra?: boolean
}

export function veriSatiri(ws: Worksheet, deger: any[], sira: number, s: VeriSecenek = {}): Row {
  const r = ws.addRow(deger)
  r.height = 20
  r.eachCell({ includeEmpty: true }, (c, no) => {
    if (no > deger.length) return
    const i = no - 1
    const para = s.paraKolon?.includes(i)
    hucre(c, {
      hiza: para ? 'right' : s.solKolon?.includes(i) ? 'left' : 'center',
      format: para ? PARA_FORMAT : undefined,
      dolgu: s.zebra && sira % 2 === 1 ? RENK.gri : undefined,
      wrap: s.solKolon?.includes(i),
    })
  })
  return r
}

/** Sarı, kalın GENEL TOPLAM satırı. */
export function toplamSatiri(ws: Worksheet, deger: any[], paraKolon: number[]): Row {
  const r = ws.addRow(deger)
  r.height = 24
  r.eachCell({ includeEmpty: true }, (c, no) => {
    if (no > deger.length) return
    const para = paraKolon.includes(no - 1)
    hucre(c, { kalin: true, dolgu: RENK.sari, hiza: para ? 'right' : 'center', format: para ? PARA_FORMAT : undefined })
  })
  return r
}

export function renkliYazi(c: Cell, renk: string, kalin = true) {
  c.font = { ...(c.font || {}), name: 'Calibri', size: 11, bold: kalin, color: { argb: renk } }
}

export function bosSatir(ws: Worksheet) {
  ws.addRow([])
}

/** Tarayıcıda dosyayı indirir. */
export async function indir(wb: Workbook, dosyaAdi: string) {
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = dosyaAdi
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
