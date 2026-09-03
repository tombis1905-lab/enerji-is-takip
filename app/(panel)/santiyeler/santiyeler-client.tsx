'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FadeIn, Stagger, StaggerItem } from '@/components/ui/animate'
import { Building2, Plus, MapPin, Pencil, Trash2, ClipboardList } from 'lucide-react'
import { toast } from 'sonner'

interface Santiye {
  id: string
  ad: string
  konum: string | null
  aktif: boolean
  _count?: { isKayitlari: number }
}

export function SantiyelerClient({ role }: { role: string }) {
  const [santiyeler, setSantiyeler] = useState<Santiye[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ ad: '', konum: '' })
  const [saving, setSaving] = useState(false)
  const isAdmin = role === 'ADMIN'

  const loadData = useCallback(() => {
    fetch('/api/santiyeler')
      .then(r => r.json())
      .then(d => setSantiyeler(Array.isArray(d) ? d : []))
      .catch(() => toast.error('Veriler yüklenemedi'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const openNew = () => {
    setEditId(null)
    setForm({ ad: '', konum: '' })
    setDialogOpen(true)
  }

  const openEdit = (s: Santiye) => {
    setEditId(s.id)
    setForm({ ad: s.ad, konum: s.konum ?? '' })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.ad.trim()) { toast.error('Şantiye adı gerekli'); return }
    setSaving(true)
    try {
      const url = editId ? `/api/santiyeler/${editId}` : '/api/santiyeler'
      const method = editId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad: form.ad.trim(), konum: form.konum.trim() || null }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data?.error ?? 'Hata oluştu')
        return
      }
      toast.success(editId ? 'Şantiye güncellendi' : 'Şantiye eklendi')
      setDialogOpen(false)
      loadData()
    } catch { toast.error('Hata oluştu') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu şantiyeyi silmek istediğinize emin misiniz?')) return
    try {
      const res = await fetch(`/api/santiyeler/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data?.error ?? 'Silinemedi')
        return
      }
      toast.success('Şantiye silindi')
      loadData()
    } catch { toast.error('Hata oluştu') }
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Şantiyeler</h1>
            <p className="text-muted-foreground text-sm mt-1">Aktif şantiye ve sahalarınız</p>
          </div>
          {isAdmin && (
            <Button onClick={openNew} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
              <Plus className="h-4 w-4 mr-2" /> Yeni Şantiye
            </Button>
          )}
        </div>
      </FadeIn>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : (santiyeler?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Henüz şantiye eklenmemiş.</p>
          </CardContent>
        </Card>
      ) : (
        <Stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" staggerDelay={0.05}>
          {(santiyeler ?? []).map((s: Santiye) => (
            <StaggerItem key={s.id}>
              <Card className="group hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{s.ad}</h3>
                        {s.konum && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" /> {s.konum}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <ClipboardList className="h-3 w-3" /> {s._count?.isKayitlari ?? 0} kayıt
                        </p>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(s)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(s.id)} className="text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? 'Şantiye Düzenle' : 'Yeni Şantiye'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Şantiye Adı *</Label>
              <Input
                value={form.ad}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, ad: e.target.value }))}
                placeholder="Ör: Ankara-Eskişehir Hattı"
              />
            </div>
            <div className="space-y-2">
              <Label>Konum / Lokasyon</Label>
              <Input
                value={form.konum}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, konum: e.target.value }))}
                placeholder="Ör: Ankara, Polatlı"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Vazgeç</Button>
            <Button onClick={handleSave} loading={saving} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
              {editId ? 'Güncelle' : 'Ekle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
