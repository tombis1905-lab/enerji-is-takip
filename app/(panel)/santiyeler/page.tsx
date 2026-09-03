import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { SantiyelerClient } from "./santiyeler-client"

export default async function SantiyelerPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return <SantiyelerClient role={(session.user as any)?.role ?? "PERSONEL"} />
}
