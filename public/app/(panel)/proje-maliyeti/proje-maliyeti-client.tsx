'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { FadeIn } from '@/components/ui/animate'
import {
  Calculator,
  Building2,
  MapPin,
  Plus,
  Trash2,
  Pencil,
  TrendingUp,
  TrendingDown,
  Truck,
  Package,
  Users,
  Fuel,
  Wallet,
  CalendarPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import { SafeDate } from '@/components/safe-format'

function formatTL(n: number) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n) + ' ₺'
}

// ---------------------------------------------------------------------------
// Tipler
// ---------------------------------------------------------------------------
interface SantiyeSatir {
  id: string
  ad: string
  konum: string | null
  aktif: boolean
  malzemeToplam: number
  aracToplam: number
  nakliyeToplam: number
  personelToplam: number
  akaryakitToplam: number
  toplamGider: number
  gelir: number
  netKarZarar: number
}

interface Malzeme {
  id: string
  kalem: string
  uzunluk: number | null
  genislik: number | null
  derinlik: number | null
  gerekliMiktar: number | null
  kullanilanMiktar: number
  birim: string
  birimFiyat: number
  aciklama: string | null
}

interface ProjeAracSatir {
  id: string
  aracId: string
  plaka: string
  isim: string | null
  gunlukBedel: number
  toplamGun: number
}

interface GunlukTakipSatir {
  tarih: string
  aracIdler: string[]
}

interface Ozet {
  gelir: number
  seferSayisi: number
  seferBasiUcret: number
  personelSayisi: number
  calisilanGun: number
  gunlukUcret: number
  digerHarcamalar: number
  akaryakitLitre: number
  akaryakitBirimFiyat: number
}

interface Detay {
  santiye: { id: string; ad: string; konum: string | null }
  malzemeler: Malzeme[]
  araclar: ProjeAracSatir[]
  gunlukTakip: GunlukTakipSatir[]
  ozet: Ozet
}

interface AracSecenek {
  id: string
  plaka: string
  isim: string | null
}

