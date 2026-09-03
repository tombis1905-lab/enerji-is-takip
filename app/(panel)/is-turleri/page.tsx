import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { IsTurleriClient } from "./is-turleri-client"

export default async function IsTurleriPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if ((session.user as any)?.role !== "ADMIN") redirect("/dashboard")

  return <IsTurleriClient />
}
