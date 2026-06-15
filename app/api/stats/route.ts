import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateTotalPot, sumGroupWins } from '@/lib/calculations'
import { getCurrentTournament } from '@/lib/tournamentServer'
import { buildPayoutLines } from '@/lib/tournament'

export async function GET() {
  const tournament = await getCurrentTournament()
  try {
    // One query for the whole tournament: the pot counts only SOLD teams, while the
    // group-stage divisor sums groupWins across ALL teams (a decisive group match counts
    // whether or not the team is owned), so the group bucket stays 14% of pot.
    const teams = await prisma.team.findMany({
      where: { tournament },
      select: { cost: true, ownerId: true, groupWins: true }
    })

    const soldTeams = teams.filter((t) => t.ownerId != null)
    const totalPot = calculateTotalPot(soldTeams)
    const actualGroupWins = sumGroupWins(teams)
    const payouts = buildPayoutLines(totalPot, tournament, actualGroupWins)

    return NextResponse.json({
      totalPot: totalPot || 0,
      payouts
    })
  } catch (error: any) {
    console.error('Error fetching stats:', error)
    console.error('Error details:', error?.message, error?.stack)

    // Return safe default values instead of error
    return NextResponse.json({
      totalPot: 0,
      payouts: buildPayoutLines(0, tournament, 0)
    })
  }
}
