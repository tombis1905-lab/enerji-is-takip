'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
  PiggyBank,
  BarChart3,
  Receipt,
  Lock,
  LockKeyhole,
  Download,
  AlertTriangle,
  CalendarRange,
  UserRound,
  Table2,
} from 'lucide-react'
import { toast } from 'sonner'
import { SafeDate } from '@/components/safe-format'
import * as XLSX from 'xlsx'

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
  isTuruId: string | null
}

interface ProjeAracSatir {
  id: string
  aracId: string
  plaka: string
  isim: string | null
  sahiplik: 'KENDI' | 'KIRALIK'
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
  akaryakitTutar: number
}

interface Detay {
  santiye: { id: string; ad: string; konum: string | null }
  malzemeler: Malzeme[]
  araclar: ProjeAracSatir[]
  gunlukTakip: GunlukTakipSatir[]
  personelHarcamaToplam: number
  ozet: Ozet
}

interface AracSecenek {
  id: string
  plaka: string
  isim: string | null
  sahiplik: 'KENDI' | 'KIRALIK'
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

  const toplam = santiyeler.reduce(
    (acc, s) => ({
      gelir: acc.gelir + s.gelir,
      gider: acc.gider + s.toplamGider,
      net: acc.net + s.netKarZarar,
    }),
    { gelir: 0, gider: 0, net: 0 }
  )

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
        <>
          {/* Genel özet / dashboard */}
          <FadeIn>
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="border-none bg-gradient-to-br from-primary/10 to-primary/5">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Toplam Gelir</p>
                    <p className="text-xl font-bold mt-1.5">{formatTL(toplam.gelir)}</p>
                  </CardContent>
                </Card>
                <Card className="border-none bg-gradient-to-br from-destructive/10 to-destructive/5">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Receipt className="h-3.5 w-3.5" /> Toplam Maliyet</p>
                    <p className="text-xl font-bold mt-1.5">{formatTL(toplam.gider)}</p>
                  </CardContent>
                </Card>
                <Card className={`border-none bg-gradient-to-br ${toplam.net >= 0 ? 'from-green-600/15 to-green-600/5' : 'from-destructive/15 to-destructive/5'}`}>
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><PiggyBank className="h-3.5 w-3.5" /> Net Kâr / Zarar</p>
                    <p className={`text-xl font-bold mt-1.5 flex items-center gap-1 ${toplam.net > 0 ? 'text-green-600' : toplam.net < 0 ? 'text-destructive' : ''}`}>
                      {toplam.net > 0 ? <TrendingUp className="h-4 w-4" /> : toplam.net < 0 ? <TrendingDown className="h-4 w-4" /> : null}
                      {formatTL(toplam.net)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-none bg-gradient-to-br from-secondary/15 to-secondary/5">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Şantiye Sayısı</p>
                    <p className="text-xl font-bold mt-1.5">{santiyeler.length}</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </FadeIn>

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
        </>
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
    detay.ozet.personelSayisi * detay.ozet.calisilanGun * detay.ozet.gunlukUcret +
    detay.ozet.digerHarcamalar +
    detay.personelHarcamaToplam
  const akaryakitToplam = detay.ozet.akaryakitTutar
  const toplamGider = malzemeToplam + aracToplam + nakliyeToplam + personelToplam + akaryakitToplam
  const netKarZarar = detay.ozet.gelir - toplamGider

  const kirilim = [
    { ad: 'Malzeme', tutar: malzemeToplam, icon: Package },
    { ad: 'Araç Yevmiyesi', tutar: aracToplam, icon: Truck },
    { ad: 'Nakliye', tutar: nakliyeToplam, icon: Truck },
    { ad: 'Personel', tutar: personelToplam, icon: Users },
    { ad: 'Akaryakıt', tutar: akaryakitToplam, icon: Fuel },
  ]
  const kirilimMax = Math.max(1, ...kirilim.map((k) => k.tutar))

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
      <PersonelHarcamalariBolumu santiyeId={santiyeId} onChange={refresh} />
      <DigerMaliyetlerBolumu santiyeId={santiyeId} ozet={detay.ozet} onChange={refresh} />

      {/* Bu şantiyeye ait kategori kırılımı */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h4 className="font-semibold flex items-center gap-2 text-sm"><BarChart3 className="h-4 w-4 text-secondary" /> Kategoriye Göre Gider Kırılımı</h4>
          <div className="space-y-2.5">
            {kirilim.map((k) => (
              <div key={k.ad} className="flex items-center gap-3">
                <div className="w-36 shrink-0 text-sm text-muted-foreground flex items-center gap-1.5">
                  <k.icon className="h-3.5 w-3.5" /> {k.ad}
                </div>
                <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-secondary"
                    style={{ width: `${(k.tutar / kirilimMax) * 100}%` }}
                  />
                </div>
                <div className="w-28 shrink-0 text-right text-sm font-medium">{formatTL(k.tutar)}</div>
              </div>
            ))}
            <div className="flex items-center gap-3 pt-1 border-t">
              <div className="w-36 shrink-0 text-sm font-semibold">Toplam Gider</div>
              <div className="flex-1" />
              <div className="w-28 shrink-0 text-right text-sm font-semibold">{formatTL(toplamGider)}</div>
            </div>
          </div>
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
  const [editAuto, setEditAuto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    kalem: '', uzunluk: '', genislik: '', derinlik: '', gerekliMiktar: '',
    kullanilanMiktar: '', birim: '', birimFiyat: '', aciklama: '',
  })

  const openNew = () => {
    setEditId(null)
    setEditAuto(false)
    setForm({ kalem: '', uzunluk: '', genislik: '', derinlik: '', gerekliMiktar: '', kullanilanMiktar: '', birim: '', birimFiyat: '', aciklama: '' })
    setDialogOpen(true)
  }

  const openEdit = (m: Malzeme) => {
    setEditId(m.id)
    setEditAuto(!!m.isTuruId)
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
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.error ?? 'Silinemedi'); return }
    toast.success('Silindi')
    onChange()
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold flex items-center gap-2"><Package className="h-4 w-4" /> Malzeme</h4>
            <p className="text-xs text-muted-foreground mt-0.5">İş Kayıtları'ndan gelen kalemler otomatik eklenir; yalnızca birim fiyatı elle girilir.</p>
          </div>
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
                      <td className="py-2 pr-2 font-medium">
                        {m.kalem}
                        {m.isTuruId && (
                          <span className="ml-1.5 inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-secondary/10 text-secondary align-middle">Otomatik</span>
                        )}
                      </td>
                      <td className="py-2 pr-2">{m.gerekliMiktar ?? '-'}</td>
                      <td className="py-2 pr-2">{m.kullanilanMiktar}</td>
                      <td className={`py-2 pr-2 ${fark < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{m.gerekliMiktar != null ? fark : '-'}</td>
                      <td className="py-2 pr-2">{m.birim}</td>
                      <td className="py-2 pr-2">{formatTL(m.birimFiyat)}</td>
                      <td className="py-2 pr-2 font-medium">{formatTL(m.kullanilanMiktar * m.birimFiyat)}</td>
                      <td className="py-2">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(m)}><Pencil className="h-3.5 w-3.5" /></Button>
                          {!m.isTuruId && (
                            <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(m.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                          )}
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
                <Label>Kullanılan Miktar{editAuto ? ' (İş Kayıtları\'ndan otomatik)' : ''}</Label>
                <Input
                  type="number"
                  value={form.kullanilanMiktar}
                  disabled={editAuto}
                  onChange={(e) => setForm((p) => ({ ...p, kullanilanMiktar: e.target.value }))}
                />
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

  // Sadece kiralık/dışarıdan tutulan araçlar burada seçilebilir — kendi
  // araçlarımızın günlük "kiralama bedeli" olmadığı için proje maliyetine
  // araç yevmiyesi olarak girmez.
  const kiralikAraclar = tumAraclar.filter((a) => a.sahiplik === 'KIRALIK')
  const takipEdilmeyenler = kiralikAraclar.filter((a) => !araclar.some((pa) => pa.aracId === a.id))

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
          <div>
            <h4 className="font-semibold flex items-center gap-2"><Truck className="h-4 w-4" /> Çalışan Araçlar (Kiralık / Dışarıdan)</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Yalnızca kiralık/dışarıdan tutulan araçlar; kendi araçlarımız burada listelenmez.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setAracDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Araç Ekle
          </Button>
        </div>

        {araclar.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bu şantiyede henüz takip edilen kiralık araç yok.</p>
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
                    <div className="px-3 py-2 text-sm text-muted-foreground">Eklenecek kiralık/dışarıdan araç yok — Araçlar sayfasında bir aracı &quot;Kiralık&quot; olarak işaretleyin</div>
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
    akaryakitTutar: ozet.akaryakitTutar.toString(),
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
            <div className="space-y-1.5"><Label>Toplam Tutar (TL)</Label><Input type="number" value={form.akaryakitTutar} onChange={set('akaryakitTutar')} /></div>
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

// ---------------------------------------------------------------------------
// 4. Personel Harcamaları — PIN korumalı, kişi/tarih/bölge bazlı harcama kaydı
// ---------------------------------------------------------------------------
interface PersonelHarcama {
  id: string
  tarih: string
  personelAdi: string
  bolge: string | null
  aciklama: string | null
  tutar: number
}

const PH_EMPTY_FORM = { tarih: '', personelAdi: '', bolge: '', aciklama: '', tutar: '' }

// ISO 8601 hafta numarası (Pazartesi başlangıçlı, yılın ilk Perşembe'sini içeren hafta = 1. hafta).
// Excel'deki "HAFTALIK LİSTE" sekmesindeki hafta bölümlemesiyle birebir aynı mantık.
function isoHaftaBilgisi(tarihStr: string): { yil: number; hafta: number } {
  const kaynak = new Date(tarihStr)
  const d = new Date(Date.UTC(kaynak.getFullYear(), kaynak.getMonth(), kaynak.getDate()))
  const gunNo = (d.getUTCDay() + 6) % 7 // Pazartesi=0 ... Pazar=6
  d.setUTCDate(d.getUTCDate() - gunNo + 3)
  const yilBasiPerembe = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const ilkGunNo = (yilBasiPerembe.getUTCDay() + 6) % 7
  yilBasiPerembe.setUTCDate(yilBasiPerembe.getUTCDate() - ilkGunNo + 3)
  const hafta = 1 + Math.round((d.getTime() - yilBasiPerembe.getTime()) / (7 * 24 * 3600 * 1000))
  return { yil: d.getUTCFullYear(), hafta }
}

// Bir ISO hafta numarasının Pazartesi–Pazar tarih aralığını "gg.aa–gg.aa" biçiminde döndürür.
function haftaAraligiEtiketi(yil: number, hafta: number): string {
  const basitTarih = new Date(Date.UTC(yil, 0, 1 + (hafta - 1) * 7))
  const gun = basitTarih.getUTCDay()
  const fark = gun <= 4 ? gun - 1 : gun - 8
  const haftaBaslangic = new Date(basitTarih)
  haftaBaslangic.setUTCDate(basitTarih.getUTCDate() - fark)
  const haftaBitis = new Date(haftaBaslangic)
  haftaBitis.setUTCDate(haftaBaslangic.getUTCDate() + 6)
  const fmt = (dt: Date) => `${dt.getUTCDate().toString().padStart(2, '0')}.${(dt.getUTCMonth() + 1).toString().padStart(2, '0')}`
  return `${fmt(haftaBaslangic)}–${fmt(haftaBitis)}`
}

// Excel sekme adları en fazla 31 karakter olabilir ve bazı karakterleri kabul etmez;
// ayrıca aynı isimli iki personel varsa sekme adları çakışmasın diye benzersizleştiriyoruz.
function excelSekmeAdi(ad: string, kullanilanlar: Set<string>): string {
  let temiz = ad.replace(/[\\/*?:[\]]/g, ' ').trim().slice(0, 31) || 'Personel'
  let sonuc = temiz
  let sayac = 2
  while (kullanilanlar.has(sonuc.toLowerCase())) {
    const ek = ` (${sayac})`
    sonuc = temiz.slice(0, 31 - ek.length) + ek
    sayac += 1
  }
  kullanilanlar.add(sonuc.toLowerCase())
  return sonuc
}

function PersonelHarcamalariBolumu({ santiyeId, onChange }: { santiyeId: string; onChange: () => void }) {
  const [locked, setLocked] = useState<boolean | null>(null)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinSubmitting, setPinSubmitting] = useState(false)

  const [kayitlar, setKayitlar] = useState<PersonelHarcama[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ ...PH_EMPTY_FORM })
  const [aktifPersonel, setAktifPersonel] = useState<string>('__tumu__')

  const fetchKayitlar = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/proje-maliyeti/${santiyeId}/personel-harcama`)
    if (res.status === 401) {
      const d = await res.json().catch(() => ({}))
      if (d?.code === 'PIN_GEREKLI') {
        setLocked(true)
        setLoading(false)
        return
      }
    }
    if (res.ok) {
      setLocked(false)
      setKayitlar(await res.json())
    }
    setLoading(false)
  }, [santiyeId])

  useEffect(() => { fetchKayitlar() }, [fetchKayitlar])

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPinError('')
    setPinSubmitting(true)
    try {
      const res = await fetch('/api/proje-maliyeti/personel-harcama/dogrula', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      if (!res.ok) { setPinError('PIN hatalı'); setPin(''); return }
      setPin('')
      fetchKayitlar()
    } finally {
      setPinSubmitting(false)
    }
  }

  const handleLock = async () => {
    await fetch('/api/proje-maliyeti/personel-harcama/dogrula', { method: 'DELETE' })
    setLocked(true)
    setKayitlar([])
  }

  const openNew = (varsayilanPersonel?: string) => {
    setEditId(null)
    setForm({
      ...PH_EMPTY_FORM,
      tarih: new Date().toISOString().slice(0, 10),
      personelAdi: varsayilanPersonel && varsayilanPersonel !== '__tumu__' ? varsayilanPersonel : '',
    })
    setDialogOpen(true)
  }

  const openEdit = (k: PersonelHarcama) => {
    setEditId(k.id)
    setForm({
      tarih: k.tarih.slice(0, 10),
      personelAdi: k.personelAdi,
      bolge: k.bolge ?? '',
      aciklama: k.aciklama ?? '',
      tutar: k.tutar.toString(),
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.tarih || !form.personelAdi.trim() || !form.tutar) {
      toast.error('Tarih, personel adı ve tutar zorunludur')
      return
    }
    setSaving(true)
    try {
      const url = editId
        ? `/api/proje-maliyeti/${santiyeId}/personel-harcama/${editId}`
        : `/api/proje-maliyeti/${santiyeId}/personel-harcama`
      const res = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d?.error ?? 'Hata oluştu'); return }
      const kaydedilen: PersonelHarcama = await res.json()
      toast.success(editId ? 'Harcama güncellendi' : 'Harcama eklendi')
      setDialogOpen(false)
      if (!editId) setAktifPersonel(kaydedilen.personelAdi)
      fetchKayitlar()
      onChange()
    } catch { toast.error('Hata oluştu') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu harcama kaydını silmek istediğinize emin misiniz?')) return
    const res = await fetch(`/api/proje-maliyeti/${santiyeId}/personel-harcama/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Silinemedi'); return }
    toast.success('Silindi')
    fetchKayitlar()
    onChange()
  }

  // Personel listesi (alfabetik, benzersiz)
  const personeller = useMemo(() => {
    const set = new Set(kayitlar.map((k) => k.personelAdi))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'))
  }, [kayitlar])

  // "HAFTALIK LİSTE" görünümü: her personelin, yılın haftalarına bölünmüş toplam harcaması.
  const haftalikOzet = useMemo(() => {
    const haftaMap = new Map<string, { yil: number; hafta: number; personelToplam: Map<string, number>; genelToplam: number }>()
    for (const k of kayitlar) {
      const { yil, hafta } = isoHaftaBilgisi(k.tarih)
      const key = `${yil}-${hafta.toString().padStart(2, '0')}`
      if (!haftaMap.has(key)) haftaMap.set(key, { yil, hafta, personelToplam: new Map(), genelToplam: 0 })
      const giris = haftaMap.get(key)!
      giris.personelToplam.set(k.personelAdi, (giris.personelToplam.get(k.personelAdi) ?? 0) + k.tutar)
      giris.genelToplam += k.tutar
    }
    return Array.from(haftaMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({ key, ...v }))
  }, [kayitlar])

  // "GENEL LİSTE" görünümü: aynı tarihte kim ne kadar harcamış — kesişenleri görmek için.
  const tarihMatrisi = useMemo(() => {
    const map = new Map<string, { tarih: string; personelToplam: Map<string, number>; genelToplam: number; kisiSayisi: number }>()
    for (const k of kayitlar) {
      const gun = k.tarih.slice(0, 10)
      if (!map.has(gun)) map.set(gun, { tarih: gun, personelToplam: new Map(), genelToplam: 0, kisiSayisi: 0 })
      const giris = map.get(gun)!
      if (!giris.personelToplam.has(k.personelAdi)) giris.kisiSayisi += 1
      giris.personelToplam.set(k.personelAdi, (giris.personelToplam.get(k.personelAdi) ?? 0) + k.tutar)
      giris.genelToplam += k.tutar
    }
    return Array.from(map.values()).sort((a, b) => b.tarih.localeCompare(a.tarih))
  }, [kayitlar])

  const personelToplamlari = useMemo(() => {
    const map = new Map<string, number>()
    for (const k of kayitlar) map.set(k.personelAdi, (map.get(k.personelAdi) ?? 0) + k.tutar)
    return map
  }, [kayitlar])

  const aktifKayitlar = useMemo(
    () => (aktifPersonel === '__tumu__' ? kayitlar : kayitlar.filter((k) => k.personelAdi === aktifPersonel)),
    [kayitlar, aktifPersonel],
  )

  const handleExcelExport = () => {
    const wb = XLSX.utils.book_new()

    // 1) Haftalık Liste: personel x hafta pivotu
    const haftaSutunlari = haftalikOzet.map((h) => `${h.hafta}. Hafta (${haftaAraligiEtiketi(h.yil, h.hafta)})`)
    const haftaSatirlari = personeller.map((p) => {
      const satir: Record<string, string | number> = { Personel: p }
      haftalikOzet.forEach((h, i) => { satir[haftaSutunlari[i]] = h.personelToplam.get(p) ?? 0 })
      satir['GENEL TOPLAM'] = personelToplamlari.get(p) ?? 0
      return satir
    })
    const genelSatir: Record<string, string | number> = { Personel: 'GENEL TOPLAM' }
    haftalikOzet.forEach((h, i) => { genelSatir[haftaSutunlari[i]] = h.genelToplam })
    genelSatir['GENEL TOPLAM'] = kayitlar.reduce((a, k) => a + k.tutar, 0)
    haftaSatirlari.push(genelSatir)
    const wsHafta = XLSX.utils.json_to_sheet(haftaSatirlari)
    XLSX.utils.book_append_sheet(wb, wsHafta, 'Haftalık Liste')

    // 2) Genel Liste: tarih x personel matrisi
    const genelListeSatirlari = tarihMatrisi.map((g) => {
      const satir: Record<string, string | number> = { Tarih: new Date(g.tarih).toLocaleDateString('tr-TR') }
      personeller.forEach((p) => { satir[p] = g.personelToplam.get(p) ?? '' })
      satir['Toplam'] = g.genelToplam
      satir['Kesişen Kişi Sayısı'] = g.kisiSayisi
      return satir
    })
    const wsGenel = XLSX.utils.json_to_sheet(genelListeSatirlari)
    XLSX.utils.book_append_sheet(wb, wsGenel, 'Genel Liste')

    // 3) Her personel için ayrı sekme (ham kayıtlar)
    const kullanilanSekmeler = new Set<string>(['haftalık liste', 'genel liste'])
    for (const p of personeller) {
      const satirlar = kayitlar
        .filter((k) => k.personelAdi === p)
        .sort((a, b) => a.tarih.localeCompare(b.tarih))
        .map((k) => ({
          Tarih: new Date(k.tarih).toLocaleDateString('tr-TR'),
          Bölge: k.bolge ?? '',
          'Açıklama / Ne İçin': k.aciklama ?? '',
          'Tutar (TL)': k.tutar,
        }))
      const ws = XLSX.utils.json_to_sheet(satirlar)
      XLSX.utils.book_append_sheet(wb, ws, excelSekmeAdi(p, kullanilanSekmeler))
    }

    XLSX.writeFile(wb, 'personel-harcamalari.xlsx')
  }

  const toplam = kayitlar.reduce((a, k) => a + k.tutar, 0)

  if (locked === null || (locked === false && loading)) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="h-16 bg-muted animate-pulse rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  if (locked) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary/10 mx-auto">
            <Lock className="h-6 w-6 text-secondary" />
          </div>
          <div>
            <h4 className="font-semibold">Personel Harcamaları Kilitli</h4>
            <p className="text-sm text-muted-foreground">Bu bölüme girmek için PIN gerekiyor</p>
          </div>
          <form onSubmit={handlePinSubmit} className="space-y-2 max-w-xs mx-auto">
            <Input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="PIN"
              className="text-center text-lg tracking-widest"
            />
            {pinError && <p className="text-destructive text-sm">{pinError}</p>}
            <Button type="submit" disabled={pinSubmitting || !pin} className="w-full bg-secondary hover:bg-secondary/90">
              {pinSubmitting ? 'Kontrol ediliyor...' : 'Kilidi Aç'}
            </Button>
          </form>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Personel Harcamaları</h4>
          <div className="flex gap-2">
            {kayitlar.length > 0 && (
              <Button size="sm" variant="outline" onClick={handleExcelExport}>
                <Download className="h-3.5 w-3.5 mr-1" /> Excel
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleLock}>
              <LockKeyhole className="h-3.5 w-3.5 mr-1" /> Kilitle
            </Button>
            <Button size="sm" variant="outline" onClick={() => openNew(aktifPersonel)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Harcama Ekle
            </Button>
          </div>
        </div>

        {kayitlar.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bu şantiyede henüz personel harcaması girilmemiş.</p>
        ) : (
          <>
            {/* ÜSTTE: Haftalık özet — personel x hafta */}
            <div className="space-y-2">
              <h5 className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground">
                <CalendarRange className="h-3.5 w-3.5" /> Haftalık Özet
              </h5>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b bg-muted/40">
                      <th className="py-2 px-2 sticky left-0 bg-muted/40">Personel</th>
                      {haftalikOzet.map((h) => (
                        <th key={h.key} className="py-2 px-2 text-right whitespace-nowrap">
                          {h.hafta}. Hafta
                          <div className="font-normal text-xs text-muted-foreground">{haftaAraligiEtiketi(h.yil, h.hafta)}</div>
                        </th>
                      ))}
                      <th className="py-2 px-2 text-right whitespace-nowrap">GENEL TOPLAM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personeller.map((p) => (
                      <tr
                        key={p}
                        className={`border-b last:border-0 cursor-pointer hover:bg-muted/30 ${aktifPersonel === p ? 'bg-secondary/5' : ''}`}
                        onClick={() => setAktifPersonel(p)}
                      >
                        <td className="py-2 px-2 font-medium sticky left-0 bg-background">{p}</td>
                        {haftalikOzet.map((h) => {
                          const v = h.personelToplam.get(p)
                          return (
                            <td key={h.key} className="py-2 px-2 text-right whitespace-nowrap text-muted-foreground">
                              {v ? formatTL(v) : '-'}
                            </td>
                          )
                        })}
                        <td className="py-2 px-2 text-right whitespace-nowrap font-semibold">{formatTL(personelToplamlari.get(p) ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold bg-muted/40">
                      <td className="py-2 px-2 sticky left-0 bg-muted/40">GENEL TOPLAM</td>
                      {haftalikOzet.map((h) => (
                        <td key={h.key} className="py-2 px-2 text-right whitespace-nowrap">{formatTL(h.genelToplam)}</td>
                      ))}
                      <td className="py-2 px-2 text-right whitespace-nowrap">{formatTL(toplam)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* ORTADA: Personel bazlı küçük sayfalar — veri girişi buradan yapılır */}
            <div className="space-y-2">
              <h5 className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground">
                <UserRound className="h-3.5 w-3.5" /> Personel Bazlı Harcamalar
              </h5>
              <Tabs value={aktifPersonel} onValueChange={setAktifPersonel}>
                <TabsList className="flex-wrap h-auto">
                  <TabsTrigger value="__tumu__">Tümü</TabsTrigger>
                  {personeller.map((p) => (
                    <TabsTrigger key={p} value={p}>
                      {p}
                      <span className="ml-1.5 text-xs text-muted-foreground">{formatTL(personelToplamlari.get(p) ?? 0)}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value={aktifPersonel} className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground">
                      {aktifPersonel === '__tumu__' ? 'Tüm personel, tüm kayıtlar' : `${aktifPersonel} — kendi harcama sayfası`}
                    </p>
                    <Button size="sm" variant="ghost" onClick={() => openNew(aktifPersonel)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> {aktifPersonel === '__tumu__' ? 'Harcama Ekle' : `${aktifPersonel} için Harcama Ekle`}
                    </Button>
                  </div>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b bg-muted/40">
                          <th className="py-2 px-2">Tarih</th>
                          {aktifPersonel === '__tumu__' && <th className="py-2 px-2">Personel</th>}
                          <th className="py-2 px-2">Bölge</th>
                          <th className="py-2 px-2">Açıklama / Ne İçin</th>
                          <th className="py-2 px-2 text-right">Tutar</th>
                          <th className="py-2 px-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {aktifKayitlar.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-4 text-center text-muted-foreground">Kayıt yok</td>
                          </tr>
                        ) : (
                          aktifKayitlar
                            .slice()
                            .sort((a, b) => b.tarih.localeCompare(a.tarih))
                            .map((k) => (
                              <tr key={k.id} className="border-b last:border-0 group">
                                <td className="py-2 px-2"><SafeDate date={k.tarih} /></td>
                                {aktifPersonel === '__tumu__' && <td className="py-2 px-2 font-medium">{k.personelAdi}</td>}
                                <td className="py-2 px-2">{k.bolge ?? '-'}</td>
                                <td className="py-2 px-2">{k.aciklama ?? '-'}</td>
                                <td className="py-2 px-2 text-right font-medium">{formatTL(k.tutar)}</td>
                                <td className="py-2 px-2">
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(k)}><Pencil className="h-3.5 w-3.5" /></Button>
                                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(k.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                                  </div>
                                </td>
                              </tr>
                            ))
                        )}
                      </tbody>
                      {aktifKayitlar.length > 0 && (
                        <tfoot>
                          <tr className="font-semibold">
                            <td colSpan={aktifPersonel === '__tumu__' ? 4 : 3} className="py-2 px-2 text-right">Toplam</td>
                            <td className="py-2 px-2 text-right">{formatTL(aktifKayitlar.reduce((a, k) => a + k.tutar, 0))}</td>
                            <td />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* EN ALTTA: Genel Liste — tarih x personel, kesişenleri işaretle */}
            <div className="space-y-2">
              <h5 className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground">
                <Table2 className="h-3.5 w-3.5" /> Genel Liste (Tarihe Göre)
              </h5>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b bg-muted/40">
                      <th className="py-2 px-2">Tarih</th>
                      {personeller.map((p) => (
                        <th key={p} className="py-2 px-2 text-right whitespace-nowrap">{p}</th>
                      ))}
                      <th className="py-2 px-2 text-right whitespace-nowrap">Toplam</th>
                      <th className="py-2 px-2 text-center whitespace-nowrap">Kesişen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tarihMatrisi.map((g) => (
                      <tr key={g.tarih} className={`border-b last:border-0 ${g.kisiSayisi > 1 ? 'bg-amber-50 dark:bg-amber-950/20' : ''}`}>
                        <td className="py-2 px-2"><SafeDate date={g.tarih} /></td>
                        {personeller.map((p) => {
                          const v = g.personelToplam.get(p)
                          return (
                            <td key={p} className="py-2 px-2 text-right whitespace-nowrap text-muted-foreground">
                              {v ? formatTL(v) : '-'}
                            </td>
                          )
                        })}
                        <td className="py-2 px-2 text-right whitespace-nowrap font-semibold">{formatTL(g.genelToplam)}</td>
                        <td className="py-2 px-2 text-center">
                          {g.kisiSayisi > 1 && (
                            <Badge variant="outline" className="border-amber-500 text-amber-600 gap-1">
                              <AlertTriangle className="h-3 w-3" /> {g.kisiSayisi} kişi
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                "Kesişen" sütunu, aynı tarihte birden fazla personelin harcama girdiği günleri işaretler.
              </p>
            </div>
          </>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? 'Harcama Düzenle' : 'Yeni Personel Harcaması'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Tarih *</Label>
                <Input type="date" value={form.tarih} onChange={(e) => setForm((p) => ({ ...p, tarih: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Tutar (TL) *</Label>
                <Input type="number" value={form.tutar} onChange={(e) => setForm((p) => ({ ...p, tutar: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Personel Adı *</Label>
              <Input
                value={form.personelAdi}
                onChange={(e) => setForm((p) => ({ ...p, personelAdi: e.target.value }))}
                placeholder="Ör: Selahattin Bolat"
                list="personel-adi-onerileri"
              />
              <datalist id="personel-adi-onerileri">
                {personeller.map((p) => <option key={p} value={p} />)}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label>Bölge</Label>
              <Input value={form.bolge} onChange={(e) => setForm((p) => ({ ...p, bolge: e.target.value }))} placeholder="Ör: Botaş İşi" />
            </div>
            <div className="space-y-1.5">
              <Label>Açıklama / Ne İçin</Label>
              <Input value={form.aciklama} onChange={(e) => setForm((p) => ({ ...p, aciklama: e.target.value }))} placeholder="Ör: Yemek, yol, konaklama..." />
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
