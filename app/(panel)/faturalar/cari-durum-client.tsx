'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Users, Download, Plus, Trash2, ArrowDownCircle, ArrowUpCircle, Pencil, GitMerge } from 'lucide-react'
import * as XLSX from 'xlsx'

interface CariSatir {
  id: string
  ad: string
  ibanBilgisi: string | null
  aciklama: string | null
  kesilenToplam: number
  alinanToplam: number
  tahsilatToplam: number
  odemeToplam: number
  alacak: number
  borc: number
  netBakiye: number
}

interface CariOdeme {
  id: string
  tarih: string
  tutar: number
  yon: 'TAHSILAT' | 'ODEME'
  odemeSekli: string | null
  aciklama: string | null
}

interface CariFatura {
  id: string
  tur: 'KESILEN' | 'ALINAN'
  faturaNo: string | null
  tarih: string
  odemeTarihi: string | null
  aciklama: string | null
  kdvDahilTutar: number
  odemeDurumu: 'BEKLIYOR' | 'ODENDI' | 'GECIKTI'
  cariEklensinMi: boolean
}

// Excele Aktar için: tek istekte tüm carilerin fatura/ödeme geçmişiyle
// birlikte gelen ayrıntılı rapor kaydı (bkz. /api/cariler/rapor).
interface CariRaporFatura {
  tur: 'KESILEN' | 'ALINAN'
  faturaNo: string | null
  tarih: string
  aciklama: string | null
  tutar: number
  kdvDahilTutar: number
  ibanBilgisi: string | null
  odemeDurumu: 'BEKLIYOR' | 'ODENDI' | 'GECIKTI'
  cariEklensinMi: boolean
  sirketAd: string | null
}
interface CariRaporOdeme {
  tarih: string
  tutar: number
  yon: 'TAHSILAT' | 'ODEME'
  odemeSekli: string | null
  aciklama: string | null
}
interface CariRaporSatir extends CariSatir {
  faturalar: CariRaporFatura[]
  odemeler: CariRaporOdeme[]
}

const DURUM_LABEL: Record<CariFatura['odemeDurumu'], string> = {
  BEKLIYOR: 'Bekliyor',
  ODENDI: 'Ödendi',
  GECIKTI: 'Gecikti',
}

const ODEME_SEKLI_SECENEKLERI = ['Nakit', 'Havale/EFT', 'Çek']

function paraStr(n: number) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n) + ' ₺'
}

function tarihStr(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('tr-TR')
}

const EMPTY_ODEME = { tarih: '', tutar: '', yon: 'TAHSILAT' as 'TAHSILAT' | 'ODEME', odemeSekli: 'Nakit', aciklama: '' }
const EMPTY_CARI_FORM = { ad: '', ibanBilgisi: '', aciklama: '' }

