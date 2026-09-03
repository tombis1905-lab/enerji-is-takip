# Enerji İş Takip — Mobile API Reference

Mobile clients authenticate via `POST /api/mobile-auth/login` and send the returned token as `Authorization: Bearer <token>` on every subsequent request.

| Method | Path | operationId | Auth | Description |
|--------|------|-------------|------|-------------|
| GET | /api/dashboard | getDashboard | ✅ | Gösterge paneli verileri |
| GET | /api/santiyeler | listSantiyeler | ✅ | Tüm şantiyeleri listeler |
| POST | /api/santiyeler | createSantiye | ✅ Admin | Yeni şantiye oluşturur |
| PUT | /api/santiyeler/{id} | updateSantiye | ✅ Admin | Şantiye günceller |
| DELETE | /api/santiyeler/{id} | deleteSantiye | ✅ Admin | Şantiye siler |
| GET | /api/is-turleri | listIsTurleri | ✅ | Tüm iş türlerini listeler |
| POST | /api/is-turleri | createIsTuru | ✅ Admin | Yeni iş türü oluşturur |
| DELETE | /api/is-turleri/{id} | deleteIsTuru | ✅ Admin | İş türü siler |
| GET | /api/is-kayitlari | listIsKayitlari | ✅ | İş kayıtlarını listeler |
| POST | /api/is-kayitlari | createIsKaydi | ✅ | Yeni iş kaydı oluşturur |
| PUT | /api/is-kayitlari/{id} | updateIsKaydi | ✅ Admin | İş kaydı günceller |
| DELETE | /api/is-kayitlari/{id} | deleteIsKaydi | ✅ Admin | İş kaydı siler |
| GET | /api/araclar | listAraclar | ✅ | Tüm araçları listeler |
| POST | /api/araclar | createArac | ✅ Admin | Yeni araç ekler |
| PUT | /api/araclar/{id} | updateArac | ✅ Admin | Araç günceller |
| DELETE | /api/araclar/{id} | deleteArac | ✅ Admin | Araç siler |
| GET | /api/akaryakit | listAkaryakit | ✅ | Akaryakıt kayıtlarını listeler |
| POST | /api/akaryakit | createAkaryakit | ✅ | Yeni akaryakıt kaydı oluşturur |
| PUT | /api/akaryakit/{id} | updateAkaryakit | ✅ Admin | Akaryakıt kaydı günceller |
| DELETE | /api/akaryakit/{id} | deleteAkaryakit | ✅ Admin | Akaryakıt kaydı siler |
| GET | /api/personeller | listPersoneller | ✅ Admin | Tüm personelleri listeler |
| POST | /api/personeller | createPersonel | ✅ Admin | Yeni personel oluşturur |
| PUT | /api/personeller/{id} | updatePersonel | ✅ Admin | Personel günceller |
| DELETE | /api/personeller/{id} | deletePersonel | ✅ Admin | Personel siler |
| POST | /api/upload/presigned | getPresignedUploadUrl | ✅ | Dosya yükleme için presigned URL |
| POST | /api/signup | signup | ❌ | Yeni kullanıcı kaydı (PERSONEL) |
