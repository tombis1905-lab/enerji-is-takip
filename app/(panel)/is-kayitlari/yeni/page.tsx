import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { KayitForm } from "./kayit-form"

export default async function YeniKayitPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return <KayitForm />
}
