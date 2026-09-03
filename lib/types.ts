import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

// Auth session types
export interface SessionUser {
  id: string
  name: string | null
  email: string | null
  role: string
}

export interface IsTuruType {
  id: string
  ad: string
  birim: string
  aktif: boolean
}

export interface SantiyeType {
  id: string
  ad: string
  konum: string | null
  aktif: boolean
}

export interface IsKaydiType {
  id: string
  tarih: string
  miktar: number
  aciklama: string | null
  userId: string
  santiyeId: string
  isTuruId: string
  createdAt: string
  user?: { name: string }
  santiye?: { ad: string }
  isTuru?: { ad: string; birim: string }
  fotograflar?: FotoType[]
}

export interface FotoType {
  id: string
  cloudStoragePath: string
  isPublic: boolean
  contentType: string
  url?: string
}

export interface PersonelType {
  id: string
  email: string
  name: string
  role: string
  createdAt: string
}
