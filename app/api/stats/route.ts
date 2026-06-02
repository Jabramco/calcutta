import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateTotalPot } from '@/lib/calculations'
import { getCurrentTournament } from '@/lib/tournamentServer'
import { buildPayoutLines } from '@/lib/tournament'

export async function GET() {
  const tournament = await getCurrentTournament()
  try {
    // Only count teams that have been sold (have an owner) within the active tournament.
    const teams = await prisma.team.findMany({
      where: {
        tournament,
        ownerId: { not: null }
      },
      select: { cost: true }
    })

    const totalPot = calculateTotalPot(teams)
    const payouts = buildPayoutLines(totalPot, tournament)

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
      payouts: buildPayoutLines(0, tournament)
    })
  }
}
