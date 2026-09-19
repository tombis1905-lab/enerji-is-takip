export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { faturaTokenGecerliMi, FATURA_COOKIE_NAME } from '@/lib/fatura-auth'

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

function hesaplaKdv(tutar: number, kdvOrani: number, kdvDahilTutarGirisi: number | undefined) {
  if (kdvDahilTutarGirisi !== undefined && kdvDahilTutarGirisi !== null && kdvDahilTutarGirisi !== ('' as any)) {
    const kdvDahilTutar = Number(kdvDahilTutarGirisi)
    const kdvTutari = kdvDahilTutar - tutar
    return { kdvTutari, kdvDahilTutar }
  }
  const kdvTutari = tutar * (kdvOrani / 100)
  return { kdvTutari, kdvDahilTutar: tutar + kdvTutari }
}

// "Kestiğimiz/aldığımız" hem tutar hem KDV dahil tutar boş gelip de sadece
// dahil tutar girilmişse, KDV hariç tutarı tersten (dahil / (1+oran/100))
// hesaplar. Form tarafında da aynı mantık var; burada API'ye doğrudan
// (ör. Excel import) sadece dahil tutar gönderilirse diye tekrar ediliyor.
function tutariTersTenBul(kdvDahilTutar: number, kdvOrani: number) {
  const tutar = kdvDahilTutar / (1 + kdvOrani / 100)
  return { tutar, kdvTutari: kdvDahilTutar - tutar }
}

// Karşı taraf ismiyle eşleşen bir Cari varsa onu döndürür; cariEklensinMi
// işaretliyken eşleşme yoksa yeni bir Cari kaydı oluşturur (find-or-create) —
// böylece kullanıcı formda tek bir kutucuğu işaretlemesi yeterli olur.
async function cariBulYaDaOlustur(cariId: string | undefined, karsiTaraf: string | undefined, ibanBilgisi: string | undefined, cariEklensinMi: boolean) {
  if (cariId) {
    const mevcut = await prisma.cari.findUnique({ where: { id: cariId } })
    if (mevcut) return mevcut
  }
  const ad = karsiTaraf?.trim()
  if (!ad) return null
  const eslesen = await prisma.cari.findUnique({ where: { ad } })
  if (eslesen) return eslesen
  if (!cariEklensinMi) return null
  return prisma.cari.create({ data: { ad, ibanBilgisi: ibanBilgisi?.trim() || null } })
}

export async function GET(req: NextRequest) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const faturalar = await prisma.fatura.findMany({
    include: {
      sirket: { select: { ad: true } },
      santiye: { select: { id: true, ad: true } },
      cari: { select: { id: true, ad: true, ibanBilgisi: true } },
    },
    orderBy: { tarih: 'desc' },
  })
  return NextResponse.json(faturalar)
}

export async function POST(req: NextRequest) {
  const g = await guard(req)
  if (!g.ok) return g.res

  const body = await req.json()
  const {
    tur, faturaNo, tarih, aciklama, karsiTaraf, tutar, kdvOrani,
    kdvDahilTutar, tevkifatTutari, odemeDurumu, sirketId,
    odemeTarihi, ibanBilgisi, yuklenici, santiyeId, cariId, cariEklensinMi,
  } = body

  if (!tur || (tur !== 'KESILEN' && tur !== 'ALINAN')) {
    return NextResponse.json({ error: 'Fatura türü (kestiğimiz/aldığımız) zorunludur' }, { status: 400 })
  }
  if (!tarih) {
    return NextResponse.json({ error: 'Tarih zorunludur' }, { status: 400 })
  }

  const oran = kdvOrani !== undefined && kdvOrani !== '' ? Number(kdvOrani) : 20

  let tutarSayi: number
  let kdvTutari: number
  let hesaplananDahil: number
  if ((tutar === undefined || tutar === null || tutar === '') && kdvDahilTutar !== undefined && kdvDahilTutar !== null && kdvDahilTutar !== '') {
    hesaplananDahil = Number(kdvDahilTutar)
    const ters = tutariTersTenBul(hesaplananDahil, oran)
    tutarSayi = ters.tutar
    kdvTutari = ters.kdvTutari
  } else {
    if (!tutar || Number(tutar) <= 0) {
      return NextResponse.json({ error: 'Geçerli bir tutar girin' }, { status: 400 })
    }
    tutarSayi = Number(tutar)
    const hesap = hesaplaKdv(tutarSayi, oran, kdvDahilTutar)
    kdvTutari = hesap.kdvTutari
    hesaplananDahil = hesap.kdvDahilTutar
  }

  let cariIdSonuc: string | null = null
  try {
    const cari = await cariBulYaDaOlustur(cariId, karsiTaraf, ibanBilgisi, !!cariEklensinMi)
    cariIdSonuc = cari?.id ?? null
  } catch {
    // Cari oluşturulamazsa (ör. isim çakışması) faturayı carisiz kaydetmeye devam et
    cariIdSonuc = null
  }

  try {
    const fatura = await prisma.fatura.create({
      data: {
        tur,
        faturaNo: faturaNo?.trim() || null,
        tarih: new Date(tarih),
        aciklama: aciklama?.trim() || null,
        karsiTaraf: karsiTaraf?.trim() || null,
        tutar: tutarSayi,
        kdvOrani: oran,
        kdvTutari,
        kdvDahilTutar: hesaplananDahil,
        tevkifatTutari: tevkifatTutari !== undefined && tevkifatTutari !== '' ? Number(tevkifatTutari) : null,
        odemeDurumu: odemeDurumu || 'BEKLIYOR',
        sirketId: sirketId || null,
        odemeTarihi: odemeTarihi ? new Date(odemeTarihi) : null,
        ibanBilgisi: ibanBilgisi?.trim() || null,
        yuklenici: yuklenici?.trim() || null,
        santiyeId: santiyeId || null,
        cariId: cariIdSonuc,
        cariEklensinMi: !!cariEklensinMi && !!cariIdSonuc,
      },
      include: {
        santiye: { select: { id: true, ad: true } },
        cari: { select: { id: true, ad: true, ibanBilgisi: true } },
      },
    })
    return NextResponse.json(fatura, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: 'Hata oluştu' }, { status: 500 })
  }
}
