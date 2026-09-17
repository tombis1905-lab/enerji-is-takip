export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { getFileUrl } from "@/lib/s3"
import { syncProjeMalzemeIsKaydi } from "@/lib/proje-malzeme-sync"
import { syncAkaryakitIsKaydi } from "@/lib/proje-akaryakit-sync"

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 })

    const userId = (session.user as any).id
    const role = (session.user as any).role
    const { searchParams } = new URL(request.url)
    const santiyeId = searchParams.get("santiyeId")
    const isTuruId = searchParams.get("isTuruId")
    const page = parseInt(searchParams.get("page") ?? "1")
    const limit = parseInt(searchParams.get("limit") ?? "20")

    const where: any = {}
    if (role !== "ADMIN") where.userId = userId
    if (santiyeId) where.santiyeId = santiyeId
    if (isTuruId) where.isTuruId = isTuruId

    const [kayitlar, total] = await Promise.all([
      prisma.isKaydi.findMany({
        where,
        orderBy: { tarih: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { name: true } },
          santiye: { select: { ad: true } },
          isTuru: { select: { ad: true, birim: true } },
          fotograflar: true,
        },
      }),
      prisma.isKaydi.count({ where }),
    ])

    // Generate URLs for photos
    const kayitlarWithUrls = await Promise.all(
      (kayitlar ?? []).map(async (k: any) => {
        const fotograflar = await Promise.all(
          (k?.fotograflar ?? []).map(async (f: any) => {
            try {
              const url = await getFileUrl(f.cloudStoragePath, f.contentType, f.isPublic)
              return { ...f, url }
            } catch {
              return { ...f, url: null }
            }
          })
        )
        return { ...k, fotograflar }
      })
    )

    return NextResponse.json({ kayitlar: kayitlarWithUrls, total, page, limit })
  } catch (error: any) {
    console.error("IsKaydi list error:", error)
    return NextResponse.json({ error: "Veri alınamadı" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 })

    const userId = (session.user as any).id
    const body = await request.json()
    const { tarih, miktar, aciklama, santiyeId, isTuruId, aracId, fotograflar } = body ?? {}

    if (!tarih || miktar === undefined || !santiyeId || !isTuruId) {
      return NextResponse.json({ error: "Gerekli alanlar eksik" }, { status: 400 })
    }

    // akaryakıt takipli bir iş türüyse araç seçimi zorunlu
    const isTuru = await prisma.isTuru.findUnique({ where: { id: String(isTuruId) } })
    if (isTuru?.akaryakitTakibi && !aracId) {
      return NextResponse.json({ error: "Bu iş türü için araç/makine seçimi zorunludur" }, { status: 400 })
    }

    const kayit = await prisma.isKaydi.create({
      data: {
        tarih: new Date(tarih),
        miktar: Number(miktar),
        aciklama: aciklama ? String(aciklama) : null,
        userId,
        santiyeId: String(santiyeId),
        isTuruId: String(isTuruId),
        aracId: aracId ? String(aracId) : null,
        fotograflar: {
          create: (fotograflar ?? []).map((f: any) => ({
            cloudStoragePath: String(f.cloud_storage_path),
            isPublic: f.isPublic !== false,
            contentType: f.contentType ? String(f.contentType) : "image/jpeg",
          })),
        },
      },
      include: {
        user: { select: { name: true } },
        santiye: { select: { ad: true } },
        isTuru: { select: { ad: true, birim: true } },
        fotograflar: true,
      },
    })

    try {
      await syncProjeMalzemeIsKaydi(kayit.santiyeId, kayit.isTuruId)
    } catch (e) {
      console.error("Proje Maliyeti malzeme senkronizasyon hatası:", e)
    }
    try {
      await syncAkaryakitIsKaydi(kayit.id)
    } catch (e) {
      console.error("Akaryakıt senkronizasyon hatası:", e)
    }

    return NextResponse.json(kayit, { status: 201 })
  } catch (error: any) {
    console.error("IsKaydi create error:", error)
    return NextResponse.json({ error: "Kayıt oluşturulamadı" }, { status: 500 })
  }
}
