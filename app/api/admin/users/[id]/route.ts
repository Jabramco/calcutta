import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { getCurrentUser } from '@/lib/auth'
import { propagateUsernameChange } from '@/lib/propagateUsernameChange'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check if user is admin
    const currentUser = await getCurrentUser()
    
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const username =
      typeof body.username === 'string' ? body.username.trim() : undefined
    const password = body.password
    const role = body.role
    const { id } = await params
    const userId = parseInt(id)

    const before = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true }
    })

    if (!before) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const oldLoginUsername = before.username

    // Build update data
    const updateData: Record<string, unknown> = {}

    if (username !== undefined && username.length > 0) {
      // Check if username is already taken by another user
      const existingUser = await prisma.user.findFirst({
        where: {
          username,
          NOT: { id: userId }
        }
      })

      if (existingUser) {
        return NextResponse.json(
          { error: 'Username already taken' },
          { status: 409 }
        )
      }

      updateData.username = username
    }

    if (password) {
      updateData.password = await bcrypt.hash(password, 10)
    }

    if (role) {
      updateData.role = role
    }

    try {
      const user = await prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({
          where: { id: userId },
          data: updateData as Parameters<typeof tx.user.update>[0]['data'],
          select: {
            id: true,
            username: true,
            role: true,
            createdAt: true
          }
        })

        if (oldLoginUsername !== updated.username) {
          await propagateUsernameChange(tx, oldLoginUsername, updated.username)
        }

        return updated
      })

      return NextResponse.json(user)
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
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check if user is admin
    const currentUser = await getCurrentUser()
    
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const { id } = await params
    const userId = parseInt(id)
    
    // Prevent deleting yourself
    if (currentUser.userId === userId) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    await prisma.user.delete({
      where: { id: userId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}
