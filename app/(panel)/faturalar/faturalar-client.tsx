'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Lock, Receipt, Plus, Pencil, Trash2, Download, AlertTriangle,
  ArrowDownCircle, ArrowUpCircle, LockKeyhole, Upload, FileText, Paperclip,
} from 'lucide-react'
import * as XLSX from 'xlsx'

interface Sirket { id: string; ad: string }

interface Fatura {
  id: string
  tur: 'KESILEN' | 'ALINAN'
  faturaNo: string | null
  tarih: string
  aciklama: string | null
  karsiTaraf: string | null
  tutar: number
  kdvOrani: number
  kdvTutari: number
  kdvDahilTutar: number
  tevkifatTutari: number | null
  vadeTarihi: string | null
  odemeDurumu: 'BEKLIYOR' | 'ODENDI' | 'GECIKTI'
  sirketId: string | null
  sirket: { ad: string } | null
  pdfYolu: string | null
  pdfDosyaAdi: string | null
}

const EMPTY_FORM = {
  tur: 'KESILEN' as 'KESILEN' | 'ALINAN',
  faturaNo: '', tarih: '', aciklama: '', karsiTaraf: '',
  tutar: '', kdvOrani: '20', kdvDahilTutar: '', tevkifatTutari: '',
  vadeTarihi: '', odemeDurumu: 'BEKLIYOR' as Fatura['odemeDurumu'], sirketId: '',
}

const DURUM_LABEL: Record<Fatura['odemeDurumu'], string> = {
  BEKLIYOR: 'Bekliyor',
  ODENDI: 'Ödendi',
  GECIKTI: 'Gecikti',
}

const DURUM_RENK: Record<Fatura['odemeDurumu'], string> = {
  BEKLIYOR: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ODENDI: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  GECIKTI: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

function tarihStr(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('tr-TR')
}

function paraStr(n: number) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n) + ' ₺'
}

