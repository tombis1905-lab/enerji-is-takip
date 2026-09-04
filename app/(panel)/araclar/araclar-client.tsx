'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Truck, Plus, Pencil, Trash2, Check, Ban, Download, ShieldCheck, ClipboardCheck, AlertTriangle } from 'lucide-react'
import * as XLSX from 'xlsx'

interface Arac {
  id: string
  plaka: string
  isim: string | null
  marka: string | null
  model: string | null
  aktif: boolean
  sigortaBitisTarihi: string | null
  muayeneBitisTarihi: string | null
  _count?: { akaryakitKayitlari: number }
}

type DurumSeviye = 'yok' | 'gecmis' | 'yakin' | 'iyi'

function durumHesapla(tarihStr: string | null): { seviye: DurumSeviye; metin: string } {
  if (!tarihStr) return { seviye: 'yok', metin: 'Tarih girilmemiş' }
  const bitis = new Date(tarihStr)
  const now = new Date()
  const gunFarki = Math.ceil((bitis.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (gunFarki < 0) return { seviye: 'gecmis', metin: `${Math.abs(gunFarki)} gün önce bitti — SÜRESİ DOLDU` }
  if (gunFarki <= 30) return { seviye: 'yakin', metin: `${gunFarki} gün kaldı` }
  return { seviye: 'iyi', metin: `${gunFarki} gün kaldı` }
}

const seviyeRenk: Record<DurumSeviye, string> = {
  yok: 'bg-muted text-muted-foreground',
  gecmis: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  yakin: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  iyi: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
}

function tarihStr(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('tr-TR')
}

function DurumBadge({ tarihStr: t }: { tarihStr: string | null }) {
  const { seviye, metin } = durumHesapla(t)
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${seviyeRenk[seviye]}`}>
      {seviye === 'gecmis' && <AlertTriangle className="h-3 w-3" />}
      {t ? `${tarihStr(t)} · ${metin}` : metin}
    </span>
  )
}

export function AraclarClient() {
  const [araclar, setAraclar] = useState<Arac[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ plaka: '', isim: '', marka: '', model: '', sigortaBitisTarihi: '', muayeneBitisTarihi: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [detayArac, setDetayArac] = useState<Arac | null>(null)

  const fetchAraclar = useCallback(async () => {
    const res = await fetch('/api/araclar')
    if (res.ok) setAraclar(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchAraclar() }, [fetchAraclar])

  const resetForm = () => {
    setForm({ plaka: '', isim: '', marka: '', model: '', sigortaBitisTarihi: '', muayeneBitisTarihi: '' })
    setShowForm(false)
    setEditId(null)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const url = editId ? `/api/araclar/${editId}` : '/api/araclar'
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
      fetchAraclar()
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (a: Arac) => {
    setForm({
      plaka: a.plaka,
      isim: a.isim || '',
      marka: a.marka || '',
      model: a.model || '',
      sigortaBitisTarihi: a.sigortaBitisTarihi ? a.sigortaBitisTarihi.slice(0, 10) : '',
      muayeneBitisTarihi: a.muayeneBitisTarihi ? a.muayeneBitisTarihi.slice(0, 10) : '',
    })
    setEditId(a.id)
    setShowForm(true)
    setError('')
  }

  const handleToggleAktif = async (a: Arac) => {
    await fetch(`/api/araclar/${a.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aktif: !a.aktif }),
    })
    fetchAraclar()
  }

  const handleDelete = async (a: Arac) => {
    if (!confirm(`"${a.plaka}" aracını silmek istediğinize emin misiniz?`)) return
    const res = await fetch(`/api/araclar/${a.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      alert(data.error || 'Silinemedi')
      return
    }
    fetchAraclar()
  }

  const handleExcelExport = () => {
    const rows = araclar.map((a) => ({
      'Plaka': a.plaka,
      'İsim': a.isim || '',
      'Marka': a.marka || '',
      'Model': a.model || '',
      'Durum': a.aktif ? 'Aktif' : 'Pasif',
      'Sigorta Bitiş': tarihStr(a.sigortaBitisTarihi),
      'Muayene Bitiş': tarihStr(a.muayeneBitisTarihi),
      'Fiş Sayısı': a._count?.akaryakitKayitlari ?? 0,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Araçlar')
    XLSX.writeFile(wb, 'araclar.xlsx')
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold font-display">Araçlar</h2>
          <p className="text-muted-foreground text-sm">Şirket araçlarını, sigorta ve muayene tarihlerini yönetin</p>
        </div>
        <div className="flex gap-2">
          {araclar.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExcelExport}>
              <Download className="h-4 w-4 mr-1" /> Excel
            </Button>
          )}
          <Button onClick={() => { resetForm(); setShowForm(true) }} className="bg-secondary hover:bg-secondary/90" size="sm">
            <Plus className="h-4 w-4 mr-1" /> Yeni Araç
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="border-secondary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{editId ? 'Araç Düzenle' : 'Yeni Araç Ekle'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label>Plaka *</Label>
                <Input
                  value={form.plaka}
                  onChange={(e) => setForm({ ...form, plaka: e.target.value })}
                  placeholder="34 ABC 123"
                  required
                />
              </div>
              <div>
                <Label>Kullanan Kişi</Label>
                <Input
                  value={form.isim}
                  onChange={(e) => setForm({ ...form, isim: e.target.value })}
                  placeholder="Ahmet Yılmaz"
                />
              </div>
              <div>
                <Label>Marka</Label>
                <Input
                  value={form.marka}
                  onChange={(e) => setForm({ ...form, marka: e.target.value })}
                  placeholder="Ford, Mercedes..."
                />
              </div>
              <div>
                <Label>Model</Label>
                <Input
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="Transit, Actros..."
                />
              </div>
              <div>
                <Label className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Sigorta Bitiş Tarihi</Label>
                <Input
                  type="date"
                  value={form.sigortaBitisTarihi}
                  onChange={(e) => setForm({ ...form, sigortaBitisTarihi: e.target.value })}
                />
              </div>
              <div>
                <Label className="flex items-center gap-1"><ClipboardCheck className="h-3.5 w-3.5" /> Muayene Bitiş Tarihi</Label>
                <Input
                  type="date"
                  value={form.muayeneBitisTarihi}
                  onChange={(e) => setForm({ ...form, muayeneBitisTarihi: e.target.value })}
                />
              </div>
              {error && <p className="text-destructive text-sm col-span-full">{error}</p>}
              <div className="col-span-full flex gap-2">
                <Button type="submit" disabled={saving} className="bg-secondary hover:bg-secondary/90">
                  {saving ? 'Kaydediliyor...' : editId ? 'Güncelle' : 'Ekle'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>İptal</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-semibold">Plaka</th>
                  <th className="text-left p-3 font-semibold">Kullanan</th>
                  <th className="text-left p-3 font-semibold">Marka / Model</th>
                  <th className="text-left p-3 font-semibold">Sigorta</th>
                  <th className="text-left p-3 font-semibold">Muayene</th>
                  <th className="text-center p-3 font-semibold">Durum</th>
                  <th className="text-right p-3 font-semibold">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {araclar.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-muted-foreground">
                      <Truck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      Henüz araç eklenmemiş
                    </td>
                  </tr>
                ) : (
                  araclar.map((a) => (
                    <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium">
                        {a.plaka === 'MİSAFİR ARAÇ' ? (
                          '🚛 MİSAFİR ARAÇ'
                        ) : (
                          <button
                            type="button"
                            className="hover:underline text-left"
                            onClick={() => setDetayArac(a)}
                            title="Sigorta / muayene detayını gör"
                          >
                            {a.plaka}
                          </button>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">{a.plaka === 'MİSAFİR ARAÇ' ? 'Misafir / Kiralık / Bidon' : (a.isim || '—')}</td>
                      <td className="p-3 text-muted-foreground">{[a.marka, a.model].filter(Boolean).join(' ') || '—'}</td>
                      <td className="p-3"><DurumBadge tarihStr={a.sigortaBitisTarihi} /></td>
                      <td className="p-3"><DurumBadge tarihStr={a.muayeneBitisTarihi} /></td>
                      <td className="p-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          a.aktif ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {a.aktif ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          {a.plaka !== 'MİSAFİR ARAÇ' && (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(a)} title="Düzenle">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleAktif(a)} title={a.aktif ? 'Pasif Yap' : 'Aktif Yap'}>
                                {a.aktif ? <Ban className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(a)} title="Sil">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          {a.plaka === 'MİSAFİR ARAÇ' && (
                            <span className="text-xs text-muted-foreground italic">Sabit</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!detayArac} onOpenChange={(open) => { if (!open) setDetayArac(null) }}>
        <DialogContent>
          {detayArac && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" /> {detayArac.plaka}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="text-sm text-muted-foreground">
                  {[detayArac.marka, detayArac.model].filter(Boolean).join(' ') || 'Marka/model girilmemiş'}
                  {detayArac.isim && ` · Kullanan: ${detayArac.isim}`}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <ShieldCheck className="h-4 w-4" /> Sigorta
                    </div>
                    <DurumBadge tarihStr={detayArac.sigortaBitisTarihi} />
                  </div>
                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <ClipboardCheck className="h-4 w-4" /> Muayene
                    </div>
                    <DurumBadge tarihStr={detayArac.muayeneBitisTarihi} />
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => { handleEdit(detayArac); setDetayArac(null) }}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Tarihleri Düzenle
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
