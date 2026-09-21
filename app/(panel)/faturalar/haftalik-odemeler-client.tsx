'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Pencil, Trash2, Download, Receipt } from 'lucide-react'
import { getISOWeek, startOfISOWeek, endOfISOWeek } from 'date-fns'
import * as XLSX from 'xlsx'

interface Sirket { id: string; ad: string }

interface FaturaKalemi {
  id: string
  tur: 'KESILEN' | 'ALINAN'
  faturaNo: string | null
  tarih: string
  odemeTarihi: string | null
  karsiTaraf: string | null
  kdvDahilTutar: number
  ibanBilgisi: string | null
  yuklenici: string | null
  sirketId: string | null
  sirket: { ad: string } | null
  odemeDurumu: 'BEKLIYOR' | 'ODENDI' | 'GECIKTI'
}

interface HaftalikOdeme {
  id: string
  tarih: string
  odemeTarihi: string | null
  yapilanIs: string
  firma: string | null
  ibanBilgisi: string | null
  tutar: number
  yuklenici: string | null
  sirketId: string
  sirket: { ad: string } | null
}

// Ortak satır şekli: hem faturadan otomatik gelen hem elle girilen kalemler
// aynı tabloda gösterilir. kaynak alanı ayırt etmek için kullanılır.
interface Satir {
  id: string
  kaynak: 'fatura' | 'manuel'
  faturaNo: string | null
  tarih: string
  odemeTarihi: string | null
  yapilanIs: string
  firma: string
  ibanBilgisi: string
  tutar: number
  yuklenici: string
  sirketId: string
  odemeDurumu: 'BEKLIYOR' | 'ODENDI' | 'GECIKTI' | null
}

const DURUM_LABEL: Record<'BEKLIYOR' | 'ODENDI' | 'GECIKTI', string> = {
  BEKLIYOR: 'Bekliyor',
  ODENDI: 'Ödendi',
  GECIKTI: 'Gecikti',
}

const DURUM_RENK: Record<'BEKLIYOR' | 'ODENDI' | 'GECIKTI', string> = {
  BEKLIYOR: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  GECIKTI: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  ODENDI: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
}

const EMPTY_FORM = {
  tarih: '', odemeTarihi: '', yapilanIs: '', firma: '', ibanBilgisi: '', tutar: '', yuklenici: '', sirketId: '',
}

function tarihStr(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('tr-TR')
}

function paraStr(n: number) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n) + ' ₺'
}

// Haftanın gruplanacağı tarih: gerçek ödeme tarihi girilmişse o, yoksa
// faturanın/kalemin tarihi esas alınır.
function haftaTarihi(s: Satir) {
  return s.odemeTarihi || s.tarih
}

function haftaAnahtari(d: string) {
  const tarih = new Date(d)
  return `${tarih.getFullYear()}-${getISOWeek(tarih)}`
}

