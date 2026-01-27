import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const teams = await prisma.team.findMany({
      include: {
        owner: true
      },
      orderBy: [
        { region: 'asc' },
        { seed: 'asc' }
      ]
    })

    return NextResponse.json(teams)
  } catch (error: any) {
    console.error('Error fetching teams:', error)
    console.error('Error stack:', error?.stack)
    console.error('Error message:', error?.message)
    
    // Return empty array instead of error object so the UI doesn't break
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, region, seed, ownerId, cost } = body

    const team = await prisma.team.create({
      data: {
        name,
        region,
        seed,
        ownerId,
        cost: cost ?? 0
      },
      include: {
        owner: true
      }
    })

    return NextResponse.json(team, { status: 201 })
  } catch (error) {
    console.error('Error creating team:', error)
    return NextResponse.json(
      { error: 'Failed to create team' },
      { status: 500 }
    )
  }
}
