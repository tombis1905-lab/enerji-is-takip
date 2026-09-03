'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FadeIn, Stagger, StaggerItem } from '@/components/ui/animate'
import { Users, Plus, Trash2, Shield, User as UserIcon, ClipboardList } from 'lucide-react'
import { toast } from 'sonner'

interface Personel {
  id: string
  email: string
  name: string
  role: string
  createdAt: string
  _count?: { isKayitlari: number }
}

export function PersonellerClient() {
  const [personeller, setPersoneller] = useState<Personel[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'PERSONEL' })
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(() => {
    fetch('/api/personeller')
      .then(r => r.json())
      .then(d => setPersoneller(Array.isArray(d) ? d : []))
      .catch(() => toast.error('Veriler yüklenemedi'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const openNew = () => {
    setForm({ email: '', password: '', name: '', role: 'PERSONEL' })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.email.trim() || !form.password.trim() || !form.name.trim()) {
      toast.error('Tüm alanları doldurun')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/personeller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data?.error ?? 'Hata oluştu')
        return
      }
      toast.success('Personel eklendi')
      setDialogOpen(false)
      loadData()
    } catch { toast.error('Hata oluştu') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu personeli silmek istediğinize emin misiniz?')) return
    try {
      const res = await fetch(`/api/personeller/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data?.error ?? 'Silinemedi')
        return
      }
      toast.success('Personel silindi')
      loadData()
    } catch { toast.error('Hata oluştu') }
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Personeller</h1>
            <p className="text-muted-foreground text-sm mt-1">Kullanıcı ve personel yönetimi</p>
          </div>
          <Button onClick={openNew} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
            <Plus className="h-4 w-4 mr-2" /> Personel Ekle
          </Button>
        </div>
      </FadeIn>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : (personeller?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Henüz personel eklenmemiş.</p>
          </CardContent>
        </Card>
      ) : (
        <Stagger className="space-y-3" staggerDelay={0.05}>
          {(personeller ?? []).map((p: Personel) => (
            <StaggerItem key={p.id}>
              <Card className="group hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                    {(p?.name ?? '?')?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{p.name}</p>
                      {p.role === 'ADMIN' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/10 text-secondary text-xs font-medium">
                          <Shield className="h-3 w-3" /> Yönetici
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                          <UserIcon className="h-3 w-3" /> Personel
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">Kullanıcı adı: {p.email}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <ClipboardList className="h-3 w-3" /> {p._count?.isKayitlari ?? 0} kayıt
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(p.id)}
                    className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4" />
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
            <DialogTitle>Yeni Personel Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>İsim Soyisim *</Label>
              <Input
                value={form.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Ad Soyad"
              />
            </div>
            <div className="space-y-2">
              <Label>Kullanıcı Adı *</Label>
              <Input
                value={form.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, email: e.target.value.toLowerCase() }))}
                placeholder="Giriş için kullanıcı adı"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">Kullanıcı adları küçük harfe çevrilir. Personel bu adı ve şifreyi girerek giriş yapar.</p>
            </div>
            <div className="space-y-2">
              <Label>Şifre *</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="Giriş şifresi"
              />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <select
                value={form.role}
                onChange={(e) => setForm(p => ({ ...p, role: e.target.value }))}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="PERSONEL">Personel</option>
                <option value="ADMIN">Yönetici</option>
              </select>
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
