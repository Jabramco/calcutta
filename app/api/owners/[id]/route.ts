import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const owner = await prisma.owner.findUnique({
      where: { id: parseInt(id) },
      include: {
        teams: true
      }
    })

    if (!owner) {
      return NextResponse.json(
        { error: 'Owner not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(owner)
  } catch (error) {
    console.error('Error fetching owner:', error)
    return NextResponse.json(
      { error: 'Failed to fetch owner' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, paid, paidOut } = body

    const owner = await prisma.owner.update({
      where: { id: parseInt(id) },
      data: {
        ...(name !== undefined && { name }),
        ...(paid !== undefined && { paid }),
        ...(paidOut !== undefined && { paidOut })
      }
    })

    return NextResponse.json(owner)
  } catch (error) {
    console.error('Error updating owner:', error)
    return NextResponse.json(
      { error: 'Failed to update owner' },
      { status: 500 }
    )
  }
}
