import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, name } = body ?? {}

    if (!email || !password) {
      return NextResponse.json(
        { error: "Kullanıcı adı ve şifre gerekli" },
        { status: 400 }
      )
    }

    const normEmail = String(email).trim().toLowerCase()

    const existing = await prisma.user.findUnique({ where: { email: normEmail } })
    if (existing) {
      return NextResponse.json(
        { error: "Bu kullanıcı adı zaten kullanılıyor" },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(String(password), 10)

    const user = await prisma.user.create({
      data: {
        email: normEmail,
        password: hashedPassword,
        name: name ? String(name) : normEmail,
        role: "PERSONEL",
      },
    })

    return NextResponse.json(
      { id: user.id, email: user.email, name: user.name },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("Signup error:", error)
    return NextResponse.json(
      { error: "Kayıt oluşturulamadı" },
      { status: 500 }
    )
  }
}
