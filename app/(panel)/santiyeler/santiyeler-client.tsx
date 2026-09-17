'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FadeIn, Stagger, StaggerItem } from '@/components/ui/animate'
import { Building2, Plus, MapPin, Pencil, Trash2, ClipboardList, CheckCircle2, Tag } from 'lucide-react'
import { toast } from 'sonner'

type Kategori = 'KASKI' | 'CEVRE_SEHIRCILIK' | 'OZEL' | null

interface Santiye {
  id: string
  ad: string
  konum: string | null
  aktif: boolean
  kategori: Kategori
  _count?: { isKayitlari: number }
}

const KATEGORI_BILGI: Record<string, { etiket: string; className: string }> = {
  KASKI: { etiket: 'KASKİ İşleri', className: 'text-blue-700 bg-blue-50 border-blue-200' },
  CEVRE_SEHIRCILIK: { etiket: 'Çevre Şehircilik İşleri', className: 'text-green-700 bg-green-50 border-green-200' },
  OZEL: { etiket: 'Özel İşler', className: 'text-purple-700 bg-purple-50 border-purple-200' },
}

export function SantiyelerClient({ role }: { role: string }) {
  const [santiyeler, setSantiyeler] = useState<Santiye[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<{ ad: string; konum: string; kategori: Kategori }>({ ad: '', konum: '', kategori: null })
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
    setForm({ ad: '', konum: '', kategori: null })
    setDialogOpen(true)
  }

  const openEdit = (s: Santiye) => {
    setEditId(s.id)
    setForm({ ad: s.ad, konum: s.konum ?? '', kategori: s.kategori ?? null })
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
        body: JSON.stringify({ ad: form.ad.trim(), konum: form.konum.trim() || null, kategori: form.kategori }),
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

  const handleDurumDegistir = async (s: Santiye) => {
    const yeniAktif = !s.aktif
    if (!confirm(yeniAktif ? `${s.ad} yeniden aktif/devam ediyor olarak işaretlensin mi?` : `${s.ad} tamamlandı olarak işaretlensin mi?`)) return
    try {
      const res = await fetch(`/api/santiyeler/${s.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktif: yeniAktif }),
      })
      if (!res.ok) { toast.error('Güncellenemedi'); return }
      toast.success(yeniAktif ? 'Şantiye devam ediyor olarak işaretlendi' : 'Şantiye tamamlandı olarak işaretlendi')
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
              <Card className={`group hover:shadow-md transition-shadow ${!s.aktif ? 'opacity-70' : ''}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold flex items-center gap-1.5 flex-wrap">
                          {s.ad}
                          <span
                            className={
                              s.aktif
                                ? 'text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-1.5 py-0.5'
                                : 'inline-flex items-center gap-0.5 text-[10px] font-semibold text-gray-600 bg-gray-100 border border-gray-300 rounded-full px-1.5 py-0.5'
                            }
                          >
                            {s.aktif ? 'Devam Ediyor' : (<><CheckCircle2 className="h-2.5 w-2.5" /> Tamamlandı</>)}
                          </span>
                          {s.kategori && KATEGORI_BILGI[s.kategori] && (
                            <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold rounded-full px-1.5 py-0.5 border ${KATEGORI_BILGI[s.kategori].className}`}>
                              <Tag className="h-2.5 w-2.5" /> {KATEGORI_BILGI[s.kategori].etiket}
                            </span>
                          )}
                        </h3>
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
                        <Button variant="ghost" size="icon-sm" onClick={() => handleDurumDegistir(s)} title={s.aktif ? 'Tamamlandı olarak işaretle' : 'Devam ediyor olarak işaretle'}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
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
            <div className="space-y-2">
              <Label>Kategori (Proje Maliyeti gruplaması)</Label>
              <Select value={form.kategori ?? '__yok__'} onValueChange={(v) => setForm(p => ({ ...p, kategori: v === '__yok__' ? null : v as Kategori }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__yok__">Kategorisiz</SelectItem>
                  <SelectItem value="KASKI">KASKİ İşleri</SelectItem>
                  <SelectItem value="CEVRE_SEHIRCILIK">Çevre Şehircilik İşleri</SelectItem>
                  <SelectItem value="OZEL">Özel İşler</SelectItem>
                </SelectContent>
              </Select>
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