export function CariDurumClient() {
  const [cariler, setCariler] = useState<CariSatir[]>([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState<'HEPSI' | 'ALACAKLI' | 'BORCLU'>('HEPSI')
  const [arama, setArama] = useState('')
  const [detay, setDetay] = useState<CariSatir | null>(null)
  const [odemeler, setOdemeler] = useState<CariOdeme[]>([])
  const [faturalar, setFaturalar] = useState<CariFatura[]>([])
  const [odemeForm, setOdemeForm] = useState({ ...EMPTY_ODEME })
  const [showOdemeForm, setShowOdemeForm] = useState(false)
  const [showYeniCari, setShowYeniCari] = useState(false)
  const [cariForm, setCariForm] = useState({ ...EMPTY_CARI_FORM })
  const [duzenlenenCariId, setDuzenlenenCariId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [ekstreExporting, setEkstreExporting] = useState(false)
  const [showBirlestir, setShowBirlestir] = useState(false)
  const [birlestirForm, setBirlestirForm] = useState({ kaynakId: '', hedefId: '' })
  const [birlestirYukleniyor, setBirlestirYukleniyor] = useState(false)
  const [birlestirHata, setBirlestirHata] = useState('')

  const fetchAll = useCallback(async () => {
    const res = await fetch('/api/cariler')
    if (res.ok) setCariler(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const fetchOdemeler = useCallback(async (cariId: string) => {
    const res = await fetch(`/api/cariler/${cariId}/odeme`)
    if (res.ok) setOdemeler(await res.json())
  }, [])

  const fetchFaturalar = useCallback(async (cariId: string) => {
    const res = await fetch(`/api/cariler/${cariId}/faturalar`)
    if (res.ok) setFaturalar(await res.json())
  }, [])

  const handleDetay = (c: CariSatir) => {
    setDetay(c)
    setShowOdemeForm(false)
    setOdemeForm({ ...EMPTY_ODEME })
    fetchOdemeler(c.id)
    fetchFaturalar(c.id)
  }

  const handleYeniCari = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    // Düzenlenen bir cari varsa (isim/IBAN/açıklama değişikliği) güncelle,
    // yoksa yeni cari oluştur — aynı form ikisi için de kullanılıyor.
    const res = await fetch(duzenlenenCariId ? `/api/cariler/${duzenlenenCariId}` : '/api/cariler', {
      method: duzenlenenCariId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cariForm),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Hata oluştu')
      return
    }
    setCariForm({ ...EMPTY_CARI_FORM })
    setDuzenlenenCariId(null)
    setShowYeniCari(false)
    fetchAll()
    if (detay && duzenlenenCariId === detay.id) {
      const guncel = await res.json()
      setDetay((d) => (d ? { ...d, ad: guncel.ad, ibanBilgisi: guncel.ibanBilgisi, aciklama: guncel.aciklama } : d))
    }
  }

  const handleCariDuzenleAc = (c: CariSatir) => {
    setDuzenlenenCariId(c.id)
    setCariForm({ ad: c.ad, ibanBilgisi: c.ibanBilgisi || '', aciklama: c.aciklama || '' })
    setError('')
    setShowYeniCari(true)
  }

  // Excel'den aktarım sırasında aynı firma farklı yazımlarla ("ADIM OTO" /
  // "ADIM OTOMOTİV" gibi) iki ayrı cariye bölünmüş olabilir. Bu form,
  // "kaynak" cariye ait tüm fatura ve ödeme kayıtlarını "hedef" cariye taşıyıp
  // kaynağı siler, böylece bakiye tek bir cari altında toplanır.
  const handleBirlestir = async (e: React.FormEvent) => {
    e.preventDefault()
    setBirlestirHata('')
    if (!birlestirForm.kaynakId || !birlestirForm.hedefId) {
      setBirlestirHata('İki cari de seçilmeli')
      return
    }
    if (birlestirForm.kaynakId === birlestirForm.hedefId) {
      setBirlestirHata('Aynı cariyi kendisiyle birleştiremezsiniz')
      return
    }
    setBirlestirYukleniyor(true)
    try {
      const res = await fetch('/api/cariler/birlestir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(birlestirForm),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setBirlestirHata(data.error || 'Hata oluştu')
        return
      }
      alert(`Birleştirildi: ${data.tasinanFatura} fatura ve ${data.tasinanOdeme} ödeme kaydı "${data.hedefAd}" cariye taşındı.`)
      setBirlestirForm({ kaynakId: '', hedefId: '' })
      setShowBirlestir(false)
      fetchAll()
    } catch {
      setBirlestirHata('Hata oluştu')
    } finally {
      setBirlestirYukleniyor(false)
    }
  }

  const handleOdemeEkle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!detay) return
    setError('')
    const res = await fetch(`/api/cariler/${detay.id}/odeme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(odemeForm),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Hata oluştu')
      return
    }
    setOdemeForm({ ...EMPTY_ODEME })
    setShowOdemeForm(false)
    await fetchOdemeler(detay.id)
    await fetchAll()
  }

  const handleOdemeSil = async (odemeId: string) => {
    if (!detay) return
    if (!confirm('Bu ödeme kaydını silmek istediğinize emin misiniz?')) return
    await fetch(`/api/cariler/${detay.id}/odeme/${odemeId}`, { method: 'DELETE' })
    await fetchOdemeler(detay.id)
    await fetchAll()
  }

  const handleCariSil = async (c: CariSatir) => {
    if (!confirm(`"${c.ad}" carisini silmek istediğinize emin misiniz?`)) return
    const res = await fetch(`/api/cariler/${c.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Silinemedi')
      return
    }
    setDetay(null)
    fetchAll()
  }

  const filtreli = useMemo(() => {
    return cariler.filter((c) => {
      if (arama && !c.ad.toLocaleLowerCase('tr-TR').includes(arama.toLocaleLowerCase('tr-TR'))) return false
      if (filtre === 'ALACAKLI' && c.alacak <= 0) return false
      if (filtre === 'BORCLU' && c.borc <= 0) return false
      return true
    })
  }, [cariler, filtre, arama])

  const toplam = useMemo(() => {
    return filtreli.reduce(
      (acc, c) => ({ alacak: acc.alacak + c.alacak, borc: acc.borc + c.borc }),
      { alacak: 0, borc: 0 }
    )
  }, [filtreli])

  // Tom'un banka/muhasebe programlarından bildiği "Cari Hesap Ekstresi"
  // formatına benzer birleşik dökümantasyon: fatura ve ödeme/tahsilat
  // kayıtları tek bir tabloda, tarih sırasına göre, her satırda o ana kadarki
  // bakiyeyi gösterecek şekilde birleştirilir. Yalnızca "cariEklensinMi"
  // işaretli faturalar bakiyeye dahil edilir — bu, /api/cariler'deki
  // netBakiye hesabıyla birebir aynı mantık (kesilen+ödeme -
  // alınan+tahsilat), satır satır açılmış hali.
  const ekstre = useMemo(() => {
    type Satir = {
      key: string
      tarih: string
      odemeTarihi: string | null
      fisNo: string
      aciklama: string
      borc: number
      alacak: number
      odemeId?: string
    }
    const satirlar: Satir[] = []
    faturalar
      .filter((f) => f.cariEklensinMi)
      .forEach((f) => {
        const kesilenMi = f.tur === 'KESILEN'
        const odendiMi = f.odemeDurumu === 'ODENDI'
        satirlar.push({
          key: `f-${f.id}`,
          tarih: f.tarih,
          // Fatura henüz ödenmediyse ödeme tarihi boş kalır — "Tarih" faturanın
          // kesildiği/geldiği tarih, "Ödeme Tarihi" fiilen ödendiği tarih.
          odemeTarihi: odendiMi ? f.odemeTarihi : null,
          fisNo: f.faturaNo || '—',
          aciklama: f.aciklama || (kesilenMi ? 'Kestiğimiz Fatura' : 'Aldığımız Fatura'),
          borc: kesilenMi ? f.kdvDahilTutar : 0,
          alacak: kesilenMi ? 0 : f.kdvDahilTutar,
        })
        // Fatura "Ödendi" işaretlendiğinde (Faturalar sekmesinden tek tek veya
        // "Tümünü Ödendi Yap" ile toplu) bunun karşılığı olarak otomatik bir
        // "ödeme" satırı ekleniyor — banka ekstrelerinde olduğu gibi, borç
        // fiilen kapandığında bakiyeden düşsün diye. Bu satır olmadan fatura
        // "Ödendi" görünse bile ekstredeki bakiye hiç değişmiyordu, bu da
        // "hepsini ödedim ama borçlu görünüyorum" karışıklığına yol açıyordu.
        if (odendiMi) {
          satirlar.push({
            key: `f-odeme-${f.id}`,
            tarih: f.odemeTarihi || f.tarih,
            odemeTarihi: f.odemeTarihi,
            fisNo: f.faturaNo || '—',
            aciklama: `Ödendi — ${f.aciklama || (kesilenMi ? 'Kestiğimiz Fatura' : 'Aldığımız Fatura')}`,
            borc: kesilenMi ? 0 : f.kdvDahilTutar,
            alacak: kesilenMi ? f.kdvDahilTutar : 0,
          })
        }
      })
    odemeler.forEach((o) => {
      const odemeMi = o.yon === 'ODEME'
      satirlar.push({
        key: `o-${o.id}`,
        tarih: o.tarih,
        // Kısmi ödeme/tahsilat kaydının kendisi zaten fiilen yapılmış bir
        // ödemedir — ödeme tarihi bu kaydın tarihiyle aynı.
        odemeTarihi: o.tarih,
        fisNo: o.odemeSekli || '—',
        aciklama: o.aciklama || (odemeMi ? 'Ödeme' : 'Tahsilat'),
        borc: odemeMi ? o.tutar : 0,
        alacak: odemeMi ? 0 : o.tutar,
        odemeId: o.id,
      })
    })
    satirlar.sort((a, b) => new Date(a.tarih).getTime() - new Date(b.tarih).getTime())
    let bakiye = 0
    return satirlar.map((s) => {
      bakiye += s.borc - s.alacak
      return { ...s, bakiye }
    })
  }, [faturalar, odemeler])

  // Ekranda açık olan tek bir carinin ekstresini (yukarıdaki tablonun birebir
  // aynısı) ayrı bir Excel dosyası olarak indirir — Tom'un tüm cariler için
  // olan genel "Excel" raporundan farklı olarak, sadece o an baktığı carinin
  // dökümünü tek sayfa halinde dışarı çıkarabilmesi için.
  const handleEkstreExcelExport = (c: CariSatir) => {
    setEkstreExporting(true)
    try {
      const satirlar: any[][] = [
        [`${c.ad} — Cari Hesap Ekstresi`],
        [],
        ['Tarih', 'Ödeme Tarihi', 'Fiş No', 'Açıklama', 'Borç', 'Alacak', 'Bakiye'],
      ]
      ekstre.forEach((s) => {
        satirlar.push([
          tarihStr(s.tarih),
          s.odemeTarihi ? tarihStr(s.odemeTarihi) : '',
          s.fisNo,
          s.aciklama,
          s.borc > 0 ? s.borc : '',
          s.alacak > 0 ? s.alacak : '',
          `${paraStr(Math.abs(s.bakiye))} ${s.bakiye >= 0 ? '(A)' : '(B)'}`,
        ])
      })
      satirlar.push([
        'TOPLAM', '', '', '',
        ekstre.reduce((sum, s) => sum + s.borc, 0),
        ekstre.reduce((sum, s) => sum + s.alacak, 0),
        `${paraStr(Math.abs(ekstre[ekstre.length - 1]?.bakiye ?? 0))} ${(ekstre[ekstre.length - 1]?.bakiye ?? 0) >= 0 ? '(A)' : '(B)'}`,
      ])
      const ws = XLSX.utils.aoa_to_sheet(satirlar)
      ws['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 36 }, { wch: 16 }, { wch: 16 }, { wch: 20 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Ekstre')
      const dosyaAdi = c.ad.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 40)
      XLSX.writeFile(wb, `${dosyaAdi}_ekstre.xlsx`)
    } finally {
      setEkstreExporting(false)
    }
  }

  // Tom'un eskiden elle tuttuğu "Piyasa Cari 2026" Excel şablonuna benzer bir
  // rapor üretir: bir "Özet Tablo" sayfası (S.NO / Şirket Kodu / Firma Adı /
  // Toplam Borç / Toplam Ödenen-Alacak / Kalan Bakiye / Durum) ve her cari
  // için ayrı bir sayfa (o cariye ait tüm fatura + ödeme/tahsilat kayıtları,
  // bölüm başlıkları ve genel toplamlarıyla). Ekrandaki arama/filtre neyi
  // gösteriyorsa sadece o cariler dahil edilir.
  const handleExcelExport = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/cariler/rapor')
      if (!res.ok) {
        alert('Rapor hazırlanamadı, tekrar deneyin.')
        return
      }
      const tumRapor: CariRaporSatir[] = await res.json()
      const gorunenIdler = new Set(filtreli.map((c) => c.id))
      const rapor = tumRapor.filter((c) => gorunenIdler.has(c.id))

      const wb = XLSX.utils.book_new()

      // --- Özet Tablo ---
      const ozetSatirlari: any[][] = [
        ['PİYASA CARİ DURUMU ÖZET RAPORU'],
        [],
        ['S.NO', 'ŞİRKET KODU', 'FİRMA ADI', 'TOPLAM BORÇ (₺)', 'TOPLAM ÖDENEN - ALACAK (₺)', 'KALAN BAKİYE (₺)', 'DURUM'],
      ]
      let toplamBorcTarafi = 0
      let toplamAlacakTarafi = 0
      rapor.forEach((c, i) => {
        const borcTarafi = c.alinanToplam + c.tahsilatToplam
        const alacakTarafi = c.kesilenToplam + c.odemeToplam
        const kalanBakiye = borcTarafi - alacakTarafi
        toplamBorcTarafi += borcTarafi
        toplamAlacakTarafi += alacakTarafi
        const durum = kalanBakiye < 0 ? 'BORÇLU' : kalanBakiye > 0 ? 'ALACAKLI' : ''
        ozetSatirlari.push([i + 1, `FRM-${String(i + 1).padStart(2, '0')}`, c.ad, borcTarafi, alacakTarafi, kalanBakiye, durum])
      })
      ozetSatirlari.push([null, null, 'GENEL TOPLAM', toplamBorcTarafi, toplamAlacakTarafi, toplamBorcTarafi - toplamAlacakTarafi, null])
      const ozetWs = XLSX.utils.aoa_to_sheet(ozetSatirlari)
      ozetWs['!cols'] = [{ wch: 6 }, { wch: 12 }, { wch: 32 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 12 }]
      XLSX.utils.book_append_sheet(wb, ozetWs, 'Özet Tablo')

      // --- Her cari için ayrı sayfa ---
      rapor.forEach((c, i) => {
        const borcTarafi = c.alinanToplam + c.tahsilatToplam
        const alacakTarafi = c.kesilenToplam + c.odemeToplam
        const kalanBakiye = borcTarafi - alacakTarafi

        const satirlar: any[][] = [
          [c.ad, null, null, null, null, null, null, '← Özet Tabloya Dön'],
          ['TOPLAM BORÇ (KDV DAHİL)', 'TOPLAM ÖDENEN / TAHSİL EDİLEN', 'KALAN BAKİYE'],
          [borcTarafi, alacakTarafi, kalanBakiye],
          [],
        ]

        const faturaBolumu = (baslik: string, tur: 'ALINAN' | 'KESILEN') => {
          const kayitlar = c.faturalar.filter((f) => f.tur === tur)
          satirlar.push([baslik])
          satirlar.push(['FATURA NO', 'TARİH', 'AÇIKLAMA', 'KDV HARİÇ TUTAR', 'KDV DAHİL TUTAR', 'IBAN BİLGİSİ', 'DURUM', 'ŞİRKET'])
          let tutarToplam = 0
          let kdvDahilToplam = 0
          kayitlar.forEach((f) => {
            tutarToplam += f.tutar
            kdvDahilToplam += f.kdvDahilTutar
            satirlar.push([
              f.faturaNo || '',
              tarihStr(f.tarih),
              f.aciklama || '',
              f.tutar,
              f.kdvDahilTutar,
              f.ibanBilgisi || '',
              DURUM_LABEL[f.odemeDurumu],
              f.sirketAd || '',
            ])
          })
          if (kayitlar.length === 0) satirlar.push(['(Kayıt yok)'])
          satirlar.push(['GENEL TOPLAM', '', '', tutarToplam, kdvDahilToplam, '', '', ''])
          satirlar.push([])
        }

        faturaBolumu('BORÇ KAYITLARI (ALDIĞIMIZ FATURALAR)', 'ALINAN')
        faturaBolumu('ALACAK KAYITLARI (KESTİĞİMİZ FATURALAR)', 'KESILEN')

        satirlar.push(['ÖDEME / TAHSİLAT KAYITLARI'])
        satirlar.push(['TARİH', 'YÖN', 'AÇIKLAMA', 'ÖDEME ŞEKLİ', 'TUTAR'])
        let odemeToplam = 0
        c.odemeler.forEach((o) => {
          odemeToplam += o.tutar
          satirlar.push([tarihStr(o.tarih), o.yon === 'TAHSILAT' ? 'Tahsilat' : 'Ödeme', o.aciklama || '', o.odemeSekli || '', o.tutar])
        })
        if (c.odemeler.length === 0) satirlar.push(['(Kayıt yok)'])
        satirlar.push(['GENEL TOPLAM', '', '', '', odemeToplam])

        const ws = XLSX.utils.aoa_to_sheet(satirlar)
        ws['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 32 }, { wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 12 }, { wch: 14 }]
        // Sayfa adı Excel kısıtı (max 31 karakter, bazı özel karakterler yasak)
        // yüzünden özgün firma adı yerine kısa bir kod kullanılır — firma adı
        // sayfanın ilk satırında ve Özet Tablo'da zaten görünüyor.
        XLSX.utils.book_append_sheet(wb, ws, `Firma_${i + 1}`)
      })

      XLSX.writeFile(wb, 'piyasa_cari_2026.xlsx')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin h-8 w-8 border-4 border-secondary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Faturalar sekmesinde "Cari eklensin mi?" işaretlenen faturalar burada karşı tarafın alacak/borç bakiyesine yansır.
        Faturayı Faturalar sekmesinden "Ödendi" yaptığınızda o fatura tutarı buradaki bakiyeden otomatik düşer.
        Tutarın sadece bir kısmını ödediyseniz/tahsil ettiyseniz, faturayı Ödendi yapmadan buradan kısmi ödeme/tahsilat kaydı ekleyerek bakiyeyi güncelleyebilirsiniz.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="w-48"
            placeholder="Cari ara..."
            value={arama}
            onChange={(e) => setArama(e.target.value)}
          />
          {(['HEPSI', 'ALACAKLI', 'BORCLU'] as const).map((f) => (
            <Button key={f} size="sm" variant={filtre === f ? 'default' : 'outline'} className={filtre === f ? 'bg-secondary hover:bg-secondary/90' : ''} onClick={() => setFiltre(f)}>
              {f === 'HEPSI' ? 'Hepsi' : f === 'ALACAKLI' ? 'Alacaklı Olduklarım' : 'Borçlu Olduklarım'}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          {filtreli.length > 0 && (
            <Button variant="outline" size="sm" disabled={exporting} onClick={handleExcelExport}>
              <Download className="h-4 w-4 mr-1" /> {exporting ? 'Hazırlanıyor...' : 'Excel'}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setBirlestirForm({ kaynakId: '', hedefId: '' }); setBirlestirHata(''); setShowBirlestir(true) }}
            title='Aynı firmanın farklı yazımla oluşmuş iki carisini tek cari altında birleştir (ör. "ADIM OTO" + "ADIM OTOMOTİV")'
          >
            <GitMerge className="h-4 w-4 mr-1" /> Carileri Birleştir
          </Button>
          <Button size="sm" className="bg-secondary hover:bg-secondary/90" onClick={() => { setCariForm({ ...EMPTY_CARI_FORM }); setDuzenlenenCariId(null); setError(''); setShowYeniCari(true) }}>
            <Plus className="h-4 w-4 mr-1" /> Yeni Cari
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card
          className={`cursor-pointer hover:shadow-md transition-shadow ${filtre === 'ALACAKLI' ? 'ring-2 ring-secondary' : ''}`}
          onClick={() => setFiltre((f) => (f === 'ALACAKLI' ? 'HEPSI' : 'ALACAKLI'))}
          title="Sadece alacaklı olduklarımı göster"
        >
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><ArrowDownCircle className="h-3.5 w-3.5" /> Toplam Alacağımız</div>
            <div className="font-semibold">{paraStr(toplam.alacak)}</div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer hover:shadow-md transition-shadow ${filtre === 'BORCLU' ? 'ring-2 ring-secondary' : ''}`}
          onClick={() => setFiltre((f) => (f === 'BORCLU' ? 'HEPSI' : 'BORCLU'))}
          title="Sadece borçlu olduklarımı göster"
        >
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><ArrowUpCircle className="h-3.5 w-3.5" /> Toplam Borcumuz</div>
            <div className="font-semibold">{paraStr(toplam.borc)}</div>
          </CardContent>
        </Card>
      </div>

      {showBirlestir && (
        <Card className="border-secondary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Carileri Birleştir</CardTitle>
            <p className="text-xs text-muted-foreground pt-1">
              Aynı firma yanlışlıkla iki farklı isimle kaydedilmiş olabilir (ör. "ADIM OTO" ve "ADIM OTOMOTİV").
              Aşağıda birleştirilecek carileri seçin: kaynaktaki tüm fatura ve ödeme/tahsilat kayıtları hedefe taşınır, kaynak cari silinir.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleBirlestir} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Bu cari silinsin (kaynak) *</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={birlestirForm.kaynakId}
                    onChange={(e) => setBirlestirForm((f) => ({ ...f, kaynakId: e.target.value }))}
                    required
                  >
                    <option value="">Seçin...</option>
                    {cariler.map((c) => <option key={c.id} value={c.id}>{c.ad}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Bunun altında birleşsin (hedef) *</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={birlestirForm.hedefId}
                    onChange={(e) => setBirlestirForm((f) => ({ ...f, hedefId: e.target.value }))}
                    required
                  >
                    <option value="">Seçin...</option>
                    {cariler.map((c) => <option key={c.id} value={c.id}>{c.ad}</option>)}
                  </select>
                </div>
              </div>
              {birlestirHata && <p className="text-destructive text-sm">{birlestirHata}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={birlestirYukleniyor} className="bg-secondary hover:bg-secondary/90">
                  {birlestirYukleniyor ? 'Birleştiriliyor...' : 'Birleştir'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowBirlestir(false)}>İptal</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showYeniCari && (
        <Card className="border-secondary/30">
          <CardHeader className="pb-3"><CardTitle className="text-lg">{duzenlenenCariId ? 'Cariyi Düzenle' : 'Yeni Cari Ekle'}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleYeniCari} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>İsim / Firma *</Label>
                  <Input value={cariForm.ad} onChange={(e) => setCariForm((f) => ({ ...f, ad: e.target.value }))} required />
                </div>
                <div>
                  <Label>IBAN Bilgisi</Label>
                  <Input value={cariForm.ibanBilgisi} onChange={(e) => setCariForm((f) => ({ ...f, ibanBilgisi: e.target.value }))} placeholder="TR.. ..." />
                </div>
              </div>
              <div>
                <Label>Açıklama</Label>
                <Input value={cariForm.aciklama} onChange={(e) => setCariForm((f) => ({ ...f, aciklama: e.target.value }))} />
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" className="bg-secondary hover:bg-secondary/90">{duzenlenenCariId ? 'Kaydet' : 'Ekle'}</Button>
                <Button type="button" variant="outline" onClick={() => { setShowYeniCari(false); setDuzenlenenCariId(null) }}>İptal</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {filtreli.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
            Gösterilecek cari yok
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtreli.map((c) => (
            <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleDetay(c)}>
              <CardContent className="p-4 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium">{c.ad}</div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); handleCariDuzenleAc(c) }} title="Düzenle">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleCariSil(c) }} title="Sil">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-4 pt-1 text-sm">
                  <span className="text-green-600 dark:text-green-400">Alacak: {paraStr(c.alacak)}</span>
                  <span className="text-orange-600 dark:text-orange-400">Borç: {paraStr(c.borc)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!detay} onOpenChange={(open) => { if (!open) setDetay(null) }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {detay && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> {detay.ad}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2 text-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-muted-foreground">
                  <div>Alacağımız</div><div className="text-right text-foreground font-medium">{paraStr(detay.alacak)}</div>
                  <div>Borcumuz</div><div className="text-right text-foreground font-medium">{paraStr(detay.borc)}</div>
                  <div>Kesilen Fatura Toplamı</div><div className="text-right text-foreground">{paraStr(detay.kesilenToplam)}</div>
                  <div>Alınan Fatura Toplamı</div><div className="text-right text-foreground">{paraStr(detay.alinanToplam)}</div>
                  {detay.ibanBilgisi && (<><div>IBAN Bilgisi</div><div className="text-right text-foreground">{detay.ibanBilgisi}</div></>)}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <Label className="text-xs">Cari Hesap Ekstresi</Label>
                    <div className="flex items-center gap-2">
                      {ekstre.length > 0 && (
                        <Button size="sm" variant="outline" disabled={ekstreExporting} onClick={() => handleEkstreExcelExport(detay)}>
                          <Download className="h-3.5 w-3.5 mr-1" /> {ekstreExporting ? 'Hazırlanıyor...' : 'Excele Aktar'}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setShowOdemeForm((v) => !v)}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Kısmi Ödeme/Tahsilat Ekle
                      </Button>
                    </div>
                  </div>

                  {showOdemeForm && (
                    <form onSubmit={handleOdemeEkle} className="space-y-3 border rounded-lg p-3 mb-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Yön</Label>
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                            value={odemeForm.yon}
                            onChange={(e) => setOdemeForm((f) => ({ ...f, yon: e.target.value as 'TAHSILAT' | 'ODEME' }))}
                          >
                            <option value="TAHSILAT">Tahsilat (o bana ödedi)</option>
                            <option value="ODEME">Ödeme (ben ona ödedim)</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs">Tarih *</Label>
                          <Input type="date" value={odemeForm.tarih} onChange={(e) => setOdemeForm((f) => ({ ...f, tarih: e.target.value }))} required />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Tutar *</Label>
                          <Input type="number" step="any" value={odemeForm.tutar} onChange={(e) => setOdemeForm((f) => ({ ...f, tutar: e.target.value }))} required />
                        </div>
                        <div>
                          <Label className="text-xs">Ödeme Şekli</Label>
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                            value={odemeForm.odemeSekli}
                            onChange={(e) => setOdemeForm((f) => ({ ...f, odemeSekli: e.target.value }))}
                          >
                            {ODEME_SEKLI_SECENEKLERI.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Açıklama</Label>
                        <Input
                          value={odemeForm.aciklama}
                          onChange={(e) => setOdemeForm((f) => ({ ...f, aciklama: e.target.value }))}
                          placeholder={odemeForm.odemeSekli === 'Çek' ? 'Çek no / vade tarihi gibi notlar' : ''}
                        />
                      </div>
                      {error && <p className="text-destructive text-sm">{error}</p>}
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" className="bg-secondary hover:bg-secondary/90">Kaydet</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setShowOdemeForm(false)}>İptal</Button>
                      </div>
                    </form>
                  )}

                  {ekstre.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Bu cariye ait fatura veya ödeme/tahsilat kaydı yok.</p>
                  ) : (
                    <div className="border rounded-lg overflow-x-auto">
                      <table className="w-full text-xs min-w-[620px]">
                        <thead>
                          <tr className="bg-muted/50 text-muted-foreground">
                            <th className="text-left font-medium px-2 py-1.5">Tarih</th>
                            <th className="text-left font-medium px-2 py-1.5">Ödeme Tarihi</th>
                            <th className="text-left font-medium px-2 py-1.5">Fiş No</th>
                            <th className="text-left font-medium px-2 py-1.5">Açıklama</th>
                            <th className="text-right font-medium px-2 py-1.5">Borç</th>
                            <th className="text-right font-medium px-2 py-1.5">Alacak</th>
                            <th className="text-right font-medium px-2 py-1.5">Bakiye</th>
                            <th className="px-1 py-1.5" />
                          </tr>
                        </thead>
                        <tbody>
                          {ekstre.map((s) => (
                            <tr key={s.key} className="border-t">
                              <td className="px-2 py-1.5 whitespace-nowrap">{tarihStr(s.tarih)}</td>
                              <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{s.odemeTarihi ? tarihStr(s.odemeTarihi) : '—'}</td>
                              <td className="px-2 py-1.5 whitespace-nowrap">{s.fisNo}</td>
                              <td className="px-2 py-1.5">{s.aciklama}</td>
                              <td className="px-2 py-1.5 text-right whitespace-nowrap">{s.borc > 0 ? paraStr(s.borc) : ''}</td>
                              <td className="px-2 py-1.5 text-right whitespace-nowrap">{s.alacak > 0 ? paraStr(s.alacak) : ''}</td>
                              <td className={`px-2 py-1.5 text-right whitespace-nowrap font-medium ${s.bakiye >= 0 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                                {paraStr(Math.abs(s.bakiye))} {s.bakiye >= 0 ? '(A)' : '(B)'}
                              </td>
                              <td className="px-1 py-1.5">
                                {s.odemeId && (
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleOdemeSil(s.odemeId!)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t bg-muted/30 font-medium">
                            <td className="px-2 py-1.5" colSpan={4}>TOPLAM</td>
                            <td className="px-2 py-1.5 text-right whitespace-nowrap">{paraStr(ekstre.reduce((sum, s) => sum + s.borc, 0))}</td>
                            <td className="px-2 py-1.5 text-right whitespace-nowrap">{paraStr(ekstre.reduce((sum, s) => sum + s.alacak, 0))}</td>
                            <td className={`px-2 py-1.5 text-right whitespace-nowrap ${(ekstre[ekstre.length - 1]?.bakiye ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                              {paraStr(Math.abs(ekstre[ekstre.length - 1]?.bakiye ?? 0))} {(ekstre[ekstre.length - 1]?.bakiye ?? 0) >= 0 ? '(A)' : '(B)'}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    (A) Alacaklıyız — karşı taraf bize borçlu &nbsp;·&nbsp; (B) Borçluyuz — karşı tarafa biz borçluyuz
                  </p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
