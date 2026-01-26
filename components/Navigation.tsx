'use client'

import Link from 'next/link'
import Image from 'next/image'
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    // Skip auth check on public pages
    if (pathname === '/login' || pathname === '/signup') {
      setLoading(false)
      return
    }
    fetchUser()
  }, [pathname])

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false)
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
    <nav className="glass-nav shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 flex-shrink-0">
            <Image 
              src="/logo.svg" 
              alt="Calcutta Logo" 
              width={40} 
              height={40}
              className="object-contain"
            />
            <h1 className="text-xl font-bold text-white">Calcutta</h1>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-2">
            {links.map(link => {
              // Hide admin-only links from non-admin users
              if (link.adminOnly && (!user || user.role !== 'admin')) {
                return null
              }
              
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    pathname === link.href
                      ? 'nav-tab-active text-white font-semibold'
                      : 'nav-tab text-[#a0a0b8]'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>

          {/* Desktop User Menu */}
          <div className="hidden lg:flex items-center space-x-4">
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

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-[#a0a0b8] hover:bg-[#1c1c28] hover:text-white transition-all"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              // X icon
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              // Hamburger icon
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-4 border-t border-[#2a2a38]">
            <div className="flex flex-col space-y-2">
              {links.map(link => {
                // Hide admin-only links from non-admin users
                if (link.adminOnly && (!user || user.role !== 'admin')) {
                  return null
                }
                
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-4 py-3 rounded-lg text-sm font-medium ${
                      pathname === link.href
                        ? 'nav-tab-active text-white font-semibold'
                        : 'nav-tab text-[#a0a0b8]'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}
              
              {/* Mobile User Section */}
              <div className="pt-4 mt-4 border-t border-[#2a2a38]">
                {loading ? null : user ? (
                  <>
                    <div className="px-4 py-2 text-sm">
                      <span className="text-white font-medium block">{user.username}</span>
                      {user.role === 'admin' && (
                        <span className="inline-block mt-2 px-2 py-1 bg-[#9d4edd] text-white text-xs rounded-full font-medium">
                          Admin
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full mt-2 px-4 py-3 rounded-lg text-sm font-medium text-[#a0a0b8] hover:bg-[#1c1c28] hover:text-white transition-all text-left"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    className="block px-4 py-3 rounded-lg text-sm font-medium text-[#a0a0b8] hover:bg-[#1c1c28] hover:text-white transition-all"
                  >
                    Login
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
