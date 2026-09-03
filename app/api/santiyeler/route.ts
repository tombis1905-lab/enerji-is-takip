export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 })

    const santiyeler = await prisma.santiye.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { isKayitlari: true } } },
    })
    return NextResponse.json(santiyeler)
  } catch (error: any) {
    console.error("Santiye list error:", error)
    return NextResponse.json({ error: "Veri alınamadı" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 })
    if ((session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 })
    }

    const body = await request.json()
    const { ad, konum } = body ?? {}
    if (!ad) return NextResponse.json({ error: "Şantiye adı gerekli" }, { status: 400 })

    const santiye = await prisma.santiye.create({
      data: { ad: String(ad), konum: konum ? String(konum) : null },
    })
    return NextResponse.json(santiye, { status: 201 })
  } catch (error: any) {
    console.error("Santiye create error:", error)
    return NextResponse.json({ error: "Şantiye oluşturulamadı" }, { status: 500 })
  }
}
