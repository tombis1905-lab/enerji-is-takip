'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ClipboardList, Calendar, CalendarDays, CalendarRange, TrendingUp, Building2, Layers, MapPin, X, ChevronDown, ChevronUp, Filter, DollarSign, Download } from 'lucide-react'
import { FadeIn } from '@/components/ui/animate'
import dynamic from 'next/dynamic'
import * as XLSX from 'xlsx'

const BarChartComponent = dynamic(() => import('./charts').then(m => m.IsTuruBarChart), { ssr: false, loading: () => <Skeleton className="w-full h-[300px]" /> })
const PieChartComponent = dynamic(() => import('./charts').then(m => m.SantiyePieChart), { ssr: false, loading: () => <Skeleton className="w-full h-[300px]" /> })
const LineChartComponent = dynamic(() => import('./charts').then(m => m.ZamanLineChart), { ssr: false, loading: () => <Skeleton className="w-full h-[300px]" /> })

interface SantiyeKirilimTur {
  ad: string
  birim: string
  toplam: number
  kayitSayisi: number
  isTuruId: string
}

interface SantiyeKirilim {
  santiyeAd: string
  santiyeId: string
  isTurleri: SantiyeKirilimTur[]
}

interface DashboardData {
  toplamKayit: number
  gunlukKayit: number
  haftalikKayit: number
  aylikKayit: number
  isTuruOzetleri: { ad: string; birim: string; toplam: number; kayitSayisi: number }[]
  santiyeOzetleri: { ad: string; kayitSayisi: number; toplamMiktar: number }[]
  santiyeBazliKirilim: SantiyeKirilim[]
  tumSantiyeler: { id: string; ad: string }[]
  tumIsTurleri: { id: string; ad: string; birim: string }[]
  sonKayitlar: any[]
  zamanSerisi: { tarih: string; kayitSayisi: number; toplamMiktar: number }[]
}

interface DetayKayit {
  id: string
  tarih: string
  miktar: number
  aciklama: string | null
  user?: { name: string }
  santiye?: { ad: string }
  isTuru?: { ad: string; birim: string }
}

const BIRIM_RENK: Record<string, string> = {
  'adet': 'text-blue-600 bg-blue-50 border-blue-200',
  'metre': 'text-green-600 bg-green-50 border-green-200',
  'm³': 'text-purple-600 bg-purple-50 border-purple-200',
  'ton': 'text-amber-600 bg-amber-50 border-amber-200',
}

