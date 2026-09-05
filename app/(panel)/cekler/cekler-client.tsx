'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Lock, FileCheck2, Plus, Pencil, Trash2, Download, AlertTriangle,
  ArrowDownCircle, ArrowUpCircle, LockKeyhole,
} from 'lucide-react'
import * as XLSX from 'xlsx'

interface Sirket { id: string; ad: string }

interface Cek {
  id: string
  tur: 'ALINAN' | 'VERILEN'
  cekNo: string | null
  banka: string | null
  sube: string | null
  karsiTaraf: string | null
  tutar: number
  vadeTarihi: string
  duzenlemeTarihi: string | null
  durum: 'BEKLEMEDE' | 'TAHSIL_EDILDI' | 'CIRO_EDILDI' | 'KARSILIKSIZ' | 'IPTAL'
  sirketId: string | null
  sirket: { ad: string } | null
  aciklama: string | null
}

const EMPTY_FORM = {
  tur: 'ALINAN' as 'ALINAN' | 'VERILEN',
  cekNo: '', banka: '', sube: '', karsiTaraf: '',
  tutar: '', vadeTarihi: '', duzenlemeTarihi: '',
  durum: 'BEKLEMEDE' as Cek['durum'], sirketId: '', aciklama: '',
}

const DURUM_LABEL: Record<Cek['durum'], string> = {
  BEKLEMEDE: 'Beklemede',
  TAHSIL_EDILDI: 'Tahsil Edildi',
  CIRO_EDILDI: 'Ciro Edildi',
  KARSILIKSIZ: 'Karşılıksız',
  IPTAL: 'İptal',
}

const DURUM_RENK: Record<Cek['durum'], string> = {
  BEKLEMEDE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  TAHSIL_EDILDI: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  CIRO_EDILDI: 'bg-muted text-muted-foreground',
  KARSILIKSIZ: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  IPTAL: 'bg-muted text-muted-foreground line-through',
}

function tarihStr(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('tr-TR')
}

function paraStr(n: number) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(n) + ' ₺'
}

