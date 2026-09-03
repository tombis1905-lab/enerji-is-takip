'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FadeIn } from '@/components/ui/animate'
import { ClipboardList, Plus, Search, Trash2, ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function IsKayitlariClient({ role, userId }: { role: string; userId: string }) {
  const [kayitlar, setKayitlar] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [fotoDialog, setFotoDialog] = useState<any[]>([])
  const [fotoOpen, setFotoOpen] = useState(false)
  const isAdmin = role === 'ADMIN'
  const limit = 15

  const loadData = useCallback(() => {
    setLoading(true)
    fetch(`/api/is-kayitlari?page=${page}&limit=${limit}`)
      .then(r => r.json())
      .then(d => {
        setKayitlar(d?.kayitlar ?? [])
        setTotal(d?.total ?? 0)
      })
      .catch(() => toast.error('Veriler yüklenemedi'))
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => { loadData() }, [loadData])

  const handleDelete = async (id: string) => {
    if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return
    try {
      const res = await fetch(`/api/is-kayitlari/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data?.error ?? 'Silinemedi')
        return
      }
      toast.success('Kayıt silindi')
      loadData()
    } catch { toast.error('Hata oluştu') }
  }

  const openPhotos = (fotograflar: any[]) => {
    setFotoDialog(fotograflar ?? [])
    setFotoOpen(true)
  }

  const totalPages = Math.ceil(total / limit)

  // Filter locally by search
  const filtered = search.trim()
    ? (kayitlar ?? []).filter((k: any) =>
        (k?.santiye?.ad ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (k?.isTuru?.ad ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (k?.user?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (k?.aciklama ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : kayitlar

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">İş Kayıtları</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isAdmin ? 'Tüm şantiyelerdeki iş kayıtları' : 'Gönderdiğiniz iş kayıtları'}
            </p>
          </div>
          <Link href="/is-kayitlari/yeni">
            <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
              <Plus className="h-4 w-4 mr-2" /> Yeni Kayıt
            </Button>
          </Link>
        </div>
      </FadeIn>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Ara (şantiye, iş türü, personel...)"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : (filtered?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Henüz iş kaydı bulunmuyor.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tarih</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Şantiye</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">İş Türü</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Miktar</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Açıklama</th>
                    {isAdmin && <th className="px-4 py-3 text-left font-medium text-muted-foreground">Personel</th>}
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Foto</th>
                    {isAdmin && <th className="px-4 py-3 text-right font-medium text-muted-foreground">İşlem</th>}
                  </tr>
                </thead>
                <tbody>
                  {(filtered ?? []).map((k: any) => (
                    <tr key={k?.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                        {k?.tarih ? new Date(k.tarih).toLocaleDateString('tr-TR') : '-'}
                      </td>
                      <td className="px-4 py-3">{k?.santiye?.ad ?? '-'}</td>
                      <td className="px-4 py-3">{k?.isTuru?.ad ?? '-'}</td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap">
                        {k?.miktar ?? 0} {k?.isTuru?.birim ?? ''}
                      </td>
                      <td className="px-4 py-3 max-w-[200px] truncate">{k?.aciklama ?? '-'}</td>
                      {isAdmin && <td className="px-4 py-3">{k?.user?.name ?? '-'}</td>}
                      <td className="px-4 py-3">
                        {(k?.fotograflar?.length ?? 0) > 0 && (
                          <Button variant="ghost" size="icon-sm" onClick={() => openPhotos(k.fotograflar)}>
                            <ImageIcon className="h-4 w-4 text-secondary" />
                          </Button>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(k.id)} className="text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Sayfa {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Photo Dialog */}
      <Dialog open={fotoOpen} onOpenChange={setFotoOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Fotoğraflar</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
            {(fotoDialog ?? []).map((f: any, i: number) => (
              <div key={f?.id ?? i} className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                {f?.url ? (
                  <img
                    src={f.url}
                    alt={`Şantiye fotoğrafı ${i + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