export function DashboardClient({ role }: { role: string }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [seciliSantiye, setSeciliSantiye] = useState<string>('hepsi')

  // Fiyat state: key = "santiyeId-isTuruAd"
  const [fiyatlar, setFiyatlar] = useState<Record<string, number>>({})

  // Excel export
  const handleDashboardExcel = () => {
    if (!data) return
    const rows: any[] = []
    const kirilimlar = seciliSantiye === 'hepsi'
      ? data.santiyeBazliKirilim
      : data.santiyeBazliKirilim.filter((s) => s.santiyeId === seciliSantiye)
    for (const s of kirilimlar) {
      for (const t of s.isTurleri) {
        const key = `${s.santiyeId}-${t.ad}`
        const fiyat = fiyatlar[key] || 0
        rows.push({
          'Şantiye': s.santiyeAd,
          'İş Türü': t.ad,
          'Birim': t.birim,
          'Toplam': t.toplam,
          'Kayıt Sayısı': t.kayitSayisi,
          'Birim Fiyat (₺)': fiyat || '',
          'Maliyet (₺)': fiyat ? t.toplam * fiyat : '',
        })
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'İş Dağılımı')
    XLSX.writeFile(wb, 'santiye_is_dagilimi.xlsx')
  }

  // Detay modal
  const [detayAcik, setDetayAcik] = useState(false)
  const [detayBaslik, setDetayBaslik] = useState('')
  const [detayKayitlar, setDetayKayitlar] = useState<DetayKayit[]>([])
  const [detayLoading, setDetayLoading] = useState(false)

  // Kayıtlar filtre
  const [filtreSantiye, setFiltreSantiye] = useState('')
  const [filtreIsTuru, setFiltreIsTuru] = useState('')
  const [filtreBaslangic, setFiltreBaslangic] = useState('')
  const [filtreBitis, setFiltreBitis] = useState('')
  const [filtreAcik, setFiltreAcik] = useState(false)
  const [filtrelenmisKayitlar, setFiltrelenmisKayitlar] = useState<any[] | null>(null)
  const [filtreLoading, setFiltreLoading] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Fiyatları localStorage'dan yükle
  useEffect(() => {
    try {
      const saved = localStorage.getItem('enerji-fiyatlar')
      if (saved) setFiyatlar(JSON.parse(saved))
    } catch {}
  }, [])

  const fiyatKaydet = useCallback((key: string, value: number) => {
    setFiyatlar(prev => {
      const next = { ...prev, [key]: value }
      try { localStorage.setItem('enerji-fiyatlar', JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const detayGoster = useCallback(async (santiyeId: string, santiyeAd: string, isTuruAd: string, isTuruId: string) => {
    setDetayAcik(true)
    setDetayBaslik(`${santiyeAd} — ${isTuruAd}`)
    setDetayLoading(true)
    setDetayKayitlar([])
    try {
      const res = await fetch(`/api/is-kayitlari?santiyeId=${santiyeId}&isTuruId=${isTuruId}&limit=100`)
      const d = await res.json()
      setDetayKayitlar(d?.kayitlar ?? [])
    } catch {}
    setDetayLoading(false)
  }, [])

  const filtreUygula = useCallback(async () => {
    setFiltreLoading(true)
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (filtreSantiye) params.set('santiyeId', filtreSantiye)
      if (filtreIsTuru) params.set('isTuruId', filtreIsTuru)
      const res = await fetch(`/api/is-kayitlari?${params}`)
      const d = await res.json()
      let kayitlar = d?.kayitlar ?? []
      // Client-side tarih filtresi
      if (filtreBaslangic) {
        const start = new Date(filtreBaslangic)
        kayitlar = kayitlar.filter((k: any) => new Date(k.tarih) >= start)
      }
      if (filtreBitis) {
        const end = new Date(filtreBitis + 'T23:59:59')
        kayitlar = kayitlar.filter((k: any) => new Date(k.tarih) <= end)
      }
      setFiltrelenmisKayitlar(kayitlar)
    } catch {}
    setFiltreLoading(false)
  }, [filtreSantiye, filtreIsTuru, filtreBaslangic, filtreBitis])

  const filtreTemizle = useCallback(() => {
    setFiltreSantiye('')
    setFiltreIsTuru('')
    setFiltreBaslangic('')
    setFiltreBitis('')
    setFiltrelenmisKayitlar(null)
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      </div>
    )
  }

  const stats = [
    { label: 'Toplam Kayıt', value: data?.toplamKayit ?? 0, icon: ClipboardList, color: 'text-blue-600 bg-blue-50' },
    { label: 'Bugün', value: data?.gunlukKayit ?? 0, icon: Calendar, color: 'text-orange-500 bg-orange-50' },
    { label: 'Bu Hafta', value: data?.haftalikKayit ?? 0, icon: CalendarDays, color: 'text-green-600 bg-green-50' },
    { label: 'Bu Ay', value: data?.aylikKayit ?? 0, icon: CalendarRange, color: 'text-purple-600 bg-purple-50' },
  ]

  const sortedOzetler = [...(data?.isTuruOzetleri ?? [])].sort((a, b) => b.toplam - a.toplam)

  // Şantiye ve iş türü listeleri (filtreler için)
  const santiyeListesi = data?.tumSantiyeler ?? []
  const isTuruListesi = data?.tumIsTurleri ?? []

  const gorunenKayitlar = filtrelenmisKayitlar ?? (data?.sonKayitlar ?? [])

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Gösterge Paneli</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {role === 'ADMIN' ? 'Tüm şantiyelerin genel durumu' : 'Kişisel iş kayıtlarınızın özeti'}
          </p>
        </div>
      </FadeIn>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon
          return (
            <FadeIn key={stat.label} delay={i * 0.05}>
              <Card>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl sm:text-3xl font-bold font-mono mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-2 sm:p-3 rounded-lg ${stat.color}`}>
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          )
        })}
      </div>

      {/* İş Türü Özet Kartları */}
      {sortedOzetler.length > 0 && (
        <FadeIn delay={0.1}>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight mb-3 flex items-center gap-2">
              <Layers className="h-5 w-5 text-secondary" />
              İş Türü Özetleri
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {sortedOzetler.map((ozet) => {
                const renkSinifi = BIRIM_RENK[ozet.birim] ?? 'text-gray-600 bg-gray-50 border-gray-200'
                return (
                  <Card key={ozet.ad} className={`border ${renkSinifi.split(' ')[2] ?? 'border-border'}`}>
                    <CardContent className="p-3 sm:p-4">
                      <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate" title={ozet.ad}>{ozet.ad}</p>
                      <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-xl sm:text-2xl font-bold font-mono">{Number(ozet.toplam).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${renkSinifi.split(' ').slice(0, 2).join(' ')}`}>{ozet.birim}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{ozet.kayitSayisi} kayıt</p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Şantiye Bazlı Kırılım */}
      {(data?.santiyeBazliKirilim?.length ?? 0) > 0 && (
        <FadeIn delay={0.12}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg font-semibold tracking-tight flex items-center gap-2">
                <MapPin className="h-5 w-5 text-secondary" />
                Şantiye Bazlı İş Dağılımı
              </h2>
              <Button variant="outline" size="sm" onClick={handleDashboardExcel}>
                <Download className="h-4 w-4 mr-1" /> Excel
              </Button>
            </div>

            {/* Şantiye Seçici */}
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setSeciliSantiye('hepsi')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  seciliSantiye === 'hepsi'
                    ? 'bg-secondary text-secondary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Tüm Şantiyeler
              </button>
              {(data?.santiyeBazliKirilim ?? []).map((s) => (
                <button
                  key={s.santiyeId}
                  onClick={() => setSeciliSantiye(s.santiyeId)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    seciliSantiye === s.santiyeId
                      ? 'bg-secondary text-secondary-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {s.santiyeAd}
                </button>
              ))}
            </div>

            {/* Seçilen Şantiye(ler) Kartları */}
            <div className="space-y-4">
              {(data?.santiyeBazliKirilim ?? [])
                .filter(s => seciliSantiye === 'hepsi' || s.santiyeId === seciliSantiye)
                .map((santiye) => {
                  // Toplam maliyet hesapla
                  const toplamMaliyet = santiye.isTurleri.reduce((sum, tur) => {
                    const key = `${santiye.santiyeId}-${tur.ad}`
                    const fiyat = fiyatlar[key] ?? 0
                    return sum + (tur.toplam * fiyat)
                  }, 0)

                  return (
                    <Card key={santiye.santiyeId} className="border-l-4 border-l-secondary">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base font-medium flex items-center gap-2 flex-wrap">
                          <Building2 className="h-4 w-4 text-secondary" />
                          {santiye.santiyeAd}
                          <span className="text-xs text-muted-foreground font-normal ml-auto">
                            {santiye.isTurleri.reduce((s, t) => s + t.kayitSayisi, 0)} toplam kayıt
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="pb-2 text-left font-medium text-muted-foreground">İş Türü</th>
                                <th className="pb-2 text-right font-medium text-muted-foreground">Toplam</th>
                                <th className="pb-2 text-left font-medium text-muted-foreground pl-2">Birim</th>
                                <th className="pb-2 text-right font-medium text-muted-foreground">Kayıt</th>
                                <th className="pb-2 text-right font-medium text-muted-foreground">B. Fiyat (₺)</th>
                                <th className="pb-2 text-right font-medium text-muted-foreground">Maliyet (₺)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {santiye.isTurleri.map((tur) => {
                                const renkSinifi = BIRIM_RENK[tur.birim] ?? 'text-gray-600 bg-gray-50 border-gray-200'
                                const fiyatKey = `${santiye.santiyeId}-${tur.ad}`
                                const birimFiyat = fiyatlar[fiyatKey] ?? 0
                                const maliyet = tur.toplam * birimFiyat
                                return (
                                  <tr key={tur.ad} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                                    <td className="py-2 font-medium">{tur.ad}</td>
                                    <td className="py-2 text-right font-mono font-bold">
                                      {Number(tur.toplam).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="py-2 pl-2">
                                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${renkSinifi.split(' ').slice(0, 2).join(' ')}`}>
                                        {tur.birim}
                                      </span>
                                    </td>
                                    <td className="py-2 text-right">
                                      <button
                                        onClick={() => detayGoster(santiye.santiyeId, santiye.santiyeAd, tur.ad, tur.isTuruId)}
                                        className="text-secondary hover:underline font-medium cursor-pointer"
                                      >
                                        {tur.kayitSayisi} kayıt
                                      </button>
                                    </td>
                                    <td className="py-2 text-right">
                                      <Input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={birimFiyat || ''}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                          const v = parseFloat(e.target.value)
                                          fiyatKaydet(fiyatKey, isNaN(v) ? 0 : v)
                                        }}
                                        placeholder="0"
                                        className="w-20 sm:w-24 h-7 text-xs text-right font-mono inline-block"
                                      />
                                    </td>
                                    <td className="py-2 text-right font-mono font-bold text-secondary">
                                      {birimFiyat > 0 ? `${maliyet.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺` : '—'}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                        {/* Toplam Maliyet */}
                        {toplamMaliyet > 0 && (
                          <div className="mt-3 pt-3 border-t flex items-center justify-between">
                            <span className="text-sm font-medium flex items-center gap-1.5">
                              <DollarSign className="h-4 w-4 text-secondary" />
                              Toplam Maliyet
                            </span>
                            <span className="text-lg font-bold font-mono text-secondary">
                              {toplamMaliyet.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FadeIn delay={0.15}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-secondary" />
                İş Türü Bazında Toplamlar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <BarChartComponent data={data?.isTuruOzetleri ?? []} />
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.2}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4 text-secondary" />
                Şantiye Dağılımı
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <PieChartComponent data={data?.santiyeOzetleri ?? []} />
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* Time series */}
      <FadeIn delay={0.25}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              Son 30 Gün – Günlük Kayıt Sayısı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <LineChartComponent data={data?.zamanSerisi ?? []} />
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Kayıtlar + Filtre */}
      <FadeIn delay={0.3}>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">Kayıtlar</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFiltreAcik(!filtreAcik)}
                className="gap-1.5"
              >
                <Filter className="h-3.5 w-3.5" />
                Filtre
                {filtreAcik ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            </div>

            {/* Filtre Panel */}
            {filtreAcik && (
              <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Şantiye</label>
                    <select
                      value={filtreSantiye}
                      onChange={(e) => setFiltreSantiye(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Tümü</option>
                      {santiyeListesi.map(s => (
                        <option key={s.id} value={s.id}>{s.ad}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">İş Türü</label>
                    <select
                      value={filtreIsTuru}
                      onChange={(e) => setFiltreIsTuru(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Tümü</option>
                      {isTuruListesi.map(t => (
                        <option key={t.id} value={t.id}>{t.ad} ({t.birim})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Başlangıç Tarihi</label>
                    <Input
                      type="date"
                      value={filtreBaslangic}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFiltreBaslangic(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Bitiş Tarihi</label>
                    <Input
                      type="date"
                      value={filtreBitis}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFiltreBitis(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={filtreUygula} disabled={filtreLoading} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                    {filtreLoading ? 'Yükleniyor...' : 'Filtrele'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={filtreTemizle}>
                    Temizle
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {gorunenKayitlar.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">
                {filtrelenmisKayitlar !== null ? 'Filtreye uygun kayıt bulunamadı.' : 'Henüz kayıt bulunmuyor.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <p className="text-xs text-muted-foreground mb-2">{gorunenKayitlar.length} kayıt gösteriliyor</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium text-muted-foreground">Tarih</th>
                      <th className="pb-2 font-medium text-muted-foreground">Şantiye</th>
                      <th className="pb-2 font-medium text-muted-foreground">İş Türü</th>
                      <th className="pb-2 font-medium text-muted-foreground text-right">Miktar</th>
                      <th className="pb-2 font-medium text-muted-foreground">Birim</th>
                      {role === 'ADMIN' && <th className="pb-2 font-medium text-muted-foreground">Personel</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {gorunenKayitlar.map((k: any, idx: number) => (
                      <tr key={k?.id ?? `row-${idx}`} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="py-2.5 font-mono text-xs">
                          {k?.tarih ? new Date(k.tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                        </td>
                        <td className="py-2.5 font-medium">{k?.santiye?.ad ?? '-'}</td>
                        <td className="py-2.5">{k?.isTuru?.ad ?? '-'}</td>
                        <td className="py-2.5 font-mono font-bold text-right">
                          {Number(k?.miktar ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 text-muted-foreground text-xs">{k?.isTuru?.birim ?? ''}</td>
                        {role === 'ADMIN' && <td className="py-2.5">{k?.user?.name ?? '-'}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Detay Modal */}
      {detayAcik && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDetayAcik(false)}>
          <div
            className="bg-card rounded-lg shadow-lg w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-display font-semibold text-lg">{detayBaslik}</h3>
              <button onClick={() => setDetayAcik(false)} className="p-1 hover:bg-muted rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-auto flex-1 p-4">
              {detayLoading ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-10 rounded" />)}
                </div>
              ) : detayKayitlar.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Kayıt bulunamadı.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium text-muted-foreground">Tarih</th>
                      <th className="pb-2 text-right font-medium text-muted-foreground">Miktar</th>
                      <th className="pb-2 font-medium text-muted-foreground">Birim</th>
                      {role === 'ADMIN' && <th className="pb-2 font-medium text-muted-foreground">Personel</th>}
                      <th className="pb-2 font-medium text-muted-foreground">Açıklama</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detayKayitlar.map((k, idx) => (
                      <tr key={k.id ?? `d-${idx}`} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-2 font-mono text-xs">
                          {new Date(k.tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td className="py-2 text-right font-mono font-bold">
                          {Number(k.miktar).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 text-muted-foreground text-xs">{k.isTuru?.birim ?? ''}</td>
                        {role === 'ADMIN' && <td className="py-2">{k.user?.name ?? '-'}</td>}
                        <td className="py-2 text-muted-foreground text-xs">{k.aciklama ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
