'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Users, Download, Plus, Trash2, ArrowDownCircle, ArrowUpCircle, Pencil } from 'lucide-react'
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
  aciklama: string | null
  kdvDahilTutar: number
  odemeDurumu: 'BEKLIYOR' | 'ODENDI' | 'GECIKTI'
  cariEklensinMi: boolean
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
  const [faturalarAcik, setFaturalarAcik] = useState(false)
  const [odemeForm, setOdemeForm] = useState({ ...EMPTY_ODEME })
  const [showOdemeForm, setShowOdemeForm] = useState(false)
  const [showYeniCari, setShowYeniCari] = useState(false)
  const [cariForm, setCariForm] = useState({ ...EMPTY_CARI_FORM })
  const [error, setError] = useState('')

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
    setFaturalarAcik(false)
    setOdemeForm({ ...EMPTY_ODEME })
    fetchOdemeler(c.id)
    fetchFaturalar(c.id)
  }

  const handleYeniCari = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/cariler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cariForm),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Hata oluştu')
      return
    }
    setCariForm({ ...EMPTY_CARI_FORM })
    setShowYeniCari(false)
    fetchAll()
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

  const handleExcelExport = () => {
    const rows = filtreli.map((c) => ({
      'Cari': c.ad,
      'IBAN Bilgisi': c.ibanBilgisi || '',
      'Kesilen Fatura Toplamı': c.kesilenToplam,
      'Alınan Fatura Toplamı': c.alinanToplam,
      'Tahsilat Toplamı': c.tahsilatToplam,
      'Ödeme Toplamı': c.odemeToplam,
      'Alacağımız': c.alacak,
      'Borcumuz': c.borc,
      'Net Bakiye': c.netBakiye,
      'Açıklama': c.aciklama || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Cari Durum')
    XLSX.writeFile(wb, 'cari_durum.xlsx')
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
            <Button variant="outline" size="sm" onClick={handleExcelExport}>
              <Download className="h-4 w-4 mr-1" /> Excel
            </Button>
          )}
          <Button size="sm" className="bg-secondary hover:bg-secondary/90" onClick={() => { setCariForm({ ...EMPTY_CARI_FORM }); setError(''); setShowYeniCari(true) }}>
            <Plus className="h-4 w-4 mr-1" /> Yeni Cari
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><ArrowDownCircle className="h-3.5 w-3.5" /> Toplam Alacağımız</div>
          <div className="font-semibold">{paraStr(toplam.alacak)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><ArrowUpCircle className="h-3.5 w-3.5" /> Toplam Borcumuz</div>
          <div className="font-semibold">{paraStr(toplam.borc)}</div>
        </CardContent></Card>
      </div>

      {showYeniCari && (
        <Card className="border-secondary/30">
          <CardHeader className="pb-3"><CardTitle className="text-lg">Yeni Cari Ekle</CardTitle></CardHeader>
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
                <Button type="submit" className="bg-secondary hover:bg-secondary/90">Ekle</Button>
                <Button type="button" variant="outline" onClick={() => setShowYeniCari(false)}>İptal</Button>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtreli.map((c) => (
            <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleDetay(c)}>
              <CardContent className="p-4 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium">{c.ad}</div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive shrink-0" onClick={(e) => { e.stopPropagation(); handleCariSil(c) }} title="Sil">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {c.ibanBilgisi && <div className="text-xs text-muted-foreground">{c.ibanBilgisi}</div>}
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
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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
                  <button
                    type="button"
                    className="flex items-center justify-between w-full mb-2"
                    onClick={() => setFaturalarAcik((v) => !v)}
                  >
                    <Label className="text-xs cursor-pointer">
                      Faturalar ({faturalar.length} adet, toplam {paraStr(faturalar.reduce((s, f) => s + f.kdvDahilTutar, 0))})
                    </Label>
                    <span className="text-xs text-secondary">{faturalarAcik ? 'Gizle' : 'Göster'}</span>
                  </button>
                  {faturalarAcik && (
                    faturalar.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Bu cariye ait fatura kaydı yok.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto">
                        {faturalar.map((f) => (
                          <div key={f.id} className="flex items-center justify-between text-xs border rounded-md px-2 py-1.5">
                            <div>
                              <span className={f.tur === 'KESILEN' ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}>
                                {f.tur === 'KESILEN' ? 'Kestiğimiz' : 'Aldığımız'}
                              </span>
                              {' · '}{tarihStr(f.tarih)}
                              {f.faturaNo ? ` · ${f.faturaNo}` : ''}
                              {f.aciklama ? ` · ${f.aciklama}` : ''}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={f.odemeDurumu === 'ODENDI' ? 'text-muted-foreground' : ''}>{DURUM_LABEL[f.odemeDurumu]}</span>
                              <span className="font-medium">{paraStr(f.kdvDahilTutar)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs">Kısmi Ödeme / Tahsilat Geçmişi</Label>
                    <Button size="sm" variant="outline" onClick={() => setShowOdemeForm((v) => !v)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Ekle
                    </Button>
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

                  {odemeler.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Henüz kısmi ödeme/tahsilat kaydı yok.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {odemeler.map((o) => (
                        <div key={o.id} className="flex items-center justify-between text-xs border rounded-md px-2 py-1.5">
                          <div>
                            <span className={o.yon === 'TAHSILAT' ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}>
                              {o.yon === 'TAHSILAT' ? 'Tahsilat' : 'Ödeme'}
                            </span>
                            {' · '}{tarihStr(o.tarih)}{o.odemeSekli ? ` · ${o.odemeSekli}` : ''}{o.aciklama ? ` · ${o.aciklama}` : ''}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{paraStr(o.tutar)}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleOdemeSil(o.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
