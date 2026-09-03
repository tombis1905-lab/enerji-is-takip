'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FadeIn, Stagger, StaggerItem } from '@/components/ui/animate'
import { Wrench, Plus, Trash2, Ruler } from 'lucide-react'
import { toast } from 'sonner'

interface IsTuru {
  id: string
  ad: string
  birim: string
  aktif: boolean
}

export function IsTurleriClient() {
  const [turleri, setTurleri] = useState<IsTuru[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ ad: '', birim: '' })
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(() => {
    fetch('/api/is-turleri')
      .then(r => r.json())
      .then(d => setTurleri(Array.isArray(d) ? d : []))
      .catch(() => toast.error('Veriler yüklenemedi'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const openNew = () => {
    setForm({ ad: '', birim: '' })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.ad.trim() || !form.birim.trim()) {
      toast.error('İş türü adı ve birim gerekli')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/is-turleri', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad: form.ad.trim(), birim: form.birim.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data?.error ?? 'Hata oluştu')
        return
      }
      toast.success('İş türü eklendi')
      setDialogOpen(false)
      loadData()
    } catch { toast.error('Hata oluştu') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu iş türünü silmek istediğinize emin misiniz?')) return
    try {
      const res = await fetch(`/api/is-turleri/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data?.error ?? 'Silinemedi')
        return
      }
      toast.success('İş türü silindi')
      loadData()
    } catch { toast.error('Hata oluştu') }
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">İş Türleri</h1>
            <p className="text-muted-foreground text-sm mt-1">Takip edilen iş türleri ve ölçü birimleri</p>
          </div>
          <Button onClick={openNew} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
            <Plus className="h-4 w-4 mr-2" /> Yeni Tür Ekle
          </Button>
        </div>
      </FadeIn>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : (turleri?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Wrench className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Henüz iş türü eklenmemiş.</p>
          </CardContent>
        </Card>
      ) : (
        <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" staggerDelay={0.05}>
          {(turleri ?? []).map((t: IsTuru) => (
            <StaggerItem key={t.id}>
              <Card className="group hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Wrench className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">{t.ad}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Ruler className="h-3 w-3" /> {t.birim}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(t.id)}
                    className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni İş Türü Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>İş Türü Adı *</Label>
              <Input
                value={form.ad}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, ad: e.target.value }))}
                placeholder="Ör: Direk dikme"
              />
            </div>
            <div className="space-y-2">
              <Label>Ölçü Birimi *</Label>
              <Input
                value={form.birim}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, birim: e.target.value }))}
                placeholder="Ör: adet, metre, m³"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Vazgeç</Button>
            <Button onClick={handleSave} loading={saving} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
              Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
