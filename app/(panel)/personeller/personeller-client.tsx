'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FadeIn, Stagger, StaggerItem } from '@/components/ui/animate'
import { Users, Plus, Trash2, Shield, User as UserIcon, ClipboardList, Building2, History, LogOut, X } from 'lucide-react'
import { toast } from 'sonner'

interface Personel {
  id: string
  email: string
  name: string
  role: string
  createdAt: string
  _count?: { isKayitlari: number }
  aktifSirket: string | null
  aktifSirketBaslangic: string | null
}

interface Sirket {
  id: string
  ad: string
  aktif: boolean
}

interface GecmisKaydi {
  id: string
  baslangicTarihi: string
  bitisTarihi: string | null
  aciklama: string | null
  sirket: { ad: string }
}

export function PersonellerClient() {
  const [personeller, setPersoneller] = useState<Personel[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'PERSONEL' })
  const [saving, setSaving] = useState(false)

  // Şirket Geçmişi dialog state
  const [gecmisDialogOpen, setGecmisDialogOpen] = useState(false)
  const [gecmisPersonel, setGecmisPersonel] = useState<Personel | null>(null)
  const [gecmisler, setGecmisler] = useState<GecmisKaydi[]>([])
  const [sirketler, setSirketler] = useState<Sirket[]>([])
  const [gecmisLoading, setGecmisLoading] = useState(false)
  const [gecmisSaving, setGecmisSaving] = useState(false)
  const [gecmisForm, setGecmisForm] = useState({ sirketId: '', baslangicTarihi: '', aciklama: '' })
  const [yeniSirketAd, setYeniSirketAd] = useState('')
  const [showYeniSirket, setShowYeniSirket] = useState(false)

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

  // --- Şirket Geçmişi ---
  const openGecmis = async (p: Personel) => {
    setGecmisPersonel(p)
    setGecmisDialogOpen(true)
    setGecmisLoading(true)
    setShowYeniSirket(false)
    setYeniSirketAd('')
    const now = new Date().toISOString().slice(0, 10)
    setGecmisForm({ sirketId: '', baslangicTarihi: now, aciklama: '' })
    try {
      const res = await fetch(`/api/personeller/${p.id}/sirket-gecmisi`)
      if (res.ok) {
        const data = await res.json()
        setGecmisler(data.gecmisler)
        setSirketler(data.sirketler)
      }
    } finally {
      setGecmisLoading(false)
    }
  }

  const refreshGecmis = async () => {
    if (!gecmisPersonel) return
    const res = await fetch(`/api/personeller/${gecmisPersonel.id}/sirket-gecmisi`)
    if (res.ok) {
      const data = await res.json()
      setGecmisler(data.gecmisler)
      setSirketler(data.sirketler)
    }
    loadData()
  }

  const handleGecmisSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!gecmisPersonel) return
    if (!gecmisForm.sirketId) { toast.error('Şirket seçiniz'); return }
    if (!gecmisForm.baslangicTarihi) { toast.error('Başlangıç tarihi giriniz'); return }
    setGecmisSaving(true)
    try {
      const res = await fetch(`/api/personeller/${gecmisPersonel.id}/sirket-gecmisi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gecmisForm),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data?.error ?? 'Hata oluştu')
        return
      }
      toast.success('Şirket geçişi kaydedildi')
      setGecmisForm({ sirketId: '', baslangicTarihi: new Date().toISOString().slice(0, 10), aciklama: '' })
      refreshGecmis()
    } catch { toast.error('Hata oluştu') }
    finally { setGecmisSaving(false) }
  }

  const handleAyrilis = async () => {
    if (!gecmisPersonel) return
    if (!confirm(`${gecmisPersonel.name} şu an çalıştığı şirketten ayrılsın mı? (Yeni bir şirkete geçmeden kaydı kapatır)`)) return
    try {
      const res = await fetch(`/api/personeller/${gecmisPersonel.id}/sirket-gecmisi/ayrilis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tarih: new Date().toISOString().slice(0, 10) }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data?.error ?? 'Hata oluştu')
        return
      }
      toast.success('Ayrılış kaydedildi')
      refreshGecmis()
    } catch { toast.error('Hata oluştu') }
  }

  const handleGecmisDelete = async (gecmisId: string) => {
    if (!gecmisPersonel) return
    if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return
    try {
      const res = await fetch(`/api/personeller/${gecmisPersonel.id}/sirket-gecmisi/${gecmisId}`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Silinemedi')
        return
      }
      toast.success('Kayıt silindi')
      refreshGecmis()
    } catch { toast.error('Hata oluştu') }
  }

  const handleYeniSirket = async () => {
    if (!yeniSirketAd.trim()) { toast.error('Şirket adı giriniz'); return }
    try {
      const res = await fetch('/api/sirketler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad: yeniSirketAd.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data?.error ?? 'Hata oluştu')
        return
      }
      const yeni = await res.json()
      setSirketler((prev) => [...prev, yeni].sort((a, b) => a.ad.localeCompare(b.ad)))
      setGecmisForm((f) => ({ ...f, sirketId: yeni.id }))
      setYeniSirketAd('')
      setShowYeniSirket(false)
      toast.success('Şirket eklendi')
    } catch { toast.error('Hata oluştu') }
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Personeller</h1>
            <p className="text-muted-foreground text-sm mt-1">Kullanıcı, personel ve şirket geçmişi yönetimi</p>
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
                    <div className="flex items-center gap-2 flex-wrap">
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
                      {p.aktifSirket ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-medium">
                          <Building2 className="h-3 w-3" /> {p.aktifSirket}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs font-medium">
                          <Building2 className="h-3 w-3" /> Şirkette değil
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
                    size="sm"
                    onClick={() => openGecmis(p)}
                    className="shrink-0"
                  >
                    <History className="h-3.5 w-3.5 mr-1" /> Şirket Geçmişi
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(p.id)}
                    className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      {/* Yeni Personel Ekle */}
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

      {/* Şirket Geçmişi */}
      <Dialog open={gecmisDialogOpen} onOpenChange={setGecmisDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-secondary" /> {gecmisPersonel?.name} — Şirket Geçmişi
            </DialogTitle>
          </DialogHeader>

          {gecmisLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Yükleniyor...</div>
          ) : (
            <div className="space-y-4 py-2">
              {/* Mevcut durum */}
              <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                <div>
                  <p className="text-xs text-muted-foreground">Şu anki şirket</p>
                  <p className="font-semibold">
                    {gecmisPersonel?.aktifSirket ?? 'Hiçbir şirkette değil'}
                  </p>
                </div>
                {gecmisPersonel?.aktifSirket && (
                  <Button variant="outline" size="sm" onClick={handleAyrilis}>
                    <LogOut className="h-3.5 w-3.5 mr-1" /> Ayrıldı
                  </Button>
                )}
              </div>

              {/* Geçmiş listesi */}
              <div className="max-h-52 overflow-y-auto space-y-2">
                {gecmisler.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Henüz şirket kaydı yok</p>
                ) : (
                  gecmisler.map((g) => (
                    <div key={g.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                      <div>
                        <span className="font-medium">{g.sirket.ad}</span>
                        <span className="text-muted-foreground ml-2">
                          {new Date(g.baslangicTarihi).toLocaleDateString('tr-TR')} —{' '}
                          {g.bitisTarihi ? new Date(g.bitisTarihi).toLocaleDateString('tr-TR') : 'Devam ediyor'}
                        </span>
                        {g.aciklama && <p className="text-xs text-muted-foreground">{g.aciklama}</p>}
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive shrink-0" onClick={() => handleGecmisDelete(g.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              {/* Yeni geçiş formu */}
              <form onSubmit={handleGecmisSubmit} className="space-y-3 border-t pt-4">
                <p className="text-sm font-semibold">Yeni Şirkete Geçiş Ekle</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <Label className="text-xs">Şirket *</Label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={gecmisForm.sirketId}
                      onChange={(e) => setGecmisForm({ ...gecmisForm, sirketId: e.target.value })}
                      required
                    >
                      <option value="">Şirket seçin</option>
                      {sirketler.map((s) => (
                        <option key={s.id} value={s.id}>{s.ad}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <Label className="text-xs">Başlangıç Tarihi *</Label>
                    <Input
                      type="date"
                      value={gecmisForm.baslangicTarihi}
                      onChange={(e) => setGecmisForm({ ...gecmisForm, baslangicTarihi: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Açıklama</Label>
                    <Input
                      value={gecmisForm.aciklama}
                      onChange={(e) => setGecmisForm({ ...gecmisForm, aciklama: e.target.value })}
                      placeholder="Opsiyonel"
                    />
                  </div>
                </div>

                {!showYeniSirket ? (
                  <button
                    type="button"
                    onClick={() => setShowYeniSirket(true)}
                    className="text-xs text-secondary hover:underline"
                  >
                    + Listede olmayan yeni bir şirket ekle
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      value={yeniSirketAd}
                      onChange={(e) => setYeniSirketAd(e.target.value)}
                      placeholder="Yeni şirket adı"
                      className="h-8 text-sm"
                    />
                    <Button type="button" size="sm" variant="outline" onClick={handleYeniSirket}>Ekle</Button>
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setShowYeniSirket(false); setYeniSirketAd('') }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}

                <Button type="submit" disabled={gecmisSaving} className="w-full bg-secondary hover:bg-secondary/90">
                  {gecmisSaving ? 'Kaydediliyor...' : 'Geçişi Kaydet'}
                </Button>
              </form>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setGecmisDialogOpen(false)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
