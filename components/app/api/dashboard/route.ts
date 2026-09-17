export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 })

    const userId = (session.user as any).id
    const role = (session.user as any).role
    const where: any = role === "ADMIN" ? {} : { userId }

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - 7)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [toplamKayit, gunlukKayit, haftalikKayit, aylikKayit] = await Promise.all([
      prisma.isKaydi.count({ where }),
      prisma.isKaydi.count({ where: { ...where, tarih: { gte: todayStart } } }),
      prisma.isKaydi.count({ where: { ...where, tarih: { gte: weekStart } } }),
      prisma.isKaydi.count({ where: { ...where, tarih: { gte: monthStart } } }),
    ])

    // Group by isTuru
    const isTuruGrouped = await prisma.isKaydi.groupBy({
      by: ["isTuruId"],
      where,
      _sum: { miktar: true },
      _count: true,
    })

    const isTurleri = await prisma.isTuru.findMany()
    const isTuruMap = Object.fromEntries((isTurleri ?? []).map((t: any) => [t.id, t]))

    const isTuruOzetleri = (isTuruGrouped ?? []).map((g: any) => ({
      ad: isTuruMap[g.isTuruId]?.ad ?? "",
      birim: isTuruMap[g.isTuruId]?.birim ?? "",
      toplam: g._sum?.miktar ?? 0,
      kayitSayisi: g._count ?? 0,
    }))

    // Group by santiye
    const santiyeGrouped = await prisma.isKaydi.groupBy({
      by: ["santiyeId"],
      where,
      _count: true,
      _sum: { miktar: true },
    })

    const santiyeler = await prisma.santiye.findMany()
    const santiyeMap = Object.fromEntries((santiyeler ?? []).map((s: any) => [s.id, s]))

    // Şantiye Durumu (Gösterge Paneli üst kısmı): her şantiye için son kayıt
    // tarihi + toplam kayıt sayısı — "ne oluyor ne bitiyor" görünümü.
    // aktif=false ise Tom onu Şantiyeler sayfasında elle "Tamamlandı" işaretlemiştir.
    // aktif=true ama uzun süredir (14 gün+) kayıt yoksa "durgun" olarak işaretlenir.
    const DURGUN_GUN_ESIGI = 14
    const sonKayitGrouped = await prisma.isKaydi.groupBy({
      by: ["santiyeId"],
      where,
      _max: { tarih: true },
    })
    const sonKayitMap = Object.fromEntries((sonKayitGrouped ?? []).map((g: any) => [g.santiyeId, g._max.tarih]))
    const toplamKayitMap = Object.fromEntries((santiyeGrouped ?? []).map((g: any) => [g.santiyeId, g._count ?? 0]))

    const santiyeDurumlari = (santiyeler ?? [])
      .map((s: any) => {
        const sonKayitTarihi: string | null = sonKayitMap[s.id] ? new Date(sonKayitMap[s.id]).toISOString() : null
        const gunFarki = sonKayitTarihi ? Math.floor((now.getTime() - new Date(sonKayitTarihi).getTime()) / 86400000) : null
        const durgun = s.aktif && gunFarki !== null && gunFarki >= DURGUN_GUN_ESIGI
        return {
          id: s.id,
          ad: s.ad,
          aktif: s.aktif,
          sonKayitTarihi,
          gunFarki,
          durgun,
          toplamKayit: toplamKayitMap[s.id] ?? 0,
        }
      })
      // Devam edenler önce (durgunlar da aralarında ama en üstte değil), tamamlananlar en altta
      .sort((a: any, b: any) => {
        if (a.aktif !== b.aktif) return a.aktif ? -1 : 1
        if (a.durgun !== b.durgun) return a.durgun ? 1 : -1
        return (b.sonKayitTarihi ?? "").localeCompare(a.sonKayitTarihi ?? "")
      })

    const santiyeOzetleri = (santiyeGrouped ?? []).map((g: any) => ({
      ad: santiyeMap[g.santiyeId]?.ad ?? "",
      kayitSayisi: g._count ?? 0,
      toplamMiktar: g._sum?.miktar ?? 0,
    }))

    // Şantiye bazlı iş türü kırılımı
    const santiyeIsTuruGrouped = await prisma.isKaydi.groupBy({
      by: ["santiyeId", "isTuruId"],
      where,
      _sum: { miktar: true },
      _count: true,
    })

    const santiyeBazliKirilim: Record<string, { santiyeAd: string; santiyeId: string; isTurleri: { ad: string; birim: string; toplam: number; kayitSayisi: number; isTuruId: string }[] }> = {}

    for (const g of santiyeIsTuruGrouped ?? []) {
      const sAd = santiyeMap[g.santiyeId]?.ad ?? ""
      if (!santiyeBazliKirilim[g.santiyeId]) {
        santiyeBazliKirilim[g.santiyeId] = { santiyeAd: sAd, santiyeId: g.santiyeId, isTurleri: [] }
      }
      santiyeBazliKirilim[g.santiyeId].isTurleri.push({
        ad: isTuruMap[g.isTuruId]?.ad ?? "",
        birim: isTuruMap[g.isTuruId]?.birim ?? "",
        toplam: g._sum?.miktar ?? 0,
        kayitSayisi: g._count ?? 0,
        isTuruId: g.isTuruId,
      })
    }

    // Her şantiyenin iş türlerini toplama göre sırala
    for (const key of Object.keys(santiyeBazliKirilim)) {
      santiyeBazliKirilim[key].isTurleri.sort((a, b) => b.toplam - a.toplam)
    }

    // Recent records
    const sonKayitlar = await prisma.isKaydi.findMany({
      where,
      orderBy: { tarih: "desc" },
      take: 10,
      include: {
        user: { select: { name: true } },
        santiye: { select: { ad: true } },
        isTuru: { select: { ad: true, birim: true } },
      },
    })

    // Time series: last 30 days
    const thirtyDaysAgo = new Date(todayStart)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentRecords = await prisma.isKaydi.findMany({
      where: { ...where, tarih: { gte: thirtyDaysAgo } },
      select: { tarih: true, miktar: true },
      orderBy: { tarih: "asc" },
    })

    // Group by date for time series
    const zamanSerisi: { tarih: string; kayitSayisi: number; toplamMiktar: number }[] = []
    const dateMap = new Map<string, { kayitSayisi: number; toplamMiktar: number }>()

    for (const r of recentRecords ?? []) {
      const dateStr = new Date(r.tarih).toISOString().split("T")[0] ?? ""
      const existing = dateMap.get(dateStr) ?? { kayitSayisi: 0, toplamMiktar: 0 }
      existing.kayitSayisi++
      existing.toplamMiktar += r?.miktar ?? 0
      dateMap.set(dateStr, existing)
    }

    dateMap.forEach((val, key) => {
      zamanSerisi.push({ tarih: key, ...val })
    })

    zamanSerisi.sort((a, b) => a.tarih.localeCompare(b.tarih))

    return NextResponse.json({
      toplamKayit,
      gunlukKayit,
      haftalikKayit,
      aylikKayit,
      isTuruOzetleri,
      santiyeOzetleri,
      santiyeBazliKirilim: Object.values(santiyeBazliKirilim),
      santiyeDurumlari,
      tumSantiyeler: santiyeler.filter((s: any) => s.aktif !== false).map((s: any) => ({ id: s.id, ad: s.ad })),
      tumIsTurleri: isTurleri.filter((t: any) => t.aktif !== false).map((t: any) => ({ id: t.id, ad: t.ad, birim: t.birim })),
      sonKayitlar,
      zamanSerisi,
    })
  } catch (error: any) {
    console.error("Dashboard error:", error)
    return NextResponse.json({ error: "Veri alınamadı" }, { status: 500 })
  }
}
