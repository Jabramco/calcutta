import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateTotalPot, calculateOwnerStats, sumGroupWins } from '@/lib/calculations'
import { getCurrentTournament } from '@/lib/tournamentServer'

export async function GET() {
  try {
    const tournament = await getCurrentTournament()
    const owners = await prisma.owner.findMany({
      where: { tournament },
      include: {
        teams: true
      }
    })

    const teams = await prisma.team.findMany({
      where: { tournament },
      select: { cost: true, groupWins: true }
    })

    const totalPot = calculateTotalPot(teams)
    const actualGroupWins = sumGroupWins(teams)

    const leaderboard = owners
      .map((owner) => calculateOwnerStats(owner, owner.teams, totalPot, actualGroupWins))
      .filter((entry) => entry.totalInvestment > 1)

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
