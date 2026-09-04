export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const { id } = await params

  try {
    await prisma.$transaction(async (tx) => {
      const hareket = await tx.depoHareketi.findUnique({ where: { id } })
      if (!hareket) throw new Error('YOK')

      const malzeme = await tx.depoMalzeme.findUnique({ where: { id: hareket.malzemeId } })
      if (malzeme) {
        await tx.depoMalzeme.update({
          where: { id: hareket.malzemeId },
          data: {
            // Hareketi geri al: GİRİŞ silinirse stoktan düş, ÇIKIŞ silinirse stoğa geri ekle
            stokMiktari: hareket.tip === 'GIRIS' ? malzeme.stokMiktari - hareket.miktar : malzeme.stokMiktari + hareket.miktar,
          },
        })
      }

      await tx.depoHareketi.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e.message === 'YOK') {
      return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Silinemedi' }, { status: 500 })
  }
}
