import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { CeklerClient } from './cekler-client'

export default async function CeklerPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if ((session.user as any).role !== 'ADMIN') redirect('/dashboard')

  return <CeklerClient />
}
