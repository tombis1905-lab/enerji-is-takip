import { prisma } from '@/lib/db'

// İş Kayıtları ile Proje Maliyeti > Malzeme arasındaki köprü.
//
// Tom bir İş Kaydı girdiğinde (ör. "Botaş şantiyesine 3 m3 beton gitti" —
// şantiye + iş türü "Beton" + miktar 3), bunu Proje Maliyeti'nde ayrıca elle
// girmesine gerek kalmasın diye, aynı şantiye + iş türü için otomatik bir
// ProjeMalzeme kalemi oluşturup/güncelliyoruz. kullanilanMiktar her zaman o
// şantiye + iş türü için girilen TÜM İş Kayıtları'nın miktar toplamına eşit
// tutulur. Birim fiyatı (TL) Tom Proje Maliyeti sayfasında elle girer —
// İş Kaydı ekranında fiyat bilgisi olmadığı için oradan gelemez.
export async function syncProjeMalzemeIsKaydi(santiyeId: string, isTuruId: string) {
  const isTuru = await prisma.isTuru.findUnique({ where: { id: isTuruId } })
  if (!isTuru) return

  const agg = await prisma.isKaydi.aggregate({
    where: { santiyeId, isTuruId },
    _sum: { miktar: true },
  })
  const toplam = agg._sum.miktar ?? 0

  const mevcut = await prisma.projeMalzeme.findFirst({ where: { santiyeId, isTuruId } })

  if (mevcut) {
    await prisma.projeMalzeme.update({
      where: { id: mevcut.id },
      data: { kullanilanMiktar: toplam, kalem: isTuru.ad, birim: isTuru.birim },
    })
  } else if (toplam > 0) {
    await prisma.projeMalzeme.create({
      data: {
        santiyeId,
        isTuruId,
        kalem: isTuru.ad,
        birim: isTuru.birim,
        kullanilanMiktar: toplam,
        birimFiyat: 0,
      },
    })
  }
}
