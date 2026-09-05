'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  ClipboardList,
  PlusCircle,
  Building2,
  Users,
  Wrench,
  LogOut,
  PanelLeft,
  Zap,
  ChevronRight,
  Truck,
  Fuel,
  Package,
  Gavel,
  FileCheck2,
} from 'lucide-react'

interface PanelLayoutProps {
  user: { name: string | null; email: string | null; role: string; id: string }
  children: React.ReactNode
}

const navItems = [
  { href: '/dashboard', label: 'Gösterge Paneli', icon: LayoutDashboard, adminOnly: false },
  { href: '/is-kayitlari/yeni', label: 'Yeni Kayıt', icon: PlusCircle, adminOnly: false },
  { href: '/is-kayitlari', label: 'İş Kayıtları', icon: ClipboardList, adminOnly: false },
  { href: '/santiyeler', label: 'Şantiyeler', icon: Building2, adminOnly: false },
  { href: '/is-turleri', label: 'İş Türleri', icon: Wrench, adminOnly: true },
  { href: '/personeller', label: 'Personeller', icon: Users, adminOnly: true },
  { href: '/araclar', label: 'Araçlar', icon: Truck, adminOnly: true },
  { href: '/akaryakit', label: 'Akaryakıt', icon: Fuel, adminOnly: false },
  { href: '/depo', label: 'Depo', icon: Package, adminOnly: false },
  { href: '/ihaleler', label: 'İhaleler', icon: Gavel, adminOnly: true },
  { href: '/cekler', label: 'Çekler', icon: FileCheck2, adminOnly: true },
]

export function PanelLayout({ user, children }: PanelLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const isAdmin = user?.role === 'ADMIN'

  const filteredNav = navItems.filter((item) => !item.adminOnly || isAdmin)

  const handleLogout = () => {
    signOut({ redirectTo: '/login' })
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-primary text-primary-foreground transition-transform duration-300 ease-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold">Enerji İş Takip</h1>
              <p className="text-xs opacity-70">Nakil Hattı Sistemi</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-4 px-3">
            <ul className="space-y-1">
              {filteredNav.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href))
                const Icon = item.icon
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                        isActive
                          ? 'bg-secondary text-white'
                          : 'text-primary-foreground/80 hover:bg-white/10 hover:text-primary-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                      {isActive && <ChevronRight className="h-4 w-4 ml-auto" />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* User */}
          <div className="border-t border-white/10 px-4 py-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-secondary/30 flex items-center justify-center text-sm font-bold">
                {(user?.name ?? '?')?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name ?? 'Kullanıcı'}</p>
                <p className="text-xs opacity-60">{isAdmin ? 'Yönetici' : 'Personel'}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Çıkış Yap
            </Button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-card/80 backdrop-blur-md px-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <PanelLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="hidden sm:inline">{user?.name ?? ''}</span>
            <span className={cn(
              'px-2 py-0.5 rounded-full text-xs font-medium',
              isAdmin ? 'bg-secondary/10 text-secondary' : 'bg-muted text-muted-foreground'
            )}>
              {isAdmin ? 'Yönetici' : 'Personel'}
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
