import { createHmac, timingSafeEqual } from 'crypto'

// Çekler bölümü, normal Yönetici girişinin ÜSTÜNE ek bir PIN kilidi ekler.
// PIN, Railway'de CEK_PIN ortam değişkeni olarak değiştirilebilir; tanımlı
// değilse aşağıdaki varsayılan kullanılır. Bu dosya hiçbir zaman tarayıcıya
// gönderilmez (sadece API route'ları / sunucu tarafında import edilir).
const CEK_PIN = process.env.CEK_PIN || '742281'
const SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'cek-fallback-secret'
const COOKIE_NAME = 'cek_erisim'
const MAX_AGE_SECONDS = 60 * 60 * 12 // 12 saat

function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('hex')
}

export function pinDogruMu(pin: string): boolean {
  if (typeof pin !== 'string' || pin.length !== CEK_PIN.length) return false
  try {
    return timingSafeEqual(Buffer.from(pin), Buffer.from(CEK_PIN))
  } catch {
    return false
  }
}

export function cekTokenUret(userId: string): { name: string; value: string; maxAge: number } {
  const exp = Date.now() + MAX_AGE_SECONDS * 1000
  const payload = `${userId}.${exp}`
  const imza = sign(payload)
  return { name: COOKIE_NAME, value: `${payload}.${imza}`, maxAge: MAX_AGE_SECONDS }
}

export function cekTokenGecerliMi(token: string | undefined, userId: string): boolean {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [tokenUserId, expStr, imza] = parts
  if (tokenUserId !== userId) return false
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || Date.now() > exp) return false
  const beklenen = sign(`${tokenUserId}.${expStr}`)
  try {
    return timingSafeEqual(Buffer.from(imza), Buffer.from(beklenen))
  } catch {
    return false
  }
}

export const CEK_COOKIE_NAME = COOKIE_NAME
