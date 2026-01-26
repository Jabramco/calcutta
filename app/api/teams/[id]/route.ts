import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const team = await prisma.team.findUnique({
      where: { id: parseInt(id) },
      include: {
        owner: true
      }
    })

    if (!team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(team)
  } catch (error) {
    console.error('Error fetching team:', error)
    return NextResponse.json(
      { error: 'Failed to fetch team' },
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
    const { 
      ownerId, 
      cost, 
      round64, 
      round32, 
      sweet16, 
      elite8, 
      final4, 
      championship 
    } = body

    const team = await prisma.team.update({
      where: { id: parseInt(id) },
      data: {
        ...(ownerId !== undefined && { ownerId }),
        ...(cost !== undefined && { cost }),
        ...(round64 !== undefined && { round64 }),
        ...(round32 !== undefined && { round32 }),
        ...(sweet16 !== undefined && { sweet16 }),
        ...(elite8 !== undefined && { elite8 }),
        ...(final4 !== undefined && { final4 }),
        ...(championship !== undefined && { championship })
      },
      include: {
        owner: true
      }
    })

    return NextResponse.json(team)
  } catch (error) {
    console.error('Error updating team:', error)
    return NextResponse.json(
      { error: 'Failed to update team' },
      { status: 500 }
    )
  }
}
