export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

const NUMERIC_FIELDS = [
  'yaklasikMaliyet',
  'sozlesmeBedeli',
  'ekIsBedeli',
  'sozlesmeSuresiGun',
  'kesinTeminatMektubu1',
  'kesinTeminatMektubu2',
  'hakedis1',
  'hakedis2',
  'hakedis3',
  'hakedis4',
  'hakedisKesin',
  'tedasKirimOrani',
] as const

const DATE_FIELDS = [
  'ihaleTarihi',
  'sozlesmeTarihi',
  'yerTeslimTarihi',
  'isBitimTarihi',
  'isBitimTarihiRevize',
  'sureUzatimBitisTarihi',
  'geciciKabulTarihi',
  'kesinKabulTarihi',
  'ilisiksizlikTarihi',
  'kesinTeminatMektubuSuresi',
  'kesinTeminatSureUzatimi',
] as const

const TEXT_FIELDS = [
  'ihaleKayitNo',
  'ihaleGrupNo',
  'projeNumarasi',
  'geciciKabulSayisi',
  'kesinKabulSayisi',
  'ilisiksizlikSayisi',
  'aciklama',
] as const

function buildData(body: any) {
  const data: any = {}
  if (body.isAdi !== undefined) data.isAdi = String(body.isAdi).trim()
  if (body.kurum !== undefined) data.kurum = String(body.kurum).trim()

  for (const f of TEXT_FIELDS) {
    if (body[f] !== undefined) data[f] = body[f]?.toString().trim() || null
  }
  for (const f of NUMERIC_FIELDS) {
    if (body[f] !== undefined) {
      data[f] = body[f] === '' || body[f] === null ? null : Number(body[f])
    }
  }
  for (const f of DATE_FIELDS) {
    if (body[f] !== undefined) data[f] = body[f] ? new Date(body[f]) : null
  }
  if (body.aktif !== undefined) data.aktif = !!body.aktif

  return data
}

export async function GET() {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const ihaleler = await prisma.ihale.findMany({
    orderBy: [{ aktif: 'desc' }, { isBitimTarihi: 'asc' }],
  })
  return NextResponse.json(ihaleler)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const body = await req.json()
  if (!body.isAdi?.trim() || !body.kurum?.trim()) {
    return NextResponse.json({ error: 'İşin adı ve kurum zorunludur' }, { status: 400 })
  }

  try {
    const ihale = await prisma.ihale.create({ data: buildData(body) })
    return NextResponse.json(ihale, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: 'Hata oluştu' }, { status: 500 })
  }
}
