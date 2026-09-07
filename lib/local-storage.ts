import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

// Fatura PDF'leri, S3 yerine yerel diskte (Railway Volume) saklanır.
// ÖNEMLİ: Railway'de bir Volume oluşturup bu servise bağlamadan ve
// FATURA_UPLOAD_DIR ortam değişkenini o volume'ün mount yoluna
// ayarlamadan, konteyner her yeniden başladığında/deploy olduğunda
// yüklenen dosyalar kaybolur. FATURA_UPLOAD_DIR tanımlı değilse
// ./uploads/faturalar altına yazar (yalnızca yerel geliştirme için).
function getUploadDir(): string {
  return process.env.FATURA_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'faturalar')
}

async function ensureDir(): Promise<string> {
  const dir = getUploadDir()
  await fs.mkdir(dir, { recursive: true })
  return dir
}

function sanitizeExt(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase()
  return ext === '.pdf' ? ext : '.pdf'
}

export async function faturaPdfKaydet(buffer: Buffer, originalName: string): Promise<{ storedName: string }> {
  const dir = await ensureDir()
  const storedName = `${Date.now()}-${randomUUID()}${sanitizeExt(originalName)}`
  const fullPath = path.join(dir, storedName)
  await fs.writeFile(fullPath, buffer)
  return { storedName }
}

export async function faturaPdfOku(storedName: string): Promise<Buffer> {
  const dir = getUploadDir()
  const fullPath = path.join(dir, path.basename(storedName))
  return fs.readFile(fullPath)
}

export async function faturaPdfSil(storedName: string): Promise<void> {
  const dir = getUploadDir()
  const fullPath = path.join(dir, path.basename(storedName))
  try {
    await fs.unlink(fullPath)
  } catch {
    // dosya zaten yoksa sorun değil
  }
}