export function HaftalikOdemelerClient({ faturalar, sirketler }: { faturalar: FaturaKalemi[]; sirketler: Sirket[] }) {
  const [kalemler, setKalemler] = useState<HaftalikOdeme[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [filterSirket, setFilterSirket] = useState('HEPSI')

  const set = (k: keyof typeof EMPTY_FORM) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  const fetchAll = useCallback(async () => {
    const res = await fetch('/api/haftalik-odemeler')
    if (res.ok) setKalemler(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const resetForm = () => {
    setForm({ ...EMPTY_FORM })
    setShowForm(false)
    setEditId(null)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const url = editId ? `/api/haftalik-odemeler/${editId}` : '/api/haftalik-odemeler'
      const method = editId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Hata oluştu')
        return
      }
      resetForm()
      fetchAll()
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (k: HaftalikOdeme) => {
    setForm({
      tarih: k.tarih.slice(0, 10),
      odemeTarihi: k.odemeTarihi ? k.odemeTarihi.slice(0, 10) : '',
      yapilanIs: k.yapilanIs, firma: k.firma || '', ibanBilgisi: k.ibanBilgisi || '',
      tutar: k.tutar.toString(), yuklenici: k.yuklenici || '', sirketId: k.sirketId,
    })
    setEditId(k.id)
    setShowForm(true)
    setError('')
  }

  const handleDelete = async (k: HaftalikOdeme) => {
    if (!confirm('Bu ödeme kalemini silmek istediğinize emin misiniz?')) return
    const res = await fetch(`/api/haftalik-odemeler/${k.id}`, { method: 'DELETE' })
    if (!res.ok) {
      alert('Silinemedi')
      return
    }
    fetchAll()
  }

  // Faturalar sekmesinde girilen "Aldığımız" faturalardan, ödeme tarihi ve
  // şirketi dolu olanlar otomatik olarak buraya (salt okunur) düşer.
  const faturaSatirlari: Satir[] = useMemo(() => {
    return faturalar
      .filter((f) => f.tur === 'ALINAN' && f.sirketId)
      .map((f) => ({
        id: `fatura-${f.id}`,
        kaynak: 'fatura' as const,
        faturaNo: f.faturaNo,
        tarih: f.tarih,
        odemeTarihi: f.odemeTarihi,
        yapilanIs: f.faturaNo ? `Fatura No: ${f.faturaNo}` : 'Fatura',
        firma: f.karsiTaraf || '',
        ibanBilgisi: f.ibanBilgisi || '',
        tutar: f.kdvDahilTutar,
        yuklenici: f.yuklenici || '',
        sirketId: f.sirketId as string,
        odemeDurumu: f.odemeDurumu,
      }))
  }, [faturalar])

  const manuelSatirlari: Satir[] = useMemo(() => {
    return kalemler.map((k) => ({
      id: k.id,
      kaynak: 'manuel' as const,
      faturaNo: null,
      tarih: k.tarih,
      odemeTarihi: k.odemeTarihi,
      yapilanIs: k.yapilanIs,
      firma: k.firma || '',
      ibanBilgisi: k.ibanBilgisi || '',
      tutar: k.tutar,
      yuklenici: k.yuklenici || '',
      sirketId: k.sirketId,
      odemeDurumu: null,
    }))
  }, [kalemler])

  const tumSatirlar = useMemo(() => [...faturaSatirlari, ...manuelSatirlari], [faturaSatirlari, manuelSatirlari])

  // Şirket -> hafta -> satırlar şeklinde grupla, tarihe göre azalan sırada.
  const gruplu = useMemo(() => {
    const filtreliSirketler = filterSirket === 'HEPSI' ? sirketler : sirketler.filter((s) => s.id === filterSirket)
    return filtreliSirketler.map((sirket) => {
      const satirlar = tumSatirlar.filter((s) => s.sirketId === sirket.id)
      const haftalar = new Map<string, Satir[]>()
      for (const s of satirlar) {
        const anahtar = haftaAnahtari(haftaTarihi(s))
        if (!haftalar.has(anahtar)) haftalar.set(anahtar, [])
        haftalar.get(anahtar)!.push(s)
      }
      const haftaListesi = Array.from(haftalar.entries())
        .map(([anahtar, satirlar]) => {
          const ilkTarih = new Date(haftaTarihi(satirlar[0]))
          const baslangic = startOfISOWeek(ilkTarih)
          const bitis = endOfISOWeek(ilkTarih)
          const toplam = satirlar.reduce((s, x) => s + x.tutar, 0)
          const bekleyenToplam = satirlar.filter((x) => x.odemeDurumu === 'BEKLIYOR' || x.odemeDurumu === 'GECIKTI').reduce((s, x) => s + x.tutar, 0)
          const odenenToplam = toplam - bekleyenToplam
          const gecikenSayisi = satirlar.filter((x) => x.odemeDurumu === 'GECIKTI').length
          satirlar.sort((a, b) => new Date(haftaTarihi(b)).getTime() - new Date(haftaTarihi(a)).getTime())
          return { anahtar, hafta: getISOWeek(ilkTarih), baslangic, bitis, satirlar, toplam, bekleyenToplam, odenenToplam, gecikenSayisi }
        })
        .sort((a, b) => b.baslangic.getTime() - a.baslangic.getTime())
      return { sirket, haftaListesi }
    }).filter((g) => g.haftaListesi.length > 0)
  }, [tumSatirlar, sirketler, filterSirket])

  const handleExcelExport = () => {
    const rows: any[] = []
    for (const { sirket, haftaListesi } of gruplu) {
      for (const hafta of haftaListesi) {
        for (const s of hafta.satirlar) {
          rows.push({
            'Şirket': sirket.ad,
            'Hafta': `${hafta.hafta}. HAFTA`,
            'Durum': s.odemeDurumu ? DURUM_LABEL[s.odemeDurumu] : 'Elden/Manuel',
            'Fatura No': s.faturaNo || '',
            'Tarih': tarihStr(s.tarih),
            'Ödeme Tarihi': tarihStr(s.odemeTarihi),
            'Yapılan İş': s.yapilanIs,
            'Firma': s.firma,
            'IBAN Bilgisi': s.ibanBilgisi,
            'KDV Dahil Tutar': s.tutar,
            'Ödeme Yapan Firma': sirket.ad,
            'Yüklenici': s.yuklenici,
          })
        }
        rows.push({ 'Şirket': sirket.ad, 'Hafta': `${hafta.hafta}. HAFTA`, 'Yapılan İş': 'GENEL TOPLAM', 'KDV Dahil Tutar': hafta.toplam })
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Haftalık Ödemeler')
    XLSX.writeFile(wb, 'haftalik_odemeler.xlsx')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin h-8 w-8 border-4 border-secondary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={filterSirket}
            onChange={(e) => setFilterSirket(e.target.value)}
          >
            <option value="HEPSI">Tüm Şirketler</option>
            {sirketler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          {tumSatirlar.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExcelExport}>
              <Download className="h-4 w-4 mr-1" /> Excel
            </Button>
          )}
          <Button onClick={() => { resetForm(); setShowForm(true) }} className="bg-secondary hover:bg-secondary/90" size="sm">
            <Plus className="h-4 w-4 mr-1" /> Faturasız Ödeme Ekle
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Faturalar sekmesinde "Aldığımız Fatura" olarak girilen ve şirketi dolu olan faturalar buraya otomatik düşer — ödenmiş olsun olmasın, o haftanın tüm faturaları burada görünür (salt okunur, düzenlemek için Faturalar sekmesini kullanın).
        Her satırın Durum rengi ödeme durumunu gösterir: <span className="text-amber-700 dark:text-amber-400 font-medium">turuncu = bekliyor</span>, <span className="text-red-700 dark:text-red-400 font-medium">kırmızı = gecikti</span>, <span className="text-green-700 dark:text-green-400 font-medium">yeşil = ödendi</span>.
        Fatura kesilmeyen ödemeleri buradan elle ekleyebilirsiniz.
      </p>

      {showForm && (
        <Card className="border-secondary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{editId ? 'Ödeme Kalemini Düzenle' : 'Faturasız Ödeme Ekle'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>Şirket *</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.sirketId}
                    onChange={(e) => set('sirketId')(e.target.value)}
                    required
                  >
                    <option value="">— Seçiniz —</option>
                    {sirketler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Tarih *</Label>
                  <Input type="date" value={form.tarih} onChange={(e) => set('tarih')(e.target.value)} required />
                </div>
                <div>
                  <Label>Ödeme Tarihi</Label>
                  <Input type="date" value={form.odemeTarihi} onChange={(e) => set('odemeTarihi')(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Yapılan İş *</Label>
                  <Input value={form.yapilanIs} onChange={(e) => set('yapilanIs')(e.target.value)} required />
                </div>
                <div>
                  <Label>Firma</Label>
                  <Input value={form.firma} onChange={(e) => set('firma')(e.target.value)} placeholder="Ödemenin yapıldığı firma/kişi" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>IBAN Bilgisi</Label>
                  <Input value={form.ibanBilgisi} onChange={(e) => set('ibanBilgisi')(e.target.value)} placeholder="TR.. ..." />
                </div>
                <div>
                  <Label>KDV Dahil Tutar *</Label>
                  <Input type="number" step="any" value={form.tutar} onChange={(e) => set('tutar')(e.target.value)} required />
                </div>
                <div>
                  <Label>Yüklenici</Label>
                  <Input value={form.yuklenici} onChange={(e) => set('yuklenici')(e.target.value)} placeholder="İşi yapan taşeron/yüklenici" />
                </div>
              </div>

              {error && <p className="text-destructive text-sm">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={saving} className="bg-secondary hover:bg-secondary/90">
                  {saving ? 'Kaydediliyor...' : editId ? 'Güncelle' : 'Ekle'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>İptal</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {gruplu.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16 text-muted-foreground">
            <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
            Gösterilecek ödeme yok
          </CardContent>
        </Card>
      ) : (
        gruplu.map(({ sirket, haftaListesi }) => (
          <div key={sirket.id} className="space-y-4">
            <h3 className="text-lg font-bold font-display">{sirket.ad}</h3>
            {haftaListesi.map((hafta) => {
              const tamamlandi = hafta.bekleyenToplam <= 0
              const kenarRenk = hafta.gecikenSayisi > 0 ? 'border-l-4 border-l-red-500' : tamamlandi ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-amber-500'
              return (
              <Card key={hafta.anahtar} className={kenarRenk}>
                <CardHeader className={`pb-2 ${hafta.gecikenSayisi > 0 ? 'bg-red-50 dark:bg-red-950/20' : tamamlandi ? 'bg-green-50 dark:bg-green-950/20' : 'bg-amber-50 dark:bg-amber-950/20'} rounded-t-lg`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-base">
                      {tarihStr(hafta.baslangic.toISOString())} – {tarihStr(hafta.bitis.toISOString())} · {hafta.hafta}. HAFTA
                    </CardTitle>
                    <div className="flex items-center gap-3 text-xs font-medium">
                      {hafta.bekleyenToplam > 0 && (
                        <span className="text-amber-700 dark:text-amber-400">Bekleyen: {paraStr(hafta.bekleyenToplam)}</span>
                      )}
                      {hafta.odenenToplam > 0 && (
                        <span className="text-green-700 dark:text-green-400">Ödenen: {paraStr(hafta.odenenToplam)}</span>
                      )}
                      {hafta.gecikenSayisi > 0 && (
                        <span className="text-red-700 dark:text-red-400">{hafta.gecikenSayisi} gecikti</span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                          <th className="text-left font-medium px-3 py-2">Durum</th>
                          <th className="text-left font-medium px-3 py-2">Fatura No</th>
                          <th className="text-left font-medium px-3 py-2">Tarih</th>
                          <th className="text-left font-medium px-3 py-2">Ödeme Tarihi</th>
                          <th className="text-left font-medium px-3 py-2">Yapılan İş</th>
                          <th className="text-left font-medium px-3 py-2">Firma</th>
                          <th className="text-left font-medium px-3 py-2">IBAN Bilgisi</th>
                          <th className="text-right font-medium px-3 py-2">KDV Dahil Tutar</th>
                          <th className="text-left font-medium px-3 py-2">Ödeme Yapan Firma</th>
                          <th className="text-left font-medium px-3 py-2">Yüklenici</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {hafta.satirlar.map((s) => (
                          <tr key={s.id} className="border-b last:border-0">
                            <td className="px-3 py-2">
                              {s.odemeDurumu ? (
                                <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${DURUM_RENK[s.odemeDurumu]}`}>{DURUM_LABEL[s.odemeDurumu]}</span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap bg-muted text-muted-foreground">Elden/Manuel</span>
                              )}
                            </td>
                            <td className="px-3 py-2">{s.faturaNo || '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{tarihStr(s.tarih)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{tarihStr(s.odemeTarihi)}</td>
                            <td className="px-3 py-2">{s.yapilanIs}</td>
                            <td className="px-3 py-2">{s.firma || '—'}</td>
                            <td className="px-3 py-2">{s.ibanBilgisi || '—'}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap font-medium">{paraStr(s.tutar)}</td>
                            <td className="px-3 py-2">{sirket.ad}</td>
                            <td className="px-3 py-2">{s.yuklenici || '—'}</td>
                            <td className="px-3 py-2">
                              {s.kaynak === 'manuel' ? (
                                <div className="flex items-center gap-1 justify-end">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(kalemler.find((k) => k.id === s.id)!)} title="Düzenle">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(kalemler.find((k) => k.id === s.id)!)} title="Sil">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-muted-foreground uppercase whitespace-nowrap">Faturadan</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-muted/40 font-semibold">
                          <td className="px-3 py-2" colSpan={7}>GENEL TOPLAM</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">{paraStr(hafta.toplam)}</td>
                          <td className="px-3 py-2" colSpan={3} />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
              )
            })}
          </div>
        ))
      )}
    </div>
  )
}
