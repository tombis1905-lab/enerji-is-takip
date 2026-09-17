'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FadeIn, Stagger, StaggerItem } from '@/components/ui/animate'
import { Users, Plus, Trash2, Building2, History, LogOut, X, Phone, Pencil, Check, MapPin, CalendarClock, Download, HardHat } from 'lucide-react'
import { toast } from 'sonner'
import { SafeDate } from '@/components/safe-format'
import * as XLSX from 'xlsx'

type PersonelTipi = 'ASIL' | 'TASERON'

interface Calisan {
  id: string
  ad: string
  telefon: string | null
  bolge: string | null
  bolgeBaslangicTarihi: string | null
  personelTipi: PersonelTipi
  aciklama: string | null
  aktif: boolean
  aktifSirketId: string | null
  aktifSirket: string | null
  aktifSirketBaslangic: string | null
}

// Asıl personel / taşeron ayrımı için renkli etiket
function PersonelTipiRozet({ tip }: { tip: PersonelTipi }) {
  if (tip === 'TASERON') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5 shrink-0">
        <HardHat className="h-2.5 w-2.5" /> Taşeron
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-1.5 py-0.5 shrink-0">
      Asıl Personel
    </span>
  )
}

interface Sirket {
  id: string
  ad: string
  aktif: boolean
}

interface Santiye {
  id: string
  ad: string
}

interface GunlukKonum {
  id: string
  tarih: string
  aciklama: string | null
  calisanId: string
  calisanAdi: string
  santiyeId: string | null
  santiyeAdi: string
}

const OZEL_DEGER = '__ozel__'

const tarihstenGunSayisi = (t: string | null) => {
  if (!t) return null
  const fark = Date.now() - new Date(t).getTime()
  return Math.max(0, Math.floor(fark / 86400000))
}

interface GecmisKaydi {
  id: string
  baslangicTarihi: string
  bitisTarihi: string | null
  aciklama: string | null
  sirket: { ad: string }
}

const tarihStr = (t: string | null) => (t ? new Date(t).toLocaleDateString('tr-TR') : '')

