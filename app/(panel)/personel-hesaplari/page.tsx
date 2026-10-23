import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { PersonelHesaplariClient } from './personel-hesaplari-client'

export default async function PersonelHesaplariPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if ((session.user as any).role !== 'ADMIN') redirect('/dashboard')
  return <PersonelHesaplariClient />
}
