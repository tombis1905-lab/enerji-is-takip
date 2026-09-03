'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Fuel, Plus, Trash2, Receipt, TrendingUp, Filter, X, Download } from 'lucide-react'
import { SafeDate, SafeNumber } from '@/components/safe-format'
import * as XLSX from 'xlsx'

interface Arac {
  id: string
  plaka: string
  marka: string | null
  model: string | null
}

interface AkaryakitKayit {
  id: string
  tarih: string
  tutar: number
  fisNo: string | null
  aciklama: string | null
  arac: { plaka: string; isim: string | null; marka: string | null; model: string | null }
  user: { name: string }
}

interface AracOzet {
  aracId: string
  _sum: { tutar: number | null }
  _count: number
}

interface Props {
  role: string
}

const fmtTL = (v: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }).format(v)

export function AkaryakitClient({ role }: Props) {
  const isAdmin = role === 'ADMIN'
  const [araclar, setAraclar] = useState<Arac[]>([])
  const [kayitlar, setKayitlar] = useState<AkaryakitKayit[]>([])
  const [aracOzet, setAracOzet] = useState<AracOzet[]>([])
  const [genelToplam, setGenelToplam] = useState(0)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Filtreler
  const [filterAracId, setFilterAracId] = useState('')
  const [filterAy, setFilterAy] = useState('')
  const [defaultAy, setDefaultAy] = useState('')
  const [showFilter, setShowFilter] = useState(false)

  // Form
  const [form, setForm] = useState({
    tarih: '',
    tutar: '',
    fisNo: '',
    aciklama: '',
    aracId: '',
  })

  // Misafir araç mı seçili?
  const isMisafirArac = araclar.some((a) => a.id === form.aracId && a.plaka === 'MİSAFİR ARAÇ')

  // SSR-safe: set date defaults in useEffect
  useEffect(() => {
    const now = new Date()
    const ay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    setDefaultAy(ay)
    setFilterAy(ay)
    setForm((f) => ({ ...f, tarih: now.toISOString().slice(0, 10) }))
  }, [])

  const fetchAraclar = useCallback(async () => {
    const res = await fetch('/api/araclar')
    if (res.ok) {
      const data = await res.json()
      // Misafir Araç her zaman en üstte gösterilsin
      const aktifler = data.filter((a: any) => a.aktif !== false)
      const misafir = aktifler.filter((a: any) => a.plaka === 'MİSAFİR ARAÇ')
      const diger = aktifler.filter((a: any) => a.plaka !== 'MİSAFİR ARAÇ')
      setAraclar([...misafir, ...diger])
    }
  }, [])

  const fetchKayitlar = useCallback(async () => {
    const params = new URLSearchParams()
    if (filterAracId) params.set('aracId', filterAracId)
    if (filterAy) params.set('ay', filterAy)
    params.set('page', String(page))
    params.set('limit', '50')

    const res = await fetch(`/api/akaryakit?${params}`)
    if (res.ok) {
      const data = await res.json()
      setKayitlar(data.kayitlar)
      setTotal(data.total)
      setTotalPages(data.totalPages)
      setAracOzet(data.aracOzet)
      setGenelToplam(data.genelToplam)
    }
    setLoading(false)
  }, [filterAracId, filterAy, page])

  useEffect(() => { fetchAraclar() }, [fetchAraclar])
  useEffect(() => { fetchKayitlar() }, [fetchKayitlar])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.aracId) { setError('Araç seçiniz'); return }
    if (!form.tutar || Number(form.tutar) <= 0) { setError('Geçerli bir tutar giriniz'); return }
    setSaving(true)

    try {
      const res = await fetch('/api/akaryakit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tutar: Number(form.tutar),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Hata oluştu')
        return
      }
      setForm({ tarih: new Date().toISOString().slice(0, 10), tutar: '', fisNo: '', aciklama: '', aracId: form.aracId })
      setShowForm(false)
      setPage(1)
      fetchKayitlar()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return
    const res = await fetch(`/api/akaryakit/${id}`, { method: 'DELETE' })
    if (res.ok) fetchKayitlar()
    else alert('Silinemedi')
  }

  const handleExcelExport = () => {
    const rows = kayitlar.map((k) => ({
      'Tarih': new Date(k.tarih).toLocaleDateString('tr-TR'),
      'Araç': k.arac.plaka === 'MİSAFİR ARAÇ' ? 'Misafir Araç' : k.arac.plaka,
      'Kullanan': k.arac.plaka === 'MİSAFİR ARAÇ' ? 'Misafir / Kiralık' : (k.arac.isim || ''),
      'Tutar (₺)': k.tutar,
      'Fiş No': k.fisNo || '',
      'Açıklama': k.aciklama || '',
      'Kaydeden': k.user.name,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Akaryakıt')
    XLSX.writeFile(wb, `akaryakit_${filterAy || 'tum'}.xlsx`)
  }

  // Plaka map for özet
  const plakaMap: Record<string, string> = {}
  araclar.forEach((a) => { plakaMap[a.id] = a.plaka })

  // Ay adı
  const ayAdi = filterAy
    ? new Date(Number(filterAy.split('-')[0]), Number(filterAy.split('-')[1]) - 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
    : 'Tüm Zamanlar'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-secondary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold font-display">Akaryakıt Takip</h2>
          <p className="text-muted-foreground text-sm">Araç yakıt fişlerini kaydedin ve takip edin</p>
        </div>
        <div className="flex gap-2">
          {kayitlar.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExcelExport}>
              <Download className="h-4 w-4 mr-1" /> Excel
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowFilter(!showFilter)}>
            <Filter className="h-4 w-4 mr-1" /> Filtre
          </Button>
          <Button onClick={() => setShowForm(!showForm)} className="bg-secondary hover:bg-secondary/90" size="sm">
            <Plus className="h-4 w-4 mr-1" /> Yeni Fiş
          </Button>
        </div>
      </div>

      {/* Filtre */}
      {showFilter && (
        <Card className="border-blue-200 dark:border-blue-900">
          <CardContent className="pt-4 pb-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <Label className="text-xs">Araç</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={filterAracId}
                  onChange={(e) => { setFilterAracId(e.target.value); setPage(1) }}
                >
                  <option value="">Tüm Araçlar</option>
                  {araclar.map((a) => (
                    <option key={a.id} value={a.id}>{a.plaka === 'MİSAFİR ARAÇ' ? '🚛 MİSAFİR ARAÇ' : `${a.plaka}${a.marka ? ` — ${a.marka}` : ''}`}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Ay</Label>
                <Input
                  type="month"
                  value={filterAy}
                  onChange={(e) => { setFilterAy(e.target.value); setPage(1) }}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setFilterAracId(''); setFilterAy(defaultAy); setPage(1) }}>
                  <X className="h-3 w-3 mr-1" /> Temizle
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fiş Giriş Formu */}
      {showForm && (
        <Card className="border-secondary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5 text-secondary" /> Yeni Akaryakıt Fişi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <Label>Araç *</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.aracId}
                  onChange={(e) => setForm({ ...form, aracId: e.target.value })}
                  required
                >
                  <option value="">Araç seçin</option>
                  {araclar.map((a) => (
                    <option key={a.id} value={a.id}>{a.plaka === 'MİSAFİR ARAÇ' ? '🚛 MİSAFİR ARAÇ' : `${a.plaka}${a.marka ? ` — ${a.marka}` : ''}`}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Tarih *</Label>
                <Input
                  type="date"
                  value={form.tarih}
                  onChange={(e) => setForm({ ...form, tarih: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Tutar (₺) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.tutar}
                  onChange={(e) => setForm({ ...form, tutar: e.target.value })}
                  placeholder="0,00"
                  required
                />
              </div>
              <div>
                <Label>Fiş No</Label>
                <Input
                  value={form.fisNo}
                  onChange={(e) => setForm({ ...form, fisNo: e.target.value })}
                  placeholder="Opsiyonel"
                />
              </div>
              <div>
                <Label>Açıklama{isMisafirArac ? ' (detay giriniz)' : ''}</Label>
                <Input
                  value={form.aciklama}
                  onChange={(e) => setForm({ ...form, aciklama: e.target.value })}
                  placeholder={isMisafirArac ? 'Örn: Kiralık kamyon - ABC Nakliyat' : 'Opsiyonel'}
                />
              </div>
              {error && <p className="text-destructive text-sm col-span-full">{error}</p>}
              <div className="col-span-full flex gap-2">
                <Button type="submit" disabled={saving} className="bg-secondary hover:bg-secondary/90">
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>İptal</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Aylık Özet Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Genel Toplam */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-secondary/10">
                <TrendingUp className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{ayAdi} — Toplam Akaryakıt</p>
                <p className="text-2xl font-bold">{fmtTL(genelToplam)}</p>
                <p className="text-xs text-muted-foreground">{total} fiş kaydı</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Araç Bazlı Özet */}
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm font-semibold mb-3">Araç Bazlı Dağılım</p>
            {aracOzet.length === 0 ? (
              <p className="text-sm text-muted-foreground">Bu dönemde kayıt yok</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {aracOzet
                  .sort((a, b) => (b._sum.tutar || 0) - (a._sum.tutar || 0))
                  .map((o) => {
                    const pct = genelToplam > 0 ? ((o._sum.tutar || 0) / genelToplam) * 100 : 0
                    return (
                      <div key={o.aracId} className="flex items-center gap-2 text-sm">
                        <span className="w-28 font-medium truncate">{plakaMap[o.aracId] === 'MİSAFİR ARAÇ' ? '🚛 Misafir' : (plakaMap[o.aracId] || '?')}</span>
                        <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-secondary rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-28 text-right text-xs font-medium">{fmtTL(o._sum.tutar || 0)}</span>
                        <span className="w-12 text-right text-xs text-muted-foreground">{o._count} fiş</span>
                      </div>
                    )
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Kayıt Tablosu */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4" /> Fiş Kayıtları
            <span className="text-xs text-muted-foreground font-normal ml-2">({total} kayıt)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-semibold">Tarih</th>
                  <th className="text-left p-3 font-semibold">Araç</th>
                  <th className="text-right p-3 font-semibold">Tutar (₺)</th>
                  <th className="text-left p-3 font-semibold">Fiş No</th>
                  <th className="text-left p-3 font-semibold">Açıklama</th>
                  <th className="text-left p-3 font-semibold">Personel</th>
                  {isAdmin && <th className="text-right p-3 font-semibold">İşlem</th>}
                </tr>
              </thead>
              <tbody>
                {kayitlar.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} className="text-center py-10 text-muted-foreground">
                      <Fuel className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      Bu dönemde akaryakıt kaydı yok
                    </td>
                  </tr>
                ) : (
                  kayitlar.map((k) => (
                    <tr key={k.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <SafeDate date={k.tarih} options={{ day: '2-digit', month: '2-digit', year: 'numeric' }} locale="tr-TR" />
                      </td>
                      <td className="p-3 font-medium">{k.arac.plaka === 'MİSAFİR ARAÇ' ? '🚛 Misafir' : k.arac.plaka}</td>
                      <td className="p-3 text-right font-semibold text-secondary">
                        <SafeNumber value={k.tutar} options={{ style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }} locale="tr-TR" />
                      </td>
                      <td className="p-3 text-muted-foreground">{k.fisNo || '—'}</td>
                      <td className="p-3 text-muted-foreground max-w-[200px] truncate">{k.aciklama || '—'}</td>
                      <td className="p-3 text-muted-foreground">{k.user.name}</td>
                      {isAdmin && (
                        <td className="p-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(k.id)}
                            title="Sil"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Sayfalama */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-3 border-t">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Önceki
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Sonraki
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
