'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { User, Lock, UserPlus } from 'lucide-react'

export function SignupForm() {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password || !name) {
      toast.error('Tüm alanları doldurun')
      return
    }
    if (password.length < 4) {
      toast.error('Şifre en az 4 karakter olmalı')
      return
    }
    setLoading(true)
    try {
      const normUsername = username.trim().toLowerCase()
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normUsername, password, name }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error ?? 'Kayıt oluşturulamadı')
        return
      }
      // Auto login after signup
      const signInRes = await signIn('credentials', {
        email: normUsername,
        password,
        redirect: false,
      })
      if (signInRes?.error) {
        toast.error('Kayıt başarılı ancak giriş yapılamadı. Lütfen giriş sayfasından deneyin.')
        router.push('/login')
      } else {
        toast.success('Hesap oluşturuldu!')
        router.replace('/dashboard')
      }
    } catch {
      toast.error('Kayıt sırasında hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">İsim Soyisim</Label>
        <div className="relative">
          <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="name"
            type="text"
            placeholder="Adınız ve soyadınız"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="username">Kullanıcı Adı</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="username"
            type="text"
            placeholder="Kullanıcı adınız"
            value={username}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
            className="pl-10"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Şifre</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="password"
            type="password"
            placeholder="Şifrenizi belirleyin"
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            className="pl-10"
            autoComplete="new-password"
          />
        </div>
      </div>
      <Button type="submit" className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90" loading={loading}>
        Kayıt Ol
      </Button>
    </form>
  )
}
