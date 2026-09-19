import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { PersonelHarcamalariClient } from './personel-harcamalari-client'

export default async function PersonelHarcamalariPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return <PersonelHarcamalariClient />
}
