export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { faturaTokenGecerliMi, FATURA_COOKIE_NAME } from '@/lib/fatura-auth'
import { faturaPdfSil } from '@/lib/local-storage'

async function guard(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return { ok: false as const, res: NextResponse.json({ error: 'Yetkisiz' }, { status: 403 }) }
  }
  const userId = (session.user as any).id as string
  const token = req.cookies.get(FATURA_COOKIE_NAME)?.value
  if (!faturaTokenGecerliMi(token, userId)) {
    return { ok: false as const, res: NextResponse.json({ error: 'PIN gerekli', code: 'PIN_GEREKLI' }, { status: 401 }) }
  }
  return { ok: true as const }
}

// Tom yeni bir toplu Excel'den baştan aktarım yapmak istediğinde önce eski
// tüm faturaları temizleyebilmesi için: kayıtlı tüm faturaları ve varsa
// üzerlerine yüklenmiş PDF dosyalarını siler. Cariler, şantiyeler, personel
// vb. diğer veriler etkilenmez — yalnızca Fatura tablosu boşaltılır.
// Geri alınamaz olduğu için istemci tarafında ekstra onay isteniyor.
export async function POST(req: NextRequest) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const hepsi = await prisma.fatura.findMany({ select: { id: true, pdfYolu: true } })

  for (const f of hepsi) {
    if (f.pdfYolu) {
      try {
        await faturaPdfSil(f.pdfYolu)
      } catch {
        // bir dosya silinemese bile veritabanı temizliği devam etsin
      }
    }
  }

  const sonuc = await prisma.fatura.deleteMany({})
  return NextResponse.json({ success: true, silinen: sonuc.count })
}
