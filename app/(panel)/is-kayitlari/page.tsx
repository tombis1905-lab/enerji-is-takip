import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { IsKayitlariClient } from "./is-kayitlari-client"

export default async function IsKayitlariPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return (
    <IsKayitlariClient
      role={(session.user as any)?.role ?? "PERSONEL"}
      userId={(session.user as any)?.id ?? ""}
    />
  )
}
