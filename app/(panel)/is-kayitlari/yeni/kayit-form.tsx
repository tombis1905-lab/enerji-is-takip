'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FadeIn } from '@/components/ui/animate'
import { toast } from 'sonner'
import { ClipboardList, Upload, X, ImageIcon } from 'lucide-react'

interface IsTuru { id: string; ad: string; birim: string }
interface Santiye { id: string; ad: string; konum: string | null }

export function KayitForm() {
  const router = useRouter()
  const [santiyeler, setSantiyeler] = useState<Santiye[]>([])
  const [isTurleri, setIsTurleri] = useState<IsTuru[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [santiyeId, setSantiyeId] = useState('')
  const [isTuruId, setIsTuruId] = useState('')
  const [miktar, setMiktar] = useState('')
  const [tarih, setTarih] = useState('')

  useEffect(() => {
    setTarih(new Date().toISOString().split('T')[0] ?? '')
  }, [])
  const [aciklama, setAciklama] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [uploadProgress, setUploadProgress] = useState(false)

  const selectedTur = (isTurleri ?? []).find((t: IsTuru) => t.id === isTuruId)

  useEffect(() => {
    Promise.all([
      fetch('/api/santiyeler').then(r => r.json()),
      fetch('/api/is-turleri').then(r => r.json()),
    ])
      .then(([s, t]) => {
        setSantiyeler(Array.isArray(s) ? s : [])
        setIsTurleri(Array.isArray(t) ? t : [])
      })
      .catch(() => toast.error('Veriler yüklenemedi'))
      .finally(() => setLoading(false))
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target?.files ?? [])
    setFiles(prev => [...(prev ?? []), ...newFiles].slice(0, 5))
  }

  const removeFile = (index: number) => {
    setFiles(prev => (prev ?? []).filter((_: File, i: number) => i !== index))
  }

  const uploadFile = async (file: File): Promise<{ cloud_storage_path: string; contentType: string; isPublic: boolean } | null> => {
    try {
      // Get presigned URL
      const presignRes = await fetch('/api/upload/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || 'image/jpeg',
          isPublic: true,
        }),
      })
      if (!presignRes.ok) return null
      const { uploadUrl, cloud_storage_path } = await presignRes.json()

      // Upload to S3
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'image/jpeg' },
        body: file,
      })
      if (!uploadRes.ok) return null

      return { cloud_storage_path, contentType: file.type || 'image/jpeg', isPublic: true }
    } catch {
      return null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!santiyeId || !isTuruId || !miktar || !tarih) {
      toast.error('Lütfen tüm gerekli alanları doldurun')
      return
    }
    if (isNaN(Number(miktar)) || Number(miktar) <= 0) {
      toast.error('Geçerli bir miktar girin')
      return
    }

    setSaving(true)
    setUploadProgress(true)

    try {
      // Upload photos
      const fotograflar: any[] = []
      for (const file of files ?? []) {
        const result = await uploadFile(file)
        if (result) fotograflar.push(result)
      }

      setUploadProgress(false)

      // Create record
      const res = await fetch('/api/is-kayitlari', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          santiyeId,
          isTuruId,
          miktar: Number(miktar),
          tarih: new Date(tarih).toISOString(),
          aciklama: aciklama.trim() || null,
          fotograflar,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data?.error ?? 'Kayıt oluşturulamadı')
        return
      }

      toast.success('İş kaydı başarıyla oluşturuldu!')
      router.push('/is-kayitlari')
    } catch {
      toast.error('Hata oluştu')
    } finally {
      setSaving(false)
      setUploadProgress(false)
    }
  }

  if (loading) {
    return <div className="max-w-2xl mx-auto"><div className="h-96 bg-muted animate-pulse rounded-lg" /></div>
  }

  return (
    <div className="max-w-2xl mx-auto">
      <FadeIn>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-secondary" />
              Yeni İş Kaydı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Santiye */}
              <div className="space-y-2">
                <Label>Şantiye *</Label>
                <select
                  value={santiyeId}
                  onChange={(e) => setSantiyeId(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Şantiye seçin</option>
                  {(santiyeler ?? []).map((s: Santiye) => (
                    <option key={s.id} value={s.id}>{s.ad}{s.konum ? ` (${s.konum})` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Is Turu */}
              <div className="space-y-2">
                <Label>İş Türü *</Label>
                <select
                  value={isTuruId}
                  onChange={(e) => setIsTuruId(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">İş türü seçin</option>
                  {(isTurleri ?? []).map((t: IsTuru) => (
                    <option key={t.id} value={t.id}>{t.ad} ({t.birim})</option>
                  ))}
                </select>
              </div>

              {/* Miktar */}
              <div className="space-y-2">
                <Label>Miktar * {selectedTur ? `(${selectedTur.birim})` : ''}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={miktar}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMiktar(e.target.value)}
                  placeholder={selectedTur ? `Miktar (${selectedTur.birim})` : 'Miktar girin'}
                />
              </div>

              {/* Tarih */}
              <div className="space-y-2">
                <Label>Tarih *</Label>
                <Input
                  type="date"
                  value={tarih}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTarih(e.target.value)}
                />
              </div>

              {/* Aciklama */}
              <div className="space-y-2">
                <Label>Açıklama / Not</Label>
                <Textarea
                  value={aciklama}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAciklama(e.target.value)}
                  placeholder="İş ile ilgili ek bilgi..."
                  rows={3}
                />
              </div>

              {/* Foto Upload */}
              <div className="space-y-2">
                <Label>Fotoğraflar (en fazla 5)</Label>
                <div className="border-2 border-dashed border-input rounded-lg p-4">
                  <label className="flex flex-col items-center cursor-pointer">
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Fotoğraf yüklemek için tıklayın</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleFileChange}
                      disabled={(files?.length ?? 0) >= 5}
                    />
                  </label>
                </div>
                {(files?.length ?? 0) > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                    {(files ?? []).map((file: File, i: number) => (
                      <div key={i} className="relative group">
                        <div className="aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-xs truncate mt-1 text-muted-foreground">{file?.name ?? ''}</p>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="absolute top-1 right-1 p-0.5 bg-destructive/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/is-kayitlari')}
                >
                  Vazgeç
                </Button>
                <Button
                  type="submit"
                  loading={saving}
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/90 flex-1"
                >
                  {uploadProgress ? 'Fotoğraflar yükleniyor...' : 'Kaydı Oluştur'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
