import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { IhalelerClient } from './ihaleler-client'

export default async function IhalelerPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if ((session.user as any).role !== 'ADMIN') redirect('/dashboard')

  return <IhalelerClient />
}
