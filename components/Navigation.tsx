'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface User {
  id: number
  username: string
  role: string
}

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Skip auth check on public pages
    if (pathname === '/login' || pathname === '/signup') {
      setLoading(false)
      return
    }
    fetchUser()
  }, [pathname])

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      setUser(null)
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const links = [
    { href: '/', label: 'Dashboard' },
    { href: '/auction', label: 'Auction' },
    { href: '/teams', label: 'Teams' },
    { href: '/finances', label: 'Finances', adminOnly: true },
    { href: '/admin', label: 'Admin', adminOnly: true }
  ]

  return (
    <nav className="bg-[#15151e] border-b border-[#2a2a38] shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <h1 className="text-xl font-bold text-white">🏀 NCAA Calcutta</h1>
            <div className="flex space-x-2">
              {links.map(link => {
                // Hide admin-only links from non-admin users
                if (link.adminOnly && (!user || user.role !== 'admin')) {
                  return null
                }
                
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      pathname === link.href
                        ? 'bg-[#00ceb8] text-[#0d0d14] font-semibold'
                        : 'text-[#a0a0b8] hover:bg-[#1c1c28] hover:text-white'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {loading ? null : user ? (
              <>
                <span className="text-sm text-[#a0a0b8]">
                  <span className="text-white font-medium">{user.username}</span>
                  {user.role === 'admin' && (
                    <span className="ml-2 px-2 py-1 bg-[#9d4edd] text-white text-xs rounded-full font-medium">
                      Admin
                    </span>
                  )}
                </span>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-[#a0a0b8] hover:bg-[#1c1c28] hover:text-white transition-all"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 rounded-lg text-sm font-medium text-[#a0a0b8] hover:bg-[#1c1c28] hover:text-white transition-all"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

