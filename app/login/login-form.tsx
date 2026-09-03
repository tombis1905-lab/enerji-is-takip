'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { User, Lock } from 'lucide-react'

export function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) {
      toast.error('Kullanıcı adı ve şifre gerekli')
      return
    }
    setLoading(true)
    try {
      const res = await signIn('credentials', {
        email: username.trim().toLowerCase(),
        password,
        redirect: false,
      })
      if (res?.error) {
        toast.error('Kullanıcı adı veya şifre hatalı')
      } else {
        toast.success('Giriş başarılı')
        router.replace('/dashboard')
      }
    } catch {
      toast.error('Giriş yapılırken hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">Kullanıcı Adı</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="username"
            type="text"
            placeholder="Kullanıcı adınızı girin"
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
            placeholder="Şifrenizi girin"
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            className="pl-10"
            autoComplete="current-password"
          />
        </div>
      </div>
      <Button type="submit" className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90" loading={loading}>
        Giriş Yap
      </Button>
    </form>
  )
}
