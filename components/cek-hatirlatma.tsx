'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BellRing, AlertTriangle } from 'lucide-react'

interface Hatirlatma {
  id: string
  tur: 'ALINAN' | 'VERILEN'
  kime: string
  vade: string
  gunKaldi: number
}

function tarihTR(s: string) {
  return s.split('-').reverse().join('.')
}

function zamanMetni(g: number) {
  if (g < 0) return `${Math.abs(g)} gün önce vadesi geçti`
  if (g === 0) return 'BUGÜN'
  if (g === 1) return 'yarın'
  return `${g} gün sonra`
}

// Yaklaşan / geçmiş çekler için kısa uyarı. Tutar, banka, çek no gösterilmez.
export function CekHatirlatma() {
  const [liste, setListe] = useState<Hatirlatma[]>([])

  useEffect(() => {
    fetch('/api/cekler/hatirlatma')
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
          {gecmisVar ? <AlertTriangle className="h-4 w-4 text-red-600" /> : <BellRing className="h-4 w-4 text-amber-600" />}
          Çek hatırlatması
        </p>
        <Link href="/cekler" className="text-xs underline text-muted-foreground hover:text-foreground">
          Çeklere git (PIN)
        </Link>
      </div>
      <ul className="space-y-1 text-sm">
        {liste.map((h) => (
          <li key={h.id} className={h.gunKaldi < 0 ? 'text-red-700 dark:text-red-400' : ''}>
            <b>{tarihTR(h.vade)}</b> ({zamanMetni(h.gunKaldi)}) —{' '}
            {h.tur === 'VERILEN' ? (
              <>
                <b>{h.kime}</b> için çek ödemesi var
              </>
            ) : (
              <>
                <b>{h.kime}</b> çekinden ödeme alınacak
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
