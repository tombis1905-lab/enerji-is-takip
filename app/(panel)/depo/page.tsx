import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { DepoClient } from './depo-client'

export default async function DepoPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return <DepoClient role={(session.user as any).role} />
}
