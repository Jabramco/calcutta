import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { propagateUsernameChange } from '@/lib/propagateUsernameChange'

/**
 * If login was renamed but pool/auction data still uses the old name (e.g. casing mismatch
 * or a failed earlier sync), rename Owner + auction JSON from `fromPoolName` → user's current login.
 */
export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const userId = typeof body.userId === 'number' ? body.userId : parseInt(String(body.userId), 10)
    const fromPoolName =
      typeof body.fromPoolName === 'string' ? body.fromPoolName.trim() : ''

    if (!Number.isFinite(userId) || userId < 1) {
      return NextResponse.json({ error: 'Invalid userId' }, { status: 400 })
    }
    if (!fromPoolName) {
      return NextResponse.json({ error: 'fromPoolName is required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (fromPoolName === user.username) {
      return NextResponse.json({ error: 'fromPoolName matches login already; nothing to do' }, { status: 400 })
    }

    try {
      await prisma.$transaction(async (tx) => {
        await propagateUsernameChange(tx, fromPoolName, user.username)
      })
    } catch (e: unknown) {
      const code = e && typeof e === 'object' && 'code' in e ? (e as { code?: string }).code : undefined
      if (code === 'OWNER_NAME_CONFLICT') {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : 'Owner name conflict' },
          { status: 409 }
        )
      }
      throw e
    }

    return NextResponse.json({ ok: true, username: user.username })
  } catch (error) {
    console.error('sync-pool-identity error:', error)
    return NextResponse.json({ error: 'Failed to sync pool identity' }, { status: 500 })
  }
}
