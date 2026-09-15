'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { FadeIn } from '@/components/ui/animate'
import {
  Wallet,
  Building2,
  Plus,
  Trash2,
  Pencil,
  Users,
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
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n || 0)
}

// ---------------------------------------------------------------------------
// Yardımcı fonksiyonlar
// ---------------------------------------------------------------------------

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

// Her personele sabit, birbirinden farklı bir renk atamak için döngüsel bir palet.
// Sıra, alfabetik personel listesindeki konuma göre belirlenir; böylece bir kişinin
// rengi haftalık özet / sekmeler / genel liste arasında hep aynı kalır.
const PERSONEL_RENK_PALETI = [
  { text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500', chipBg: 'bg-blue-50 dark:bg-blue-950/40', rgb: '59,130,246' },
  { text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500', chipBg: 'bg-emerald-50 dark:bg-emerald-950/40', rgb: '16,185,129' },
  { text: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-500', chipBg: 'bg-purple-50 dark:bg-purple-950/40', rgb: '168,85,247' },
  { text: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500', chipBg: 'bg-orange-50 dark:bg-orange-950/40', rgb: '249,115,22' },
  { text: 'text-pink-600 dark:text-pink-400', dot: 'bg-pink-500', chipBg: 'bg-pink-50 dark:bg-pink-950/40', rgb: '236,72,153' },
  { text: 'text-cyan-600 dark:text-cyan-400', dot: 'bg-cyan-500', chipBg: 'bg-cyan-50 dark:bg-cyan-950/40', rgb: '6,182,212' },
  { text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500', chipBg: 'bg-amber-50 dark:bg-amber-950/40', rgb: '245,158,11' },
  { text: 'text-indigo-600 dark:text-indigo-400', dot: 'bg-indigo-500', chipBg: 'bg-indigo-50 dark:bg-indigo-950/40', rgb: '99,102,241' },
  { text: 'text-teal-600 dark:text-teal-400', dot: 'bg-teal-500', chipBg: 'bg-teal-50 dark:bg-teal-950/40', rgb: '20,184,166' },
  { text: 'text-rose-600 dark:text-rose-400', dot: 'bg-rose-500', chipBg: 'bg-rose-50 dark:bg-rose-950/40', rgb: '244,63,94' },
]

function personelRengi(index: number) {
  return PERSONEL_RENK_PALETI[index % PERSONEL_RENK_PALETI.length]
}

// Haftalık özet tablosundaki tutar hücrelerine, o kişinin o haftaki harcamasının
// (kendi satırındaki en yükseğe göre oranla) yoğunluğuna göre canlı bir renk tonu verir.
function isiHaritasiStili(deger: number, satirMax: number, rgb: string): React.CSSProperties {
  if (!deger || !satirMax) return {}
  const oran = Math.min(1, deger / satirMax)
  return { backgroundColor: `rgba(${rgb}, ${0.1 + oran * 0.32})` }
}

// ---------------------------------------------------------------------------
// Tipler
// ---------------------------------------------------------------------------
interface SantiyeSecenek {
  id: string
  ad: string
}

interface PersonelHarcama {
  id: string
  tarih: string
  personelAdi: string
  bolge: string | null
  aciklama: string | null
  tutar: number
}

const PH_EMPTY_FORM = { tarih: '', personelAdi: '', bolge: '', aciklama: '', tutar: '' }

// ---------------------------------------------------------------------------
// Sayfa: şantiye seçici + PIN korumalı Personel Harcamaları bölümü
// ---------------------------------------------------------------------------
export function PersonelHarcamalariClient() {
  const [santiyeler, setSantiyeler] = useState<SantiyeSecenek[]>([])
  const [loadingSantiyeler, setLoadingSantiyeler] = useState(true)
  const [selectedSantiyeId, setSelectedSantiyeId] = useState<string>('')
  const [personelSecenekleri, setPersonelSecenekleri] = useState<string[]>([])
  const [baslangicUygulandi, setBaslangicUygulandi] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/santiyeler').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/calisanlar').then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([santiyeData, calisanData]) => {
        const liste: SantiyeSecenek[] = (Array.isArray(santiyeData) ? santiyeData : [])
          .map((s: any) => ({ id: s.id, ad: s.ad }))
          .sort((a: SantiyeSecenek, b: SantiyeSecenek) => a.ad.localeCompare(b.ad, 'tr'))
        setSantiyeler(liste)
        const adlar: string[] = (Array.isArray(calisanData) ? calisanData : [])
          .map((c: any) => c.ad)
          .filter(Boolean)
          .sort((a: string, b: string) => a.localeCompare(b, 'tr'))
        setPersonelSecenekleri(adlar)
      })
      .catch(() => toast.error('Veriler yüklenemedi'))
      .finally(() => setLoadingSantiyeler(false))
  }, [])

  // URL'den ?santiye=... parametresi varsa (Proje Maliyeti sayfasındaki linkten geldiyse) başlangıçta onu seç
  useEffect(() => {
    if (baslangicUygulandi || santiyeler.length === 0) return
    const params = new URLSearchParams(window.location.search)
    const fromUrl = params.get('santiye')
    if (fromUrl && santiyeler.some((s) => s.id === fromUrl)) {
      setSelectedSantiyeId(fromUrl)
    } else {
      setSelectedSantiyeId(santiyeler[0].id)
    }
    setBaslangicUygulandi(true)
  }, [santiyeler, baslangicUygulandi])

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wallet className="h-6 w-6 text-secondary" /> Personel Harcamaları
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Şantiye bazında, kişi/tarih/bölge detaylı personel harcama takibi — PIN korumalı
          </p>
        </div>
      </FadeIn>

      {loadingSantiyeler ? (
        <div className="h-20 bg-muted animate-pulse rounded-lg" />
      ) : santiyeler.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Önce Şantiyeler sayfasından bir şantiye ekleyin.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-4 flex items-center gap-3 flex-wrap">
              <Label className="text-sm shrink-0 flex items-center gap-1.5"><Building2 className="h-4 w-4" /> Şantiye</Label>
              <Select value={selectedSantiyeId} onValueChange={setSelectedSantiyeId}>
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue placeholder="Şantiye seçin" />
                </SelectTrigger>
                <SelectContent>
                  {santiyeler.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.ad}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedSantiyeId && (
            <PersonelHarcamalariBolumu
              key={selectedSantiyeId}
              santiyeId={selectedSantiyeId}
              personelSecenekleri={personelSecenekleri}
            />
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PIN korumalı, kişi/tarih/bölge bazlı harcama kaydı bölümü
// ---------------------------------------------------------------------------
function PersonelHarcamalariBolumu({ santiyeId, personelSecenekleri }: { santiyeId: string; personelSecenekleri: string[] }) {
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
  const [kesisenDetayTarih, setKesisenDetayTarih] = useState<string | null>(null)

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
    } catch { toast.error('Hata oluştu') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu harcama kaydını silmek istediğinize emin misiniz?')) return
    const res = await fetch(`/api/proje-maliyeti/${santiyeId}/personel-harcama/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Silinemedi'); return }
    toast.success('Silindi')
    fetchKayitlar()
  }

  // Personel listesi (alfabetik, benzersiz) — bu şantiyede kayıt olan herkes
  const personeller = useMemo(() => {
    const set = new Set(kayitlar.map((k) => k.personelAdi))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'))
  }, [kayitlar])

  // Her personele sabit bir renk ata — alfabetik sıradaki konumuna göre, tüm tablolarda aynı kalır
  const personelRenkHaritasi = useMemo(() => {
    const map = new Map<string, ReturnType<typeof personelRengi>>()
    personeller.forEach((p, i) => map.set(p, personelRengi(i)))
    return map
  }, [personeller])
  const renkAl = (p: string) => personelRenkHaritasi.get(p) ?? personelRengi(0)

  // Dialog'daki "Personel Adı" seçim listesi: Personeller sayfasındaki çalışanlar + bu şantiyede
  // daha önce elle girilmiş (Personeller sayfasında olmayan) isimler bir arada
  const personelDropdownSecenekleri = useMemo(() => {
    const set = new Set<string>([...personelSecenekleri, ...personeller])
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'))
  }, [personelSecenekleri, personeller])

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

  // Haftalık özette ısı haritası tonu için: her personelin, kendi haftaları arasındaki en yüksek harcaması
  const personelHaftaMax = useMemo(() => {
    const map = new Map<string, number>()
    for (const h of haftalikOzet) {
      for (const [p, v] of h.personelToplam) {
        map.set(p, Math.max(map.get(p) ?? 0, v))
      }
    }
    return map
  }, [haftalikOzet])

  const aktifKayitlar = useMemo(
    () => (aktifPersonel === '__tumu__' ? kayitlar : kayitlar.filter((k) => k.personelAdi === aktifPersonel)),
    [kayitlar, aktifPersonel],
  )

  // Bir "Kesişen" rozetine tıklandığında, o tarihte kimin nerede/ne kadar harcadığını gösteren detay listesi
  const kesisenDetayKayitlar = useMemo(
    () =>
      kesisenDetayTarih
        ? kayitlar.filter((k) => k.tarih.slice(0, 10) === kesisenDetayTarih).sort((a, b) => b.tutar - a.tutar)
        : [],
    [kayitlar, kesisenDetayTarih],
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
                    {personeller.map((p) => {
                      const renk = renkAl(p)
                      const satirMax = personelHaftaMax.get(p) ?? 0
                      return (
                        <tr
                          key={p}
                          className={`border-b last:border-0 cursor-pointer hover:bg-muted/30 ${aktifPersonel === p ? 'bg-secondary/5' : ''}`}
                          onClick={() => setAktifPersonel(p)}
                        >
                          <td className="py-2 px-2 sticky left-0 bg-background">
                            <span className="inline-flex items-center gap-1.5 font-medium">
                              <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${renk.dot}`} />
                              <span className={renk.text}>{p}</span>
                            </span>
                          </td>
                          {haftalikOzet.map((h) => {
                            const v = h.personelToplam.get(p) ?? 0
                            return (
                              <td
                                key={h.key}
                                className="py-2 px-2 text-right whitespace-nowrap text-muted-foreground rounded"
                                style={isiHaritasiStili(v, satirMax, renk.rgb)}
                              >
                                {v ? formatTL(v) : '-'}
                              </td>
                            )
                          })}
                          <td className="py-2 px-2 text-right whitespace-nowrap font-semibold">{formatTL(personelToplamlari.get(p) ?? 0)}</td>
                        </tr>
                      )
                    })}
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
                  {personeller.map((p) => {
                    const renk = renkAl(p)
                    return (
                      <TabsTrigger key={p} value={p} className="gap-1.5">
                        <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${renk.dot}`} />
                        <span className={aktifPersonel === p ? renk.text : ''}>{p}</span>
                        <span className="ml-1 text-xs text-muted-foreground">{formatTL(personelToplamlari.get(p) ?? 0)}</span>
                      </TabsTrigger>
                    )
                  })}
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
                                {aktifPersonel === '__tumu__' && (
                                  <td className="py-2 px-2 font-medium">
                                    <span className="inline-flex items-center gap-1.5">
                                      <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${renkAl(k.personelAdi).dot}`} />
                                      <span className={renkAl(k.personelAdi).text}>{k.personelAdi}</span>
                                    </span>
                                  </td>
                                )}
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
                      {personeller.map((p) => {
                        const renk = renkAl(p)
                        return (
                          <th key={p} className="py-2 px-2 text-right whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 justify-end">
                              <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${renk.dot}`} />
                              <span className={renk.text}>{p}</span>
                            </span>
                          </th>
                        )
                      })}
                      <th className="py-2 px-2 text-right whitespace-nowrap">Toplam</th>
                      <th className="py-2 px-2 text-center whitespace-nowrap">Kesişen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tarihMatrisi.map((g) => (
                      <tr
                        key={g.tarih}
                        className={`border-b last:border-0 ${
                          g.kisiSayisi > 1
                            ? 'bg-amber-100/70 dark:bg-amber-900/30 border-l-4 border-l-amber-500 font-medium'
                            : ''
                        }`}
                      >
                        <td className="py-2 px-2"><SafeDate date={g.tarih} /></td>
                        {personeller.map((p) => {
                          const v = g.personelToplam.get(p)
                          const renk = renkAl(p)
                          return (
                            <td
                              key={p}
                              className={`py-2 px-2 text-right whitespace-nowrap ${v ? renk.text + ' font-medium' : 'text-muted-foreground'}`}
                            >
                              {v ? formatTL(v) : '-'}
                            </td>
                          )
                        })}
                        <td className="py-2 px-2 text-right whitespace-nowrap font-semibold">{formatTL(g.genelToplam)}</td>
                        <td className="py-2 px-2 text-center">
                          {g.kisiSayisi > 1 && (
                            <button type="button" onClick={() => setKesisenDetayTarih(g.tarih)} className="inline-flex">
                              <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 gap-1 cursor-pointer shadow-sm">
                                <AlertTriangle className="h-3 w-3" /> {g.kisiSayisi} kişi
                              </Badge>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                "Kesişen" sütunu, aynı tarihte birden fazla personelin harcama girdiği günleri işaretler — rozete tıklayınca kimin nerede harcadığını görebilirsin.
              </p>
            </div>
          </>
        )}
      </CardContent>

      {/* Kesişen gün detayı: o tarihte kim, nerede, ne kadar harcamış */}
      <Dialog open={!!kesisenDetayTarih} onOpenChange={(open) => !open && setKesisenDetayTarih(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {kesisenDetayTarih && <SafeDate date={kesisenDetayTarih} />} — Kim Nerede Harcamış
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b bg-muted/40">
                  <th className="py-2 px-2">Personel</th>
                  <th className="py-2 px-2">Bölge</th>
                  <th className="py-2 px-2">Açıklama / Ne İçin</th>
                  <th className="py-2 px-2 text-right">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {kesisenDetayKayitlar.map((k) => (
                  <tr key={k.id} className="border-b last:border-0">
                    <td className="py-2 px-2 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${renkAl(k.personelAdi).dot}`} />
                        <span className={renkAl(k.personelAdi).text}>{k.personelAdi}</span>
                      </span>
                    </td>
                    <td className="py-2 px-2">{k.bolge ?? '-'}</td>
                    <td className="py-2 px-2">{k.aciklama ?? '-'}</td>
                    <td className="py-2 px-2 text-right font-medium">{formatTL(k.tutar)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={3} className="py-2 px-2 text-right">Toplam</td>
                  <td className="py-2 px-2 text-right">{formatTL(kesisenDetayKayitlar.reduce((a, k) => a + k.tutar, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKesisenDetayTarih(null)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <Select value={form.personelAdi} onValueChange={(v) => setForm((p) => ({ ...p, personelAdi: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Personeller sayfasından seçin" />
                </SelectTrigger>
                <SelectContent>
                  {personelDropdownSecenekleri.length === 0 ? (
                    <div className="px-2 py-2 text-sm text-muted-foreground">Önce Personeller sayfasından çalışan ekleyin</div>
                  ) : (
                    personelDropdownSecenekleri.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
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
