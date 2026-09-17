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
    const { ad, birim, akaryakitTakibi, aktif } = body ?? {}

    const isTuru = await prisma.isTuru.update({
      where: { id },
      data: {
        ...(ad !== undefined && { ad: String(ad) }),
        ...(birim !== undefined && { birim: String(birim) }),
        ...(akaryakitTakibi !== undefined && { akaryakitTakibi: Boolean(akaryakitTakibi) }),
        ...(aktif !== undefined && { aktif: Boolean(aktif) }),
      },
    })
    return NextResponse.json(isTuru)
  } catch (error: any) {
    console.error("IsTuru update error:", error)
    return NextResponse.json({ error: "İş türü güncellenemedi" }, { status: 500 })
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
    const kayitCount = await prisma.isKaydi.count({ where: { isTuruId: id } })
    if (kayitCount > 0) {
      return NextResponse.json(
        { error: "Bu iş türüne bağlı kayıtlar var. Önce onları silin." },
        { status: 400 }
      )
    }

    await prisma.isTuru.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("IsTuru delete error:", error)
    return NextResponse.json({ error: "İş türü silinemedi" }, { status: 500 })
  }
}
