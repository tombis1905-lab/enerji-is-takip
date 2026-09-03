'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Truck, Plus, Pencil, Trash2, Check, Ban, Download } from 'lucide-react'
import * as XLSX from 'xlsx'

interface Arac {
  id: string
  plaka: string
  isim: string | null
  marka: string | null
  model: string | null
  aktif: boolean
  _count?: { akaryakitKayitlari: number }
}

export function AraclarClient() {
  const [araclar, setAraclar] = useState<Arac[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ plaka: '', isim: '', marka: '', model: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchAraclar = useCallback(async () => {
    const res = await fetch('/api/araclar')
    if (res.ok) setAraclar(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchAraclar() }, [fetchAraclar])

  const resetForm = () => {
    setForm({ plaka: '', isim: '', marka: '', model: '' })
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
    setForm({ plaka: a.plaka, isim: a.isim || '', marka: a.marka || '', model: a.model || '' })
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
          <p className="text-muted-foreground text-sm">Şirket araçlarını yönetin</p>
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
                  <th className="text-left p-3 font-semibold">Marka</th>
                  <th className="text-left p-3 font-semibold">Model</th>
                  <th className="text-center p-3 font-semibold">Kayıt</th>
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
                      <td className="p-3 font-medium">{a.plaka === 'MİSAFİR ARAÇ' ? '🚛 MİSAFİR ARAÇ' : a.plaka}</td>
                      <td className="p-3 text-muted-foreground">{a.plaka === 'MİSAFİR ARAÇ' ? 'Misafir / Kiralık / Bidon' : (a.isim || '—')}</td>
                      <td className="p-3 text-muted-foreground">{a.marka || '—'}</td>
                      <td className="p-3 text-muted-foreground">{a.model || '—'}</td>
                      <td className="p-3 text-center">
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                          {a._count?.akaryakitKayitlari ?? 0} fiş
                        </span>
                      </td>
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
    </div>
  )
}