export function PersonellerClient() {
  const [calisanlar, setCalisanlar] = useState<Calisan[]>([])
  const [sirketler, setSirketler] = useState<Sirket[]>([])
  const [santiyeler, setSantiyeler] = useState<Santiye[]>([])
  const [loading, setLoading] = useState(true)

  // Puantaj — günlük çalışma yeri istisnaları
  const [gunlukKonumlar, setGunlukKonumlar] = useState<GunlukKonum[]>([])
  const [gunlukLoading, setGunlukLoading] = useState(true)
  const [gunlukDialogOpen, setGunlukDialogOpen] = useState(false)
  const [gunlukForm, setGunlukForm] = useState({ calisanId: '', tarih: '', santiyeId: '', aciklama: '' })
  const [gunlukSaving, setGunlukSaving] = useState(false)
  const [gunlukFilterCalisanId, setGunlukFilterCalisanId] = useState('__tumu__')
  const [gunlukFilterSantiyeId, setGunlukFilterSantiyeId] = useState('__tumu__')

  // Asıl personel / taşeron filtresi
  const [tipFiltre, setTipFiltre] = useState<'TUMU' | 'ASIL' | 'TASERON'>('TUMU')

  // Yeni çalışan ekle
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ ad: '', telefon: '', bolge: '', aciklama: '', sirketId: '', baslangicTarihi: '', personelTipi: 'ASIL' as PersonelTipi })
  const [saving, setSaving] = useState(false)
  const [tipSaving, setTipSaving] = useState(false)

  // Detay / Şirket Geçmişi dialog
  const [gecmisDialogOpen, setGecmisDialogOpen] = useState(false)
  const [gecmisCalisan, setGecmisCalisan] = useState<Calisan | null>(null)
  const [gecmisler, setGecmisler] = useState<GecmisKaydi[]>([])
  const [gecmisSirketler, setGecmisSirketler] = useState<Sirket[]>([])
  const [gecmisLoading, setGecmisLoading] = useState(false)
  const [gecmisSaving, setGecmisSaving] = useState(false)
  const [gecmisForm, setGecmisForm] = useState({ sirketId: '', baslangicTarihi: '', aciklama: '' })
  const [yeniSirketAd, setYeniSirketAd] = useState('')
  const [showYeniSirket, setShowYeniSirket] = useState(false)
  const [editingAd, setEditingAd] = useState(false)
  const [editAdDeger, setEditAdDeger] = useState('')
  const [editingBolge, setEditingBolge] = useState(false)
  const [editBolgeDeger, setEditBolgeDeger] = useState('')
  const [bolgeSaving, setBolgeSaving] = useState(false)

  const loadData = useCallback(() => {
    Promise.all([
      fetch('/api/calisanlar').then(r => r.json()),
      fetch('/api/sirketler').then(r => r.json()),
      fetch('/api/santiyeler').then(r => r.json()),
    ])
      .then(([c, s, sn]) => {
        setCalisanlar(Array.isArray(c) ? c : [])
        setSirketler(Array.isArray(s) ? s : [])
        setSantiyeler(
          (Array.isArray(sn) ? sn : [])
            .map((x: any) => ({ id: x.id, ad: x.ad }))
            .sort((a: Santiye, b: Santiye) => a.ad.localeCompare(b.ad, 'tr')),
        )
      })
      .catch(() => toast.error('Veriler yüklenemedi'))
      .finally(() => setLoading(false))
  }, [])

  const loadGunlukKonumlar = useCallback(() => {
    setGunlukLoading(true)
    fetch('/api/calisanlar/gunluk-konum')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setGunlukKonumlar(Array.isArray(d) ? d : []))
      .catch(() => toast.error('Puantaj kayıtları yüklenemedi'))
      .finally(() => setGunlukLoading(false))
  }, [])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { loadGunlukKonumlar() }, [loadGunlukKonumlar])

  const openGunlukNew = () => {
    setGunlukForm({ calisanId: '', tarih: new Date().toISOString().slice(0, 10), santiyeId: '', aciklama: '' })
    setGunlukDialogOpen(true)
  }

  const handleGunlukSave = async () => {
    if (!gunlukForm.calisanId) { toast.error('Personel seçiniz'); return }
    if (!gunlukForm.tarih) { toast.error('Tarih giriniz'); return }
    if (!gunlukForm.santiyeId) { toast.error('Şantiye seçiniz (ya da "Özel")'); return }
    setGunlukSaving(true)
    try {
      const res = await fetch('/api/calisanlar/gunluk-konum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...gunlukForm,
          santiyeId: gunlukForm.santiyeId === OZEL_DEGER ? null : gunlukForm.santiyeId,
        }),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d?.error ?? 'Hata oluştu'); return }
      toast.success('Kayıt eklendi')
      setGunlukDialogOpen(false)
      loadGunlukKonumlar()
    } catch { toast.error('Hata oluştu') }
    finally { setGunlukSaving(false) }
  }

  const handleGunlukDelete = async (id: string) => {
    if (!confirm('Bu puantaj kaydını silmek istediğinize emin misiniz?')) return
    const res = await fetch(`/api/calisanlar/gunluk-konum/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Silinemedi'); return }
    toast.success('Silindi')
    loadGunlukKonumlar()
  }

  const handleGunlukExcelExport = () => {
    const rows = gunlukKonumlarFiltreli.map((k) => ({
      'Tarih': new Date(k.tarih).toLocaleDateString('tr-TR'),
      'Personel': k.calisanAdi,
      'Şantiye': k.santiyeAdi,
      'Açıklama': k.aciklama || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Puantaj')
    XLSX.writeFile(wb, `puantaj_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const gunlukKonumlarFiltreli = gunlukKonumlar.filter((k) => {
    if (gunlukFilterCalisanId !== '__tumu__' && k.calisanId !== gunlukFilterCalisanId) return false
    if (gunlukFilterSantiyeId === OZEL_DEGER && k.santiyeId !== null) return false
    if (gunlukFilterSantiyeId !== '__tumu__' && gunlukFilterSantiyeId !== OZEL_DEGER && k.santiyeId !== gunlukFilterSantiyeId) return false
    return true
  })

  const openNew = () => {
    setForm({ ad: '', telefon: '', bolge: '', aciklama: '', sirketId: '', baslangicTarihi: new Date().toISOString().slice(0, 10), personelTipi: 'ASIL' })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.ad.trim()) {
      toast.error('Çalışan adı gerekli')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/calisanlar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ad: form.ad,
          telefon: form.telefon,
          bolge: form.bolge,
          aciklama: form.aciklama,
          personelTipi: form.personelTipi,
          ...(form.sirketId ? { sirketId: form.sirketId, baslangicTarihi: form.baslangicTarihi } : {}),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data?.error ?? 'Hata oluştu')
        return
      }
      toast.success('Çalışan eklendi')
      setDialogOpen(false)
      loadData()
    } catch { toast.error('Hata oluştu') }
    finally { setSaving(false) }
  }

  // --- Detay / Şirket Geçmişi ---
  const openGecmis = async (c: Calisan) => {
    setGecmisCalisan(c)
    setGecmisDialogOpen(true)
    setGecmisLoading(true)
    setShowYeniSirket(false)
    setYeniSirketAd('')
    setEditingAd(false)
    setEditingBolge(false)
    setEditBolgeDeger(c.bolge ?? '')
    const now = new Date().toISOString().slice(0, 10)
    setGecmisForm({ sirketId: '', baslangicTarihi: now, aciklama: '' })
    try {
      const res = await fetch(`/api/calisanlar/${c.id}/sirket-gecmisi`)
      if (res.ok) {
        const data = await res.json()
        setGecmisler(data.gecmisler)
        setGecmisSirketler(data.sirketler)
      }
    } finally {
      setGecmisLoading(false)
    }
  }

  const refreshGecmis = async () => {
    if (!gecmisCalisan) return
    const res = await fetch(`/api/calisanlar/${gecmisCalisan.id}/sirket-gecmisi`)
    if (res.ok) {
      const data = await res.json()
      setGecmisler(data.gecmisler)
      setGecmisSirketler(data.sirketler)
    }
    // Güncel çalışan listesini de tazele; açık diyaloğun başlığı da güncellensin
    const listRes = await fetch('/api/calisanlar')
    if (listRes.ok) {
      const list = await listRes.json()
      setCalisanlar(list)
      const guncel = list.find((x: Calisan) => x.id === gecmisCalisan.id)
      if (guncel) setGecmisCalisan(guncel)
    }
  }

  const handleGecmisSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!gecmisCalisan) return
    if (!gecmisForm.sirketId) { toast.error('Şirket seçiniz'); return }
    if (!gecmisForm.baslangicTarihi) { toast.error('Başlangıç tarihi giriniz'); return }
    setGecmisSaving(true)
    try {
      const res = await fetch(`/api/calisanlar/${gecmisCalisan.id}/sirket-gecmisi`, {
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
    if (!gecmisCalisan) return
    if (!confirm(`${gecmisCalisan.ad} şu an çalıştığı şirketten ayrılsın mı?`)) return
    try {
      const res = await fetch(`/api/calisanlar/${gecmisCalisan.id}/sirket-gecmisi/ayrilis`, {
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
    if (!gecmisCalisan) return
    if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return
    try {
      const res = await fetch(`/api/calisanlar/${gecmisCalisan.id}/sirket-gecmisi/${gecmisId}`, { method: 'DELETE' })
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
      setGecmisSirketler((prev) => [...prev, yeni].sort((a, b) => a.ad.localeCompare(b.ad)))
      setSirketler((prev) => [...prev, yeni].sort((a, b) => a.ad.localeCompare(b.ad)))
      setGecmisForm((f) => ({ ...f, sirketId: yeni.id }))
      setYeniSirketAd('')
      setShowYeniSirket(false)
      toast.success('Şirket eklendi')
    } catch { toast.error('Hata oluştu') }
  }

  const handleAdKaydet = async () => {
    if (!gecmisCalisan || !editAdDeger.trim()) return
    try {
      const res = await fetch(`/api/calisanlar/${gecmisCalisan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad: editAdDeger.trim() }),
      })
      if (!res.ok) { toast.error('Güncellenemedi'); return }
      toast.success('İsim güncellendi')
      setEditingAd(false)
      refreshGecmis()
    } catch { toast.error('Hata oluştu') }
  }

  const handleBolgeKaydet = async () => {
    if (!gecmisCalisan) return
    setBolgeSaving(true)
    try {
      const res = await fetch(`/api/calisanlar/${gecmisCalisan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bolge: editBolgeDeger }),
      })
      if (!res.ok) { toast.error('Güncellenemedi'); return }
      toast.success('Bölge güncellendi')
      setEditingBolge(false)
      refreshGecmis()
    } catch { toast.error('Hata oluştu') }
    finally { setBolgeSaving(false) }
  }

  const handleTipDegistir = async (yeniTip: PersonelTipi) => {
    if (!gecmisCalisan) return
    setTipSaving(true)
    try {
      const res = await fetch(`/api/calisanlar/${gecmisCalisan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personelTipi: yeniTip }),
      })
      if (!res.ok) { toast.error('Güncellenemedi'); return }
      toast.success('Personel tipi güncellendi')
      refreshGecmis()
    } catch { toast.error('Hata oluştu') }
    finally { setTipSaving(false) }
  }

  const handleCalisanDelete = async () => {
    if (!gecmisCalisan) return
    if (!confirm(`${gecmisCalisan.ad} kaydını tamamen silmek istediğinize emin misiniz?`)) return
    try {
      const res = await fetch(`/api/calisanlar/${gecmisCalisan.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data?.error ?? 'Silinemedi')
        return
      }
      toast.success('Çalışan silindi')
      setGecmisDialogOpen(false)
      loadData()
    } catch { toast.error('Hata oluştu') }
  }

  const calisanlarFiltreli = calisanlar.filter((c) => tipFiltre === 'TUMU' || c.personelTipi === tipFiltre)
  const sirketteOlmayanlar = calisanlarFiltreli.filter((c) => !c.aktifSirketId)
  const asilSayisi = calisanlar.filter((c) => c.personelTipi !== 'TASERON').length
  const taseronSayisi = calisanlar.filter((c) => c.personelTipi === 'TASERON').length

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Personeller</h1>
            <p className="text-muted-foreground text-sm mt-1">Şirket bazlı çalışan listesi ve geçmişi</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={tipFiltre} onValueChange={(v) => setTipFiltre(v as any)}>
              <SelectTrigger className="w-auto min-w-[10rem] h-9">
                <SelectValue placeholder="Personel Tipi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TUMU">Tümü ({calisanlar.length})</SelectItem>
                <SelectItem value="ASIL">Asıl Personel ({asilSayisi})</SelectItem>
                <SelectItem value="TASERON">Taşeron ({taseronSayisi})</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={openNew} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
              <Plus className="h-4 w-4 mr-2" /> Çalışan Ekle
            </Button>
          </div>
        </div>
      </FadeIn>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : sirketler.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Henüz şirket eklenmemiş.</p>
          </CardContent>
        </Card>
      ) : (
        <Stagger className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" staggerDelay={0.05}>
          {sirketler.map((s) => {
            const bunlar = calisanlarFiltreli.filter((c) => c.aktifSirketId === s.id)
            return (
              <StaggerItem key={s.id}>
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-secondary" /> {s.ad}
                      </span>
                      <span className="text-xs font-normal text-muted-foreground">{bunlar.length} kişi</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {bunlar.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-3 text-center">Bu şirkette kimse yok</p>
                    ) : (
                      bunlar.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => openGecmis(c)}
                          className="w-full flex items-center justify-between gap-2 rounded-md px-2 py-2 text-left hover:bg-muted/50 transition-colors"
                        >
                          <span className="min-w-0">
                            <span className="font-medium truncate flex items-center gap-1.5">{c.ad} <PersonelTipiRozet tip={c.personelTipi} /></span>
                            {c.bolge && (
                              <span className="text-xs text-secondary flex items-center gap-1 mt-0.5">
                                <MapPin className="h-3 w-3 shrink-0" /> {c.bolge}
                                {tarihstenGunSayisi(c.bolgeBaslangicTarihi) !== null && (
                                  <span className="text-muted-foreground">· {tarihstenGunSayisi(c.bolgeBaslangicTarihi)} gündür</span>
                                )}
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">{tarihStr(c.aktifSirketBaslangic)} tarihinden beri</span>
                        </button>
                      ))
                    )}
                  </CardContent>
                </Card>
              </StaggerItem>
            )
          })}
        </Stagger>
      )}

      {/* Şirkette olmayanlar */}
      {!loading && sirketteOlmayanlar.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" /> Şu An Hiçbir Şirkette Olmayanlar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {sirketteOlmayanlar.map((c) => (
              <button
                key={c.id}
                onClick={() => openGecmis(c)}
                className="w-full flex items-center justify-between gap-2 rounded-md px-2 py-2 text-left hover:bg-muted/50 transition-colors"
              >
                <span className="min-w-0">
                  <span className="font-medium truncate flex items-center gap-1.5">{c.ad} <PersonelTipiRozet tip={c.personelTipi} /></span>
                  {c.bolge && (
                    <span className="text-xs text-secondary flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 shrink-0" /> {c.bolge}
                      {tarihstenGunSayisi(c.bolgeBaslangicTarihi) !== null && (
                        <span className="text-muted-foreground">· {tarihstenGunSayisi(c.bolgeBaslangicTarihi)} gündür</span>
                      )}
                    </span>
                  )}
                </span>
                {c.telefon && <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {c.telefon}</span>}
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {!loading && calisanlar.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Henüz çalışan eklenmemiş.</p>
          </CardContent>
        </Card>
      )}

      {/* Puantaj: günlük çalışma yeri istisnaları — kim, hangi şirkette olduğu yukarıda sabit kalır;
          burada sadece "bugün/o gün normalden farklı bir şantiyede çalıştı" değişiklikleri listelenir. */}
      {!loading && calisanlar.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-secondary" /> Puantaj — Günlük Çalışma Yeri
              </CardTitle>
              <div className="flex items-center gap-2">
                {gunlukKonumlarFiltreli.length > 0 && (
                  <Button size="sm" variant="outline" onClick={handleGunlukExcelExport}>
                    <Download className="h-3.5 w-3.5 mr-1" /> Excel
                  </Button>
                )}
                <Button size="sm" onClick={openGunlukNew} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Kayıt Ekle
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Bir değişiklik eklemediğin sürece personel, Personeller listesindeki bölgesinde çalışıyor sayılır.
              Sadece &quot;o gün başka bir şantiyeye gitti&quot; gibi istisnaları buraya ekle.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Filtre */}
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={gunlukFilterCalisanId} onValueChange={setGunlukFilterCalisanId}>
                <SelectTrigger className="w-auto min-w-[10rem] h-9">
                  <Users className="h-3.5 w-3.5 mr-1 shrink-0" />
                  <SelectValue placeholder="Personel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__tumu__">Tüm Personel</SelectItem>
                  {calisanlar.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.ad}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={gunlukFilterSantiyeId} onValueChange={setGunlukFilterSantiyeId}>
                <SelectTrigger className="w-auto min-w-[10rem] h-9">
                  <Building2 className="h-3.5 w-3.5 mr-1 shrink-0" />
                  <SelectValue placeholder="Şantiye" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__tumu__">Tüm Şantiyeler</SelectItem>
                  <SelectItem value={OZEL_DEGER}>Özel</SelectItem>
                  {santiyeler.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.ad}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {gunlukLoading ? (
              <div className="h-16 bg-muted animate-pulse rounded-lg" />
            ) : gunlukKonumlarFiltreli.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3 text-center">
                {gunlukKonumlar.length === 0 ? 'Henüz puantaj kaydı eklenmemiş.' : 'Bu filtreye uyan kayıt yok.'}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b bg-muted/40">
                      <th className="py-2 px-2">Tarih</th>
                      <th className="py-2 px-2">Personel</th>
                      <th className="py-2 px-2">Şantiye</th>
                      <th className="py-2 px-2">Açıklama</th>
                      <th className="py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {gunlukKonumlarFiltreli.map((k) => (
                      <tr key={k.id} className="border-b last:border-0 group hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-2"><SafeDate date={k.tarih} /></td>
                        <td className="py-2 px-2 font-medium">{k.calisanAdi}</td>
                        <td className="py-2 px-2">
                          <span
                            className={
                              k.santiyeId
                                ? 'inline-flex text-xs bg-secondary/10 text-secondary rounded-full px-2 py-0.5'
                                : 'inline-flex text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5'
                            }
                          >
                            {k.santiyeAdi}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-muted-foreground">{k.aciklama || '—'}</td>
                        <td className="py-2 px-2 text-right">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                            onClick={() => handleGunlukDelete(k.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Puantaj Kaydı Ekle */}
      <Dialog open={gunlukDialogOpen} onOpenChange={setGunlukDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Puantaj Kaydı Ekle</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Personel *</Label>
              <Select value={gunlukForm.calisanId} onValueChange={(v) => setGunlukForm((p) => ({ ...p, calisanId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Personel seçin" />
                </SelectTrigger>
                <SelectContent>
                  {calisanlar.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.ad}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Tarih *</Label>
                <Input type="date" value={gunlukForm.tarih} onChange={(e) => setGunlukForm((p) => ({ ...p, tarih: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Şantiye *</Label>
                <Select value={gunlukForm.santiyeId} onValueChange={(v) => setGunlukForm((p) => ({ ...p, santiyeId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Şantiye" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={OZEL_DEGER}>Özel (şantiye dışı)</SelectItem>
                    {santiyeler.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.ad}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Açıklama</Label>
              <Input
                value={gunlukForm.aciklama}
                onChange={(e) => setGunlukForm((p) => ({ ...p, aciklama: e.target.value }))}
                placeholder={gunlukForm.santiyeId === OZEL_DEGER ? 'Ör: ofiste, araba yıkandı' : 'Opsiyonel'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGunlukDialogOpen(false)}>Vazgeç</Button>
            <Button onClick={handleGunlukSave} loading={gunlukSaving} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
              Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Yeni Çalışan Ekle */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Çalışan Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>İsim Soyisim *</Label>
              <Input
                value={form.ad}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, ad: e.target.value }))}
                placeholder="Ad Soyad"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefon</Label>
              <Input
                value={form.telefon}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, telefon: e.target.value }))}
                placeholder="Opsiyonel"
              />
            </div>
            <div className="space-y-2">
              <Label>Bölge</Label>
              <Input
                value={form.bolge}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, bolge: e.target.value }))}
                placeholder="Ör: Botaş şantiyesi"
              />
            </div>
            <div className="space-y-2">
              <Label>Personel Tipi</Label>
              <Select value={form.personelTipi} onValueChange={(v) => setForm(p => ({ ...p, personelTipi: v as PersonelTipi }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASIL">Asıl Personel</SelectItem>
                  <SelectItem value="TASERON">Taşeron</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t pt-3">
              <div className="col-span-2">
                <Label className="text-xs">Şirket (opsiyonel — hemen atamak isterseniz)</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.sirketId}
                  onChange={(e) => setForm(p => ({ ...p, sirketId: e.target.value }))}
                >
                  <option value="">Henüz atama yapma</option>
                  {sirketler.map((s) => (
                    <option key={s.id} value={s.id}>{s.ad}</option>
                  ))}
                </select>
              </div>
              {form.sirketId && (
                <div className="col-span-2">
                  <Label className="text-xs">Başlangıç Tarihi</Label>
                  <Input
                    type="date"
                    value={form.baslangicTarihi}
                    onChange={(e) => setForm(p => ({ ...p, baslangicTarihi: e.target.value }))}
                  />
                </div>
              )}
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

      {/* Çalışan Detay / Şirket Geçmişi */}
      <Dialog open={gecmisDialogOpen} onOpenChange={setGecmisDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingAd ? (
                <div className="flex items-center gap-2 w-full">
                  <Input value={editAdDeger} onChange={(e) => setEditAdDeger(e.target.value)} className="h-8" />
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={handleAdKaydet}>
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  {gecmisCalisan?.ad}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0"
                    onClick={() => { setEditingAd(true); setEditAdDeger(gecmisCalisan?.ad ?? '') }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </>
              )}
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
                    {gecmisCalisan?.aktifSirket ?? 'Hiçbir şirkette değil'}
                  </p>
                </div>
                {gecmisCalisan?.aktifSirket && (
                  <Button variant="outline" size="sm" onClick={handleAyrilis}>
                    <LogOut className="h-3.5 w-3.5 mr-1" /> Ayrıldı
                  </Button>
                )}
              </div>

              {/* Personel tipi */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><HardHat className="h-3 w-3" /> Personel Tipi</p>
                <Select
                  value={gecmisCalisan?.personelTipi ?? 'ASIL'}
                  onValueChange={(v) => handleTipDegistir(v as PersonelTipi)}
                  disabled={tipSaving}
                >
                  <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ASIL">Asıl Personel</SelectItem>
                    <SelectItem value="TASERON">Taşeron</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Bölge */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Çalıştığı bölge</p>
                  {editingBolge ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        value={editBolgeDeger}
                        onChange={(e) => setEditBolgeDeger(e.target.value)}
                        placeholder="Ör: Botaş şantiyesi"
                        className="h-8"
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={handleBolgeKaydet} disabled={bolgeSaving}>
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="font-semibold truncate">{gecmisCalisan?.bolge || 'Belirtilmemiş'}</p>
                      {gecmisCalisan?.bolge && tarihstenGunSayisi(gecmisCalisan.bolgeBaslangicTarihi) !== null && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {tarihStr(gecmisCalisan.bolgeBaslangicTarihi)} tarihinden beri ({tarihstenGunSayisi(gecmisCalisan.bolgeBaslangicTarihi)} gün)
                        </p>
                      )}
                    </>
                  )}
                </div>
                {!editingBolge && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    onClick={() => { setEditingBolge(true); setEditBolgeDeger(gecmisCalisan?.bolge ?? '') }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
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
                          {tarihStr(g.baslangicTarihi)} —{' '}
                          {g.bitisTarihi ? tarihStr(g.bitisTarihi) : 'Devam ediyor'}
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
                <p className="text-sm font-semibold flex items-center gap-1.5"><History className="h-3.5 w-3.5" /> Yeni Şirkete Geçiş Ekle</p>
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
                      {gecmisSirketler.map((s) => (
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

          <DialogFooter className="flex items-center sm:justify-between">
            <Button variant="ghost" size="sm" onClick={handleCalisanDelete} className="text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Çalışanı Sil
            </Button>
            <Button variant="outline" onClick={() => setGecmisDialogOpen(false)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