// ---------------------------------------------------------------------------
// Ana bileşen
// ---------------------------------------------------------------------------
export function ProjeMaliyetiClient() {
  const [santiyeler, setSantiyeler] = useState<SantiyeSatir[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string>('')

  const loadList = useCallback(() => {
    fetch('/api/proje-maliyeti')
      .then((r) => r.json())
      .then((d) => setSantiyeler(Array.isArray(d) ? d : []))
      .catch(() => toast.error('Veriler yüklenemedi'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadList() }, [loadList])

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
            <Calculator className="h-6 w-6 text-secondary" /> Proje Maliyeti
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Şantiye bazında malzeme, araç, personel, nakliye, akaryakıt maliyeti ve kâr/zarar takibi
          </p>
        </div>
      </FadeIn>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : santiyeler.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Önce Şantiyeler sayfasından bir şantiye ekleyin.</p>
          </CardContent>
        </Card>
      ) : (
        <Accordion
          type="single"
          collapsible
          value={openId}
          onValueChange={setOpenId}
          className="space-y-3"
        >
          {santiyeler.map((s) => (
            <AccordionItem key={s.id} value={s.id} className="border rounded-xl overflow-hidden bg-card">
              <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/50">
                <div className="flex flex-1 items-center justify-between gap-4 pr-2">
                  <div className="flex items-start gap-3 text-left">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{s.ad}</h3>
                      {s.konum && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" /> {s.konum}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-muted-foreground">Toplam Gider</p>
                      <p className="text-sm font-medium">{formatTL(s.toplamGider)}</p>
                    </div>
                    <Badge
                      variant={s.netKarZarar > 0 ? 'default' : s.netKarZarar < 0 ? 'destructive' : 'outline'}
                      className={s.netKarZarar > 0 ? 'bg-green-600 hover:bg-green-600' : ''}
                    >
                      {s.netKarZarar > 0 ? (
                        <TrendingUp className="h-3 w-3 mr-1" />
                      ) : s.netKarZarar < 0 ? (
                        <TrendingDown className="h-3 w-3 mr-1" />
                      ) : null}
                      {formatTL(s.netKarZarar)}
                    </Badge>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5">
                {openId === s.id && (
                  <SantiyeDetay santiyeId={s.id} onChange={loadList} />
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Şantiye detay paneli
// ---------------------------------------------------------------------------
function SantiyeDetay({ santiyeId, onChange }: { santiyeId: string; onChange: () => void }) {
  const [detay, setDetay] = useState<Detay | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    fetch(`/api/proje-maliyeti/${santiyeId}`)
      .then((r) => r.json())
      .then((d) => setDetay(d))
      .catch(() => toast.error('Detay yüklenemedi'))
      .finally(() => setLoading(false))
  }, [santiyeId])

  useEffect(() => { load() }, [load])

  const refresh = () => { load(); onChange() }

  if (loading || !detay) {
    return <div className="h-40 bg-muted animate-pulse rounded-lg" />
  }

  const malzemeToplam = detay.malzemeler.reduce((a, m) => a + m.kullanilanMiktar * m.birimFiyat, 0)
  const aracToplam = detay.araclar.reduce((a, x) => a + x.toplamGun * x.gunlukBedel, 0)
  const nakliyeToplam = detay.ozet.seferSayisi * detay.ozet.seferBasiUcret
  const personelToplam =
    detay.ozet.personelSayisi * detay.ozet.calisilanGun * detay.ozet.gunlukUcret + detay.ozet.digerHarcamalar
  const akaryakitToplam = detay.ozet.akaryakitLitre * detay.ozet.akaryakitBirimFiyat
  const toplamGider = malzemeToplam + aracToplam + nakliyeToplam + personelToplam + akaryakitToplam
  const netKarZarar = detay.ozet.gelir - toplamGider

  return (
    <div className="space-y-6 pt-1">
      {/* Sonuç şeridi */}
      <div
        className={`rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-white ${
          netKarZarar > 0 ? 'bg-green-600' : netKarZarar < 0 ? 'bg-destructive' : 'bg-muted-foreground'
        }`}
      >
        <span className="font-semibold">
          {netKarZarar > 0 ? 'BU İŞTEN KÂR EDİLDİ' : netKarZarar < 0 ? 'BU İŞTEN ZARAR EDİLDİ' : 'BAŞABAŞ'}
        </span>
        <span className="font-bold text-lg">{formatTL(netKarZarar)}</span>
      </div>

      <MalzemeBolumu santiyeId={santiyeId} malzemeler={detay.malzemeler} onChange={refresh} />
      <AracBolumu santiyeId={santiyeId} araclar={detay.araclar} gunlukTakip={detay.gunlukTakip} onChange={refresh} />
      <DigerMaliyetlerBolumu santiyeId={santiyeId} ozet={detay.ozet} onChange={refresh} />

      {/* Özet */}
      <Card>
        <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div><p className="text-muted-foreground">Malzeme</p><p className="font-medium">{formatTL(malzemeToplam)}</p></div>
          <div><p className="text-muted-foreground">Araç Yevmiyesi</p><p className="font-medium">{formatTL(aracToplam)}</p></div>
          <div><p className="text-muted-foreground">Nakliye</p><p className="font-medium">{formatTL(nakliyeToplam)}</p></div>
          <div><p className="text-muted-foreground">Personel</p><p className="font-medium">{formatTL(personelToplam)}</p></div>
          <div><p className="text-muted-foreground">Akaryakıt</p><p className="font-medium">{formatTL(akaryakitToplam)}</p></div>
          <div><p className="text-muted-foreground">Toplam Gider</p><p className="font-semibold">{formatTL(toplamGider)}</p></div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 1. Malzeme bölümü
// ---------------------------------------------------------------------------
function MalzemeBolumu({
  santiyeId,
  malzemeler,
  onChange,
}: {
  santiyeId: string
  malzemeler: Malzeme[]
  onChange: () => void
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    kalem: '', uzunluk: '', genislik: '', derinlik: '', gerekliMiktar: '',
    kullanilanMiktar: '', birim: '', birimFiyat: '', aciklama: '',
  })

  const openNew = () => {
    setEditId(null)
    setForm({ kalem: '', uzunluk: '', genislik: '', derinlik: '', gerekliMiktar: '', kullanilanMiktar: '', birim: '', birimFiyat: '', aciklama: '' })
    setDialogOpen(true)
  }

  const openEdit = (m: Malzeme) => {
    setEditId(m.id)
    setForm({
      kalem: m.kalem,
      uzunluk: m.uzunluk?.toString() ?? '',
      genislik: m.genislik?.toString() ?? '',
      derinlik: m.derinlik?.toString() ?? '',
      gerekliMiktar: m.gerekliMiktar?.toString() ?? '',
      kullanilanMiktar: m.kullanilanMiktar.toString(),
      birim: m.birim,
      birimFiyat: m.birimFiyat.toString(),
      aciklama: m.aciklama ?? '',
    })
    setDialogOpen(true)
  }

  const hesaplaGerekli = () => {
    const u = parseFloat(form.uzunluk)
    const g = parseFloat(form.genislik)
    const d = parseFloat(form.derinlik)
    if (!Number.isNaN(u) && !Number.isNaN(g) && !Number.isNaN(d)) {
      setForm((p) => ({ ...p, gerekliMiktar: (u * g * d).toString() }))
    }
  }

  const handleSave = async () => {
    if (!form.kalem.trim() || !form.birim.trim()) { toast.error('Kalem adı ve birim zorunludur'); return }
    setSaving(true)
    try {
      const url = editId
        ? `/api/proje-maliyeti/${santiyeId}/malzeme/${editId}`
        : `/api/proje-maliyeti/${santiyeId}/malzeme`
      const res = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d?.error ?? 'Hata oluştu'); return }
      toast.success(editId ? 'Malzeme güncellendi' : 'Malzeme eklendi')
      setDialogOpen(false)
      onChange()
    } catch { toast.error('Hata oluştu') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu malzeme kalemini silmek istediğinize emin misiniz?')) return
    const res = await fetch(`/api/proje-maliyeti/${santiyeId}/malzeme/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Silinemedi'); return }
    toast.success('Silindi')
    onChange()
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold flex items-center gap-2"><Package className="h-4 w-4" /> Malzeme</h4>
          <Button size="sm" variant="outline" onClick={openNew}><Plus className="h-3.5 w-3.5 mr-1" /> Kalem Ekle</Button>
        </div>

        {malzemeler.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz malzeme kalemi eklenmemiş.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-2">Kalem</th>
                  <th className="py-2 pr-2">Gerekli</th>
                  <th className="py-2 pr-2">Kullanılan</th>
                  <th className="py-2 pr-2">Fark</th>
                  <th className="py-2 pr-2">Birim</th>
                  <th className="py-2 pr-2">Birim Fiyat</th>
                  <th className="py-2 pr-2">Tutar</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {malzemeler.map((m) => {
                  const fark = (m.gerekliMiktar ?? 0) - m.kullanilanMiktar
                  return (
                    <tr key={m.id} className="border-b last:border-0 group">
                      <td className="py-2 pr-2 font-medium">{m.kalem}</td>
                      <td className="py-2 pr-2">{m.gerekliMiktar ?? '-'}</td>
                      <td className="py-2 pr-2">{m.kullanilanMiktar}</td>
                      <td className={`py-2 pr-2 ${fark < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{m.gerekliMiktar != null ? fark : '-'}</td>
                      <td className="py-2 pr-2">{m.birim}</td>
                      <td className="py-2 pr-2">{formatTL(m.birimFiyat)}</td>
                      <td className="py-2 pr-2 font-medium">{formatTL(m.kullanilanMiktar * m.birimFiyat)}</td>
                      <td className="py-2">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(m)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(m.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={6} className="py-2 pr-2 text-right">Toplam Malzeme Maliyeti</td>
                  <td className="py-2 pr-2">{formatTL(malzemeler.reduce((a, m) => a + m.kullanilanMiktar * m.birimFiyat, 0))}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? 'Malzeme Düzenle' : 'Yeni Malzeme Kalemi'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>Kalem Adı *</Label>
              <Input value={form.kalem} onChange={(e) => setForm((p) => ({ ...p, kalem: e.target.value }))} placeholder="Ör: Kum (0,5)" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label>Uzunluk (m)</Label>
                <Input type="number" value={form.uzunluk} onChange={(e) => setForm((p) => ({ ...p, uzunluk: e.target.value }))} onBlur={hesaplaGerekli} />
              </div>
              <div className="space-y-1.5">
                <Label>Genişlik (m)</Label>
                <Input type="number" value={form.genislik} onChange={(e) => setForm((p) => ({ ...p, genislik: e.target.value }))} onBlur={hesaplaGerekli} />
              </div>
              <div className="space-y-1.5">
                <Label>Derinlik (m)</Label>
                <Input type="number" value={form.derinlik} onChange={(e) => setForm((p) => ({ ...p, derinlik: e.target.value }))} onBlur={hesaplaGerekli} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Uzunluk × Genişlik × Derinlik girilirse Gerekli Miktar otomatik hesaplanır; dilerseniz elle de değiştirebilirsiniz.</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Gerekli Miktar</Label>
                <Input type="number" value={form.gerekliMiktar} onChange={(e) => setForm((p) => ({ ...p, gerekliMiktar: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Kullanılan Miktar</Label>
                <Input type="number" value={form.kullanilanMiktar} onChange={(e) => setForm((p) => ({ ...p, kullanilanMiktar: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Birim *</Label>
                <Input value={form.birim} onChange={(e) => setForm((p) => ({ ...p, birim: e.target.value }))} placeholder="M3 / TON / ADET" />
              </div>
              <div className="space-y-1.5">
                <Label>Birim Fiyat (TL)</Label>
                <Input type="number" value={form.birimFiyat} onChange={(e) => setForm((p) => ({ ...p, birimFiyat: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Not</Label>
              <Input value={form.aciklama} onChange={(e) => setForm((p) => ({ ...p, aciklama: e.target.value }))} />
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
    </Card>
  )
}

// ---------------------------------------------------------------------------
// 2. Araç bölümü (günlük kiralama bedeli + çalışma takibi)
// ---------------------------------------------------------------------------
function AracBolumu({
  santiyeId,
  araclar,
  gunlukTakip,
  onChange,
}: {
  santiyeId: string
  araclar: ProjeAracSatir[]
  gunlukTakip: GunlukTakipSatir[]
  onChange: () => void
}) {
  const [tumAraclar, setTumAraclar] = useState<AracSecenek[]>([])
  const [aracDialogOpen, setAracDialogOpen] = useState(false)
  const [secilenAracId, setSecilenAracId] = useState('')
  const [bedel, setBedel] = useState('')
  const [saving, setSaving] = useState(false)

  const [gunDialogOpen, setGunDialogOpen] = useState(false)
  const [gunTarih, setGunTarih] = useState('')
  const [calisanlar, setCalisanlar] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/araclar').then((r) => r.json()).then((d) => setTumAraclar(Array.isArray(d) ? d : []))
  }, [])

  const takipEdilmeyenler = tumAraclar.filter((a) => !araclar.some((pa) => pa.aracId === a.id))

  const handleAracEkle = async () => {
    if (!secilenAracId) { toast.error('Araç seçin'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/proje-maliyeti/${santiyeId}/arac-bedel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aracId: secilenAracId, gunlukBedel: bedel }),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d?.error ?? 'Hata oluştu'); return }
      toast.success('Araç eklendi')
      setAracDialogOpen(false)
      setSecilenAracId(''); setBedel('')
      onChange()
    } catch { toast.error('Hata oluştu') }
    finally { setSaving(false) }
  }

  const handleBedelGuncelle = async (aracId: string, yeniBedel: string) => {
    const res = await fetch(`/api/proje-maliyeti/${santiyeId}/arac-bedel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aracId, gunlukBedel: yeniBedel }),
    })
    if (!res.ok) { toast.error('Güncellenemedi'); return }
    onChange()
  }

  const handleAracSil = async (aracId: string) => {
    if (!confirm('Bu aracı ve tüm günlük kayıtlarını şantiyeden kaldırmak istediğinize emin misiniz?')) return
    const res = await fetch(`/api/proje-maliyeti/${santiyeId}/arac-bedel/${aracId}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Silinemedi'); return }
    toast.success('Araç kaldırıldı')
    onChange()
  }

  const openGunDialog = (mevcut?: GunlukTakipSatir) => {
    setGunTarih(mevcut?.tarih ?? new Date().toISOString().slice(0, 10))
    setCalisanlar(new Set(mevcut?.aracIdler ?? []))
    setGunDialogOpen(true)
  }

  const toggleCalisan = (aracId: string) => {
    setCalisanlar((prev) => {
      const next = new Set(prev)
      if (next.has(aracId)) next.delete(aracId); else next.add(aracId)
      return next
    })
  }

  const handleGunKaydet = async () => {
    if (!gunTarih) { toast.error('Tarih seçin'); return }
    if (araclar.length === 0) { toast.error('Önce en az bir araç ekleyin'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/proje-maliyeti/${santiyeId}/arac-gun`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tarih: gunTarih, calisanAracIdler: Array.from(calisanlar) }),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d?.error ?? 'Hata oluştu'); return }
      toast.success('Gün kaydedildi')
      setGunDialogOpen(false)
      onChange()
    } catch { toast.error('Hata oluştu') }
    finally { setSaving(false) }
  }

  const handleGunSil = async (tarih: string) => {
    if (!confirm('Bu günün kayıtlarını silmek istediğinize emin misiniz?')) return
    const res = await fetch(`/api/proje-maliyeti/${santiyeId}/arac-gun?tarih=${tarih}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Silinemedi'); return }
    toast.success('Gün silindi')
    onChange()
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold flex items-center gap-2"><Truck className="h-4 w-4" /> Çalışan Araçlar</h4>
          <Button size="sm" variant="outline" onClick={() => setAracDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Araç Ekle
          </Button>
        </div>

        {araclar.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bu şantiyede henüz takip edilen araç yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-2">Araç</th>
                  <th className="py-2 pr-2">Günlük Bedel</th>
                  <th className="py-2 pr-2">Çalışılan Gün</th>
                  <th className="py-2 pr-2">Tutar</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {araclar.map((a) => (
                  <tr key={a.id} className="border-b last:border-0 group">
                    <td className="py-2 pr-2 font-medium">{a.plaka}{a.isim ? ` — ${a.isim}` : ''}</td>
                    <td className="py-2 pr-2 w-32">
                      <Input
                        type="number"
                        defaultValue={a.gunlukBedel}
                        className="h-8"
                        onBlur={(e) => handleBedelGuncelle(a.aracId, e.target.value)}
                      />
                    </td>
                    <td className="py-2 pr-2">{a.toplamGun}</td>
                    <td className="py-2 pr-2 font-medium">{formatTL(a.toplamGun * a.gunlukBedel)}</td>
                    <td className="py-2">
                      <Button variant="ghost" size="icon-sm" onClick={() => handleAracSil(a.aracId)} className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={3} className="py-2 pr-2 text-right">Toplam Araç Maliyeti</td>
                  <td className="py-2 pr-2">{formatTL(araclar.reduce((a, x) => a + x.toplamGun * x.gunlukBedel, 0))}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="border-t pt-3">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-sm font-semibold text-muted-foreground">Günlük Çalışma Takibi</h5>
            <Button size="sm" variant="outline" onClick={() => openGunDialog()} disabled={araclar.length === 0}>
              <CalendarPlus className="h-3.5 w-3.5 mr-1" /> Gün Ekle
            </Button>
          </div>
          {gunlukTakip.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz çalışma günü girilmemiş — her araç çalıştığı gün için ayrı ayrı işaretlenir.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 pr-2">Tarih</th>
                    <th className="py-2 pr-2">Çalışan Araçlar</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {gunlukTakip.map((g) => (
                    <tr key={g.tarih} className="border-b last:border-0 group">
                      <td className="py-2 pr-2"><SafeDate date={g.tarih} /></td>
                      <td className="py-2 pr-2">
                        {g.aracIdler
                          .map((id) => araclar.find((a) => a.aracId === id)?.plaka ?? '-')
                          .join(', ')}
                      </td>
                      <td className="py-2">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon-sm" onClick={() => openGunDialog(g)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => handleGunSil(g.tarih)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>

      {/* Araç ekle dialog */}
      <Dialog open={aracDialogOpen} onOpenChange={setAracDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Araç Ekle</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Araç *</Label>
              <Select value={secilenAracId} onValueChange={setSecilenAracId}>
                <SelectTrigger><SelectValue placeholder="Araç seçin" /></SelectTrigger>
                <SelectContent>
                  {takipEdilmeyenler.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Eklenecek başka araç yok</div>
                  )}
                  {takipEdilmeyenler.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.plaka}{a.isim ? ` — ${a.isim}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Günlük Kiralama Bedeli (TL)</Label>
              <Input type="number" value={bedel} onChange={(e) => setBedel(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAracDialogOpen(false)}>Vazgeç</Button>
            <Button onClick={handleAracEkle} loading={saving} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">Ekle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gün ekle/düzenle dialog */}
      <Dialog open={gunDialogOpen} onOpenChange={setGunDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Günlük Çalışma Takibi</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Tarih *</Label>
              <Input type="date" value={gunTarih} onChange={(e) => setGunTarih(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>O gün çalışan araçlar</Label>
              <div className="space-y-2 border rounded-md p-3">
                {araclar.map((a) => (
                  <div key={a.aracId} className="flex items-center gap-2">
                    <Checkbox checked={calisanlar.has(a.aracId)} onCheckedChange={() => toggleCalisan(a.aracId)} id={`arac-${a.aracId}`} />
                    <label htmlFor={`arac-${a.aracId}`} className="text-sm cursor-pointer">{a.plaka}{a.isim ? ` — ${a.isim}` : ''}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGunDialogOpen(false)}>Vazgeç</Button>
            <Button onClick={handleGunKaydet} loading={saving} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// 3. Nakliye, Personel, Akaryakıt, Gelir — tek özet form
// ---------------------------------------------------------------------------
function DigerMaliyetlerBolumu({
  santiyeId,
  ozet,
  onChange,
}: {
  santiyeId: string
  ozet: Ozet
  onChange: () => void
}) {
  const [form, setForm] = useState({
    seferSayisi: ozet.seferSayisi.toString(),
    seferBasiUcret: ozet.seferBasiUcret.toString(),
    personelSayisi: ozet.personelSayisi.toString(),
    calisilanGun: ozet.calisilanGun.toString(),
    gunlukUcret: ozet.gunlukUcret.toString(),
    digerHarcamalar: ozet.digerHarcamalar.toString(),
    akaryakitLitre: ozet.akaryakitLitre.toString(),
    akaryakitBirimFiyat: ozet.akaryakitBirimFiyat.toString(),
    gelir: ozet.gelir.toString(),
  })
  const [saving, setSaving] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }))

  const handleKaydet = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/proje-maliyeti/${santiyeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d?.error ?? 'Hata oluştu'); return }
      toast.success('Kaydedildi')
      onChange()
    } catch { toast.error('Hata oluştu') }
    finally { setSaving(false) }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h4 className="font-semibold flex items-center gap-2"><Truck className="h-4 w-4" /> Nakliye (Kamyon Seferi)</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Sefer Sayısı</Label><Input type="number" value={form.seferSayisi} onChange={set('seferSayisi')} /></div>
            <div className="space-y-1.5"><Label>Sefer Başı Ücret (TL)</Label><Input type="number" value={form.seferBasiUcret} onChange={set('seferBasiUcret')} /></div>
          </div>

          <h4 className="font-semibold flex items-center gap-2 pt-2"><Users className="h-4 w-4" /> Personel</h4>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5"><Label>Personel Sayısı</Label><Input type="number" value={form.personelSayisi} onChange={set('personelSayisi')} /></div>
            <div className="space-y-1.5"><Label>Çalışılan Gün</Label><Input type="number" value={form.calisilanGun} onChange={set('calisilanGun')} /></div>
            <div className="space-y-1.5"><Label>Günlük Ücret (TL)</Label><Input type="number" value={form.gunlukUcret} onChange={set('gunlukUcret')} /></div>
          </div>
          <div className="space-y-1.5"><Label>Diğer Personel Harcamaları (yemek, barınma vb.)</Label><Input type="number" value={form.digerHarcamalar} onChange={set('digerHarcamalar')} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h4 className="font-semibold flex items-center gap-2"><Fuel className="h-4 w-4" /> Akaryakıt</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Miktar (Litre)</Label><Input type="number" value={form.akaryakitLitre} onChange={set('akaryakitLitre')} /></div>
            <div className="space-y-1.5"><Label>Birim Fiyat (TL/Litre)</Label><Input type="number" value={form.akaryakitBirimFiyat} onChange={set('akaryakitBirimFiyat')} /></div>
          </div>

          <h4 className="font-semibold flex items-center gap-2 pt-2"><Wallet className="h-4 w-4" /> Gelir</h4>
          <div className="space-y-1.5"><Label>Proje Geliri (Hakediş / Fatura Tutarı)</Label><Input type="number" value={form.gelir} onChange={set('gelir')} /></div>

          <Button onClick={handleKaydet} loading={saving} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 mt-2">
            Kaydet
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
