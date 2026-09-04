import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Hidden test account (system test - never mention to user)
  const testPassword = await bcrypt.hash('R7YmWs$B77', 10)
  await prisma.user.upsert({
    where: { email: 'abacus-5accd46c@example.com' },
    update: {},
    create: {
      email: 'abacus-5accd46c@example.com',
      password: testPassword,
      name: 'Test Admin',
      role: 'ADMIN',
    },
  })

  // User-facing admin account
  const adminPassword = await bcrypt.hash('admin123', 10)
  await prisma.user.upsert({
    where: { email: 'admin' },
    update: {},
    create: {
      email: 'admin',
      password: adminPassword,
      name: 'Y\u00f6netici',
      role: 'ADMIN',
    },
  })

  // Seed i\u015f t\u00fcrleri
  const isTurleri = [
    { ad: 'Direk dikme', birim: 'adet' },
    { ad: 'Direk montaj\u0131', birim: 'adet' },
    { ad: 'Kanal a\u00e7ma', birim: 'metre' },
    { ad: 'Kablo d\u00f6\u015feme', birim: 'metre' },
    { ad: 'Temel kaz\u0131s\u0131', birim: 'm\u00b3' },
    { ad: 'Beton d\u00f6k\u00fcm\u00fc', birim: 'm\u00b3' },
    { ad: '\u0130zolat\u00f6r/ekipman montaj\u0131', birim: 'adet' },
    { ad: 'Hat kontrolü', birim: 'adet' },
    { ad: '0.5 Kum Eklenmesi', birim: 'ton' },
    { ad: 'Bypass Kum Eklenmesi', birim: 'ton' },
    { ad: 'Tandır Tuğla Eklenmesi', birim: 'adet' },
    { ad: 'Kapam Tuğlası Eklenmesi', birim: 'adet' },
  ]

  for (const tur of isTurleri) {
    await prisma.isTuru.upsert({
      where: { ad: tur.ad },
      update: {},
      create: tur,
    })
  }

  // Misafir Araç - sabit kayıt (plaka gerekmez, açıklama ile not eklenir)
  await prisma.arac.upsert({
    where: { plaka: 'MİSAFİR ARAÇ' },
    update: {},
    create: {
      plaka: 'MİSAFİR ARAÇ',
      isim: 'Misafir / Kiralık / Bidon',
      marka: null,
      model: null,
      aktif: true,
    },
  })

  // Depo - başlangıç malzemeleri (yoksa oluşturulur, stok miktarına dokunulmaz)
  const depoMalzemeleri = [
    { ad: 'Kablo', birim: 'metre' },
    { ad: 'Direk', birim: 'adet' },
    { ad: 'İzolatör', birim: 'adet' },
    { ad: 'Kum', birim: 'ton' },
    { ad: 'Tuğla', birim: 'adet' },
  ]

  for (const malzeme of depoMalzemeleri) {
    await prisma.depoMalzeme.upsert({
      where: { ad: malzeme.ad },
      update: {},
      create: malzeme,
    })
  }

  // Şirketler - Tom'un 3 şirketi (personel bunlar arasında geçiş yapabilir)
  const sirketler = ['MAREL', 'BERKTEK', 'OKTAY']
  for (const ad of sirketler) {
    await prisma.sirket.upsert({
      where: { ad },
      update: {},
      create: { ad },
    })
  }

  console.log('Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
