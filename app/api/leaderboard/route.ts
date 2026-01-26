import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateTotalPot, calculateOwnerStats } from '@/lib/calculations'

export async function GET() {
  try {
    const owners = await prisma.owner.findMany({
      include: {
        teams: true
      }
    })

    const teams = await prisma.team.findMany({
      select: { cost: true }
    })

    const totalPot = calculateTotalPot(teams)

    const leaderboard = owners.map(owner => 
      calculateOwnerStats(owner, owner.teams, totalPot)
    )

    // Sort by ROI descending
    leaderboard.sort((a, b) => b.roi - a.roi)

    return NextResponse.json(leaderboard)
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    )
  }
}
