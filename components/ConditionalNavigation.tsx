'use client'

import { usePathname } from 'next/navigation'
import Navigation from './Navigation'

export default function ConditionalNavigation() {
  const pathname = usePathname()
  
  // Hide navigation on login and signup pages
  if (pathname === '/login' || pathname === '/signup') {
    return null
  }
  
  return <Navigation />
}
