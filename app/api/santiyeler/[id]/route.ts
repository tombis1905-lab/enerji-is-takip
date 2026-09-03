export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"

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
    const { ad, konum, aktif } = body ?? {}

    const santiye = await prisma.santiye.update({
      where: { id },
      data: {
        ...(ad !== undefined && { ad: String(ad) }),
        ...(konum !== undefined && { konum: konum ? String(konum) : null }),
        ...(aktif !== undefined && { aktif: Boolean(aktif) }),
      },
    })
    return NextResponse.json(santiye)
  } catch (error: any) {
    console.error("Santiye update error:", error)
    return NextResponse.json({ error: "Şantiye güncellenemedi" }, { status: 500 })
  }
}

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

    const kayitCount = await prisma.isKaydi.count({ where: { santiyeId: id } })
    if (kayitCount > 0) {
      return NextResponse.json(
        { error: "Bu şantiyeye bağlı iş kayıtları var. Önce onları silin." },
        { status: 400 }
      )
    }

    await prisma.santiye.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Santiye delete error:", error)
    return NextResponse.json({ error: "Şantiye silinemedi" }, { status: 500 })
  }
}
