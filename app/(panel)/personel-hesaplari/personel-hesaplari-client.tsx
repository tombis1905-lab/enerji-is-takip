'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Pencil, Trash2, Download, Upload, Lock, Wallet, X } from 'lucide-react'
import { hesapExceliniOku } from '@/lib/personel-hesap-excel'

interface Hesap {
  id: string; ad: string; maas: number | null; iseBaslama: string | null; istenCikis: string | null
  notlar: string | null; aktif: boolean; hakedilen: number; odenen: number; bakiye: number
  hareketSayisi: number; sonHareket: string | null
}
interface Hareket {
  id: string; tarih: string | null; tur: string; aciklama: string | null; hakedilen: number; odenen: number
}

const TURLER: Record<string, string> = {
  DEVIR: 'Devir', MAAS: 'Maaş', AVANS: 'Avans', TAZMINAT: 'Tazminat', ODEME: 'Ödeme', HARCAMA: 'Harcama', DIGER: 'Diğer',
}
const para = (n: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n)
const tarihGoster = (s: string | null) => (s ? s.slice(0, 10).split('-').reverse().join('.') : '—')
const gun = (s: string | null) => (s ? s.slice(0, 10) : '')
const inputCls = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm'

// bakiye = hakedilen − ödenen. Negatif → personel borçlu (Excel'deki "BORÇLU")
function BakiyeYazi({ v }: { v: number }) {
  if (Math.abs(v) < 0.005) return <span>{para(0)}</span>
  return (
    <span className={v < 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-green-700 dark:text-green-400 font-semibold'}>
      {para(Math.abs(v))} <span className="text-xs font-normal">{v < 0 ? 'borçlu' : 'alacaklı'}</span>
    </span>
  )
}

export function PersonelHesaplariClient() {
  const [kilitli, setKilitli] = useState(false)
  const [pin, setPin] = useState('')
  const [pinHata, setPinHata] = useState('')
  const [hesaplar, setHesaplar] = useState<Hesap[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [ara, setAra] = useState('')
  const [secili, setSecili] = useState<string | null>(null)
  const [detay, setDetay] = useState<{ hesap: any; hareketler: Hareket[] } | null>(null)
  const [yeniAcik, setYeniAcik] = useState(false)
  const [yeniForm, setYeniForm] = useState({ ad: '', maas: '', iseBaslama: '' })
  const [hareketForm, setHareketForm] = useState({ id: '', tarih: '', tur: 'ODEME', aciklama: '', hakedilen: '', odenen: '' })
  const [hata, setHata] = useState('')

  // Excel aktarım
  const [impAcik, setImpAcik] = useState(false)
  const [impVeri, setImpVeri] = useState<any[]>([])
  const [impMukerrer, setImpMukerrer] = useState(0)
  const [impOnizleme, setImpOnizleme] = useState<any>(null)
  const [impMesaj, setImpMesaj] = useState('')
  const [impIsleniyor, setImpIsleniyor] = useState(false)
  // Maaş işle
  const [maasAcik, setMaasAcik] = useState(false)
  const [maasAy, setMaasAy] = useState(new Date().toISOString().slice(0, 7))
  const [maasOnizleme, setMaasOnizleme] = useState<any>(null)

  const yukle = useCallback(async () => {
    const res = await fetch('/api/personel-hesap')
    if (res.status === 401) { setKilitli(true); setYukleniyor(false); return }
    if (res.ok) { setKilitli(false); setHesaplar(await res.json()) }
    setYukleniyor(false)
  }, [])
  useEffect(() => { yukle() }, [yukle])

  const detayYukle = useCallback(async (id: string) => {
    const res = await fetch(`/api/personel-hesap/${id}`)
    if (res.ok) { const d = await res.json(); setDetay({ hesap: d, hareketler: d.hareketler }) }
  }, [])
  useEffect(() => { if (secili) detayYukle(secili); else setDetay(null) }, [secili, detayYukle])

  const pinGonder = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/personel-hesap/dogrula', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) })
    if (!res.ok) { setPinHata('PIN hatalı'); setPin(''); return }
    setPin(''); setPinHata(''); setYukleniyor(true); yukle()
  }
  const kilitle = async () => { await fetch('/api/personel-hesap/dogrula', { method: 'DELETE' }); setHesaplar([]); setSecili(null); setKilitli(true) }

  const filtreli = useMemo(() => hesaplar.filter((h) => h.ad.toLocaleLowerCase('tr-TR').includes(ara.toLocaleLowerCase('tr-TR'))), [hesaplar, ara])
  const toplam = useMemo(() => filtreli.reduce((t, h) => ({ hak: t.hak + h.hakedilen, ode: t.ode + h.odenen, bak: t.bak + h.bakiye }), { hak: 0, ode: 0, bak: 0 }), [filtreli])

  const hesapEkle = async () => {
    setHata('')
    const res = await fetch('/api/personel-hesap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(yeniForm) })
    const d = await res.json()
    if (!res.ok) { setHata(d.error || 'Hata'); return }
    setYeniAcik(false); setYeniForm({ ad: '', maas: '', iseBaslama: '' }); yukle(); setSecili(d.id)
  }

  const hareketKaydet = async () => {
    if (!secili) return
    setHata('')
    const body = { ...hareketForm, hesapId: secili }
    const res = await fetch(hareketForm.id ? `/api/personel-hesap/hareket/${hareketForm.id}` : '/api/personel-hesap/hareket', {
      method: hareketForm.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (!res.ok) { setHata((await res.json()).error || 'Hata'); return }
    setHareketForm({ id: '', tarih: '', tur: 'ODEME', aciklama: '', hakedilen: '', odenen: '' })
    detayYukle(secili); yukle()
  }
  const hareketSil = async (id: string) => {
    if (!confirm('Bu hareket silinsin mi?')) return
    await fetch(`/api/personel-hesap/hareket/${id}`, { method: 'DELETE' })
    if (secili) detayYukle(secili)
    yukle()
  }
  const hesapSil = async () => {
    if (!secili || !confirm('Bu personelin hesabı ve TÜM hareketleri silinsin mi?')) return
    await fetch(`/api/personel-hesap/${secili}`, { method: 'DELETE' })
    setSecili(null); yukle()
  }
  const hesapGuncelle = async (alan: string, deger: any) => {
    if (!secili) return
    await fetch(`/api/personel-hesap/${secili}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [alan]: deger }) })
    detayYukle(secili); yukle()
  }

  // ---- Ekstre (yürüyen bakiye)
  const ekstre = useMemo(() => {
    if (!detay) return []
    let b = 0
    return detay.hareketler.map((h) => { b += h.hakedilen - h.odenen; return { ...h, bakiye: b } })
  }, [detay])

  // ---- Excel aktarım
  const dosyaSec = async (file: File) => {
    setImpMesaj(''); setImpOnizleme(null)
    try {
      const { hesaplar: h, mukerrer } = hesapExceliniOku(await file.arrayBuffer(), true)
      if (!h.length) { setImpMesaj('Sayfa bulunamadı. Her sayfada TARİH / AÇIKLAMA / Harcanan-Hakedilen / Alınan-Ödenen başlığı olmalı.'); return }
      setImpVeri(h); setImpMukerrer(mukerrer)
      setImpIsleniyor(true)
      const res = await fetch('/api/personel-hesap/toplu', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hesaplar: h, uygula: false }) })
      const d = await res.json()
      setImpIsleniyor(false)
      if (!res.ok) { setImpMesaj(d.error || 'Hata'); return }
      setImpOnizleme(d)
    } catch (e: any) { setImpIsleniyor(false); setImpMesaj('Dosya okunamadı: ' + (e?.message || '')) }
  }
  const impUygula = async () => {
    setImpIsleniyor(true)
    const res = await fetch('/api/personel-hesap/toplu', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hesaplar: impVeri, uygula: true }) })
    const d = await res.json()
    setImpIsleniyor(false)
    if (!res.ok) { setImpMesaj(d.error || 'Hata'); return }
    setImpMesaj(`${d.yeniHesap} yeni personel, ${d.yeniHareket} hareket eklendi. ${d.atlanan} kayıt zaten vardı.`)
    setImpOnizleme(null); setImpVeri([]); yukle()
  }

  // ---- Maaş işle
  const maasOnizle = async (uygula: boolean) => {
    const res = await fetch('/api/personel-hesap/maas-isle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ay: maasAy, uygula }) })
    const d = await res.json()
    if (!res.ok) { setHata(d.error || 'Hata'); return }
    setMaasOnizleme(d)
    if (uygula) yukle()
  }

  // ---- Excel çıktıları
  const listeExcel = async () => {
    const S = await import('@/lib/excel-stil')
    const wb = await S.yeniKitap()
    const ws = S.sayfaAc(wb, 'Personel Hesapları', [28, 16, 18, 18, 22, 14])
    S.baslikSatiri(ws, 'PERSONEL HESAPLARI', 6)
    S.kolonBasliklari(ws, ['PERSONEL', 'ANLAŞILAN MAAŞ', 'HARCANAN / HAKEDİLEN', 'ALINAN / ÖDENEN', 'BAKİYE', 'DURUM'])
    filtreli.forEach((h, i) => {
      const r = S.veriSatiri(ws, [h.ad, h.maas ?? '', h.hakedilen, h.odenen, h.bakiye, h.bakiye < -0.005 ? 'BORÇLU' : h.bakiye > 0.005 ? 'ALACAKLI' : '-'], i, { paraKolon: [1, 2, 3, 4], solKolon: [0], zebra: true })
      S.renkliYazi(r.getCell(5), h.bakiye < 0 ? S.RENK.kirmizi : S.RENK.yesil)
    })
    S.toplamSatiri(ws, ['GENEL TOPLAM', '', toplam.hak, toplam.ode, toplam.bak, toplam.bak < 0 ? 'BORÇLU' : 'ALACAKLI'], [2, 3, 4])
    await S.indir(wb, `personel-hesaplari-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }
  const ekstreExcel = async () => {
    if (!detay) return
    const S = await import('@/lib/excel-stil')
    const wb = await S.yeniKitap()
    const ws = S.sayfaAc(wb, detay.hesap.ad.slice(0, 30), [14, 14, 52, 18, 18, 20])
    S.baslikSatiri(ws, detay.hesap.ad, 6)
    S.kolonBasliklari(ws, ['TARİH', 'TÜR', 'AÇIKLAMA', 'HARCANAN / HAKEDİLEN', 'ALINAN / ÖDENEN', 'BAKİYE'])
    ekstre.forEach((h, i) => {
      const r = S.veriSatiri(ws, [tarihGoster(h.tarih), TURLER[h.tur] || h.tur, h.aciklama || '', h.hakedilen || '', h.odenen || '', h.bakiye], i, { paraKolon: [3, 4, 5], solKolon: [2], zebra: true })
      S.renkliYazi(r.getCell(6), h.bakiye < 0 ? S.RENK.kirmizi : S.RENK.yesil)
    })
    const hak = ekstre.reduce((t, x) => t + x.hakedilen, 0), ode = ekstre.reduce((t, x) => t + x.odenen, 0)
    S.toplamSatiri(ws, ['', '', 'TOPLAM', hak, ode, hak - ode], [3, 4, 5])
    await S.indir(wb, `${detay.hesap.ad.replace(/[^\p{L}\p{N}]+/gu, '_')}-ekstre.xlsx`)
  }

  if (yukleniyor) return <p className="p-6 text-muted-foreground">Yükleniyor...</p>

  if (kilitli) {
    return (
      <div className="max-w-sm mx-auto mt-16">
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-2 font-semibold"><Lock className="h-4 w-4" /> Personel Hesapları</div>
            <p className="text-sm text-muted-foreground">Bu bölüme girmek için PIN gerekiyor</p>
            <form onSubmit={pinGonder} className="space-y-3">
              <Input type="password" inputMode="numeric" autoFocus value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN" />
              {pinHata && <p className="text-destructive text-sm">{pinHata}</p>}
              <Button type="submit" disabled={!pin} className="w-full bg-secondary hover:bg-secondary/90">Kilidi Aç</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="h-6 w-6" /> Personel Hesapları</h1>
          <p className="text-sm text-muted-foreground">Maaş, avans ve harcama bakiyesi — PIN korumalı. Bakiye = hakedilen − ödenen (eksi ise personel borçlu).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setImpAcik(!impAcik)}><Upload className="h-4 w-4 mr-1" /> Excel'den Aktar</Button>
          <Button variant="outline" size="sm" onClick={() => { setMaasAcik(!maasAcik); setMaasOnizleme(null) }}>Aylık Maaş İşle</Button>
          <Button variant="outline" size="sm" onClick={listeExcel}><Download className="h-4 w-4 mr-1" /> Excel</Button>
          <Button size="sm" className="bg-secondary hover:bg-secondary/90" onClick={() => setYeniAcik(!yeniAcik)}><Plus className="h-4 w-4 mr-1" /> Personel Ekle</Button>
          <Button variant="ghost" size="sm" onClick={kilitle}><Lock className="h-4 w-4 mr-1" /> Kilitle</Button>
        </div>
      </div>

      {hata && <p className="text-destructive text-sm">{hata}</p>}

      {yeniAcik && (
        <Card><CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div><Label>Ad Soyad</Label><input className={inputCls} value={yeniForm.ad} onChange={(e) => setYeniForm({ ...yeniForm, ad: e.target.value })} /></div>
          <div><Label>Anlaşılan Maaş</Label><input type="number" className={inputCls} value={yeniForm.maas} onChange={(e) => setYeniForm({ ...yeniForm, maas: e.target.value })} /></div>
          <div><Label>İşe Başlama</Label><input type="date" className={inputCls} value={yeniForm.iseBaslama} onChange={(e) => setYeniForm({ ...yeniForm, iseBaslama: e.target.value })} /></div>
          <Button onClick={hesapEkle} disabled={!yeniForm.ad.trim()} className="bg-secondary hover:bg-secondary/90">Kaydet</Button>
        </CardContent></Card>
      )}

      {maasAcik && (
        <Card><CardContent className="pt-4 space-y-2">
          <p className="text-xs text-muted-foreground">Anlaşılan maaşı tanımlı tüm aktif personele seçilen ay için "maaş hakedişi" yazar. Aynı ay tekrar işlenirse çoğalmaz.</p>
          <div className="flex flex-wrap items-end gap-2">
            <div><Label>Ay</Label><input type="month" className={inputCls} value={maasAy} onChange={(e) => { setMaasAy(e.target.value); setMaasOnizleme(null) }} /></div>
            <Button variant="outline" size="sm" onClick={() => maasOnizle(false)}>Önizle</Button>
            {maasOnizleme && maasOnizleme.islenecek > 0 && !maasOnizleme.uygulandi && (
              <Button size="sm" className="bg-secondary hover:bg-secondary/90" onClick={() => maasOnizle(true)}>{maasOnizleme.islenecek} kişiye işle ({para(maasOnizleme.toplam)})</Button>
            )}
          </div>
          {maasOnizleme && <p className="text-sm">{maasOnizleme.uygulandi ? 'İşlendi: ' : 'İşlenecek: '}{maasOnizleme.islenecek} kişi · {para(maasOnizleme.toplam)} · zaten işlenmiş/uygun olmayan: {maasOnizleme.zatenVar}</p>}
        </CardContent></Card>
      )}

      {impAcik && (
        <Card className="border-green-300 dark:border-green-900">
          <CardHeader className="pb-2"><CardTitle className="text-base">Excel'den Aktar (2026 HARCAMA VE MAAŞ TAKİP)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Her sayfa bir personel olarak okunur (devir dahil). Tekrar yüklerseniz aynı kayıtlar çoğalmaz; dosyadaki birebir aynı satırlar tek sayılır.</p>
            <input type="file" accept=".xlsx,.xls" className="text-sm" onChange={(e) => { const f = e.target.files?.[0]; if (f) dosyaSec(f); e.target.value = '' }} />
            {impMesaj && <p className="text-sm">{impMesaj}</p>}
            {impOnizleme && (
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded border p-2"><div className="text-xs text-muted-foreground">Personel</div><div className="font-bold">{impOnizleme.hesapSayisi} ({impOnizleme.yeniHesap} yeni)</div></div>
                  <div className="rounded border p-2"><div className="text-xs text-muted-foreground">Eklenecek hareket</div><div className="font-bold">{impOnizleme.yeniHareket}</div></div>
                  <div className="rounded border p-2"><div className="text-xs text-muted-foreground">Zaten var</div><div className="font-bold">{impOnizleme.atlanan}</div></div>
                  <div className="rounded border p-2"><div className="text-xs text-muted-foreground">Dosyada mükerrer</div><div className="font-bold">{impMukerrer} satır atlandı</div></div>
                </div>
                <Button size="sm" disabled={impIsleniyor || impOnizleme.yeniHareket + impOnizleme.yeniHesap === 0} onClick={impUygula} className="bg-secondary hover:bg-secondary/90">
                  {impIsleniyor ? 'Aktarılıyor...' : 'Aktar'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <input className={inputCls + ' max-w-xs'} placeholder="Personel ara..." value={ara} onChange={(e) => setAra(e.target.value)} />
      </div>

      <Card><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-2">Personel</th><th className="p-2 text-right">Maaş</th><th className="p-2 text-right">Hakedilen</th>
              <th className="p-2 text-right">Ödenen</th><th className="p-2 text-right">Bakiye</th><th className="p-2">Son hareket</th>
            </tr>
          </thead>
          <tbody>
            {filtreli.map((h) => (
              <tr key={h.id} onClick={() => setSecili(h.id)} className={`border-t cursor-pointer hover:bg-muted/40 ${!h.aktif ? 'opacity-50' : ''}`}>
                <td className="p-2 font-medium">{h.ad}</td>
                <td className="p-2 text-right">{h.maas ? para(h.maas) : '—'}</td>
                <td className="p-2 text-right">{para(h.hakedilen)}</td>
                <td className="p-2 text-right">{para(h.odenen)}</td>
                <td className="p-2 text-right"><BakiyeYazi v={h.bakiye} /></td>
                <td className="p-2">{tarihGoster(h.sonHareket)}</td>
              </tr>
            ))}
            {filtreli.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Henüz personel yok. "Excel'den Aktar" veya "Personel Ekle" ile başlayın.</td></tr>}
          </tbody>
          {filtreli.length > 0 && (
            <tfoot className="bg-yellow-100 dark:bg-yellow-900/30 font-bold">
              <tr><td className="p-2">GENEL TOPLAM</td><td /><td className="p-2 text-right">{para(toplam.hak)}</td><td className="p-2 text-right">{para(toplam.ode)}</td><td className="p-2 text-right"><BakiyeYazi v={toplam.bak} /></td><td /></tr>
            </tfoot>
          )}
        </table>
      </CardContent></Card>

      {secili && detay && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm overflow-y-auto" onClick={() => setSecili(null)}>
          <div className="max-w-4xl mx-auto my-6 bg-card border rounded-lg shadow-lg p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold">{detay.hesap.ad}</h2>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                  <label className="flex items-center gap-1">Maaş:
                    <input type="number" defaultValue={detay.hesap.maas ?? ''} className="h-7 w-28 rounded border border-input bg-background px-2 text-xs" onBlur={(e) => hesapGuncelle('maas', e.target.value)} />
                  </label>
                  <label className="flex items-center gap-1">İşe başlama:
                    <input type="date" defaultValue={gun(detay.hesap.iseBaslama)} className="h-7 rounded border border-input bg-background px-2 text-xs" onBlur={(e) => hesapGuncelle('iseBaslama', e.target.value || null)} />
                  </label>
                  <label className="flex items-center gap-1">İşten çıkış:
                    <input type="date" defaultValue={gun(detay.hesap.istenCikis)} className="h-7 rounded border border-input bg-background px-2 text-xs" onBlur={(e) => hesapGuncelle('istenCikis', e.target.value || null)} />
                  </label>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={detay.hesap.aktif} onChange={(e) => hesapGuncelle('aktif', e.target.checked)} /> Aktif</label>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={ekstreExcel}><Download className="h-4 w-4 mr-1" /> Ekstre</Button>
                <Button variant="outline" size="sm" onClick={hesapSil}><Trash2 className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => setSecili(null)}><X className="h-4 w-4" /></Button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end rounded border p-2">
              <div><Label className="text-xs">Tarih</Label><input type="date" className={inputCls} value={hareketForm.tarih} onChange={(e) => setHareketForm({ ...hareketForm, tarih: e.target.value })} /></div>
              <div><Label className="text-xs">Tür</Label>
                <select className={inputCls} value={hareketForm.tur} onChange={(e) => setHareketForm({ ...hareketForm, tur: e.target.value })}>
                  {Object.entries(TURLER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div className="col-span-2"><Label className="text-xs">Açıklama</Label><input className={inputCls} value={hareketForm.aciklama} onChange={(e) => setHareketForm({ ...hareketForm, aciklama: e.target.value })} /></div>
              <div><Label className="text-xs">Hakedilen / Harcanan</Label><input type="number" step="0.01" className={inputCls} value={hareketForm.hakedilen} onChange={(e) => setHareketForm({ ...hareketForm, hakedilen: e.target.value })} /></div>
              <div><Label className="text-xs">Ödenen / Alınan</Label><input type="number" step="0.01" className={inputCls} value={hareketForm.odenen} onChange={(e) => setHareketForm({ ...hareketForm, odenen: e.target.value })} /></div>
              <div className="col-span-2 sm:col-span-6 flex gap-2">
                <Button size="sm" className="bg-secondary hover:bg-secondary/90" onClick={hareketKaydet} disabled={!hareketForm.hakedilen && !hareketForm.odenen}>{hareketForm.id ? 'Güncelle' : 'Hareket Ekle'}</Button>
                {hareketForm.id && <Button size="sm" variant="ghost" onClick={() => setHareketForm({ id: '', tarih: '', tur: 'ODEME', aciklama: '', hakedilen: '', odenen: '' })}>Vazgeç</Button>}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left"><tr><th className="p-2">Tarih</th><th className="p-2">Tür</th><th className="p-2">Açıklama</th><th className="p-2 text-right">Hakedilen</th><th className="p-2 text-right">Ödenen</th><th className="p-2 text-right">Bakiye</th><th /></tr></thead>
                <tbody>
                  {ekstre.map((h) => (
                    <tr key={h.id} className="border-t">
                      <td className="p-2 whitespace-nowrap">{tarihGoster(h.tarih)}</td>
                      <td className="p-2">{TURLER[h.tur] || h.tur}</td>
                      <td className="p-2 max-w-[22rem] truncate" title={h.aciklama || ''}>{h.aciklama}</td>
                      <td className="p-2 text-right">{h.hakedilen ? para(h.hakedilen) : ''}</td>
                      <td className="p-2 text-right">{h.odenen ? para(h.odenen) : ''}</td>
                      <td className="p-2 text-right"><BakiyeYazi v={h.bakiye} /></td>
                      <td className="p-2 whitespace-nowrap">
                        <button className="p-1 hover:text-primary" onClick={() => setHareketForm({ id: h.id, tarih: gun(h.tarih), tur: h.tur, aciklama: h.aciklama || '', hakedilen: h.hakedilen ? String(h.hakedilen) : '', odenen: h.odenen ? String(h.odenen) : '' })}><Pencil className="h-4 w-4" /></button>
                        <button className="p-1 hover:text-destructive" onClick={() => hareketSil(h.id)}><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                  {ekstre.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Hareket yok</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
