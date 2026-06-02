import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentTournament } from '@/lib/tournamentServer'

export async function GET() {
  try {
    const tournament = await getCurrentTournament()
    const owners = await prisma.owner.findMany({
      where: { tournament },
      include: {
        teams: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json(owners)
  } catch (error) {
    console.error('Error fetching owners:', error)
    return NextResponse.json(
      { error: 'Failed to fetch owners' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const tournament = await getCurrentTournament()
    const body = await request.json()
    const { name, paid, paidOut } = body

    const owner = await prisma.owner.create({
      data: {
        name,
        tournament,
        paid: paid ?? false,
        paidOut: paidOut ?? false
      }
    })

    return NextResponse.json(owner, { status: 201 })
  } catch (error) {
    console.error('Error creating owner:', error)
    return NextResponse.json(
      { error: 'Failed to create owner' },
      { status: 500 }
    )
  }
}
