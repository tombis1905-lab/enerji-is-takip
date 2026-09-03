import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AkaryakitClient } from './akaryakit-client'

export default async function AkaryakitPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return <AkaryakitClient role={(session.user as any).role} />
}
