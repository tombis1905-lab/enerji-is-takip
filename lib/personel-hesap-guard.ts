import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { phaTokenGecerliMi, PHA_COOKIE_NAME } from '@/lib/personel-hesap-auth'

// Personel Hesapları: sadece ADMIN + PIN çerezi
export async function hesapGuard(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return { ok: false as const, res: NextResponse.json({ error: 'Yetkisiz' }, { status: 403 }) }
  }
  const userId = (session.user as any).id as string
  if (!phaTokenGecerliMi(req.cookies.get(PHA_COOKIE_NAME)?.value, userId)) {
    return { ok: false as const, res: NextResponse.json({ error: 'PIN gerekli', code: 'PIN_GEREKLI' }, { status: 401 }) }
  }
  return { ok: true as const }
}

export const gunParse = (s: any): Date | null =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s) ? new Date(s.slice(0, 10) + 'T00:00:00.000Z') : null

export const sayi = (v: any): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
