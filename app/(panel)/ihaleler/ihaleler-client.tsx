'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Gavel, Plus, Pencil, Trash2, Check, Ban, Download, AlertTriangle,
  Building2, Calendar, Banknote, ShieldCheck, FileText,
} from 'lucide-react'
import * as XLSX from 'xlsx'

interface Ihale {
  id: string
  isAdi: string
  kurum: string
  ihaleKayitNo: string | null
  ihaleGrupNo: string | null
  projeNumarasi: string | null
  yaklasikMaliyet: number | null
  sozlesmeBedeli: number | null
  ekIsBedeli: number | null
  ihaleTarihi: string | null
  sozlesmeTarihi: string | null
  yerTeslimTarihi: string | null
  sozlesmeSuresiGun: number | null
  isBitimTarihi: string | null
  isBitimTarihiRevize: string | null
  sureUzatimBitisTarihi: string | null
  geciciKabulTarihi: string | null
  geciciKabulSayisi: string | null
  kesinKabulTarihi: string | null
  kesinKabulSayisi: string | null
  ilisiksizlikTarihi: string | null
  ilisiksizlikSayisi: string | null
  kesinTeminatMektubu1: number | null
  kesinTeminatMektubu2: number | null
  kesinTeminatMektubuSuresi: string | null
  kesinTeminatSureUzatimi: string | null
  hakedis1: number | null
  hakedis2: number | null
  hakedis3: number | null
  hakedis4: number | null
  hakedisKesin: number | null
  tedasKirimOrani: number | null
  aciklama: string | null
  aktif: boolean
}

const EMPTY_FORM = {
  isAdi: '', kurum: '', ihaleKayitNo: '', ihaleGrupNo: '', projeNumarasi: '',
  yaklasikMaliyet: '', sozlesmeBedeli: '', ekIsBedeli: '',
  ihaleTarihi: '', sozlesmeTarihi: '', yerTeslimTarihi: '', sozlesmeSuresiGun: '',
  isBitimTarihi: '', isBitimTarihiRevize: '', sureUzatimBitisTarihi: '',
  geciciKabulTarihi: '', geciciKabulSayisi: '', kesinKabulTarihi: '', kesinKabulSayisi: '',
  ilisiksizlikTarihi: '', ilisiksizlikSayisi: '',
  kesinTeminatMektubu1: '', kesinTeminatMektubu2: '', kesinTeminatMektubuSuresi: '', kesinTeminatSureUzatimi: '',
  hakedis1: '', hakedis2: '', hakedis3: '', hakedis4: '', hakedisKesin: '',
  tedasKirimOrani: '', aciklama: '',
}

type DurumSeviye = 'yok' | 'gecmis' | 'yakin' | 'iyi'

