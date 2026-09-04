export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 })
    if ((session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 })
    }

    const personeller = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        _count: { select: { isKayitlari: true } },
        sirketGecmisi: {
          where: { bitisTarihi: null },
          select: { sirket: { select: { ad: true } }, baslangicTarihi: true },
          take: 1,
        },
      },
    })

    const sonuc = personeller.map((p) => {
      const { sirketGecmisi, ...rest } = p
      return {
        ...rest,
        aktifSirket: sirketGecmisi[0]?.sirket.ad ?? null,
        aktifSirketBaslangic: sirketGecmisi[0]?.baslangicTarihi ?? null,
      }
    })

    return NextResponse.json(sonuc)
  } catch (error: any) {
    console.error("Personel list error:", error)
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
    const { email, password, name, role } = body ?? {}

    if (!email || !password || !name) {
      return NextResponse.json({ error: "Kullanıcı adı, şifre ve isim gerekli" }, { status: 400 })
    }

    const normEmail = String(email).trim().toLowerCase()

    const existing = await prisma.user.findUnique({ where: { email: normEmail } })
    if (existing) {
      return NextResponse.json({ error: "Bu kullanıcı adı zaten kullanılıyor" }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(String(password), 10)
    const user = await prisma.user.create({
      data: {
        email: normEmail,
        password: hashedPassword,
        name: String(name),
        role: role === "ADMIN" ? "ADMIN" : "PERSONEL",
      },
    })

    return NextResponse.json(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("Personel create error:", error)
    return NextResponse.json({ error: "Personel oluşturulamadı" }, { status: 500 })
  }
}
