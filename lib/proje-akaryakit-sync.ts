import { prisma } from '@/lib/db'

// İş Kaydı ile Akaryakıt arasındaki köprü.
//
// Bir İş Kaydı'nın iş türü "akaryakıt takipli" olarak işaretlenmişse (ör. bir
// kepçenin/iş makinesinin yakıt harcaması) ve bir araç seçilmişse, o kaydın
// miktarı (TL olarak girilir) otomatik olarak Akaryakıt listesine bir kayıt
// olarak düşer — Tom aynı harcamayı Akaryakıt sayfasında ayrıca girmesin diye.
// AkaryakitKaydi.kaynakIsKaydiId bu otomatik kaydı işaretler; İş Kaydı
// silinirse/artık akaryakıt takipli olmaktan çıkarsa bu kayıt da silinir,
// değişirse (tarih/tutar/araç/şantiye) güncellenir.
export async function syncAkaryakitIsKaydi(isKaydiId: string) {
  const kayit = await prisma.isKaydi.findUnique({
    where: { id: isKaydiId },
    include: { isTuru: true },
  })

  // Kayıt silinmiş, iş türü artık akaryakıt takipli değil ya da araç
  // seçilmemişse: varsa daha önce oluşturulmuş otomatik kaydı temizle.
  if (!kayit || !kayit.isTuru.akaryakitTakibi || !kayit.aracId) {
    await prisma.akaryakitKaydi.deleteMany({ where: { kaynakIsKaydiId: isKaydiId } })
    return
  }

  const data = {
    tarih: kayit.tarih,
    tutar: kayit.miktar,
    aracId: kayit.aracId,
    santiyeId: kayit.santiyeId,
    userId: kayit.userId,
    aciklama: `İş Kaydı'ndan otomatik: ${kayit.isTuru.ad}`,
  }

  const mevcut = await prisma.akaryakitKaydi.findUnique({ where: { kaynakIsKaydiId: isKaydiId } })
  if (mevcut) {
    await prisma.akaryakitKaydi.update({ where: { id: mevcut.id }, data })
  } else {
    await prisma.akaryakitKaydi.create({ data: { ...data, kaynakIsKaydiId: isKaydiId } })
  }
}
