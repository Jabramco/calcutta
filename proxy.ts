import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from './lib/auth'

// Routes that don't require authentication
const publicRoutes = ['/login', '/signup']

// Routes that require admin access
const adminRoutes = ['/finances', '/admin']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Allow public routes
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next()
  }
  
  // Get auth token from cookie
  const token = request.cookies.get('auth_token')?.value
  
  if (!token) {
    // Redirect to login if not authenticated
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  // Verify token
  const user = await verifyToken(token)
  
  if (!user) {
    // Invalid token, redirect to login
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('auth_token')
    return response
  }
  
  // Check admin access for admin routes
  if (adminRoutes.some(route => pathname.startsWith(route)) && user.role !== 'admin') {
    return NextResponse.redirect(new URL('/', request.url))
  }
  
  return NextResponse.next()
}

// Configure which routes use this proxy
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api routes (they handle their own auth)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - other static files (svg, png, jpg, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.webp).*)',
  ],
}
