import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { SignupForm } from "./signup-form"

export default async function SignupPage() {
  const session = await auth()
  if (session?.user) redirect("/dashboard")

  return (
    <div className="min-h-screen flex items-center justify-center p-4 hero-gradient">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-primary mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Kayıt Ol</h1>
          <p className="text-muted-foreground mt-1">Yeni hesap oluşturun</p>
        </div>
        <div className="bg-card rounded-lg p-6" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <SignupForm />
        </div>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Zaten hesabınız var mı?{" "}
          <a href="/login" className="text-secondary font-medium hover:underline">Giriş Yap</a>
        </p>
      </div>
    </div>
  )
}