function vadeDurumu(f: Fatura): { seviye: 'gecmis' | 'yakin' | 'iyi' | 'nötr'; metin: string } {
  if (f.odemeDurumu !== 'BEKLIYOR' || !f.vadeTarihi) return { seviye: 'nötr', metin: '' }
  const gunFarki = Math.ceil((new Date(f.vadeTarihi).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (gunFarki < 0) return { seviye: 'gecmis', metin: `${Math.abs(gunFarki)} gün geçti — VADESİ GEÇTİ` }
  if (gunFarki <= 7) return { seviye: 'yakin', metin: gunFarki === 0 ? 'Bugün vadesi doluyor' : `${gunFarki} gün kaldı` }
  return { seviye: 'iyi', metin: `${gunFarki} gün kaldı` }
}

const VADE_RENK: Record<string, string> = {
  gecmis: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  yakin: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  iyi: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  nötr: 'bg-muted text-muted-foreground',
}

function VadeBadge({ f }: { f: Fatura }) {
  const { seviye, metin } = vadeDurumu(f)
  if (seviye === 'nötr') return null
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${VADE_RENK[seviye]}`}>
      {seviye === 'gecmis' && <AlertTriangle className="h-3 w-3" />}
      {tarihStr(f.vadeTarihi)} · {metin}
    </span>
  )
}

function PinKilidi({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/faturalar/dogrula', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      if (!res.ok) {
        setError('PIN hatalı')
        setPin('')
        return
      }
      onUnlock()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex items-center justify-center py-20">
      <Card className="w-full max-w-sm border-secondary/30">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-secondary/10 mx-auto">
            <Lock className="h-7 w-7 text-secondary" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">Faturalar Kilitli</h2>
            <p className="text-sm text-muted-foreground">Bu bölüme girmek için PIN gerekiyor</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="PIN"
              className="text-center text-lg tracking-widest"
            />
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button type="submit" disabled={submitting || !pin} className="w-full bg-secondary hover:bg-secondary/90">
              {submitting ? 'Kontrol ediliyor...' : 'Kilidi Aç'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export function FaturalarClient() {
  const [locked, setLocked] = useState<boolean | null>(null)
  const [faturalar, setFaturalar] = useState<Fatura[]>([])
  const [sirketler, setSirketler] = useState<Sirket[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [detay, setDetay] = useState<Fatura | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingUploadIdRef = useRef<string | null>(null)

  const [filterTur, setFilterTur] = useState<'HEPSI' | 'KESILEN' | 'ALINAN'>('HEPSI')
  const [filterSirket, setFilterSirket] = useState('HEPSI')
  const [showCompleted, setShowCompleted] = useState(false)

  const set = (k: keyof typeof EMPTY_FORM) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  const fetchAll = useCallback(async () => {
    const res = await fetch('/api/faturalar')
    if (res.status === 401) {
      const data = await res.json().catch(() => ({}))
      if (data?.code === 'PIN_GEREKLI') {
        setLocked(true)
        setLoading(false)
        return
      }
    }
    if (res.ok) {
      setLocked(false)
      setFaturalar(await res.json())
      const sRes = await fetch('/api/sirketler')
      if (sRes.ok) setSirketler(await sRes.json())
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Tutar veya KDV oranı değiştikçe KDV dahil tutarı otomatik hesapla
  useEffect(() => {
    const tutar = parseFloat(form.tutar)
    const oran = parseFloat(form.kdvOrani)
    if (!isNaN(tutar) && !isNaN(oran)) {
      const dahil = tutar + tutar * (oran / 100)
      setForm((f) => ({ ...f, kdvDahilTutar: dahil.toFixed(2) }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.tutar, form.kdvOrani])

  const handleLock = async () => {
    await fetch('/api/faturalar/dogrula', { method: 'DELETE' })
    setLocked(true)
    setFaturalar([])
  }

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
      const url = editId ? `/api/faturalar/${editId}` : '/api/faturalar'
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

  const handleEdit = (f: Fatura) => {
    setForm({
      tur: f.tur,
      faturaNo: f.faturaNo || '', tarih: f.tarih.slice(0, 10), aciklama: f.aciklama || '',
      karsiTaraf: f.karsiTaraf || '', tutar: f.tutar.toString(), kdvOrani: f.kdvOrani.toString(),
      kdvDahilTutar: f.kdvDahilTutar.toString(), tevkifatTutari: f.tevkifatTutari?.toString() || '',
      vadeTarihi: f.vadeTarihi ? f.vadeTarihi.slice(0, 10) : '',
      odemeDurumu: f.odemeDurumu, sirketId: f.sirketId || '',
    })
    setEditId(f.id)
    setShowForm(true)
    setError('')
    setDetay(null)
  }

  const handleDurumChange = async (f: Fatura, odemeDurumu: Fatura['odemeDurumu']) => {
    await fetch(`/api/faturalar/${f.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ odemeDurumu }),
    })
    fetchAll()
    setDetay(null)
  }

  const handleDelete = async (f: Fatura) => {
    if (!confirm(`${f.faturaNo ? `"${f.faturaNo}" numaralı ` : ''}faturayı silmek istediğinize emin misiniz?`)) return
    const res = await fetch(`/api/faturalar/${f.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Silinemedi')
      return
    }
    setDetay(null)
    fetchAll()
  }

  const handlePdfSecFor = (faturaId: string) => {
    pendingUploadIdRef.current = faturaId
    fileInputRef.current?.click()
  }

  const handlePdfSecildi = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const dosya = e.target.files?.[0]
    const faturaId = pendingUploadIdRef.current
    e.target.value = ''
    if (!dosya || !faturaId) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('faturaId', faturaId)
      fd.append('dosya', dosya)
      const res = await fetch('/api/faturalar/upload', { method: 'POST', body: fd })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Yükleme başarısız oldu')
        return
      }
      await fetchAll()
      setDetay((d) => (d && d.id === faturaId ? { ...d, pdfDosyaAdi: dosya.name } : d))
    } finally {
      setUploading(false)
    }
  }

  const handleExcelExport = () => {
    const rows = faturalar.map((f) => ({
      'Tür': f.tur === 'KESILEN' ? 'Kestiğimiz' : 'Aldığımız',
      'Fatura No': f.faturaNo || '',
      'Tarih': tarihStr(f.tarih),
      'Açıklama': f.aciklama || '',
      'Karşı Taraf': f.karsiTaraf || '',
      'Tutar (KDV Hariç)': f.tutar,
      'KDV Oranı (%)': f.kdvOrani,
      'KDV Tutarı': f.kdvTutari,
      'KDV Dahil Tutar': f.kdvDahilTutar,
      'Tevkifat': f.tevkifatTutari ?? '',
      'Vade Tarihi': tarihStr(f.vadeTarihi),
      'Ödeme Durumu': DURUM_LABEL[f.odemeDurumu],
      'Şirket': f.sirket?.ad || '',
      'PDF': f.pdfDosyaAdi || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Faturalar')
    XLSX.writeFile(wb, 'faturalar.xlsx')
  }

  const filtreli = useMemo(() => {
    return faturalar.filter((f) => {
      if (filterTur !== 'HEPSI' && f.tur !== filterTur) return false
      if (filterSirket !== 'HEPSI' && f.sirketId !== filterSirket) return false
      if (!showCompleted && f.odemeDurumu === 'ODENDI') return false
      return true
    })
  }, [faturalar, filterTur, filterSirket, showCompleted])

  const ozet = useMemo(() => {
    const bekleyenKesilen = faturalar.filter((f) => f.tur === 'KESILEN' && f.odemeDurumu !== 'ODENDI').reduce((s, f) => s + f.kdvDahilTutar, 0)
    const bekleyenAlinan = faturalar.filter((f) => f.tur === 'ALINAN' && f.odemeDurumu !== 'ODENDI').reduce((s, f) => s + f.kdvDahilTutar, 0)
    const yaklasan = faturalar.filter((f) => f.odemeDurumu === 'BEKLIYOR' && vadeDurumu(f).seviye !== 'iyi' && vadeDurumu(f).seviye !== 'nötr').length
    const odenen = faturalar.filter((f) => f.odemeDurumu === 'ODENDI').length
    return { bekleyenKesilen, bekleyenAlinan, yaklasan, odenen }
  }, [faturalar])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-secondary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (locked) {
    return <PinKilidi onUnlock={() => { setLocked(false); fetchAll() }} />
  }

  return (
    <div className="space-y-6">
      <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handlePdfSecildi} />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold font-display">Faturalar</h2>
          <p className="text-muted-foreground text-sm">Kestiğimiz ve aldığımız faturaların takibi</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleLock} title="Bölümü kilitle">
            <LockKeyhole className="h-4 w-4 mr-1" /> Kilitle
          </Button>
          {faturalar.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExcelExport}>
              <Download className="h-4 w-4 mr-1" /> Excel
            </Button>
          )}
          <Button onClick={() => { resetForm(); setShowForm(true) }} className="bg-secondary hover:bg-secondary/90" size="sm">
            <Plus className="h-4 w-4 mr-1" /> Yeni Fatura
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><ArrowDownCircle className="h-3.5 w-3.5" /> Bekleyen Alacak (Kesilen)</div>
          <div className="font-semibold">{paraStr(ozet.bekleyenKesilen)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><ArrowUpCircle className="h-3.5 w-3.5" /> Bekleyen Borç (Alınan)</div>
          <div className="font-semibold">{paraStr(ozet.bekleyenAlinan)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><AlertTriangle className="h-3.5 w-3.5" /> Yaklaşan / Geçen</div>
          <div className="font-semibold">{ozet.yaklasan}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><Receipt className="h-3.5 w-3.5" /> Ödenen</div>
          <div className="font-semibold">{ozet.odenen}</div>
        </CardContent></Card>
      </div>

      {showForm && (
        <Card className="border-secondary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{editId ? 'Fatura Düzenle' : 'Yeni Fatura Ekle'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>Tür *</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.tur}
                    onChange={(e) => set('tur')(e.target.value)}
                  >
                    <option value="KESILEN">Kestiğimiz Fatura</option>
                    <option value="ALINAN">Aldığımız Fatura</option>
                  </select>
                </div>
                <div>
                  <Label>Ödeme Durumu</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.odemeDurumu}
                    onChange={(e) => set('odemeDurumu')(e.target.value)}
                  >
                    {Object.entries(DURUM_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Şirket</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.sirketId}
                    onChange={(e) => set('sirketId')(e.target.value)}
                  >
                    <option value="">— Seçilmedi —</option>
                    {sirketler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>{form.tur === 'KESILEN' ? 'Kime Kesildi' : 'Kimden Alındı'}</Label>
                  <Input value={form.karsiTaraf} onChange={(e) => set('karsiTaraf')(e.target.value)} placeholder="Firma / kişi adı" />
                </div>
                <div>
                  <Label>Fatura No</Label>
                  <Input value={form.faturaNo} onChange={(e) => set('faturaNo')(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <Label>Tarih *</Label>
                  <Input type="date" value={form.tarih} onChange={(e) => set('tarih')(e.target.value)} required />
                </div>
                <div>
                  <Label>Vade Tarihi</Label>
                  <Input type="date" value={form.vadeTarihi} onChange={(e) => set('vadeTarihi')(e.target.value)} />
                </div>
                <div>
                  <Label>Tutar (KDV Hariç) *</Label>
                  <Input type="number" step="any" value={form.tutar} onChange={(e) => set('tutar')(e.target.value)} required />
                </div>
                <div>
                  <Label>KDV Oranı (%)</Label>
                  <Input type="number" step="any" value={form.kdvOrani} onChange={(e) => set('kdvOrani')(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>KDV Dahil Tutar</Label>
                  <Input type="number" step="any" value={form.kdvDahilTutar} onChange={(e) => set('kdvDahilTutar')(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">Tutar/KDV oranı değişince otomatik hesaplanır, istersen elle düzelt.</p>
                </div>
                <div>
                  <Label>Tevkifat (varsa)</Label>
                  <Input type="number" step="any" value={form.tevkifatTutari} onChange={(e) => set('tevkifatTutari')(e.target.value)} />
                </div>
              </div>

              <div>
                <Label>Açıklama</Label>
                <Textarea value={form.aciklama} onChange={(e) => set('aciklama')(e.target.value)} rows={2} />
              </div>

              {error && <p className="text-destructive text-sm">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={saving} className="bg-secondary hover:bg-secondary/90">
                  {saving ? 'Kaydediliyor...' : editId ? 'Güncelle' : 'Ekle'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>İptal</Button>
              </div>
              {editId && (
                <div className="pt-2 border-t">
                  <Label className="text-xs">Fatura PDF'i</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => handlePdfSecFor(editId)}>
                      <Upload className="h-3.5 w-3.5 mr-1" /> {uploading ? 'Yükleniyor...' : 'PDF Yükle / Değiştir'}
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(['HEPSI', 'KESILEN', 'ALINAN'] as const).map((t) => (
          <Button key={t} size="sm" variant={filterTur === t ? 'default' : 'outline'} className={filterTur === t ? 'bg-secondary hover:bg-secondary/90' : ''} onClick={() => setFilterTur(t)}>
            {t === 'HEPSI' ? 'Hepsi' : t === 'KESILEN' ? 'Kestiğimiz' : 'Aldığımız'}
          </Button>
        ))}
        <select
          className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={filterSirket}
          onChange={(e) => setFilterSirket(e.target.value)}
        >
          <option value="HEPSI">Tüm Şirketler</option>
          {sirketler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
        </select>
        <Button size="sm" variant={showCompleted ? 'default' : 'outline'} className={showCompleted ? 'bg-secondary hover:bg-secondary/90' : ''} onClick={() => setShowCompleted((v) => !v)}>
          Ödenenleri Göster
        </Button>
      </div>

      {filtreli.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16 text-muted-foreground">
            <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
            Gösterilecek fatura yok
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtreli.map((f) => (
            <Card key={f.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetay(f)}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    {f.tur === 'KESILEN' ? <ArrowDownCircle className="h-4 w-4 text-green-600" /> : <ArrowUpCircle className="h-4 w-4 text-orange-600" />}
                    {f.tur === 'KESILEN' ? 'Kestiğimiz' : 'Aldığımız'}
                    {f.faturaNo && <span className="text-muted-foreground font-normal">· {f.faturaNo}</span>}
                    {f.pdfYolu && <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${DURUM_RENK[f.odemeDurumu]}`}>{DURUM_LABEL[f.odemeDurumu]}</span>
                </div>
                <div className="text-sm text-muted-foreground">{f.karsiTaraf || '—'}{f.sirket && ` · ${f.sirket.ad}`}</div>
                <div className="font-semibold">{paraStr(f.kdvDahilTutar)} <span className="text-xs font-normal text-muted-foreground">(KDV dahil)</span></div>
                <VadeBadge f={f} />
                <div className="flex items-center justify-end gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(f)} title="Düzenle">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(f)} title="Sil">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!detay} onOpenChange={(open) => { if (!open) setDetay(null) }}>
        <DialogContent>
          {detay && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" /> {detay.tur === 'KESILEN' ? 'Kestiğimiz Fatura' : 'Aldığımız Fatura'}{detay.faturaNo ? ` · ${detay.faturaNo}` : ''}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${DURUM_RENK[detay.odemeDurumu]}`}>{DURUM_LABEL[detay.odemeDurumu]}</span>
                  <VadeBadge f={detay} />
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-muted-foreground">
                  <div>Karşı Taraf</div><div className="text-right text-foreground">{detay.karsiTaraf || '—'}</div>
                  <div>Şirket</div><div className="text-right text-foreground">{detay.sirket?.ad || '—'}</div>
                  <div>Tarih</div><div className="text-right text-foreground">{tarihStr(detay.tarih)}</div>
                  <div>Vade Tarihi</div><div className="text-right text-foreground">{tarihStr(detay.vadeTarihi)}</div>
                  <div>Tutar (KDV Hariç)</div><div className="text-right text-foreground">{paraStr(detay.tutar)}</div>
                  <div>KDV ({detay.kdvOrani}%)</div><div className="text-right text-foreground">{paraStr(detay.kdvTutari)}</div>
                  <div>KDV Dahil Tutar</div><div className="text-right text-foreground font-medium">{paraStr(detay.kdvDahilTutar)}</div>
                  {detay.tevkifatTutari != null && (<><div>Tevkifat</div><div className="text-right text-foreground">{paraStr(detay.tevkifatTutari)}</div></>)}
                </div>
                {detay.aciklama && (
                  <div>
                    <p className="font-medium mb-1">Açıklama</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{detay.aciklama}</p>
                  </div>
                )}

                <div>
                  <Label className="text-xs">PDF Nüshası</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {detay.pdfYolu ? (
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/api/faturalar/dosya/${detay.id}`} target="_blank" rel="noopener noreferrer">
                          <FileText className="h-3.5 w-3.5 mr-1" /> {detay.pdfDosyaAdi || 'PDF Görüntüle'}
                        </a>
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-xs">Henüz PDF yüklenmedi</span>
                    )}
                    <Button variant="outline" size="sm" disabled={uploading} onClick={() => handlePdfSecFor(detay.id)}>
                      <Upload className="h-3.5 w-3.5 mr-1" /> {uploading ? 'Yükleniyor...' : detay.pdfYolu ? 'Değiştir' : 'PDF Yükle'}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Ödeme Durumunu Değiştir</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {Object.entries(DURUM_LABEL).map(([k, v]) => (
                      <Button
                        key={k}
                        size="sm"
                        variant={detay.odemeDurumu === k ? 'default' : 'outline'}
                        className={detay.odemeDurumu === k ? 'bg-secondary hover:bg-secondary/90' : ''}
                        onClick={() => handleDurumChange(detay, k as Fatura['odemeDurumu'])}
                      >
                        {v}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(detay)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Düzenle
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 text-destructive hover:text-destructive" onClick={() => handleDelete(detay)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Sil
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