function durumHesapla(tarihStr: string | null): { seviye: DurumSeviye; metin: string } {
  if (!tarihStr) return { seviye: 'yok', metin: 'Tarih girilmemiş' }
  const bitis = new Date(tarihStr)
  const now = new Date()
  const gunFarki = Math.ceil((bitis.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (gunFarki < 0) return { seviye: 'gecmis', metin: `${Math.abs(gunFarki)} gün önce doldu — SÜRESİ DOLDU` }
  if (gunFarki <= 30) return { seviye: 'yakin', metin: `${gunFarki} gün kaldı` }
  return { seviye: 'iyi', metin: `${gunFarki} gün kaldı` }
}

const seviyeRenk: Record<DurumSeviye, string> = {
  yok: 'bg-muted text-muted-foreground',
  gecmis: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  yakin: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  iyi: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
}

function tarihStr(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('tr-TR')
}

function paraStr(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(n) + ' ₺'
}

function DurumBadge({ tarihStr: t, label }: { tarihStr: string | null; label?: string }) {
  const { seviye, metin } = durumHesapla(t)
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${seviyeRenk[seviye]}`}>
      {seviye === 'gecmis' && <AlertTriangle className="h-3 w-3" />}
      {label && `${label}: `}{t ? `${tarihStr(t)} · ${metin}` : metin}
    </span>
  )
}

// En güncel iş bitim tarihi: süre uzatımı varsa o, yoksa revize tarih, yoksa sözleşmeye göre tarih
function efektifBitisTarihi(i: Pick<Ihale, 'sureUzatimBitisTarihi' | 'isBitimTarihiRevize' | 'isBitimTarihi'>) {
  return i.sureUzatimBitisTarihi || i.isBitimTarihiRevize || i.isBitimTarihi
}

// En güncel teminat mektubu süresi: uzatım varsa o, yoksa asıl süre
function efektifTeminatSuresi(i: Pick<Ihale, 'kesinTeminatSureUzatimi' | 'kesinTeminatMektubuSuresi'>) {
  return i.kesinTeminatSureUzatimi || i.kesinTeminatMektubuSuresi
}

function hesaplaMali(i: Partial<Ihale> | Record<string, any>) {
  // Form state alanları string olarak tutuluyor (controlled input); burada Number()
  // ile çeviriyoruz ki "82019700" + "16403940" gibi uç uca ekleme değil, gerçek
  // toplama yapılsın. Gerçek Ihale nesnelerinde (API'den gelen sayılar) no-op'tur.
  const num = (v: any) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  const sozlesme = num(i.sozlesmeBedeli)
  const ekIs = num(i.ekIsBedeli)
  const toplamSozlesme = sozlesme + ekIs
  const toplamHakedis = num(i.hakedis1) + num(i.hakedis2) + num(i.hakedis3) + num(i.hakedis4) + num(i.hakedisKesin)
  const kalan = toplamSozlesme - toplamHakedis
  const yuzde = toplamSozlesme > 0 ? Math.min(100, Math.max(0, (toplamHakedis / toplamSozlesme) * 100)) : 0
  return { toplamSozlesme, toplamHakedis, kalan, yuzde }
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function NumberField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type="number" step="any" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

function TextField({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <Label>{label}{required && ' *'}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} />
    </div>
  )
}

export function IhalelerClient() {
  const [ihaleler, setIhaleler] = useState<Ihale[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [detay, setDetay] = useState<Ihale | null>(null)

  const set = (k: keyof typeof EMPTY_FORM) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  const fetchIhaleler = useCallback(async () => {
    const res = await fetch('/api/ihaleler')
    if (res.ok) setIhaleler(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchIhaleler() }, [fetchIhaleler])

  const resetForm = () => {
    setForm({ ...EMPTY_FORM })
    setShowForm(false)
    setEditId(null)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const url = editId ? `/api/ihaleler/${editId}` : '/api/ihaleler'
      const method = editId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Hata oluştu')
        return
      }
      resetForm()
      fetchIhaleler()
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (i: Ihale) => {
    setForm({
      isAdi: i.isAdi, kurum: i.kurum,
      ihaleKayitNo: i.ihaleKayitNo || '', ihaleGrupNo: i.ihaleGrupNo || '', projeNumarasi: i.projeNumarasi || '',
      yaklasikMaliyet: i.yaklasikMaliyet?.toString() || '', sozlesmeBedeli: i.sozlesmeBedeli?.toString() || '', ekIsBedeli: i.ekIsBedeli?.toString() || '',
      ihaleTarihi: i.ihaleTarihi?.slice(0, 10) || '', sozlesmeTarihi: i.sozlesmeTarihi?.slice(0, 10) || '', yerTeslimTarihi: i.yerTeslimTarihi?.slice(0, 10) || '',
      sozlesmeSuresiGun: i.sozlesmeSuresiGun?.toString() || '',
      isBitimTarihi: i.isBitimTarihi?.slice(0, 10) || '', isBitimTarihiRevize: i.isBitimTarihiRevize?.slice(0, 10) || '', sureUzatimBitisTarihi: i.sureUzatimBitisTarihi?.slice(0, 10) || '',
      geciciKabulTarihi: i.geciciKabulTarihi?.slice(0, 10) || '', geciciKabulSayisi: i.geciciKabulSayisi || '',
      kesinKabulTarihi: i.kesinKabulTarihi?.slice(0, 10) || '', kesinKabulSayisi: i.kesinKabulSayisi || '',
      ilisiksizlikTarihi: i.ilisiksizlikTarihi?.slice(0, 10) || '', ilisiksizlikSayisi: i.ilisiksizlikSayisi || '',
      kesinTeminatMektubu1: i.kesinTeminatMektubu1?.toString() || '', kesinTeminatMektubu2: i.kesinTeminatMektubu2?.toString() || '',
      kesinTeminatMektubuSuresi: i.kesinTeminatMektubuSuresi?.slice(0, 10) || '', kesinTeminatSureUzatimi: i.kesinTeminatSureUzatimi?.slice(0, 10) || '',
      hakedis1: i.hakedis1?.toString() || '', hakedis2: i.hakedis2?.toString() || '', hakedis3: i.hakedis3?.toString() || '', hakedis4: i.hakedis4?.toString() || '',
      hakedisKesin: i.hakedisKesin?.toString() || '', tedasKirimOrani: i.tedasKirimOrani?.toString() || '', aciklama: i.aciklama || '',
    })
    setEditId(i.id)
    setShowForm(true)
    setError('')
    setDetay(null)
  }

  const handleToggleAktif = async (i: Ihale) => {
    await fetch(`/api/ihaleler/${i.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aktif: !i.aktif }),
    })
    fetchIhaleler()
  }

  const handleDelete = async (i: Ihale) => {
    if (!confirm(`"${i.isAdi}" ihalesini silmek istediğinize emin misiniz?`)) return
    const res = await fetch(`/api/ihaleler/${i.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Silinemedi')
      return
    }
    setDetay(null)
    fetchIhaleler()
  }

  const handleExcelExport = () => {
    const rows = ihaleler.map((i) => {
      const m = hesaplaMali(i)
      return {
        'İşin Adı': i.isAdi,
        'Kurum': i.kurum,
        'İhale Kayıt No': i.ihaleKayitNo || '',
        'İhale Grup No': i.ihaleGrupNo || '',
        'Proje Numarası': i.projeNumarasi || '',
        'Yaklaşık Maliyet': i.yaklasikMaliyet ?? '',
        'Sözleşme Bedeli': i.sozlesmeBedeli ?? '',
        'Ek İş Bedeli': i.ekIsBedeli ?? '',
        'Toplam Sözleşme Bedeli': m.toplamSozlesme,
        'İhale Tarihi': tarihStr(i.ihaleTarihi),
        'Sözleşme Tarihi': tarihStr(i.sozlesmeTarihi),
        'Yer Teslim Tarihi': tarihStr(i.yerTeslimTarihi),
        'Sözleşmeye Göre İşin Süresi (gün)': i.sozlesmeSuresiGun ?? '',
        'Sözleşmeye Göre İş Bitim Tarihi': tarihStr(i.isBitimTarihi),
        'İş Bitim Tarihi (Revize)': tarihStr(i.isBitimTarihiRevize),
        'Süre Uzatımına Göre İş Bitim Tarihi': tarihStr(i.sureUzatimBitisTarihi),
        'Geçici Kabul Tarihi': tarihStr(i.geciciKabulTarihi),
        'Geçici Kabul Sayısı': i.geciciKabulSayisi || '',
        'Kesin Kabul Tarihi': tarihStr(i.kesinKabulTarihi),
        'Kesin Kabul Sayısı': i.kesinKabulSayisi || '',
        'İlişiksizlik Belgesi Tarihi': tarihStr(i.ilisiksizlikTarihi),
        'İlişiksizlik Belgesi Sayısı': i.ilisiksizlikSayisi || '',
        'Kesin Teminat Mektubu 1': i.kesinTeminatMektubu1 ?? '',
        'Kesin Teminat Mektubu 2': i.kesinTeminatMektubu2 ?? '',
        'Kesin Teminat Mektubu Süresi': tarihStr(i.kesinTeminatMektubuSuresi),
        'Kesin Teminat Süre Uzatımı': tarihStr(i.kesinTeminatSureUzatimi),
        'Hakediş 1': i.hakedis1 ?? '',
        'Hakediş 2': i.hakedis2 ?? '',
        'Hakediş 3': i.hakedis3 ?? '',
        'Hakediş 4': i.hakedis4 ?? '',
        'Hakediş Kesin': i.hakedisKesin ?? '',
        'Toplam Hakediş': m.toplamHakedis,
        'Kalan Tutar': m.kalan,
        'Tamamlanma Yüzdesi': `%${m.yuzde.toFixed(1)}`,
        'Tedaş Birim Fiyat Kırım Oranı': i.tedasKirimOrani ?? '',
        'Durum': i.aktif ? 'Aktif' : 'Pasif',
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'İhaleler')
    XLSX.writeFile(wb, 'ihaleler.xlsx')
  }

  const canliMali = useMemo(() => hesaplaMali(form as any), [form])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-secondary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold font-display">İhaleler</h2>
          <p className="text-muted-foreground text-sm">Alınan işlerin mali ve takvim takibi</p>
        </div>
        <div className="flex gap-2">
          {ihaleler.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExcelExport}>
              <Download className="h-4 w-4 mr-1" /> Excel
            </Button>
          )}
          <Button onClick={() => { resetForm(); setShowForm(true) }} className="bg-secondary hover:bg-secondary/90" size="sm">
            <Plus className="h-4 w-4 mr-1" /> Yeni İhale
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="border-secondary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{editId ? 'İhale Düzenle' : 'Yeni İhale Ekle'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Tabs defaultValue="genel">
                <TabsList className="flex-wrap h-auto">
                  <TabsTrigger value="genel"><Building2 className="h-3.5 w-3.5 mr-1" /> Genel</TabsTrigger>
                  <TabsTrigger value="mali"><Banknote className="h-3.5 w-3.5 mr-1" /> Mali</TabsTrigger>
                  <TabsTrigger value="takvim"><Calendar className="h-3.5 w-3.5 mr-1" /> Takvim</TabsTrigger>
                  <TabsTrigger value="teminat"><ShieldCheck className="h-3.5 w-3.5 mr-1" /> Teminat &amp; Hakediş</TabsTrigger>
                </TabsList>

                <TabsContent value="genel" className="space-y-4 pt-2">
                  <div>
                    <Label>İşin Adı *</Label>
                    <Textarea value={form.isAdi} onChange={(e) => set('isAdi')(e.target.value)} placeholder="Kahramanmaraş İli ... Elektrik Hattı Yapım İşi" required rows={2} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <TextField label="Kurum" value={form.kurum} onChange={set('kurum')} placeholder="Kahramanmaraş Çevre, Şehircilik ve İklim Değişikliği" required />
                    <TextField label="İhale Kayıt No" value={form.ihaleKayitNo} onChange={set('ihaleKayitNo')} placeholder="2026/644068" />
                    <TextField label="İhale Grup No" value={form.ihaleGrupNo} onChange={set('ihaleGrupNo')} placeholder="13. Etap" />
                    <TextField label="Proje Numarası" value={form.projeNumarasi} onChange={set('projeNumarasi')} />
                  </div>
                  <div>
                    <Label>Açıklama</Label>
                    <Textarea value={form.aciklama} onChange={(e) => set('aciklama')(e.target.value)} rows={2} />
                  </div>
                </TabsContent>

                <TabsContent value="mali" className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <NumberField label="Yaklaşık Maliyet (₺)" value={form.yaklasikMaliyet} onChange={set('yaklasikMaliyet')} />
                    <NumberField label="Sözleşme Bedeli (₺)" value={form.sozlesmeBedeli} onChange={set('sozlesmeBedeli')} />
                    <NumberField label="Ek İş Bedeli (₺)" value={form.ekIsBedeli} onChange={set('ekIsBedeli')} />
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-sm">
                    Toplam Sözleşme Bedeli (otomatik): <span className="font-semibold">{paraStr(canliMali.toplamSozlesme)}</span>
                  </div>
                  <NumberField label="Tedaş Birim Fiyat Kırım Oranı (%)" value={form.tedasKirimOrani} onChange={set('tedasKirimOrani')} placeholder="Örn: 5 → %5" />
                </TabsContent>

                <TabsContent value="takvim" className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <DateField label="İhale Tarihi" value={form.ihaleTarihi} onChange={set('ihaleTarihi')} />
                    <DateField label="Sözleşme Tarihi" value={form.sozlesmeTarihi} onChange={set('sozlesmeTarihi')} />
                    <DateField label="Yer Teslim Tarihi" value={form.yerTeslimTarihi} onChange={set('yerTeslimTarihi')} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <NumberField label="Sözleşmeye Göre İşin Süresi (gün)" value={form.sozlesmeSuresiGun} onChange={set('sozlesmeSuresiGun')} />
                    <DateField label="Sözleşmeye Göre İş Bitim Tarihi" value={form.isBitimTarihi} onChange={set('isBitimTarihi')} />
                    <DateField label="İş Bitim Tarihi (Revize)" value={form.isBitimTarihiRevize} onChange={set('isBitimTarihiRevize')} />
                  </div>
                  <DateField label="Süre Uzatımına Göre İş Bitim Tarihi" value={form.sureUzatimBitisTarihi} onChange={set('sureUzatimBitisTarihi')} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DateField label="Geçici Kabul Tarihi" value={form.geciciKabulTarihi} onChange={set('geciciKabulTarihi')} />
                    <TextField label="Geçici Kabul Sayısı" value={form.geciciKabulSayisi} onChange={set('geciciKabulSayisi')} />
                    <DateField label="Kesin Kabul Tarihi" value={form.kesinKabulTarihi} onChange={set('kesinKabulTarihi')} />
                    <TextField label="Kesin Kabul Sayısı" value={form.kesinKabulSayisi} onChange={set('kesinKabulSayisi')} />
                    <DateField label="İlişiksizlik Belgesi Tarihi" value={form.ilisiksizlikTarihi} onChange={set('ilisiksizlikTarihi')} />
                    <TextField label="İlişiksizlik Belgesi Sayısı" value={form.ilisiksizlikSayisi} onChange={set('ilisiksizlikSayisi')} />
                  </div>
                </TabsContent>

                <TabsContent value="teminat" className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <NumberField label="Kesin Teminat Mektubu 1 (₺)" value={form.kesinTeminatMektubu1} onChange={set('kesinTeminatMektubu1')} />
                    <NumberField label="Kesin Teminat Mektubu 2 (₺)" value={form.kesinTeminatMektubu2} onChange={set('kesinTeminatMektubu2')} />
                    <DateField label="Kesin Teminat Mektubu Süresi" value={form.kesinTeminatMektubuSuresi} onChange={set('kesinTeminatMektubuSuresi')} />
                    <DateField label="Kesin Teminat Süre Uzatımı" value={form.kesinTeminatSureUzatimi} onChange={set('kesinTeminatSureUzatimi')} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <NumberField label="Hakediş 1 (₺)" value={form.hakedis1} onChange={set('hakedis1')} />
                    <NumberField label="Hakediş 2 (₺)" value={form.hakedis2} onChange={set('hakedis2')} />
                    <NumberField label="Hakediş 3 (₺)" value={form.hakedis3} onChange={set('hakedis3')} />
                    <NumberField label="Hakediş 4 (₺)" value={form.hakedis4} onChange={set('hakedis4')} />
                    <NumberField label="Hakediş Kesin (₺)" value={form.hakedisKesin} onChange={set('hakedisKesin')} />
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                    <div>Toplam Hakediş (otomatik): <span className="font-semibold">{paraStr(canliMali.toplamHakedis)}</span></div>
                    <div>Kalan Tutar (otomatik): <span className="font-semibold">{paraStr(canliMali.kalan)}</span></div>
                    <div>Tamamlanma: <span className="font-semibold">%{canliMali.yuzde.toFixed(1)}</span></div>
                  </div>
                </TabsContent>
              </Tabs>

              {error && <p className="text-destructive text-sm">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={saving} className="bg-secondary hover:bg-secondary/90">
                  {saving ? 'Kaydediliyor...' : editId ? 'Güncelle' : 'Ekle'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>İptal</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {ihaleler.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16 text-muted-foreground">
            <Gavel className="h-10 w-10 mx-auto mb-2 opacity-30" />
            Henüz ihale eklenmemiş
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {ihaleler.map((i) => {
            const m = hesaplaMali(i)
            return (
              <Card
                key={i.id}
                className={`cursor-pointer hover:shadow-md transition-shadow ${!i.aktif ? 'opacity-60' : ''}`}
                onClick={() => setDetay(i)}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm line-clamp-2">{i.isAdi}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{i.kurum}</p>
                      {i.ihaleKayitNo && <p className="text-xs text-muted-foreground">İhale No: {i.ihaleKayitNo}</p>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                      i.aktif ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {i.aktif ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>

                  <div className="text-sm">
                    Toplam Sözleşme Bedeli: <span className="font-semibold">{paraStr(m.toplamSozlesme)}</span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Hakediş İlerlemesi</span>
                      <span>%{m.yuzde.toFixed(1)}</span>
                    </div>
                    <Progress value={m.yuzde} className="h-1.5" />
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <DurumBadge tarihStr={efektifBitisTarihi(i)} label="İş Bitim" />
                    <DurumBadge tarihStr={efektifTeminatSuresi(i)} label="Teminat" />
                  </div>

                  <div className="flex items-center justify-end gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(i)} title="Düzenle">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleAktif(i)} title={i.aktif ? 'Pasif Yap' : 'Aktif Yap'}>
                      {i.aktif ? <Ban className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(i)} title="Sil">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={!!detay} onOpenChange={(open) => { if (!open) setDetay(null) }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detay && (() => {
            const m = hesaplaMali(detay)
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-start gap-2">
                    <Gavel className="h-5 w-5 mt-0.5 shrink-0" />
                    <span>{detay.isAdi}</span>
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-5 pt-2 text-sm">
                  <div className="text-muted-foreground">
                    {detay.kurum}
                    {detay.ihaleKayitNo && ` · İhale No: ${detay.ihaleKayitNo}`}
                    {detay.ihaleGrupNo && ` · ${detay.ihaleGrupNo}`}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <DurumBadge tarihStr={efektifBitisTarihi(detay)} label="İş Bitim" />
                    <DurumBadge tarihStr={efektifTeminatSuresi(detay)} label="Teminat Mektubu" />
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-1.5"><Banknote className="h-4 w-4" /> Mali Durum</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-muted-foreground">
                      <div>Yaklaşık Maliyet</div><div className="text-right text-foreground">{paraStr(detay.yaklasikMaliyet)}</div>
                      <div>Sözleşme Bedeli</div><div className="text-right text-foreground">{paraStr(detay.sozlesmeBedeli)}</div>
                      <div>Ek İş Bedeli</div><div className="text-right text-foreground">{paraStr(detay.ekIsBedeli)}</div>
                      <div className="font-medium">Toplam Sözleşme Bedeli</div><div className="text-right font-medium text-foreground">{paraStr(m.toplamSozlesme)}</div>
                      <div>Toplam Hakediş</div><div className="text-right text-foreground">{paraStr(m.toplamHakedis)}</div>
                      <div className="font-medium">Kalan Tutar</div><div className="text-right font-medium text-foreground">{paraStr(m.kalan)}</div>
                    </div>
                    <div className="mt-2">
                      <Progress value={m.yuzde} className="h-1.5" />
                      <p className="text-xs text-muted-foreground mt-1">%{m.yuzde.toFixed(1)} tamamlandı (hakediş bazlı)</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-1.5"><Calendar className="h-4 w-4" /> Takvim</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-muted-foreground">
                      <div>İhale Tarihi</div><div className="text-right text-foreground">{tarihStr(detay.ihaleTarihi)}</div>
                      <div>Sözleşme Tarihi</div><div className="text-right text-foreground">{tarihStr(detay.sozlesmeTarihi)}</div>
                      <div>Yer Teslim Tarihi</div><div className="text-right text-foreground">{tarihStr(detay.yerTeslimTarihi)}</div>
                      <div>İşin Süresi</div><div className="text-right text-foreground">{detay.sozlesmeSuresiGun ? `${detay.sozlesmeSuresiGun} gün` : '—'}</div>
                      <div>Sözleşmeye Göre Bitim</div><div className="text-right text-foreground">{tarihStr(detay.isBitimTarihi)}</div>
                      <div>Revize Bitim Tarihi</div><div className="text-right text-foreground">{tarihStr(detay.isBitimTarihiRevize)}</div>
                      <div>Süre Uzatımına Göre Bitim</div><div className="text-right text-foreground">{tarihStr(detay.sureUzatimBitisTarihi)}</div>
                      <div>Geçici Kabul</div><div className="text-right text-foreground">{tarihStr(detay.geciciKabulTarihi)}{detay.geciciKabulSayisi ? ` (${detay.geciciKabulSayisi})` : ''}</div>
                      <div>Kesin Kabul</div><div className="text-right text-foreground">{tarihStr(detay.kesinKabulTarihi)}{detay.kesinKabulSayisi ? ` (${detay.kesinKabulSayisi})` : ''}</div>
                      <div>İlişiksizlik Belgesi</div><div className="text-right text-foreground">{tarihStr(detay.ilisiksizlikTarihi)}{detay.ilisiksizlikSayisi ? ` (${detay.ilisiksizlikSayisi})` : ''}</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Teminat Mektubu &amp; Hakedişler</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-muted-foreground">
                      <div>Kesin Teminat Mektubu 1</div><div className="text-right text-foreground">{paraStr(detay.kesinTeminatMektubu1)}</div>
                      <div>Kesin Teminat Mektubu 2</div><div className="text-right text-foreground">{paraStr(detay.kesinTeminatMektubu2)}</div>
                      <div>Hakediş 1 / 2 / 3 / 4</div><div className="text-right text-foreground">{paraStr(detay.hakedis1)} / {paraStr(detay.hakedis2)} / {paraStr(detay.hakedis3)} / {paraStr(detay.hakedis4)}</div>
                      <div>Hakediş Kesin</div><div className="text-right text-foreground">{paraStr(detay.hakedisKesin)}</div>
                      {detay.tedasKirimOrani !== null && <><div>Tedaş Kırım Oranı</div><div className="text-right text-foreground">%{detay.tedasKirimOrani}</div></>}
                    </div>
                  </div>

                  {detay.aciklama && (
                    <div>
                      <h4 className="font-semibold mb-1 flex items-center gap-1.5"><FileText className="h-4 w-4" /> Açıklama</h4>
                      <p className="text-muted-foreground whitespace-pre-wrap">{detay.aciklama}</p>
                    </div>
                  )}

                  <Button variant="outline" size="sm" className="w-full" onClick={() => handleEdit(detay)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Düzenle
                  </Button>
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
