import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ProjeMaliyetiClient } from './proje-maliyeti-client'

export default async function ProjeMaliyetiPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if ((session.user as any).role !== 'ADMIN') redirect('/dashboard')

  return <ProjeMaliyetiClient />
}
