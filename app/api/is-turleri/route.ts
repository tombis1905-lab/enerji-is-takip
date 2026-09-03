export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 })

    const turleri = await prisma.isTuru.findMany({
      orderBy: { ad: "asc" },
    })
    return NextResponse.json(turleri)
  } catch (error: any) {
    console.error("IsTuru list error:", error)
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
    const { ad, birim } = body ?? {}
    if (!ad || !birim) return NextResponse.json({ error: "İş türü adı ve birim gerekli" }, { status: 400 })

    const isTuru = await prisma.isTuru.create({
      data: { ad: String(ad), birim: String(birim) },
    })
    return NextResponse.json(isTuru, { status: 201 })
  } catch (error: any) {
    console.error("IsTuru create error:", error)
    return NextResponse.json({ error: "İş türü oluşturulamadı" }, { status: 500 })
  }
}
