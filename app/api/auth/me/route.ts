import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const tokenUser = await getCurrentUser()

    if (!tokenUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Always return identity from DB so username/role changes (e.g. admin edit) show up without re-login.
    const row = await prisma.user.findUnique({
      where: { id: tokenUser.userId },
      select: { id: true, username: true, role: true }
    })

    if (!row) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      user: {
        id: row.id,
        username: row.username,
        role: row.role
      }
    })
  } catch (error) {
    console.error('Auth me error:', error)
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
}
