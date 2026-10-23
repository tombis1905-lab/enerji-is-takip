'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShieldAlert, AlertTriangle } from 'lucide-react'

interface Uyari {
  id: string
  plaka: string
  isim: string | null
  tur: string
  bitis: string
  gunKaldi: number
}

const tarihTR = (s: string) => s.split('-').reverse().join('.')

function zaman(g: number) {
  if (g < 0) return `${Math.abs(g)} gün önce bitti`
  if (g === 0) return 'BUGÜN bitiyor'
  if (g === 1) return 'yarın bitiyor'
  return `${g} gün sonra bitiyor`
}

// Sigorta / muayene / kasko süresi yaklaşan veya geçmiş araçlar için kısa uyarı.
export function AracHatirlatma() {
  const [liste, setListe] = useState<Uyari[]>([])

  useEffect(() => {
    fetch('/api/araclar/hatirlatma')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setListe(Array.isArray(d) ? d : []))
      .catch(() => setListe([]))
  }, [])

  if (liste.length === 0) return null
  const gecmisVar = liste.some((h) => h.gunKaldi < 0)

  return (
    <div
      className={`rounded-xl border p-4 space-y-2 ${
        gecmisVar
          ? 'border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30'
          : 'border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-sm flex items-center gap-2">
          {gecmisVar ? <AlertTriangle className="h-4 w-4 text-red-600" /> : <ShieldAlert className="h-4 w-4 text-amber-600" />}
          Araç sigorta / muayene / kasko uyarısı
        </p>
        <Link href="/araclar" className="text-xs underline text-muted-foreground hover:text-foreground">
          Araçlara git
        </Link>
      </div>
      <ul className="space-y-1 text-sm">
        {liste.map((h) => (
          <li key={`${h.id}-${h.tur}`} className={h.gunKaldi < 0 ? 'text-red-700 dark:text-red-400' : ''}>
            <b>{h.plaka}</b>
            {h.isim ? ` (${h.isim})` : ''} — {h.tur} {tarihTR(h.bitis)} · {zaman(h.gunKaldi)}
          </li>
        ))}
      </ul>
    </div>
  )
}
