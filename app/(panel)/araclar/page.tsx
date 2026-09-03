import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AraclarClient } from './araclar-client'

export default async function AraclarPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if ((session.user as any).role !== 'ADMIN') redirect('/dashboard')

  return <AraclarClient />
}
