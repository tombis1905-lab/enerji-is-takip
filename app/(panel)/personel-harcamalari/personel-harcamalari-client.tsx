'use client'

import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react'
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
  DialogDescription,
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
  Upload,
  AlertTriangle,
  CalendarRange,
  UserRound,
  Table2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  Receipt,
} from 'lucide-react'
import { toast } from 'sonner'
import { SafeDate } from '@/components/safe-format'
import * as XLSX from 'xlsx'

function formatTL(n: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n || 0)
}

// ---------------------------------------------------------------------------
// Tarih / hafta yardımcıları (hepsi saat dilimi bağımsız: "YYYY-MM-DD" kısmı
// üzerinden UTC ile hesaplanır, böylece sunucu ve tarayıcıda aynı sonucu verir)
// ---------------------------------------------------------------------------

const pad2 = (n: number) => n.toString().padStart(2, '0')

function gunParcalari(tarihStr: string): [number, number, number] {
  const [y, m, d] = tarihStr.slice(0, 10).split('-').map(Number)
  return [y, m, d]
}

// ISO 8601 hafta numarası (Pazartesi başlangıçlı, yılın ilk Perşembe'sini içeren hafta = 1. hafta).
// Excel'deki WEEKNUM(tarih;2) ile 2026 için birebir aynı sonucu verir.
function isoHaftaBilgisi(tarihStr: string): { yil: number; hafta: number } {
  const [y, m, g] = gunParcalari(tarihStr)
  const d = new Date(Date.UTC(y, m - 1, g))
  const gunNo = (d.getUTCDay() + 6) % 7 // Pazartesi=0 ... Pazar=6
  d.setUTCDate(d.getUTCDate() - gunNo + 3) // bu haftanın Perşembe'si
  const yilBasiPerembe = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const ilkGunNo = (yilBasiPerembe.getUTCDay() + 6) % 7
  yilBasiPerembe.setUTCDate(yilBasiPerembe.getUTCDate() - ilkGunNo + 3)
  const hafta = 1 + Math.round((d.getTime() - yilBasiPerembe.getTime()) / (7 * 24 * 3600 * 1000))
  return { yil: d.getUTCFullYear(), hafta }
}

// Bir ISO yılında kaç hafta var (52 ya da 53).
function yildakiHaftaSayisi(yil: number): number {
  return isoHaftaBilgisi(`${yil}-12-28`).hafta
}

// Bir ISO haftasının Pazartesi günü (UTC).
function haftaPazartesi(yil: number, hafta: number): Date {
  const ocakDort = new Date(Date.UTC(yil, 0, 4))
  const gunNo = (ocakDort.getUTCDay() + 6) % 7
  const ilkPazartesi = new Date(ocakDort)
  ilkPazartesi.setUTCDate(ocakDort.getUTCDate() - gunNo)
  const sonuc = new Date(ilkPazartesi)
  sonuc.setUTCDate(ilkPazartesi.getUTCDate() + (hafta - 1) * 7)
  return sonuc
}

// "08.06 – 14.06" biçiminde hafta aralığı
function haftaAraligiEtiketi(yil: number, hafta: number): string {
  const bas = haftaPazartesi(yil, hafta)
  const bit = new Date(bas)
  bit.setUTCDate(bas.getUTCDate() + 6)
  const fmt = (dt: Date) => `${pad2(dt.getUTCDate())}.${pad2(dt.getUTCMonth() + 1)}`
  return `${fmt(bas)} – ${fmt(bit)}`
}

function bugunStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

