export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { pinDogruMu, cekTokenUret, CEK_COOKIE_NAME } from '@/lib/cek-auth'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const pin = String(body?.pin ?? '')

  if (!pinDogruMu(pin)) {
    return NextResponse.json({ error: 'PIN hatalı' }, { status: 401 })
  }

  const userId = (session.user as any).id as string
  const token = cekTokenUret(userId)

  const res = NextResponse.json({ success: true })
  res.cookies.set(token.name, token.value, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: token.maxAge,
  })
  return res
}

// Manuel kilitleme: PIN doğrulamasını iptal eder (cihazdan çıkmadan bölümü kilitler)
export async function DELETE() {
  const res = NextResponse.json({ success: true })
  res.cookies.set(CEK_COOKIE_NAME, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
  return res
}
