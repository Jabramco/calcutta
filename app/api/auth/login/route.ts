import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { generateToken } from '@/lib/auth'
import { serialize } from 'cookie'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const username = typeof body.username === 'string' ? body.username.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    // Validation
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      )
    }

    // Find user (exact match; username is trimmed above)
    const user = await prisma.user.findUnique({
      where: { username }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      )
    }

    // Verify password (guard against invalid hash in DB)
    let validPassword = false
    try {
      validPassword = await bcrypt.compare(password, user.password)
    } catch (e) {
      console.error('Login bcrypt.compare error:', e)
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      )
    }
    if (!validPassword) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      )
    }

    // Generate token
    const token = await generateToken({
      userId: user.id,
      username: user.username,
      role: user.role
    })

    // Serialize cookie
    const cookie = serialize('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })

    // Create response with Set-Cookie header
    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    }, {
      headers: {
        'Set-Cookie': cookie
      }
    })

    return response
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    console.error('Login error:', message, stack)
    // In development, surface the error so we can fix it; in production keep it generic
    const isDev = process.env.NODE_ENV !== 'production'
    return NextResponse.json(
      { error: 'Failed to login', ...(isDev && { details: message }) },
      { status: 500 }
    )
  }
}