// Excel sekme adları en fazla 31 karakter olabilir ve bazı karakterleri kabul etmez;
// ayrıca aynı isimli iki personel varsa sekme adları çakışmasın diye benzersizleştiriyoruz.
function excelSekmeAdi(ad: string, kullanilanlar: Set<string>): string {
  const temiz = ad.replace(/[\\/*?:[\]]/g, ' ').trim().slice(0, 31) || 'Personel'
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
// rengi tüm tablolarda hep aynı kalır.
const PERSONEL_RENK_PALETI = [
  { text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500', rgb: '59,130,246' },
  { text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500', rgb: '16,185,129' },
  { text: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-500', rgb: '168,85,247' },
  { text: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500', rgb: '249,115,22' },
  { text: 'text-pink-600 dark:text-pink-400', dot: 'bg-pink-500', rgb: '236,72,153' },
  { text: 'text-cyan-600 dark:text-cyan-400', dot: 'bg-cyan-500', rgb: '6,182,212' },
  { text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500', rgb: '245,158,11' },
  { text: 'text-indigo-600 dark:text-indigo-400', dot: 'bg-indigo-500', rgb: '99,102,241' },
  { text: 'text-teal-600 dark:text-teal-400', dot: 'bg-teal-500', rgb: '20,184,166' },
  { text: 'text-rose-600 dark:text-rose-400', dot: 'bg-rose-500', rgb: '244,63,94' },
]

function personelRengi(index: number) {
  return PERSONEL_RENK_PALETI[index % PERSONEL_RENK_PALETI.length]
}

// Haftalık tablodaki tutar hücrelerine, o kişinin o haftaki harcamasının
// (kendi satırındaki en yükseğe göre oranla) yoğunluğuna göre bir renk tonu verir.
function isiHaritasiStili(deger: number, satirMax: number, rgb: string): React.CSSProperties {
  if (!deger || !satirMax) return {}
  const oran = Math.min(1, deger / satirMax)
  return { backgroundColor: `rgba(${rgb}, ${0.1 + oran * 0.32})` }
}

// ---------------------------------------------------------------------------
// Excel'den toplu aktarım: "PERSONEL HAFTALIK HARCAMA TABLOSU" biçimi
// (her personelin kendi sekmesi; HAFTA | TARİH | AÇIKLAMA | TUTAR [| ÖDENEN | ÖDEME TARİHİ])
// ---------------------------------------------------------------------------
interface AktarimKayit {
  personelAdi: string
  tarih: string
  aciklama: string | null
  tutar: number
  odendi: boolean
  odemeTarihi: string | null
}

interface AktarimOkuma {
  kayitlar: AktarimKayit[]
  uyarilar: string[]
  sayfalar: string[]
}

function sayiyaCevir(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const t = v.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
    const n = parseFloat(t)
    return Number.isNaN(n) ? 0 : n
  }
  return 0
}

function excelTarihiniCevir(v: unknown): string | null {
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const p = XLSX.SSF.parse_date_code(v)
    if (!p) return null
    return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`
  }
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
    if (m) return `${m[3]}-${pad2(Number(m[2]))}-${pad2(Number(m[1]))}`
  }
  return null
}

function hucreMetni(v: unknown): string {
  return String(v ?? '').trim().toLocaleUpperCase('tr-TR')
}

function haftalikTabloyuOku(veri: ArrayBuffer): AktarimOkuma {
  const wb = XLSX.read(veri, { type: 'array' })
  const ATLANACAK = new Set(['ÖZET', 'OZET', 'ANASAYFA', 'HAFTALIK'])

  type HamSatir = {
    personelAdi: string
    tarih: string | null
    haftaNo: number
    aciklama: string
    kalan: number
    odenen: number
    odemeTarihi: string | null
  }
  const hamSatirlar: HamSatir[] = []
  const sayfalar: string[] = []

  for (const sayfaAdi of wb.SheetNames) {
    if (ATLANACAK.has(hucreMetni(sayfaAdi))) continue
    const ws = wb.Sheets[sayfaAdi]
    const aoa: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null })

    // Başlık satırını bul: içinde hem TARİH hem AÇIKLAMA geçen ilk satır
    let baslikSatiri = -1
    for (let r = 0; r < Math.min(8, aoa.length); r++) {
      const hucreler = (aoa[r] || []).map(hucreMetni)
      if (hucreler.includes('TARİH') && hucreler.includes('AÇIKLAMA')) { baslikSatiri = r; break }
    }
    if (baslikSatiri === -1) continue

    const baslik = (aoa[baslikSatiri] || []).map(hucreMetni)
    const iHafta = baslik.indexOf('HAFTA')
    const iTarih = baslik.indexOf('TARİH')
    const iAciklama = baslik.indexOf('AÇIKLAMA')
    const iTutar = baslik.indexOf('TUTAR')
    const iOdenen = baslik.indexOf('ÖDENEN')
    const iOdemeTarihi = baslik.indexOf('ÖDEME TARİHİ')

    const ilkHucre = aoa[0]?.[0]
    const personelAdi = (typeof ilkHucre === 'string' && ilkHucre.trim() ? ilkHucre : sayfaAdi).trim()
    sayfalar.push(personelAdi)

    for (let r = baslikSatiri + 1; r < aoa.length; r++) {
      const satir = aoa[r] || []
      const kalan = iTutar >= 0 ? sayiyaCevir(satir[iTutar]) : 0
      const odenen = iOdenen >= 0 ? sayiyaCevir(satir[iOdenen]) : 0
      if (!kalan && !odenen) continue

      const tarih = excelTarihiniCevir(satir[iTarih])
      const haftaNo = iHafta >= 0 ? Math.round(sayiyaCevir(satir[iHafta])) : 0
      const aciklama = satir[iAciklama] != null ? String(satir[iAciklama]).trim() : ''
      // Tarihi de açıklaması da olmayan satırlar "KALAN / TOPLAM" gibi alt toplam satırlarıdır
      if (!tarih && !(haftaNo > 0 && aciklama)) continue

      hamSatirlar.push({
        personelAdi,
        tarih,
        haftaNo,
        aciklama,
        kalan,
        odenen,
        odemeTarihi: iOdemeTarihi >= 0 ? excelTarihiniCevir(satir[iOdemeTarihi]) : null,
      })
    }
  }

  // Tarihsiz ama hafta numarası olan (haftalık toplu girilmiş) satırlar için yıl: dosyada en çok geçen yıl
  const yilSayac = new Map<number, number>()
  for (const s of hamSatirlar) {
    if (s.tarih) {
      const y = Number(s.tarih.slice(0, 4))
      yilSayac.set(y, (yilSayac.get(y) || 0) + 1)
    }
  }
  let dosyaYili = new Date().getFullYear()
  let enCok = 0
  for (const [y, n] of yilSayac) if (n > enCok) { enCok = n; dosyaYili = y }

  const kayitlar: AktarimKayit[] = []
  const toplukSayac = new Map<string, number>()
  for (const s of hamSatirlar) {
    let tarih = s.tarih
    let aciklama = s.aciklama
    if (!tarih) {
      const pzt = haftaPazartesi(dosyaYili, s.haftaNo)
      tarih = `${pzt.getUTCFullYear()}-${pad2(pzt.getUTCMonth() + 1)}-${pad2(pzt.getUTCDate())}`
      aciklama = `${aciklama} (${s.haftaNo}. hafta toplu kayıt)`
      toplukSayac.set(s.personelAdi, (toplukSayac.get(s.personelAdi) || 0) + 1)
    }
    if (s.kalan) {
      kayitlar.push({ personelAdi: s.personelAdi, tarih, aciklama: aciklama || null, tutar: s.kalan, odendi: false, odemeTarihi: null })
    }
    if (s.odenen) {
      kayitlar.push({ personelAdi: s.personelAdi, tarih, aciklama: aciklama || null, tutar: s.odenen, odendi: true, odemeTarihi: s.odemeTarihi })
    }
  }

  const uyarilar: string[] = []
  for (const [ad, n] of toplukSayac) {
    uyarilar.push(`${ad}: ${n} satırda gün bilgisi yoktu (sadece hafta no vardı) — o haftanın Pazartesi gününe, "toplu kayıt" notuyla eklenecek.`)
  }
  return { kayitlar, uyarilar, sayfalar }
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
  santiyeId: string | null
  santiyeAdi: string | null
  odendi: boolean
  odemeTarihi: string | null
}

interface AktarimOnizleme {
  gelenSatir: number
  eklenecek: number
  atlanan: number
  toplamTutar: number
  personeller: { ad: string; kayit: number; toplam: number; odenen: number }[]
}

const TUMU = '__tumu__'
const GENEL = '__genel__' // şantiyesiz ("Genel") kayıtlar

const PH_EMPTY_FORM = {
  tarih: '',
  personelAdi: '',
  bolge: '',
  aciklama: '',
  tutar: '',
  santiyeId: GENEL,
  odendi: false,
  odemeTarihi: '',
}

// ---------------------------------------------------------------------------
// Sayfa: PIN korumalı Personel Harcamaları bölümü
// ---------------------------------------------------------------------------
export function PersonelHarcamalariClient() {
  const [santiyeler, setSantiyeler] = useState<SantiyeSecenek[]>([])
  const [loadingSantiyeler, setLoadingSantiyeler] = useState(true)
  const [personelSecenekleri, setPersonelSecenekleri] = useState<string[]>([])

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

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wallet className="h-6 w-6 text-secondary" /> Personel Harcamaları
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Personel bazlı haftalık harcama takibi, ödeme durumu ve yıllık özet — PIN korumalı
          </p>
        </div>
      </FadeIn>

      {loadingSantiyeler ? (
        <div className="h-20 bg-muted animate-pulse rounded-lg" />
      ) : (
        <PersonelHarcamalariBolumu santiyeler={santiyeler} personelSecenekleri={personelSecenekleri} />
      )}
    </div>
  )
}

// Özet kartı
function OzetKart({
  baslik,
  deger,
  alt,
  ikon,
  renk,
}: {
  baslik: string
  deger: string
  alt?: string
  ikon: React.ReactNode
  renk: string
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-start gap-3">
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${renk}`}>{ikon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{baslik}</p>
        <p className="text-xl font-bold tracking-tight truncate">{deger}</p>
        {alt && <p className="text-xs text-muted-foreground mt-0.5">{alt}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PIN korumalı, kişi/tarih/şantiye bazlı harcama bölümü
// ---------------------------------------------------------------------------
function PersonelHarcamalariBolumu({ santiyeler, personelSecenekleri }: { santiyeler: SantiyeSecenek[]; personelSecenekleri: string[] }) {
  const [santiyeFiltresi, setSantiyeFiltresi] = useState<string>(TUMU)
  const [baslangicUygulandi, setBaslangicUygulandi] = useState(false)

  // URL'den ?santiye=... parametresi varsa (Proje Maliyeti sayfasındaki linkten geldiyse) başlangıçta o şantiyeye filtrele
  useEffect(() => {
    if (baslangicUygulandi || santiyeler.length === 0) return
    const params = new URLSearchParams(window.location.search)
    const fromUrl = params.get('santiye')
    if (fromUrl && santiyeler.some((s) => s.id === fromUrl)) {
      setSantiyeFiltresi(fromUrl)
    }
    setBaslangicUygulandi(true)
  }, [santiyeler, baslangicUygulandi])

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
  const [aktifPersonel, setAktifPersonel] = useState<string>(TUMU)
  const [kesisenDetayTarih, setKesisenDetayTarih] = useState<string | null>(null)
  const [genelListeAcik, setGenelListeAcik] = useState(false)

  // Yıl / hafta seçimi (null = otomatik)
  const [yilSecimi, setYilSecimi] = useState<number | null>(null)
  const [haftaSecimi, setHaftaSecimi] = useState<number | null>(null)

  // Toplu "Ödendi" işlemi
  const [odemeIslem, setOdemeIslem] = useState<{ ids: string[]; baslik: string } | null>(null)
  const [odemeTarihiForm, setOdemeTarihiForm] = useState('')
  const [odemeKaydediliyor, setOdemeKaydediliyor] = useState(false)

  // Excel'den toplu aktarım
  const [aktarimAcik, setAktarimAcik] = useState(false)
  const [aktarimDosyaAdi, setAktarimDosyaAdi] = useState('')
  const [aktarimOkuma, setAktarimOkuma] = useState<AktarimOkuma | null>(null)
  const [aktarimSantiye, setAktarimSantiye] = useState<string>(GENEL)
  const [aktarimOnizleme, setAktarimOnizleme] = useState<AktarimOnizleme | null>(null)
  const [aktarimHata, setAktarimHata] = useState('')
  const [aktarimYukleniyor, setAktarimYukleniyor] = useState(false)

  const personelBolumuRef = useRef<HTMLDivElement | null>(null)

  const fetchKayitlar = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/proje-maliyeti/personel-harcama')
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
  }, [])

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
      tarih: bugunStr(),
      personelAdi: varsayilanPersonel && varsayilanPersonel !== TUMU ? varsayilanPersonel : '',
      santiyeId: santiyeFiltresi !== TUMU ? santiyeFiltresi : GENEL,
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
      santiyeId: k.santiyeId ?? GENEL,
      odendi: k.odendi,
      odemeTarihi: k.odemeTarihi ? k.odemeTarihi.slice(0, 10) : '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.tarih || !form.personelAdi.trim() || !form.tutar) {
      toast.error('Tarih, personel adı ve tutar zorunludur')
      return
    }
    if (form.odendi && !form.odemeTarihi) {
      toast.error('Ödendi işaretlendiyse ödeme tarihi de girilmeli')
      return
    }
    setSaving(true)
    try {
      const url = editId
        ? `/api/proje-maliyeti/personel-harcama/${editId}`
        : '/api/proje-maliyeti/personel-harcama'
      const res = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, santiyeId: form.santiyeId === GENEL ? '' : form.santiyeId }),
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
    const res = await fetch(`/api/proje-maliyeti/personel-harcama/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Silinemedi'); return }
    toast.success('Silindi')
    fetchKayitlar()
  }

  // ---- Ödendi işlemleri ----
  const odemeDialoguAc = (ids: string[], baslik: string) => {
    if (ids.length === 0) return
    setOdemeTarihiForm(bugunStr())
    setOdemeIslem({ ids, baslik })
  }

  const handleOdemeOnayla = async () => {
    if (!odemeIslem) return
    if (!odemeTarihiForm) { toast.error('Ödeme tarihi seçin'); return }
    setOdemeKaydediliyor(true)
    try {
      const res = await fetch('/api/proje-maliyeti/personel-harcama/toplu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: odemeIslem.ids, odendi: true, odemeTarihi: odemeTarihiForm }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.error ?? 'Hata oluştu'); return }
      toast.success(`${odemeIslem.ids.length} kayıt ödendi olarak işaretlendi`)
      setOdemeIslem(null)
      fetchKayitlar()
    } catch { toast.error('Hata oluştu') }
    finally { setOdemeKaydediliyor(false) }
  }

  const odemeyiGeriAl = async (k: PersonelHarcama) => {
    if (!confirm('Bu kaydın "Ödendi" işareti kaldırılsın mı?')) return
    const res = await fetch('/api/proje-maliyeti/personel-harcama/toplu', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [k.id], odendi: false }),
    })
    if (!res.ok) { toast.error('Hata oluştu'); return }
    fetchKayitlar()
  }

  // ---- Excel'den toplu aktarım ----
  const aktarimiSifirla = () => {
    setAktarimDosyaAdi('')
    setAktarimOkuma(null)
    setAktarimOnizleme(null)
    setAktarimHata('')
    setAktarimSantiye(santiyeFiltresi !== TUMU ? santiyeFiltresi : GENEL)
  }

  const aktarimIstegi = async (okuma: AktarimOkuma, uygula: boolean, santiye: string) => {
    const res = await fetch('/api/proje-maliyeti/personel-harcama/toplu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kayitlar: okuma.kayitlar, santiyeId: santiye === GENEL ? null : santiye, uygula }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || 'Hata oluştu')
    return data as AktarimOnizleme
  }

  const handleAktarimDosya = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const dosya = e.target.files?.[0]
    if (!dosya) return
    setAktarimHata('')
    setAktarimOnizleme(null)
    setAktarimOkuma(null)
    setAktarimDosyaAdi(dosya.name)
    setAktarimYukleniyor(true)
    try {
      const okuma = haftalikTabloyuOku(await dosya.arrayBuffer())
      if (okuma.kayitlar.length === 0) {
        setAktarimHata('Dosyada aktarılabilir harcama satırı bulunamadı. Her personelin kendi sekmesinde TARİH / AÇIKLAMA / TUTAR başlıkları olan bir tablo bekleniyor.')
        return
      }
      setAktarimOkuma(okuma)
      setAktarimOnizleme(await aktarimIstegi(okuma, false, aktarimSantiye))
    } catch (err: any) {
      setAktarimHata(err?.message || 'Dosya okunamadı. Geçerli bir Excel (.xlsx) dosyası seçin.')
    } finally {
      setAktarimYukleniyor(false)
      e.target.value = ''
    }
  }

  const handleAktarimUygula = async () => {
    if (!aktarimOkuma) return
    setAktarimYukleniyor(true)
    setAktarimHata('')
    try {
      const sonuc = await aktarimIstegi(aktarimOkuma, true, aktarimSantiye)
      toast.success(`${sonuc.eklenecek} harcama kaydı aktarıldı${sonuc.atlanan ? ` (${sonuc.atlanan} kayıt zaten vardı, atlandı)` : ''}`)
      setAktarimAcik(false)
      aktarimiSifirla()
      fetchKayitlar()
    } catch (err: any) {
      setAktarimHata(err?.message || 'Aktarım başarısız')
    } finally {
      setAktarimYukleniyor(false)
    }
  }

  // ---------------------------------------------------------------------
  // Hesaplamalar
  // ---------------------------------------------------------------------

  // Seçili şantiye filtresine göre daraltılmış kayıtlar
  const kayitlarFiltreli = useMemo(() => {
    if (santiyeFiltresi === TUMU) return kayitlar
    if (santiyeFiltresi === GENEL) return kayitlar.filter((k) => !k.santiyeId)
    return kayitlar.filter((k) => k.santiyeId === santiyeFiltresi)
  }, [kayitlar, santiyeFiltresi])

  // Her kaydın ISO yıl/hafta bilgisi (bir kere hesaplanır)
  const kayitMeta = useMemo(() => {
    const m = new Map<string, { yil: number; hafta: number }>()
    for (const k of kayitlar) m.set(k.id, isoHaftaBilgisi(k.tarih))
    return m
  }, [kayitlar])
  const metaAl = (k: PersonelHarcama) => kayitMeta.get(k.id) ?? isoHaftaBilgisi(k.tarih)

  const yillar = useMemo(() => {
    const set = new Set<number>()
    for (const k of kayitlarFiltreli) set.add(metaAl(k).yil)
    return Array.from(set).sort((a, b) => b - a)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kayitlarFiltreli, kayitMeta])

  const aktifYil = yilSecimi !== null && yillar.includes(yilSecimi) ? yilSecimi : (yillar[0] ?? new Date().getFullYear())
  const haftaSayisi = yildakiHaftaSayisi(aktifYil)

  // Seçili yıla ait kayıtlar
  const kayitlarYil = useMemo(
    () => kayitlarFiltreli.filter((k) => metaAl(k).yil === aktifYil),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kayitlarFiltreli, kayitMeta, aktifYil],
  )

  // Personel listesi (alfabetik, benzersiz) — filtrelenmiş kayıtlarda geçen herkes (tüm yıllar)
  const personeller = useMemo(() => {
    const set = new Set(kayitlarFiltreli.map((k) => k.personelAdi))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'))
  }, [kayitlarFiltreli])

  // Her personele sabit bir renk
  const personelRenkHaritasi = useMemo(() => {
    const map = new Map<string, ReturnType<typeof personelRengi>>()
    personeller.forEach((p, i) => map.set(p, personelRengi(i)))
    return map
  }, [personeller])
  const renkAl = (p: string) => personelRenkHaritasi.get(p) ?? personelRengi(0)

  // Dialog'daki "Personel Adı" listesi: Personeller sayfasındaki çalışanlar + daha önce girilmiş isimler
  const personelDropdownSecenekleri = useMemo(() => {
    const set = new Set<string>([...personelSecenekleri, ...personeller])
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'))
  }, [personelSecenekleri, personeller])

  // Seçili yıl için: personel x hafta matrisi (HAFTALIK sekmesi)
  const haftalikMatris = useMemo(() => {
    const satirlar = new Map<string, number[]>()
    const genel: number[] = new Array(haftaSayisi + 1).fill(0)
    for (const p of personeller) satirlar.set(p, new Array(haftaSayisi + 1).fill(0))
    for (const k of kayitlarYil) {
      const { hafta } = metaAl(k)
      if (hafta < 1 || hafta > haftaSayisi) continue
      const satir = satirlar.get(k.personelAdi)
      if (satir) satir[hafta] += k.tutar
      genel[hafta] += k.tutar
    }
    return { satirlar, genel }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kayitlarYil, personeller, haftaSayisi, kayitMeta])

  // Seçili yıl için personel bazlı toplam / ödenen
  const personelYillik = useMemo(() => {
    const map = new Map<string, { toplam: number; odenen: number }>()
    for (const p of personeller) map.set(p, { toplam: 0, odenen: 0 })
    for (const k of kayitlarYil) {
      const o = map.get(k.personelAdi)
      if (!o) continue
      o.toplam += k.tutar
      if (k.odendi) o.odenen += k.tutar
    }
    return map
  }, [kayitlarYil, personeller])

  // Tüm yıllar için personel toplamları (sekme başlıklarında gösterilir)
  const personelGenelToplam = useMemo(() => {
    const map = new Map<string, number>()
    for (const k of kayitlarFiltreli) map.set(k.personelAdi, (map.get(k.personelAdi) ?? 0) + k.tutar)
    return map
  }, [kayitlarFiltreli])

  // Varsayılan seçili hafta: bu haftada kayıt varsa bu hafta, yoksa veri olan son hafta
  const varsayilanHafta = useMemo(() => {
    const dolu = haftalikMatris.genel.map((v, i) => (i > 0 && v ? i : 0)).filter(Boolean)
    const simdi = isoHaftaBilgisi(bugunStr())
    if (simdi.yil === aktifYil && dolu.includes(simdi.hafta)) return simdi.hafta
    if (dolu.length > 0) return dolu[dolu.length - 1]
    return simdi.yil === aktifYil ? Math.min(simdi.hafta, haftaSayisi) : 1
  }, [haftalikMatris, aktifYil, haftaSayisi])

  const aktifHafta = haftaSecimi !== null && haftaSecimi >= 1 && haftaSecimi <= haftaSayisi ? haftaSecimi : varsayilanHafta

  const yillikToplam = personelSayilariToplam(personelYillik, 'toplam')
  const yillikOdenen = personelSayilariToplam(personelYillik, 'odenen')
  const yillikKalan = yillikToplam - yillikOdenen
  const seciliHaftaToplam = haftalikMatris.genel[aktifHafta] ?? 0
  const enBuyukYillik = Math.max(1, ...Array.from(personelYillik.values()).map((v) => v.toplam))

  // Haftalık tabloda ısı haritası için: her personelin kendi en yüksek haftası
  const personelHaftaMax = useMemo(() => {
    const map = new Map<string, number>()
    for (const [p, satir] of haftalikMatris.satirlar) map.set(p, Math.max(0, ...satir))
    return map
  }, [haftalikMatris])

  // "GENEL LİSTE" görünümü: aynı tarihte kim ne kadar harcamış (seçili yıl)
  const tarihMatrisi = useMemo(() => {
    const map = new Map<string, { tarih: string; personelToplam: Map<string, number>; genelToplam: number; kisiSayisi: number }>()
    for (const k of kayitlarYil) {
      const gun = k.tarih.slice(0, 10)
      if (!map.has(gun)) map.set(gun, { tarih: gun, personelToplam: new Map(), genelToplam: 0, kisiSayisi: 0 })
      const giris = map.get(gun)!
      if (!giris.personelToplam.has(k.personelAdi)) giris.kisiSayisi += 1
      giris.personelToplam.set(k.personelAdi, (giris.personelToplam.get(k.personelAdi) ?? 0) + k.tutar)
      giris.genelToplam += k.tutar
    }
    return Array.from(map.values()).sort((a, b) => b.tarih.localeCompare(a.tarih))
  }, [kayitlarYil])

  const aktifKayitlar = useMemo(
    () => (aktifPersonel === TUMU ? kayitlarFiltreli : kayitlarFiltreli.filter((k) => k.personelAdi === aktifPersonel)),
    [kayitlarFiltreli, aktifPersonel],
  )

  const aktifOzet = useMemo(() => {
    let toplam = 0
    let odenen = 0
    for (const k of aktifKayitlar) {
      toplam += k.tutar
      if (k.odendi) odenen += k.tutar
    }
    return { toplam, odenen, kalan: toplam - odenen, adet: aktifKayitlar.length }
  }, [aktifKayitlar])

  // Personel sekmesi: önce haftaya, sonra güne göre gruplanmış (yeniden eskiye) kayıtlar;
  // her hafta için Excel'deki "HAFTALIK TOPLAM" sütununa karşılık gelen alt toplam
  const aktifHaftaGruplari = useMemo(() => {
    type GunGrubu = { tarih: string; kayitlar: PersonelHarcama[]; toplam: number }
    type HaftaGrubu = { key: string; yil: number; hafta: number; gunler: GunGrubu[]; toplam: number; kalan: number; adet: number; bekleyenIds: string[] }
    const siralanmis = aktifKayitlar.slice().sort((a, b) => b.tarih.localeCompare(a.tarih))
    const haftalar: HaftaGrubu[] = []
    for (const k of siralanmis) {
      const { yil, hafta } = metaAl(k)
      const key = `${yil}-${pad2(hafta)}`
      let h = haftalar[haftalar.length - 1]
      if (!h || h.key !== key) {
        h = { key, yil, hafta, gunler: [], toplam: 0, kalan: 0, adet: 0, bekleyenIds: [] }
        haftalar.push(h)
      }
      const gun = k.tarih.slice(0, 10)
      let g = h.gunler[h.gunler.length - 1]
      if (!g || g.tarih !== gun) {
        g = { tarih: gun, kayitlar: [], toplam: 0 }
        h.gunler.push(g)
      }
      g.kayitlar.push(k)
      g.toplam += k.tutar
      h.toplam += k.tutar
      h.adet += 1
      if (!k.odendi) {
        h.kalan += k.tutar
        h.bekleyenIds.push(k.id)
      }
    }
    return haftalar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktifKayitlar, kayitMeta])

  const aktifBekleyenIds = useMemo(() => aktifKayitlar.filter((k) => !k.odendi).map((k) => k.id), [aktifKayitlar])
  const santiyeSutunuVar = aktifKayitlar.some((k) => !!k.santiyeId)
  const bolgeSutunuVar = aktifKayitlar.some((k) => !!k.bolge)

  // Bir "Kesişen" rozetine tıklandığında, o tarihte kimin nerede/ne kadar harcadığını gösteren detay listesi
  const kesisenDetayKayitlar = useMemo(
    () =>
      kesisenDetayTarih
        ? kayitlarFiltreli.filter((k) => k.tarih.slice(0, 10) === kesisenDetayTarih).sort((a, b) => b.tutar - a.tutar)
        : [],
    [kayitlarFiltreli, kesisenDetayTarih],
  )

  // Aktarım önizlemesi (dosyadan okunan, henüz kaydedilmemiş veriye göre)
  const aktarimKisiOzeti = useMemo(() => {
    if (!aktarimOkuma) return []
    const map = new Map<string, { kayit: number; toplam: number; odenen: number }>()
    for (const k of aktarimOkuma.kayitlar) {
      const o = map.get(k.personelAdi) || { kayit: 0, toplam: 0, odenen: 0 }
      o.kayit += 1
      o.toplam += k.tutar
      if (k.odendi) o.odenen += k.tutar
      map.set(k.personelAdi, o)
    }
    return Array.from(map.entries()).map(([ad, v]) => ({ ad, ...v }))
  }, [aktarimOkuma])

  // ---------------------------------------------------------------------
  // Excel çıktısı: kaynak dosyadaki yapıya benzer (ÖZET, HAFTALIK, personel sekmeleri)
  // ---------------------------------------------------------------------
  const handleExcelExport = () => {
    const wb = XLSX.utils.book_new()
    const haftaEtiket = (h: number) => `${h}. Hafta (${haftaAraligiEtiketi(aktifYil, h)})`

    // 1) ÖZET
    const ozetSatirlari: (string | number)[][] = [
      ['Seçilen Hafta', aktifHafta, haftaAraligiEtiketi(aktifYil, aktifHafta)],
      [],
      ['Personel', 'Seçilen Hafta Harcama', `${aktifYil} Yıllık Toplam`, 'Ödenen', 'Kalan'],
    ]
    for (const p of personeller) {
      const y = personelYillik.get(p) ?? { toplam: 0, odenen: 0 }
      ozetSatirlari.push([p, haftalikMatris.satirlar.get(p)?.[aktifHafta] ?? 0, y.toplam, y.odenen, y.toplam - y.odenen])
    }
    ozetSatirlari.push(['GENEL TOPLAM', seciliHaftaToplam, yillikToplam, yillikOdenen, yillikKalan])
    const wsOzet = XLSX.utils.aoa_to_sheet(ozetSatirlari)
    wsOzet['!cols'] = [{ wch: 26 }, { wch: 22 }, { wch: 20 }, { wch: 16 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, wsOzet, 'ÖZET')

    // 2) HAFTALIK: personel x tüm haftalar
    const haftaBasliklari = Array.from({ length: haftaSayisi }, (_, i) => haftaEtiket(i + 1))
    const haftalikSatirlari: (string | number)[][] = [['Personel', ...haftaBasliklari, 'TOPLAM']]
    for (const p of personeller) {
      const satir = haftalikMatris.satirlar.get(p) ?? []
      haftalikSatirlari.push([p, ...Array.from({ length: haftaSayisi }, (_, i) => satir[i + 1] ?? 0), personelYillik.get(p)?.toplam ?? 0])
    }
    haftalikSatirlari.push(['GENEL TOPLAM', ...Array.from({ length: haftaSayisi }, (_, i) => haftalikMatris.genel[i + 1] ?? 0), yillikToplam])
    const wsHaftalik = XLSX.utils.aoa_to_sheet(haftalikSatirlari)
    wsHaftalik['!cols'] = [{ wch: 26 }, ...Array.from({ length: haftaSayisi + 1 }, () => ({ wch: 18 }))]
    XLSX.utils.book_append_sheet(wb, wsHaftalik, 'HAFTALIK')

    // 3) Her personel için ayrı sekme (tüm yıllar, tarih sırasıyla; haftanın ilk satırında HAFTALIK TOPLAM)
    const kullanilanSekmeler = new Set<string>(['özet', 'haftalık', 'genel liste'])
    for (const p of personeller) {
      const satirlar = kayitlarFiltreli
        .filter((k) => k.personelAdi === p)
        .sort((a, b) => a.tarih.localeCompare(b.tarih))
      const haftaToplamlari = new Map<string, number>()
      for (const k of satirlar) {
        const { yil, hafta } = metaAl(k)
        const key = `${yil}-${hafta}`
        haftaToplamlari.set(key, (haftaToplamlari.get(key) ?? 0) + k.tutar)
      }
      const gorulenHafta = new Set<string>()
      const baslik = ['HAFTA', 'TARİH', 'AÇIKLAMA', 'ŞANTİYE', 'TUTAR', 'DURUM', 'ÖDEME TARİHİ', 'HAFTALIK TOPLAM']
      const veri: (string | number)[][] = [[p], baslik]
      for (const k of satirlar) {
        const { yil, hafta } = metaAl(k)
        const key = `${yil}-${hafta}`
        const ilk = !gorulenHafta.has(key)
        gorulenHafta.add(key)
        veri.push([
          hafta,
          new Date(k.tarih).toLocaleDateString('tr-TR', { timeZone: 'UTC' }),
          k.aciklama ?? '',
          k.santiyeAdi ?? 'Genel',
          k.tutar,
          k.odendi ? 'Ödendi' : 'Bekliyor',
          k.odemeTarihi ? new Date(k.odemeTarihi).toLocaleDateString('tr-TR', { timeZone: 'UTC' }) : '',
          ilk ? haftaToplamlari.get(key) ?? 0 : '',
        ])
      }
      const toplam = satirlar.reduce((a, k) => a + k.tutar, 0)
      const odenen = satirlar.filter((k) => k.odendi).reduce((a, k) => a + k.tutar, 0)
      veri.push([])
      veri.push(['', '', 'TOPLAM', '', toplam])
      veri.push(['', '', 'ÖDENEN', '', odenen])
      veri.push(['', '', 'KALAN', '', toplam - odenen])
      const ws = XLSX.utils.aoa_to_sheet(veri)
      ws['!cols'] = [{ wch: 8 }, { wch: 12 }, { wch: 40 }, { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 16 }]
      XLSX.utils.book_append_sheet(wb, ws, excelSekmeAdi(p, kullanilanSekmeler))
    }

    // 4) Genel Liste: tarih x personel
    const genelListeSatirlari = tarihMatrisi.map((g) => {
      const satir: Record<string, string | number> = { Tarih: new Date(g.tarih).toLocaleDateString('tr-TR', { timeZone: 'UTC' }) }
      personeller.forEach((p) => { satir[p] = g.personelToplam.get(p) ?? '' })
      satir['Toplam'] = g.genelToplam
      satir['Kesişen Kişi Sayısı'] = g.kisiSayisi
      return satir
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(genelListeSatirlari), 'Genel Liste')

    XLSX.writeFile(wb, `personel-harcamalari-${aktifYil}.xlsx`)
  }

  const personelSekmesineGit = (p: string) => {
    setAktifPersonel(p)
    setTimeout(() => personelBolumuRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  if (locked === null || (locked === false && loading && kayitlar.length === 0)) {
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

  const bosVeri = kayitlarFiltreli.length === 0
  const colSayisi = 5 + (aktifPersonel === TUMU ? 1 : 0) + (santiyeSutunuVar ? 1 : 0) + (bolgeSutunuVar ? 1 : 0)

  return (
    <div className="space-y-5">
      {/* Araç çubuğu */}
      <Card>
        <CardContent className="p-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-2 flex-wrap items-center">
            <Select value={santiyeFiltresi} onValueChange={setSantiyeFiltresi}>
              <SelectTrigger className="w-auto min-w-[10rem] h-9">
                <Building2 className="h-3.5 w-3.5 mr-1 shrink-0" />
                <SelectValue placeholder="Şantiye" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TUMU}>Tüm Şantiyeler</SelectItem>
                <SelectItem value={GENEL}>Genel (şantiyesiz)</SelectItem>
                {santiyeler.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.ad}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {yillar.length > 1 && (
              <Select value={String(aktifYil)} onValueChange={(v) => { setYilSecimi(Number(v)); setHaftaSecimi(null) }}>
                <SelectTrigger className="w-auto min-w-[6rem] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yillar.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Button size="sm" variant="outline" onClick={() => { aktarimiSifirla(); setAktarimAcik(true) }}>
              <Upload className="h-3.5 w-3.5 mr-1" /> Excel'den Aktar
            </Button>
            {!bosVeri && (
              <Button size="sm" variant="outline" onClick={handleExcelExport}>
                <Download className="h-3.5 w-3.5 mr-1" /> Excel'e İndir
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleLock}>
              <LockKeyhole className="h-3.5 w-3.5 mr-1" /> Kilitle
            </Button>
            <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={() => openNew(aktifPersonel)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Harcama Ekle
            </Button>
          </div>
        </CardContent>
      </Card>

      {bosVeri ? (
        <Card>
          <CardContent className="py-14 text-center space-y-3">
            <Receipt className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground">
              {kayitlar.length === 0
                ? 'Henüz personel harcaması girilmemiş. Mevcut Excel tablonu "Excel\'den Aktar" ile tek seferde yükleyebilirsin.'
                : 'Bu filtrede henüz personel harcaması yok.'}
            </p>
            {kayitlar.length === 0 && (
              <Button variant="outline" onClick={() => { aktarimiSifirla(); setAktarimAcik(true) }}>
                <Upload className="h-4 w-4 mr-1" /> Excel'den Aktar
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 1) Özet kartları */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <OzetKart
              baslik={`${aktifYil} Yıllık Toplam Harcama`}
              deger={formatTL(yillikToplam)}
              alt={`${kayitlarYil.length} kayıt · ${personeller.length} personel`}
              ikon={<Wallet className="h-5 w-5" />}
              renk="bg-blue-500/10 text-blue-600 dark:text-blue-400"
            />
            <OzetKart
              baslik={`${aktifHafta}. Hafta Harcaması`}
              deger={formatTL(seciliHaftaToplam)}
              alt={haftaAraligiEtiketi(aktifYil, aktifHafta)}
              ikon={<CalendarRange className="h-5 w-5" />}
              renk="bg-purple-500/10 text-purple-600 dark:text-purple-400"
            />
            <OzetKart
              baslik="Personele Ödenen"
              deger={formatTL(yillikOdenen)}
              alt={yillikToplam ? `Toplamın %${Math.round((yillikOdenen / yillikToplam) * 100)}'i` : undefined}
              ikon={<CheckCircle2 className="h-5 w-5" />}
              renk="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            />
            <OzetKart
              baslik="Ödenecek (Kalan)"
              deger={formatTL(yillikKalan)}
              alt="Henüz ödenmemiş harcamalar"
              ikon={<Clock className="h-5 w-5" />}
              renk="bg-amber-500/10 text-amber-600 dark:text-amber-400"
            />
          </div>

          {/* 2) ÖZET: seçilen hafta + yıllık toplam */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="font-semibold flex items-center gap-2"><CalendarRange className="h-4 w-4" /> Haftalık Özet</h4>
                <div className="flex items-center gap-1.5">
                  <Button size="icon" variant="outline" className="h-8 w-8" disabled={aktifHafta <= 1} onClick={() => setHaftaSecimi(aktifHafta - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Select value={String(aktifHafta)} onValueChange={(v) => setHaftaSecimi(Number(v))}>
                    <SelectTrigger className="h-8 min-w-[13rem]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {Array.from({ length: haftaSayisi }, (_, i) => i + 1).map((h) => (
                        <SelectItem key={h} value={String(h)}>
                          {h}. Hafta · {haftaAraligiEtiketi(aktifYil, h)}
                          {haftalikMatris.genel[h] ? ` · ${formatTL(haftalikMatris.genel[h])}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="outline" className="h-8 w-8" disabled={aktifHafta >= haftaSayisi} onClick={() => setHaftaSecimi(aktifHafta + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b bg-muted/40">
                      <th className="py-2 px-3">Personel</th>
                      <th className="py-2 px-3 text-right whitespace-nowrap">{aktifHafta}. Hafta</th>
                      <th className="py-2 px-3 text-right whitespace-nowrap">{aktifYil} Yıllık Toplam</th>
                      <th className="py-2 px-3 text-right whitespace-nowrap">Ödenen</th>
                      <th className="py-2 px-3 text-right whitespace-nowrap">Kalan</th>
                      <th className="py-2 px-3 w-40 hidden md:table-cell">Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personeller.map((p) => {
                      const renk = renkAl(p)
                      const y = personelYillik.get(p) ?? { toplam: 0, odenen: 0 }
                      const haftaDegeri = haftalikMatris.satirlar.get(p)?.[aktifHafta] ?? 0
                      return (
                        <tr key={p} className="border-b last:border-0 cursor-pointer hover:bg-muted/30" onClick={() => personelSekmesineGit(p)}>
                          <td className="py-2 px-3">
                            <span className="inline-flex items-center gap-1.5 font-medium">
                              <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${renk.dot}`} />
                              <span className={renk.text}>{p}</span>
                            </span>
                          </td>
                          <td className={`py-2 px-3 text-right whitespace-nowrap ${haftaDegeri ? 'font-semibold' : 'text-muted-foreground'}`}>
                            {haftaDegeri ? formatTL(haftaDegeri) : '-'}
                          </td>
                          <td className="py-2 px-3 text-right whitespace-nowrap font-semibold">{formatTL(y.toplam)}</td>
                          <td className="py-2 px-3 text-right whitespace-nowrap text-emerald-600 dark:text-emerald-400">{y.odenen ? formatTL(y.odenen) : '-'}</td>
                          <td className={`py-2 px-3 text-right whitespace-nowrap ${y.toplam - y.odenen > 0 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground'}`}>
                            {y.toplam - y.odenen > 0 ? formatTL(y.toplam - y.odenen) : '-'}
                          </td>
                          <td className="py-2 px-3 hidden md:table-cell">
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${Math.max(2, (y.toplam / enBuyukYillik) * 100)}%`, backgroundColor: `rgb(${renk.rgb})` }}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold bg-muted/40">
                      <td className="py-2 px-3">GENEL TOPLAM</td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">{formatTL(seciliHaftaToplam)}</td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">{formatTL(yillikToplam)}</td>
                      <td className="py-2 px-3 text-right whitespace-nowrap text-emerald-600 dark:text-emerald-400">{formatTL(yillikOdenen)}</td>
                      <td className="py-2 px-3 text-right whitespace-nowrap text-amber-600 dark:text-amber-400">{formatTL(yillikKalan)}</td>
                      <td className="hidden md:table-cell" />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">Bir personelin satırına tıklayınca o kişinin harcama sayfası açılır.</p>
            </CardContent>
          </Card>

          {/* 3) HAFTALIK: personel x tüm haftalar */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h4 className="font-semibold flex items-center gap-2"><Table2 className="h-4 w-4" /> {aktifYil} — Haftalık Harcama Tablosu ({haftaSayisi} hafta)</h4>
              <div className="overflow-x-auto rounded-lg border">
                <table className="text-sm border-collapse">
                  <thead>
                    <tr className="text-muted-foreground border-b bg-muted/40">
                      <th className="py-2 px-3 text-left sticky left-0 z-10 bg-muted min-w-[11rem]">Personel</th>
                      {Array.from({ length: haftaSayisi }, (_, i) => i + 1).map((h) => (
                        <th
                          key={h}
                          className={`py-1.5 px-2 text-right whitespace-nowrap cursor-pointer min-w-[5.5rem] ${h === aktifHafta ? 'bg-secondary/15 text-foreground' : ''}`}
                          onClick={() => setHaftaSecimi(h)}
                          title="Bu haftayı özet kartlarında göster"
                        >
                          <div className="font-semibold">{h}. Hafta</div>
                          <div className="font-normal text-[10px] text-muted-foreground">{haftaAraligiEtiketi(aktifYil, h)}</div>
                        </th>
                      ))}
                      <th className="py-2 px-3 text-right whitespace-nowrap sticky right-0 z-10 bg-muted">TOPLAM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personeller.map((p) => {
                      const renk = renkAl(p)
                      const satir = haftalikMatris.satirlar.get(p) ?? []
                      const satirMax = personelHaftaMax.get(p) ?? 0
                      return (
                        <tr key={p} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="py-2 px-3 sticky left-0 z-10 bg-background cursor-pointer" onClick={() => personelSekmesineGit(p)}>
                            <span className="inline-flex items-center gap-1.5 font-medium whitespace-nowrap">
                              <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${renk.dot}`} />
                              <span className={renk.text}>{p}</span>
                            </span>
                          </td>
                          {Array.from({ length: haftaSayisi }, (_, i) => i + 1).map((h) => {
                            const v = satir[h] ?? 0
                            return (
                              <td
                                key={h}
                                className={`py-2 px-2 text-right whitespace-nowrap ${v ? 'font-medium' : 'text-muted-foreground/40'} ${h === aktifHafta ? 'border-x border-secondary/40' : ''}`}
                                style={isiHaritasiStili(v, satirMax, renk.rgb)}
                              >
                                {v ? formatTL(v) : '·'}
                              </td>
                            )
                          })}
                          <td className="py-2 px-3 text-right whitespace-nowrap font-semibold sticky right-0 z-10 bg-background">
                            {formatTL(personelYillik.get(p)?.toplam ?? 0)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold bg-muted/40">
                      <td className="py-2 px-3 sticky left-0 z-10 bg-muted">GENEL TOPLAM</td>
                      {Array.from({ length: haftaSayisi }, (_, i) => i + 1).map((h) => (
                        <td key={h} className={`py-2 px-2 text-right whitespace-nowrap ${h === aktifHafta ? 'border-x border-secondary/40' : ''}`}>
                          {haftalikMatris.genel[h] ? formatTL(haftalikMatris.genel[h]) : '·'}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right whitespace-nowrap sticky right-0 z-10 bg-muted">{formatTL(yillikToplam)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">Renk koyuluğu, kişinin kendi en yüksek haftasına göre harcama yoğunluğunu gösterir. Hafta başlığına tıklayınca yukarıdaki özet o haftaya geçer.</p>
            </CardContent>
          </Card>

          {/* 4) Personel bazlı harcama sayfaları */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div ref={personelBolumuRef} className="scroll-mt-4 flex items-center justify-between flex-wrap gap-2">
                <h4 className="font-semibold flex items-center gap-2"><UserRound className="h-4 w-4" /> Personel Bazlı Harcamalar</h4>
              </div>
              <Tabs value={aktifPersonel} onValueChange={setAktifPersonel}>
                <TabsList className="flex-wrap h-auto">
                  <TabsTrigger value={TUMU}>Tümü</TabsTrigger>
                  {personeller.map((p) => {
                    const renk = renkAl(p)
                    return (
                      <TabsTrigger key={p} value={p} className="gap-1.5">
                        <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${renk.dot}`} />
                        <span className={aktifPersonel === p ? renk.text : ''}>{p}</span>
                        <span className="ml-1 text-xs text-muted-foreground">{formatTL(personelGenelToplam.get(p) ?? 0)}</span>
                      </TabsTrigger>
                    )
                  })}
                </TabsList>

                <TabsContent value={aktifPersonel} className="mt-3 space-y-3">
                  {/* Sekme özeti */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex flex-wrap gap-2 text-sm">
                      <span className="rounded-full bg-muted px-3 py-1">Toplam: <b>{formatTL(aktifOzet.toplam)}</b></span>
                      <span className="rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-3 py-1">Ödenen: <b>{formatTL(aktifOzet.odenen)}</b></span>
                      <span className="rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 px-3 py-1">Kalan: <b>{formatTL(aktifOzet.kalan)}</b></span>
                      <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">{aktifOzet.adet} kayıt</span>
                    </div>
                    <div className="flex gap-2">
                      {aktifBekleyenIds.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => odemeDialoguAc(aktifBekleyenIds, aktifPersonel === TUMU ? 'Tüm bekleyen harcamalar' : `${aktifPersonel} — tüm bekleyen harcamalar`)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Bekleyenleri Ödendi Yap ({aktifBekleyenIds.length})
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => openNew(aktifPersonel)}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> {aktifPersonel === TUMU ? 'Harcama Ekle' : `${aktifPersonel} için Harcama Ekle`}
                      </Button>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b bg-muted/40">
                          <th className="py-2 px-2">Tarih</th>
                          {aktifPersonel === TUMU && <th className="py-2 px-2">Personel</th>}
                          {santiyeSutunuVar && <th className="py-2 px-2">Şantiye</th>}
                          {bolgeSutunuVar && <th className="py-2 px-2">Bölge</th>}
                          <th className="py-2 px-2">Açıklama</th>
                          <th className="py-2 px-2 text-right">Tutar</th>
                          <th className="py-2 px-2">Durum</th>
                          <th className="py-2 px-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {aktifHaftaGruplari.length === 0 ? (
                          <tr>
                            <td colSpan={colSayisi} className="py-4 text-center text-muted-foreground">Kayıt yok</td>
                          </tr>
                        ) : (
                          aktifHaftaGruplari.map((hg) => (
                            <Fragment key={hg.key}>
                              {/* Hafta başlığı: Excel'deki "HAFTA / HAFTALIK TOPLAM" karşılığı */}
                              <tr className="bg-muted/60 border-t-2 border-t-border">
                                <td colSpan={colSayisi - 1} className="py-1.5 px-2">
                                  <span className="font-semibold">{hg.hafta}. Hafta</span>
                                  <span className="text-xs text-muted-foreground ml-2">{haftaAraligiEtiketi(hg.yil, hg.hafta)} · {hg.adet} kayıt</span>
                                </td>
                                <td className="py-1.5 px-2 text-right whitespace-nowrap">
                                  <span className="text-xs text-muted-foreground mr-2">Haftalık toplam</span>
                                  <span className="font-semibold">{formatTL(hg.toplam)}</span>
                                  {hg.kalan > 0 && hg.kalan !== hg.toplam && (
                                    <span className="block text-[11px] text-amber-600 dark:text-amber-400">Kalan {formatTL(hg.kalan)}</span>
                                  )}
                                </td>
                              </tr>
                              {hg.gunler.map((grup) => (
                                <Fragment key={hg.key + grup.tarih}>
                                  {grup.kayitlar.map((k, ki) => (
                                    <tr
                                      key={k.id}
                                      className={`group border-b ${grup.kayitlar.length > 1 ? 'bg-secondary/[0.04]' : ''}`}
                                    >
                                      {ki === 0 && (
                                        <td rowSpan={grup.kayitlar.length} className="py-2 px-2 align-top border-r whitespace-nowrap">
                                          <div className="flex flex-col gap-1">
                                            <SafeDate date={k.tarih} />
                                            {grup.kayitlar.length > 1 && (
                                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 w-fit border-secondary/50 text-secondary">
                                                {grup.kayitlar.length} kayıt
                                              </Badge>
                                            )}
                                          </div>
                                        </td>
                                      )}
                                      {aktifPersonel === TUMU && (
                                        <td className="py-2 px-2 font-medium whitespace-nowrap">
                                          <span className="inline-flex items-center gap-1.5">
                                            <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${renkAl(k.personelAdi).dot}`} />
                                            <span className={renkAl(k.personelAdi).text}>{k.personelAdi}</span>
                                          </span>
                                        </td>
                                      )}
                                      {santiyeSutunuVar && (
                                        <td className="py-2 px-2">
                                          {k.santiyeAdi ? (
                                            <span className="inline-flex text-xs bg-muted rounded-full px-2 py-0.5 whitespace-nowrap">{k.santiyeAdi}</span>
                                          ) : (
                                            <span className="text-xs text-muted-foreground">Genel</span>
                                          )}
                                        </td>
                                      )}
                                      {bolgeSutunuVar && <td className="py-2 px-2">{k.bolge ?? '-'}</td>}
                                      <td className="py-2 px-2">{k.aciklama ?? '-'}</td>
                                      <td className="py-2 px-2 text-right font-medium whitespace-nowrap">{formatTL(k.tutar)}</td>
                                      <td className="py-2 px-2 whitespace-nowrap">
                                        {k.odendi ? (
                                          <button type="button" onClick={() => odemeyiGeriAl(k)} title="Ödendi işaretini kaldır" className="inline-flex">
                                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 gap-1 cursor-pointer">
                                              <CheckCircle2 className="h-3 w-3" /> Ödendi
                                              {k.odemeTarihi && <span className="font-normal opacity-90">· <SafeDate date={k.odemeTarihi} /></span>}
                                            </Badge>
                                          </button>
                                        ) : (
                                          <button type="button" onClick={() => odemeDialoguAc([k.id], `${k.personelAdi} — ${k.aciklama ?? 'harcama'}`)} title="Ödendi olarak işaretle" className="inline-flex">
                                            <Badge variant="outline" className="gap-1 cursor-pointer text-muted-foreground hover:text-foreground">
                                              <Clock className="h-3 w-3" /> Bekliyor
                                            </Badge>
                                          </button>
                                        )}
                                      </td>
                                      <td className="py-2 px-2">
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                                          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(k)}><Pencil className="h-3.5 w-3.5" /></Button>
                                          <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(k.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                  {grup.kayitlar.length > 1 && (
                                    <tr className="bg-secondary/10 border-b">
                                      <td colSpan={colSayisi - 4} className="py-1 px-2 text-right text-xs text-muted-foreground italic">
                                        Gün toplamı
                                      </td>
                                      <td className="py-1 px-2 text-right text-sm font-semibold whitespace-nowrap">{formatTL(grup.toplam)}</td>
                                      <td colSpan={2} />
                                    </tr>
                                  )}
                                </Fragment>
                              ))}
                              {hg.bekleyenIds.length > 0 && (
                                <tr className="border-b">
                                  <td colSpan={colSayisi} className="py-1 px-2 text-right">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs"
                                      onClick={() => odemeDialoguAc(hg.bekleyenIds, `${hg.hafta}. hafta (${haftaAraligiEtiketi(hg.yil, hg.hafta)}) bekleyen harcamaları`)}
                                    >
                                      <CheckCircle2 className="h-3 w-3 mr-1" /> Bu haftanın bekleyenlerini ödendi yap ({hg.bekleyenIds.length})
                                    </Button>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          ))
                        )}
                      </tbody>
                      {aktifKayitlar.length > 0 && (
                        <tfoot>
                          <tr className="font-semibold bg-muted/40">
                            <td colSpan={colSayisi - 3} className="py-2 px-2 text-right">Genel Toplam</td>
                            <td className="py-2 px-2 text-right whitespace-nowrap">{formatTL(aktifOzet.toplam)}</td>
                            <td colSpan={2} />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* 5) Genel Liste — tarih x personel, kesişenleri işaretle (açılır/kapanır) */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <button
                type="button"
                onClick={() => setGenelListeAcik((v) => !v)}
                className="w-full flex items-center justify-between"
              >
                <h4 className="font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Genel Liste — Aynı Gün Kimler Harcamış ({aktifYil})</h4>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  {genelListeAcik ? 'Gizle' : 'Göster'}
                  {genelListeAcik ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </span>
              </button>
              {genelListeAcik && (
                <>
                  <div className="overflow-x-auto rounded-lg border max-h-[32rem] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10">
                        <tr className="text-left text-muted-foreground border-b bg-muted">
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
                            <td className="py-2 px-2 whitespace-nowrap"><SafeDate date={g.tarih} /></td>
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
                    "Kesişen" sütunu, aynı tarihte birden fazla personelin harcama girdiği günleri işaretler — rozete tıklayınca kimin ne harcadığını görebilirsin.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Kesişen gün detayı: o tarihte kim, nerede, ne kadar harcamış */}
      <Dialog open={!!kesisenDetayTarih} onOpenChange={(open) => !open && setKesisenDetayTarih(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {kesisenDetayTarih && <SafeDate date={kesisenDetayTarih} />} — Kim Ne Harcamış
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b bg-muted/40">
                  <th className="py-2 px-2">Personel</th>
                  <th className="py-2 px-2">Açıklama</th>
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
                    <td className="py-2 px-2">{k.aciklama ?? '-'}{k.santiyeAdi ? ` · ${k.santiyeAdi}` : ''}</td>
                    <td className="py-2 px-2 text-right font-medium">{formatTL(k.tutar)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={2} className="py-2 px-2 text-right">Toplam</td>
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

      {/* Toplu "Ödendi" işaretleme */}
      <Dialog open={!!odemeIslem} onOpenChange={(open) => !open && setOdemeIslem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ödendi Olarak İşaretle</DialogTitle>
            <DialogDescription>
              {odemeIslem?.baslik} — {odemeIslem?.ids.length} kayıt
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>Ödeme Tarihi</Label>
            <Input type="date" value={odemeTarihiForm} onChange={(e) => setOdemeTarihiForm(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOdemeIslem(null)}>Vazgeç</Button>
            <Button onClick={handleOdemeOnayla} disabled={odemeKaydediliyor} className="bg-emerald-600 text-white hover:bg-emerald-700">
              {odemeKaydediliyor ? 'Kaydediliyor...' : 'Ödendi Yap'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excel'den toplu aktarım */}
      <Dialog open={aktarimAcik} onOpenChange={(open) => { setAktarimAcik(open); if (!open) aktarimiSifirla() }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Excel'den Personel Harcamalarını Aktar</DialogTitle>
            <DialogDescription>
              "PERSONEL HAFTALIK HARCAMA TABLOSU" gibi, her personelin kendi sekmesinde TARİH / AÇIKLAMA / TUTAR (varsa ÖDENEN / ÖDEME TARİHİ)
              sütunları olan dosyayı seç. ÖZET, ANASAYFA ve HAFTALIK sekmeleri otomatik atlanır. Aynı dosya tekrar yüklenirse zaten kayıtlı satırlar eklenmez.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Excel dosyası (.xlsx)</Label>
              <Input type="file" accept=".xlsx,.xls" onChange={handleAktarimDosya} disabled={aktarimYukleniyor} />
              {aktarimDosyaAdi && <p className="text-xs text-muted-foreground">{aktarimDosyaAdi}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Bu harcamalar hangi şantiyeye ait?</Label>
              <Select value={aktarimSantiye} onValueChange={setAktarimSantiye}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={GENEL}>Genel (şantiyesiz — hiçbir Proje Maliyeti'ne yansımaz)</SelectItem>
                  {santiyeler.map((s) => <SelectItem key={s.id} value={s.id}>{s.ad}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Sonradan her kaydı tek tek düzenleyip farklı şantiyeye bağlayabilirsin.</p>
            </div>

            {aktarimYukleniyor && !aktarimOkuma && <div className="h-16 bg-muted animate-pulse rounded-lg" />}
            {aktarimHata && <p className="text-destructive text-sm">{aktarimHata}</p>}

            {aktarimOkuma && (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b bg-muted/40">
                        <th className="py-2 px-2">Personel (sekme)</th>
                        <th className="py-2 px-2 text-right">Kayıt</th>
                        <th className="py-2 px-2 text-right">Toplam</th>
                        <th className="py-2 px-2 text-right">Ödenen</th>
                        <th className="py-2 px-2 text-right">Kalan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aktarimKisiOzeti.map((o) => (
                        <tr key={o.ad} className="border-b last:border-0">
                          <td className="py-1.5 px-2 font-medium">{o.ad}</td>
                          <td className="py-1.5 px-2 text-right">{o.kayit}</td>
                          <td className="py-1.5 px-2 text-right">{formatTL(o.toplam)}</td>
                          <td className="py-1.5 px-2 text-right text-emerald-600 dark:text-emerald-400">{o.odenen ? formatTL(o.odenen) : '-'}</td>
                          <td className="py-1.5 px-2 text-right text-amber-600 dark:text-amber-400">{o.toplam - o.odenen ? formatTL(o.toplam - o.odenen) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-semibold bg-muted/40">
                        <td className="py-2 px-2">DOSYADAKİ TOPLAM</td>
                        <td className="py-2 px-2 text-right">{aktarimOkuma.kayitlar.length}</td>
                        <td className="py-2 px-2 text-right">{formatTL(aktarimKisiOzeti.reduce((a, o) => a + o.toplam, 0))}</td>
                        <td className="py-2 px-2 text-right">{formatTL(aktarimKisiOzeti.reduce((a, o) => a + o.odenen, 0))}</td>
                        <td className="py-2 px-2 text-right">{formatTL(aktarimKisiOzeti.reduce((a, o) => a + (o.toplam - o.odenen), 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {aktarimOnizleme && (
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                    <p><b>{aktarimOnizleme.eklenecek}</b> yeni kayıt eklenecek ({formatTL(aktarimOnizleme.toplamTutar)}).</p>
                    {aktarimOnizleme.atlanan > 0 && (
                      <p className="text-muted-foreground">{aktarimOnizleme.atlanan} kayıt sistemde zaten var, tekrar eklenmeyecek.</p>
                    )}
                  </div>
                )}

                {aktarimOkuma.uyarilar.length > 0 && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs space-y-1">
                    <p className="font-medium flex items-center gap-1 text-amber-700 dark:text-amber-400"><AlertTriangle className="h-3.5 w-3.5" /> Dikkat</p>
                    {aktarimOkuma.uyarilar.map((u, i) => <p key={i}>{u}</p>)}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setAktarimAcik(false); aktarimiSifirla() }}>Vazgeç</Button>
            <Button
              onClick={handleAktarimUygula}
              disabled={aktarimYukleniyor || !aktarimOkuma || !aktarimOnizleme || aktarimOnizleme.eklenecek === 0}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
            >
              {aktarimYukleniyor && aktarimOkuma ? 'Aktarılıyor...' : `Aktar${aktarimOnizleme ? ` (${aktarimOnizleme.eklenecek} kayıt)` : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Harcama ekle / düzenle */}
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
                <Input type="number" step="any" value={form.tutar} onChange={(e) => setForm((p) => ({ ...p, tutar: e.target.value }))} />
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
              <Label>Açıklama / Ne İçin</Label>
              <Input value={form.aciklama} onChange={(e) => setForm((p) => ({ ...p, aciklama: e.target.value }))} placeholder="Ör: Yemek, yakıt, malzeme..." />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Şantiye</Label>
                <Select value={form.santiyeId} onValueChange={(v) => setForm((p) => ({ ...p, santiyeId: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={GENEL}>Genel (şantiyesiz)</SelectItem>
                    {santiyeler.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.ad}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Bölge</Label>
                <Input value={form.bolge} onChange={(e) => setForm((p) => ({ ...p, bolge: e.target.value }))} placeholder="Ör: Botaş İşi" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">Şantiye seçersen bu harcama o şantiyenin Proje Maliyeti'ne otomatik yansır.</p>

            <div className="rounded-lg border p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-emerald-600"
                  checked={form.odendi}
                  onChange={(e) => setForm((p) => ({ ...p, odendi: e.target.checked, odemeTarihi: e.target.checked && !p.odemeTarihi ? bugunStr() : p.odemeTarihi }))}
                />
                Personele ödendi
              </label>
              {form.odendi && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Ödeme Tarihi</Label>
                  <Input type="date" value={form.odemeTarihi} onChange={(e) => setForm((p) => ({ ...p, odemeTarihi: e.target.value }))} />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Vazgeç</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
              {saving ? 'Kaydediliyor...' : editId ? 'Güncelle' : 'Ekle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function personelSayilariToplam(map: Map<string, { toplam: number; odenen: number }>, alan: 'toplam' | 'odenen'): number {
  let t = 0
  for (const v of map.values()) t += v[alan]
  return t
}
