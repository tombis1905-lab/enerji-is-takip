import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { FaturalarClient } from './faturalar-client'

export default async function FaturalarPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if ((session.user as any).role !== 'ADMIN') redirect('/dashboard')

  return <FaturalarClient />
}
