import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { LoginForm } from "./login-form"

export default async function LoginPage() {
  const session = await auth()
  if (session?.user) redirect("/dashboard")

  return (
    <div className="min-h-screen flex items-center justify-center p-4 hero-gradient">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-primary mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Enerji İş Takip</h1>
          <p className="text-muted-foreground mt-1">Enerji nakil hattı iş takip sistemi</p>
        </div>
        <div className="bg-card rounded-lg p-6" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <h2 className="font-display text-xl font-semibold tracking-tight text-center mb-6">Giriş Yap</h2>
          <LoginForm />
        </div>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Hesabınız yok mu?{" "}
          <a href="/signup" className="text-secondary font-medium hover:underline">Kayıt Ol</a>
        </p>
      </div>
    </div>
  )
}