function vadeDurumu(cek: Cek): { seviye: 'gecmis' | 'yakin' | 'iyi' | 'nötr'; metin: string } {
  if (cek.durum !== 'BEKLEMEDE') return { seviye: 'nötr', metin: '' }
  const gunFarki = Math.ceil((new Date(cek.vadeTarihi).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
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

function VadeBadge({ cek }: { cek: Cek }) {
  const { seviye, metin } = vadeDurumu(cek)
  if (seviye === 'nötr') return null
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${VADE_RENK[seviye]}`}>
      {seviye === 'gecmis' && <AlertTriangle className="h-3 w-3" />}
      {tarihStr(cek.vadeTarihi)} · {metin}
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
      const res = await fetch('/api/cekler/dogrula', {
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
            <h2 className="font-semibold text-lg">Çekler Kilitli</h2>
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

export function CeklerClient() {
  const [locked, setLocked] = useState<boolean | null>(null)
  const [cekler, setCekler] = useState<Cek[]>([])
  const [sirketler, setSirketler] = useState<Sirket[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [detay, setDetay] = useState<Cek | null>(null)

  const [filterTur, setFilterTur] = useState<'HEPSI' | 'ALINAN' | 'VERILEN'>('HEPSI')
  const [filterSirket, setFilterSirket] = useState('HEPSI')
  const [showCompleted, setShowCompleted] = useState(false)

  const set = (k: keyof typeof EMPTY_FORM) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  const fetchAll = useCallback(async () => {
    const res = await fetch('/api/cekler')
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
      setCekler(await res.json())
      const sRes = await fetch('/api/sirketler')
      if (sRes.ok) setSirketler(await sRes.json())
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleLock = async () => {
    await fetch('/api/cekler/dogrula', { method: 'DELETE' })
    setLocked(true)
    setCekler([])
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
      const url = editId ? `/api/cekler/${editId}` : '/api/cekler'
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

  const handleEdit = (c: Cek) => {
    setForm({
      tur: c.tur,
      cekNo: c.cekNo || '', banka: c.banka || '', sube: c.sube || '', karsiTaraf: c.karsiTaraf || '',
      tutar: c.tutar.toString(), vadeTarihi: c.vadeTarihi.slice(0, 10),
      duzenlemeTarihi: c.duzenlemeTarihi ? c.duzenlemeTarihi.slice(0, 10) : '',
      durum: c.durum, sirketId: c.sirketId || '', aciklama: c.aciklama || '',
    })
    setEditId(c.id)
    setShowForm(true)
    setError('')
    setDetay(null)
  }

  const handleDurumChange = async (c: Cek, durum: Cek['durum']) => {
    await fetch(`/api/cekler/${c.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durum }),
    })
    fetchAll()
    setDetay(null)
  }

  const handleDelete = async (c: Cek) => {
    if (!confirm(`${c.cekNo ? `"${c.cekNo}" numaralı ` : ''}çeki silmek istediğinize emin misiniz?`)) return
    const res = await fetch(`/api/cekler/${c.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Silinemedi')
      return
    }
    setDetay(null)
    fetchAll()
  }

  const handleExcelExport = () => {
    const rows = cekler.map((c) => ({
      'Tür': c.tur === 'ALINAN' ? 'Alınan' : 'Verilen',
      'Çek No': c.cekNo || '',
      'Banka': c.banka || '',
      'Şube': c.sube || '',
      'Karşı Taraf': c.karsiTaraf || '',
      'Tutar': c.tutar,
      'Vade Tarihi': tarihStr(c.vadeTarihi),
      'Düzenleme Tarihi': tarihStr(c.duzenlemeTarihi),
      'Durum': DURUM_LABEL[c.durum],
      'Şirket': c.sirket?.ad || '',
      'Açıklama': c.aciklama || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Çekler')
    XLSX.writeFile(wb, 'cekler.xlsx')
  }

  const filtreli = useMemo(() => {
    return cekler.filter((c) => {
      if (filterTur !== 'HEPSI' && c.tur !== filterTur) return false
      if (filterSirket !== 'HEPSI' && c.sirketId !== filterSirket) return false
      if (!showCompleted && ['TAHSIL_EDILDI', 'CIRO_EDILDI', 'IPTAL'].includes(c.durum)) return false
      return true
    })
  }, [cekler, filterTur, filterSirket, showCompleted])

  const ozet = useMemo(() => {
    const bekleyenAlinan = cekler.filter((c) => c.tur === 'ALINAN' && c.durum === 'BEKLEMEDE').reduce((s, c) => s + c.tutar, 0)
    const bekleyenVerilen = cekler.filter((c) => c.tur === 'VERILEN' && c.durum === 'BEKLEMEDE').reduce((s, c) => s + c.tutar, 0)
    const yaklasan = cekler.filter((c) => c.durum === 'BEKLEMEDE' && vadeDurumu(c).seviye !== 'iyi').length
    const karsiliksiz = cekler.filter((c) => c.durum === 'KARSILIKSIZ').length
    return { bekleyenAlinan, bekleyenVerilen, yaklasan, karsiliksiz }
  }, [cekler])

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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold font-display">Çekler</h2>
          <p className="text-muted-foreground text-sm">Alınan ve verilen çeklerin vade takibi</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleLock} title="Bölümü kilitle">
            <LockKeyhole className="h-4 w-4 mr-1" /> Kilitle
          </Button>
          {cekler.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExcelExport}>
              <Download className="h-4 w-4 mr-1" /> Excel
            </Button>
          )}
          <Button onClick={() => { resetForm(); setShowForm(true) }} className="bg-secondary hover:bg-secondary/90" size="sm">
            <Plus className="h-4 w-4 mr-1" /> Yeni Çek
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><ArrowDownCircle className="h-3.5 w-3.5" /> Bekleyen Alınan</div>
          <div className="font-semibold">{paraStr(ozet.bekleyenAlinan)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><ArrowUpCircle className="h-3.5 w-3.5" /> Bekleyen Verilen</div>
          <div className="font-semibold">{paraStr(ozet.bekleyenVerilen)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><AlertTriangle className="h-3.5 w-3.5" /> Yaklaşan / Geçen</div>
          <div className="font-semibold">{ozet.yaklasan}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Karşılıksız</div>
          <div className="font-semibold">{ozet.karsiliksiz}</div>
        </CardContent></Card>
      </div>

      {showForm && (
        <Card className="border-secondary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{editId ? 'Çek Düzenle' : 'Yeni Çek Ekle'}</CardTitle>
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
                    <option value="ALINAN">Alınan Çek</option>
                    <option value="VERILEN">Verilen Çek</option>
                  </select>
                </div>
                <div>
                  <Label>Durum</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.durum}
                    onChange={(e) => set('durum')(e.target.value)}
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
                  <Label>{form.tur === 'ALINAN' ? 'Kimden Alındı' : 'Kime Verildi'}</Label>
                  <Input value={form.karsiTaraf} onChange={(e) => set('karsiTaraf')(e.target.value)} placeholder="Firma / kişi adı" />
                </div>
                <div>
                  <Label>Tutar (₺) *</Label>
                  <Input type="number" step="any" value={form.tutar} onChange={(e) => set('tutar')(e.target.value)} required />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <Label>Çek No</Label>
                  <Input value={form.cekNo} onChange={(e) => set('cekNo')(e.target.value)} />
                </div>
                <div>
                  <Label>Banka</Label>
                  <Input value={form.banka} onChange={(e) => set('banka')(e.target.value)} />
                </div>
                <div>
                  <Label>Şube</Label>
                  <Input value={form.sube} onChange={(e) => set('sube')(e.target.value)} />
                </div>
                <div>
                  <Label>Düzenleme Tarihi</Label>
                  <Input type="date" value={form.duzenlemeTarihi} onChange={(e) => set('duzenlemeTarihi')(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Vade Tarihi *</Label>
                  <Input type="date" value={form.vadeTarihi} onChange={(e) => set('vadeTarihi')(e.target.value)} required />
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
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(['HEPSI', 'ALINAN', 'VERILEN'] as const).map((t) => (
          <Button key={t} size="sm" variant={filterTur === t ? 'default' : 'outline'} className={filterTur === t ? 'bg-secondary hover:bg-secondary/90' : ''} onClick={() => setFilterTur(t)}>
            {t === 'HEPSI' ? 'Hepsi' : t === 'ALINAN' ? 'Alınan' : 'Verilen'}
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
          Tamamlananları Göster
        </Button>
      </div>

      {filtreli.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16 text-muted-foreground">
            <FileCheck2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
            Gösterilecek çek yok
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtreli.map((c) => (
            <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetay(c)}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    {c.tur === 'ALINAN' ? <ArrowDownCircle className="h-4 w-4 text-green-600" /> : <ArrowUpCircle className="h-4 w-4 text-orange-600" />}
                    {c.tur === 'ALINAN' ? 'Alınan' : 'Verilen'}
                    {c.cekNo && <span className="text-muted-foreground font-normal">· {c.cekNo}</span>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${DURUM_RENK[c.durum]}`}>{DURUM_LABEL[c.durum]}</span>
                </div>
                <div className="text-sm text-muted-foreground">{c.karsiTaraf || '—'}{c.sirket && ` · ${c.sirket.ad}`}</div>
                <div className="font-semibold">{paraStr(c.tutar)}</div>
                <VadeBadge cek={c} />
                <div className="flex items-center justify-end gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(c)} title="Düzenle">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(c)} title="Sil">
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
                  <FileCheck2 className="h-5 w-5" /> {detay.tur === 'ALINAN' ? 'Alınan Çek' : 'Verilen Çek'}{detay.cekNo ? ` · ${detay.cekNo}` : ''}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${DURUM_RENK[detay.durum]}`}>{DURUM_LABEL[detay.durum]}</span>
                  <VadeBadge cek={detay} />
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-muted-foreground">
                  <div>Karşı Taraf</div><div className="text-right text-foreground">{detay.karsiTaraf || '—'}</div>
                  <div>Tutar</div><div className="text-right text-foreground font-medium">{paraStr(detay.tutar)}</div>
                  <div>Banka / Şube</div><div className="text-right text-foreground">{[detay.banka, detay.sube].filter(Boolean).join(' / ') || '—'}</div>
                  <div>Şirket</div><div className="text-right text-foreground">{detay.sirket?.ad || '—'}</div>
                  <div>Düzenleme Tarihi</div><div className="text-right text-foreground">{tarihStr(detay.duzenlemeTarihi)}</div>
                  <div>Vade Tarihi</div><div className="text-right text-foreground">{tarihStr(detay.vadeTarihi)}</div>
                </div>
                {detay.aciklama && (
                  <div>
                    <p className="font-medium mb-1">Açıklama</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{detay.aciklama}</p>
                  </div>
                )}

                <div>
                  <Label className="text-xs">Durumu Değiştir</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {Object.entries(DURUM_LABEL).map(([k, v]) => (
                      <Button
                        key={k}
                        size="sm"
                        variant={detay.durum === k ? 'default' : 'outline'}
                        className={detay.durum === k ? 'bg-secondary hover:bg-secondary/90' : ''}
                        onClick={() => handleDurumChange(detay, k as Cek['durum'])}
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
