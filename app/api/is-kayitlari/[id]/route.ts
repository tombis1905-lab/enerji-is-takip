export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { deleteFile } from "@/lib/s3"
import { syncProjeMalzemeIsKaydi } from "@/lib/proje-malzeme-sync"
import { syncAkaryakitIsKaydi } from "@/lib/proje-akaryakit-sync"

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

    const silinecek = await prisma.isKaydi.findUnique({ where: { id }, select: { santiyeId: true, isTuruId: true } })

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

    if (silinecek) {
      try {
        await syncProjeMalzemeIsKaydi(silinecek.santiyeId, silinecek.isTuruId)
      } catch (e) {
        console.error("Proje Maliyeti malzeme senkronizasyon hatası:", e)
      }
    }

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
    const { tarih, miktar, aciklama, santiyeId, isTuruId, aracId } = body ?? {}

    const oncesi = await prisma.isKaydi.findUnique({ where: { id }, select: { santiyeId: true, isTuruId: true } })

    if (isTuruId) {
      const yeniTur = await prisma.isTuru.findUnique({ where: { id: String(isTuruId) } })
      const yeniAracId = aracId !== undefined ? aracId : (await prisma.isKaydi.findUnique({ where: { id }, select: { aracId: true } }))?.aracId
      if (yeniTur?.akaryakitTakibi && !yeniAracId) {
        return NextResponse.json({ error: "Bu iş türü için araç/makine seçimi zorunludur" }, { status: 400 })
      }
    }

    const kayit = await prisma.isKaydi.update({
      where: { id },
      data: {
        ...(tarih && { tarih: new Date(tarih) }),
        ...(miktar !== undefined && { miktar: Number(miktar) }),
        ...(aciklama !== undefined && { aciklama: aciklama ? String(aciklama) : null }),
        ...(santiyeId && { santiyeId: String(santiyeId) }),
        ...(isTuruId && { isTuruId: String(isTuruId) }),
        ...(aracId !== undefined && { aracId: aracId ? String(aracId) : null }),
      },
      include: {
        user: { select: { name: true } },
        santiye: { select: { ad: true } },
        isTuru: { select: { ad: true, birim: true } },
      },
    })

    try {
      // Hem eski hem yeni şantiye/iş türü çiftini senkronla (biri değişmiş olabilir)
      if (oncesi) await syncProjeMalzemeIsKaydi(oncesi.santiyeId, oncesi.isTuruId)
      await syncProjeMalzemeIsKaydi(kayit.santiyeId, kayit.isTuruId)
    } catch (e) {
      console.error("Proje Maliyeti malzeme senkronizasyon hatası:", e)
    }
    try {
      await syncAkaryakitIsKaydi(kayit.id)
    } catch (e) {
      console.error("Akaryakıt senkronizasyon hatası:", e)
    }

    return NextResponse.json(kayit)
  } catch (error: any) {
    console.error("IsKaydi update error:", error)
    return NextResponse.json({ error: "Kayıt güncellenemedi" }, { status: 500 })
  }
}
