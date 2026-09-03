import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { PanelLayout } from "@/components/panel-layout"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const user = {
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: (session.user as any)?.role ?? "PERSONEL",
    id: (session.user as any)?.id ?? "",
  }

  return <PanelLayout user={user}>{children}</PanelLayout>
}
