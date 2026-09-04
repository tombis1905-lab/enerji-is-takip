'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Check,
  Ban,
  Download,
  Filter,
  X,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  Boxes,
} from 'lucide-react'
import { SafeDate } from '@/components/safe-format'
import * as XLSX from 'xlsx'

interface Malzeme {
  id: string
  ad: string
  birim: string
  stokMiktari: number
  minStok: number | null
  aciklama: string | null
  aktif: boolean
  _count?: { hareketler: number }
}

interface Hareket {
  id: string
  tarih: string
  tip: 'GIRIS' | 'CIKIS'
  miktar: number
  aciklama: string | null
  malzeme: { ad: string; birim: string }
  user: { name: string }
}

interface Props {
  role: string
}

export function DepoClient({ role }: Props) {
  const isAdmin = role === 'ADMIN'

  const [malzemeler, setMalzemeler] = useState<Malzeme[]>([])
  const [hareketler, setHareketler] = useState<Hareket[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Malzeme formu (admin)
  const [showMalzemeForm, setShowMalzemeForm] = useState(false)
  const [malzemeEditId, setMalzemeEditId] = useState<string | null>(null)
  const [malzemeForm, setMalzemeForm] = useState({ ad: '', birim: '', minStok: '', aciklama: '' })

  // Hareket formu
  const [showHareketForm, setShowHareketForm] = useState(false)
  const [defaultTarih, setDefaultTarih] = useState('')
  const [hareketForm, setHareketForm] = useState({ tarih: '', tip: 'GIRIS' as 'GIRIS' | 'CIKIS', miktar: '', aciklama: '', malzemeId: '' })

  // Filtreler
  const [filterMalzemeId, setFilterMalzemeId] = useState('')
  const [filterTip, setFilterTip] = useState('')
  const [filterAy, setFilterAy] = useState('')
  const [showFilter, setShowFilter] = useState(false)

  useEffect(() => {
    const now = new Date().toISOString().slice(0, 10)
    setDefaultTarih(now)
    setHareketForm((f) => ({ ...f, tarih: now }))
  }, [])

  const fetchMalzemeler = useCallback(async () => {
    const res = await fetch('/api/depo/malzeme')
    if (res.ok) setMalzemeler(await res.json())
  }, [])

  const fetchHareketler = useCallback(async () => {
    const params = new URLSearchParams()
    if (filterMalzemeId) params.set('malzemeId', filterMalzemeId)
    if (filterTip) params.set('tip', filterTip)
    if (filterAy) params.set('ay', filterAy)
    params.set('page', String(page))
    params.set('limit', '50')

    const res = await fetch(`/api/depo/hareket?${params}`)
    if (res.ok) {
      const data = await res.json()
      setHareketler(data.hareketler)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    }
    setLoading(false)
  }, [filterMalzemeId, filterTip, filterAy, page])

  useEffect(() => { fetchMalzemeler() }, [fetchMalzemeler])
  useEffect(() => { fetchHareketler() }, [fetchHareketler])

  const aktifMalzemeler = malzemeler.filter((m) => m.aktif)

  // --- Malzeme CRUD ---
  const resetMalzemeForm = () => {
    setMalzemeForm({ ad: '', birim: '', minStok: '', aciklama: '' })
    setShowMalzemeForm(false)
    setMalzemeEditId(null)
    setError('')
  }

  const handleMalzemeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const url = malzemeEditId ? `/api/depo/malzeme/${malzemeEditId}` : '/api/depo/malzeme'
      const method = malzemeEditId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(malzemeForm),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Hata oluştu')
        return
      }
      resetMalzemeForm()
      fetchMalzemeler()
    } finally {
      setSaving(false)
    }
  }

  const handleMalzemeEdit = (m: Malzeme) => {
    setMalzemeForm({ ad: m.ad, birim: m.birim, minStok: m.minStok?.toString() || '', aciklama: m.aciklama || '' })
    setMalzemeEditId(m.id)
    setShowMalzemeForm(true)
    setError('')
  }

  const handleMalzemeToggleAktif = async (m: Malzeme) => {
    await fetch(`/api/depo/malzeme/${m.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aktif: !m.aktif }),
    })
    fetchMalzemeler()
  }

  const handleMalzemeDelete = async (m: Malzeme) => {
    if (!confirm(`"${m.ad}" malzemesini silmek istediğinize emin misiniz?`)) return
    const res = await fetch(`/api/depo/malzeme/${m.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      alert(data.error || 'Silinemedi')
      return
    }
    fetchMalzemeler()
  }

  // --- Hareket ---
  const handleHareketSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!hareketForm.malzemeId) { setError('Malzeme seçiniz'); return }
    if (!hareketForm.miktar || Number(hareketForm.miktar) <= 0) { setError('Geçerli bir miktar giriniz'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/depo/hareket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...hareketForm, miktar: Number(hareketForm.miktar) }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Hata oluştu')
        return
      }
      setHareketForm({ tarih: defaultTarih, tip: 'GIRIS', miktar: '', aciklama: '', malzemeId: hareketForm.malzemeId })
      setShowHareketForm(false)
      setPage(1)
      fetchMalzemeler()
      fetchHareketler()
    } finally {
      setSaving(false)
    }
  }

  const handleHareketDelete = async (id: string) => {
    if (!confirm('Bu hareketi silmek istediğinize emin misiniz? Stok miktarı buna göre geri güncellenecek.')) return
    const res = await fetch(`/api/depo/hareket/${id}`, { method: 'DELETE' })
    if (res.ok) {
      fetchMalzemeler()
      fetchHareketler()
    } else {
      alert('Silinemedi')
    }
  }

  const handleExcelExport = () => {
    const rows = hareketler.map((h) => ({
      'Tarih': new Date(h.tarih).toLocaleDateString('tr-TR'),
      'Malzeme': h.malzeme.ad,
      'Tip': h.tip === 'GIRIS' ? 'Giriş' : 'Çıkış',
      'Miktar': h.miktar,
      'Birim': h.malzeme.birim,
      'Açıklama': h.aciklama || '',
      'Kaydeden': h.user.name,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Depo Hareketleri')
    XLSX.writeFile(wb, `depo_hareketleri_${filterAy || 'tum'}.xlsx`)
  }

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
          <h2 className="text-2xl font-bold font-display">Depo</h2>
          <p className="text-muted-foreground text-sm">Malzeme stoklarını ve depo giriş/çıkışlarını takip edin</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {hareketler.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExcelExport}>
              <Download className="h-4 w-4 mr-1" /> Excel
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowFilter(!showFilter)}>
            <Filter className="h-4 w-4 mr-1" /> Filtre
          </Button>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => { resetMalzemeForm(); setShowMalzemeForm(true) }}>
              <Plus className="h-4 w-4 mr-1" /> Yeni Malzeme
            </Button>
          )}
          <Button onClick={() => setShowHareketForm(!showHareketForm)} className="bg-secondary hover:bg-secondary/90" size="sm">
            <Plus className="h-4 w-4 mr-1" /> Yeni Hareket
          </Button>
        </div>
      </div>

      {/* Malzeme (Stok) Kartları */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Boxes className="h-4 w-4" /> Stok Durumu
          </CardTitle>
        </CardHeader>
        <CardContent>
          {aktifMalzemeler.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Henüz malzeme eklenmemiş. {isAdmin ? '"Yeni Malzeme" ile başlayın.' : ''}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {aktifMalzemeler.map((m) => {
                const kritik = m.minStok !== null && m.minStok !== undefined && m.stokMiktari <= m.minStok
                return (
                  <div
                    key={m.id}
                    className={`rounded-lg border p-3 ${kritik ? 'border-destructive/40 bg-destructive/5' : 'border-border'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate flex items-center gap-1.5">
                          {kritik && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                          {m.ad}
                        </p>
                        <p className="text-xl font-bold mt-1">
                          {m.stokMiktari.toLocaleString('tr-TR')} <span className="text-xs font-normal text-muted-foreground">{m.birim}</span>
                        </p>
                        {m.minStok !== null && m.minStok !== undefined && (
                          <p className="text-xs text-muted-foreground mt-0.5">Min. stok: {m.minStok.toLocaleString('tr-TR')} {m.birim}</p>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMalzemeEdit(m)} title="Düzenle">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleMalzemeDelete(m)} title="Sil">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pasif malzemeler (admin) */}
          {isAdmin && malzemeler.some((m) => !m.aktif) && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Pasif Malzemeler</p>
              <div className="flex flex-wrap gap-2">
                {malzemeler.filter((m) => !m.aktif).map((m) => (
                  <div key={m.id} className="flex items-center gap-1 text-xs bg-muted rounded-full pl-3 pr-1 py-1">
                    <span>{m.ad}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleMalzemeToggleAktif(m)} title="Aktif Yap">
                      <Check className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Malzeme Ekle/Düzenle Formu */}
      {showMalzemeForm && (
        <Card className="border-secondary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{malzemeEditId ? 'Malzeme Düzenle' : 'Yeni Malzeme Ekle'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleMalzemeSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label>Malzeme Adı *</Label>
                <Input
                  value={malzemeForm.ad}
                  onChange={(e) => setMalzemeForm({ ...malzemeForm, ad: e.target.value })}
                  placeholder="Örn: Kablo, İzolatör, Kum"
                  required
                />
              </div>
              <div>
                <Label>Birim *</Label>
                <Input
                  value={malzemeForm.birim}
                  onChange={(e) => setMalzemeForm({ ...malzemeForm, birim: e.target.value })}
                  placeholder="adet, metre, ton..."
                  required
                />
              </div>
              <div>
                <Label>Min. Stok Uyarısı</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={malzemeForm.minStok}
                  onChange={(e) => setMalzemeForm({ ...malzemeForm, minStok: e.target.value })}
                  placeholder="Opsiyonel"
                />
              </div>
              <div>
                <Label>Açıklama</Label>
                <Input
                  value={malzemeForm.aciklama}
                  onChange={(e) => setMalzemeForm({ ...malzemeForm, aciklama: e.target.value })}
                  placeholder="Opsiyonel"
                />
              </div>
              {error && <p className="text-destructive text-sm col-span-full">{error}</p>}
              <div className="col-span-full flex gap-2">
                <Button type="submit" disabled={saving} className="bg-secondary hover:bg-secondary/90">
                  {saving ? 'Kaydediliyor...' : malzemeEditId ? 'Güncelle' : 'Ekle'}
                </Button>
                <Button type="button" variant="outline" onClick={resetMalzemeForm}>İptal</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filtre */}
      {showFilter && (
        <Card className="border-blue-200 dark:border-blue-900">
          <CardContent className="pt-4 pb-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <Label className="text-xs">Malzeme</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={filterMalzemeId}
                  onChange={(e) => { setFilterMalzemeId(e.target.value); setPage(1) }}
                >
                  <option value="">Tüm Malzemeler</option>
                  {malzemeler.map((m) => (
                    <option key={m.id} value={m.id}>{m.ad}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Hareket Tipi</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={filterTip}
                  onChange={(e) => { setFilterTip(e.target.value); setPage(1) }}
                >
                  <option value="">Tümü</option>
                  <option value="GIRIS">Giriş</option>
                  <option value="CIKIS">Çıkış</option>
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
                <Button variant="outline" size="sm" onClick={() => { setFilterMalzemeId(''); setFilterTip(''); setFilterAy(''); setPage(1) }}>
                  <X className="h-3 w-3 mr-1" /> Temizle
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hareket Formu */}
      {showHareketForm && (
        <Card className="border-secondary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-secondary" /> Yeni Depo Hareketi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleHareketSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <Label>Malzeme *</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={hareketForm.malzemeId}
                  onChange={(e) => setHareketForm({ ...hareketForm, malzemeId: e.target.value })}
                  required
                >
                  <option value="">Malzeme seçin</option>
                  {aktifMalzemeler.map((m) => (
                    <option key={m.id} value={m.id}>{m.ad} ({m.stokMiktari.toLocaleString('tr-TR')} {m.birim} mevcut)</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Hareket Tipi *</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={hareketForm.tip}
                  onChange={(e) => setHareketForm({ ...hareketForm, tip: e.target.value as 'GIRIS' | 'CIKIS' })}
                  required
                >
                  <option value="GIRIS">Giriş (depoya eklenen)</option>
                  <option value="CIKIS">Çıkış (depodan kullanılan)</option>
                </select>
              </div>
              <div>
                <Label>Tarih *</Label>
                <Input
                  type="date"
                  value={hareketForm.tarih}
                  onChange={(e) => setHareketForm({ ...hareketForm, tarih: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Miktar *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={hareketForm.miktar}
                  onChange={(e) => setHareketForm({ ...hareketForm, miktar: e.target.value })}
                  placeholder="0"
                  required
                />
              </div>
              <div>
                <Label>Açıklama</Label>
                <Input
                  value={hareketForm.aciklama}
                  onChange={(e) => setHareketForm({ ...hareketForm, aciklama: e.target.value })}
                  placeholder="Opsiyonel"
                />
              </div>
              {error && <p className="text-destructive text-sm col-span-full">{error}</p>}
              <div className="col-span-full flex gap-2">
                <Button type="submit" disabled={saving} className="bg-secondary hover:bg-secondary/90">
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowHareketForm(false)}>İptal</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Hareket Kayıtları */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" /> Depo Hareketleri
            <span className="text-xs text-muted-foreground font-normal ml-2">({total} kayıt)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-semibold">Tarih</th>
                  <th className="text-left p-3 font-semibold">Malzeme</th>
                  <th className="text-center p-3 font-semibold">Tip</th>
                  <th className="text-right p-3 font-semibold">Miktar</th>
                  <th className="text-left p-3 font-semibold">Açıklama</th>
                  <th className="text-left p-3 font-semibold">Personel</th>
                  {isAdmin && <th className="text-right p-3 font-semibold">İşlem</th>}
                </tr>
              </thead>
              <tbody>
                {hareketler.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} className="text-center py-10 text-muted-foreground">
                      <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      Bu dönemde depo hareketi yok
                    </td>
                  </tr>
                ) : (
                  hareketler.map((h) => (
                    <tr key={h.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <SafeDate date={h.tarih} options={{ day: '2-digit', month: '2-digit', year: 'numeric' }} locale="tr-TR" />
                      </td>
                      <td className="p-3 font-medium">{h.malzeme.ad}</td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                          h.tip === 'GIRIS'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                        }`}>
                          {h.tip === 'GIRIS' ? <ArrowDownToLine className="h-3 w-3" /> : <ArrowUpFromLine className="h-3 w-3" />}
                          {h.tip === 'GIRIS' ? 'Giriş' : 'Çıkış'}
                        </span>
                      </td>
                      <td className="p-3 text-right font-semibold">
                        {h.miktar.toLocaleString('tr-TR')} <span className="text-xs font-normal text-muted-foreground">{h.malzeme.birim}</span>
                      </td>
                      <td className="p-3 text-muted-foreground max-w-[200px] truncate">{h.aciklama || '—'}</td>
                      <td className="p-3 text-muted-foreground">{h.user.name}</td>
                      {isAdmin && (
                        <td className="p-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleHareketDelete(h.id)}
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

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-3 border-t">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Önceki
              </Button>
              <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Sonraki
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
