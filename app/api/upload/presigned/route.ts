export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { generatePresignedUploadUrl } from "@/lib/s3"

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 })

    const body = await request.json()
    const { fileName, contentType, isPublic } = body ?? {}

    if (!fileName || !contentType) {
      return NextResponse.json({ error: "Dosya adı ve türü gerekli" }, { status: 400 })
    }

    const result = await generatePresignedUploadUrl(
      String(fileName),
      String(contentType),
      isPublic !== false
    )

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Presigned URL error:", error)
    return NextResponse.json({ error: "Yükleme URL'si oluşturulamadı" }, { status: 500 })
  }
}
