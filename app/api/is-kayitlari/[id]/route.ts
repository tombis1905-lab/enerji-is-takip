export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { deleteFile } from "@/lib/s3"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 })
    if ((session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 })
    }

    const { id } = await params

    // Delete photos from S3
    const fotograflar = await prisma.isKaydiFoto.findMany({ where: { isKaydiId: id } })
    for (const f of fotograflar ?? []) {
      try {
        await deleteFile(f.cloudStoragePath)
      } catch (e: any) {
        console.error("Photo delete error:", e)
      }
    }

    await prisma.isKaydi.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("IsKaydi delete error:", error)
    return NextResponse.json({ error: "Kayıt silinemedi" }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 })
    if ((session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { tarih, miktar, aciklama, santiyeId, isTuruId } = body ?? {}

    const kayit = await prisma.isKaydi.update({
      where: { id },
      data: {
        ...(tarih && { tarih: new Date(tarih) }),
        ...(miktar !== undefined && { miktar: Number(miktar) }),
        ...(aciklama !== undefined && { aciklama: aciklama ? String(aciklama) : null }),
        ...(santiyeId && { santiyeId: String(santiyeId) }),
        ...(isTuruId && { isTuruId: String(isTuruId) }),
      },
      include: {
        user: { select: { name: true } },
        santiye: { select: { ad: true } },
        isTuru: { select: { ad: true, birim: true } },
      },
    })
    return NextResponse.json(kayit)
  } catch (error: any) {
    console.error("IsKaydi update error:", error)
    return NextResponse.json({ error: "Kayıt güncellenemedi" }, { status: 500 })
  }
}
