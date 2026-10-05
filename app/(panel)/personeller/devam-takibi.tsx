'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { CalendarCheck, ChevronLeft, ChevronRight, Download, Check } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

type Tur = 'IZINLI' | 'RAPORLU' | 'GELMEDI'

interface PersonelOzet {
  id: string
  ad: string
  personelTipi: 'ASIL' | 'TASERON'
  aktif: boolean
  aktifSirketBaslangic: string | null
}

interface Devamsizlik {
  id: string
  calisanId: string
  tarih: string
  tur: Tur
  aciklama: string | null
}

const TUR_BILGI: Record<Tur, { etiket: string; kisa: string; hucre: string }> = {
  IZINLI: { etiket: 'İzinli', kisa: 'İ', hucre: 'bg-amber-500 text-white' },
  RAPORLU: { etiket: 'Raporlu', kisa: 'R', hucre: 'bg-sky-500 text-white' },
  GELMEDI: { etiket: 'Gelmedi (mazeretsiz)', kisa: 'G', hucre: 'bg-red-500 text-white' },
}

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const GUN_KISA = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct']

const pad2 = (n: number) => n.toString().padStart(2, '0')
const tarihStr = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`

function bugun(): string {
  const d = new Date()
  return tarihStr(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

// 0 = Pazar ... 6 = Cumartesi (saat dilimi bağımsız)
function haftaninGunu(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function DevamTakibi({ calisanlar }: { calisanlar: PersonelOzet[] }) {
  const simdi = new Date()
  const [yil, setYil] = useState(simdi.getFullYear())
  const [ay, setAy] = useState(simdi.getMonth() + 1)
  const [kayitlar, setKayitlar] = useState<Devamsizlik[]>([])
  const [loading, setLoading] = useState(true)

  // Düzenleme penceresi
  const [secili, setSecili] = useState<{ calisan: PersonelOzet; tarih: string } | null>(null)
  const [tur, setTur] = useState<Tur>('IZINLI')
  const [aciklama, setAciklama] = useState('')
  const [saving, setSaving] = useState(false)

  const asilPersonel = useMemo(
    () => calisanlar.filter((c) => c.personelTipi === 'ASIL' && c.aktif).sort((a, b) => a.ad.localeCompare(b.ad, 'tr')),
    [calisanlar],
  )

  const yukle = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/calisanlar/devamsizlik?yil=${yil}&ay=${ay}`)
      if (!res.ok) throw new Error()
      setKayitlar(await res.json())
    } catch {
      toast.error('Devam kayıtları yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [yil, ay])

  useEffect(() => { yukle() }, [yukle])

  const gunSayisi = new Date(Date.UTC(yil, ay, 0)).getUTCDate()
  const gunler = useMemo(() => Array.from({ length: gunSayisi }, (_, i) => i + 1), [gunSayisi])
  const bugunStr = bugun()

  // personelId|tarih → kayıt
  const kayitHaritasi = useMemo(() => {
    const m = new Map<string, Devamsizlik>()
    for (const k of kayitlar) m.set(`${k.calisanId}|${k.tarih.slice(0, 10)}`, k)
    return m
  }, [kayitlar])

  // Bir gün "sayılan iş günü" mü: Pazar hariç, bugüne kadar, personelin işe başlama tarihinden sonra
  const sayilirMi = (c: PersonelOzet, d: number) => {
    const t = tarihStr(yil, ay, d)
    if (haftaninGunu(yil, ay, d) === 0) return false
    if (t > bugunStr) return false
    if (c.aktifSirketBaslangic && t < c.aktifSirketBaslangic.slice(0, 10)) return false
    return true
  }

  const ozetler = useMemo(() => {
    const map = new Map<string, { calisti: number; izinli: number; raporlu: number; gelmedi: number }>()
    for (const c of asilPersonel) {
      const o = { calisti: 0, izinli: 0, raporlu: 0, gelmedi: 0 }
      for (const d of gunler) {
        if (!sayilirMi(c, d)) continue
        const k = kayitHaritasi.get(`${c.id}|${tarihStr(yil, ay, d)}`)
        if (!k) o.calisti += 1
        else if (k.tur === 'IZINLI') o.izinli += 1
        else if (k.tur === 'RAPORLU') o.raporlu += 1
        else o.gelmedi += 1
      }
      map.set(c.id, o)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asilPersonel, gunler, kayitHaritasi, yil, ay, bugunStr])

  const oncekiAy = () => { if (ay === 1) { setYil(yil - 1); setAy(12) } else setAy(ay - 1) }
  const sonrakiAy = () => { if (ay === 12) { setYil(yil + 1); setAy(1) } else setAy(ay + 1) }

  const hucreyeTikla = (c: PersonelOzet, d: number) => {
    if (haftaninGunu(yil, ay, d) === 0) return
    const t = tarihStr(yil, ay, d)
    const mevcut = kayitHaritasi.get(`${c.id}|${t}`)
    setTur(mevcut?.tur ?? 'IZINLI')
    setAciklama(mevcut?.aciklama ?? '')
    setSecili({ calisan: c, tarih: t })
  }

  const kaydet = async () => {
    if (!secili) return
    setSaving(true)
    try {
      const res = await fetch('/api/calisanlar/devamsizlik', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calisanId: secili.calisan.id, tarih: secili.tarih, tur, aciklama }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.error ?? 'Kaydedilemedi'); return }
      toast.success(`${secili.calisan.ad} — ${TUR_BILGI[tur].etiket} olarak işaretlendi`)
      setSecili(null)
      yukle()
    } catch { toast.error('Kaydedilemedi') }
    finally { setSaving(false) }
  }

  const geldiYap = async () => {
    if (!secili) return
    setSaving(true)
    try {
      const res = await fetch(
        `/api/calisanlar/devamsizlik?calisanId=${secili.calisan.id}&tarih=${secili.tarih}`,
        { method: 'DELETE' },
      )
      if (!res.ok) { toast.error('Güncellenemedi'); return }
      toast.success(`${secili.calisan.ad} — geldi olarak düzeltildi`)
      setSecili(null)
      yukle()
    } catch { toast.error('Güncellenemedi') }
    finally { setSaving(false) }
  }

  const excelIndir = () => {
    const baslik = ['Personel', ...gunler.map((d) => `${d} ${GUN_KISA[haftaninGunu(yil, ay, d)]}`), 'Çalıştı', 'İzinli', 'Raporlu', 'Gelmedi']
    const satirlar = asilPersonel.map((c) => {
      const o = ozetler.get(c.id)!
      return [
        c.ad,
        ...gunler.map((d) => {
          if (haftaninGunu(yil, ay, d) === 0) return 'Tatil'
          if (!sayilirMi(c, d)) return ''
          const k = kayitHaritasi.get(`${c.id}|${tarihStr(yil, ay, d)}`)
          return k ? TUR_BILGI[k.tur].etiket : 'Geldi'
        }),
        o.calisti, o.izinli, o.raporlu, o.gelmedi,
      ]
    })
    const ws = XLSX.utils.aoa_to_sheet([baslik, ...satirlar])
    ws['!cols'] = [{ wch: 24 }, ...gunler.map(() => ({ wch: 9 })), { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `${AYLAR[ay - 1]} ${yil}`)

    // İstisna listesi (hangi gün neden gelmedi)
    const liste = kayitlar
      .slice()
      .sort((a, b) => a.tarih.localeCompare(b.tarih))
      .map((k) => ({
        Personel: asilPersonel.find((c) => c.id === k.calisanId)?.ad ?? '',
        Tarih: k.tarih.slice(0, 10).split('-').reverse().join('.'),
        Durum: TUR_BILGI[k.tur].etiket,
        Açıklama: k.aciklama ?? '',
      }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(liste), 'Gelmeyenler')
    XLSX.writeFile(wb, `devam-takibi-${yil}-${pad2(ay)}.xlsx`)
  }

  const seciliKayit = secili ? kayitHaritasi.get(`${secili.calisan.id}|${secili.tarih}`) : undefined

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-secondary" /> Devam Takibi — Asıl Personel
            </CardTitle>
            <div className="flex items-center gap-1.5">
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={oncekiAy}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="min-w-[8.5rem] text-center text-sm font-medium">{AYLAR[ay - 1]} {yil}</span>
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={sonrakiAy}><ChevronRight className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={excelIndir} disabled={asilPersonel.length === 0}>
                <Download className="h-3.5 w-3.5 mr-1" /> Excel
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            Herkes her iş günü otomatik <b>geldi</b> sayılır (Pazar tatil). Gelmeyen olursa o günün kutusuna tıkla ve durumunu seç;
            hiçbir şey girmen gerekmez.
          </p>
        </CardHeader>
        <CardContent>
          {asilPersonel.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Aktif asıl personel yok.</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border">
                <table className="text-sm border-collapse">
                  <thead>
                    <tr className="text-muted-foreground border-b bg-muted/40">
                      <th className="py-1.5 px-3 text-left sticky left-0 z-10 bg-muted min-w-[10rem]">Personel</th>
                      {gunler.map((d) => {
                        const g = haftaninGunu(yil, ay, d)
                        const bugunMu = tarihStr(yil, ay, d) === bugunStr
                        return (
                          <th key={d} className={`px-0 py-1 text-center font-normal min-w-[1.9rem] ${g === 0 ? 'bg-muted/70' : ''} ${bugunMu ? 'text-foreground font-semibold' : ''}`}>
                            <div className="text-[11px]">{d}</div>
                            <div className="text-[9px] opacity-70">{GUN_KISA[g]}</div>
                          </th>
                        )
                      })}
                      <th className="px-2 text-center text-xs whitespace-nowrap">Çalıştı</th>
                      <th className="px-2 text-center text-xs">İzinli</th>
                      <th className="px-2 text-center text-xs">Raporlu</th>
                      <th className="px-2 text-center text-xs">Gelmedi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asilPersonel.map((c) => {
                      const o = ozetler.get(c.id)!
                      return (
                        <tr key={c.id} className="border-b last:border-0">
                          <td className="py-1 px-3 sticky left-0 z-10 bg-background font-medium whitespace-nowrap">{c.ad}</td>
                          {gunler.map((d) => {
                            const g = haftaninGunu(yil, ay, d)
                            if (g === 0) return <td key={d} className="bg-muted/50 text-center text-[10px] text-muted-foreground">·</td>
                            const t = tarihStr(yil, ay, d)
                            const k = kayitHaritasi.get(`${c.id}|${t}`)
                            const sayilan = sayilirMi(c, d)
                            return (
                              <td key={d} className="p-0.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => hucreyeTikla(c, d)}
                                  title={k ? `${TUR_BILGI[k.tur].etiket}${k.aciklama ? ' — ' + k.aciklama : ''}` : sayilan ? 'Geldi (değiştirmek için tıkla)' : 'İşaretlemek için tıkla'}
                                  className={`h-6 w-6 rounded text-[11px] font-semibold inline-flex items-center justify-center transition-colors ${
                                    k
                                      ? TUR_BILGI[k.tur].hucre
                                      : sayilan
                                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/30'
                                        : 'bg-transparent text-muted-foreground/40 hover:bg-muted'
                                  }`}
                                >
                                  {k ? TUR_BILGI[k.tur].kisa : sayilan ? <Check className="h-3 w-3" /> : '·'}
                                </button>
                              </td>
                            )
                          })}
                          <td className="px-2 text-center font-semibold text-emerald-600 dark:text-emerald-400">{o.calisti}</td>
                          <td className="px-2 text-center">{o.izinli || '-'}</td>
                          <td className="px-2 text-center">{o.raporlu || '-'}</td>
                          <td className={`px-2 text-center ${o.gelmedi ? 'text-red-600 font-semibold' : ''}`}>{o.gelmedi || '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-3">
                <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-500/30 inline-block" /> Geldi (otomatik)</span>
                <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-500 inline-block" /> İzinli</span>
                <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-sky-500 inline-block" /> Raporlu</span>
                <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-500 inline-block" /> Gelmedi</span>
                {loading && <span>Yükleniyor…</span>}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!secili} onOpenChange={(open) => !open && setSecili(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{secili?.calisan.ad}</DialogTitle>
            <DialogDescription>
              {secili && secili.tarih.split('-').reverse().join('.')} tarihli devam durumu
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(TUR_BILGI) as Tur[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTur(t)}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                    tur === t ? TUR_BILGI[t].hucre + ' border-transparent' : 'hover:bg-muted'
                  }`}
                >
                  {t === 'GELMEDI' ? 'Gelmedi' : TUR_BILGI[t].etiket}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label>Not (isteğe bağlı)</Label>
              <Input value={aciklama} onChange={(e) => setAciklama(e.target.value)} placeholder="Ör: Yıllık izin, hastane..." />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {seciliKayit ? (
              <Button variant="outline" onClick={geldiYap} disabled={saving}>Geldi olarak düzelt</Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSecili(null)}>Vazgeç</Button>
              <Button onClick={kaydet} disabled={saving} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
