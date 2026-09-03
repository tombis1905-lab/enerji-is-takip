import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { PersonellerClient } from "./personeller-client"

export default async function PersonellerPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if ((session.user as any)?.role !== "ADMIN") redirect("/dashboard")

  return <PersonellerClient />
}
