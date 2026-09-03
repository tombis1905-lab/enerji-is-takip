export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"

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
    const userId = (session.user as any).id

    if (id === userId) {
      return NextResponse.json({ error: "Kendi hesabınızı silemezsiniz" }, { status: 400 })
    }

    // Check for related records
    const kayitCount = await prisma.isKaydi.count({ where: { userId: id } })
    if (kayitCount > 0) {
      return NextResponse.json(
        { error: "Bu personele ait iş kayıtları var. Önce onları silin." },
        { status: 400 }
      )
    }

    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Personel delete error:", error)
    return NextResponse.json({ error: "Personel silinemedi" }, { status: 500 })
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
    const { name, password, role } = body ?? {}

    const data: any = {}
    if (name) data.name = String(name)
    if (role) data.role = role === "ADMIN" ? "ADMIN" : "PERSONEL"
    if (password) data.password = await bcrypt.hash(String(password), 10)

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true },
    })
    return NextResponse.json(user)
  } catch (error: any) {
    console.error("Personel update error:", error)
    return NextResponse.json({ error: "Personel güncellenemedi" }, { status: 500 })
  }
}
