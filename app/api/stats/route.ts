import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateTotalPot } from '@/lib/calculations'
import { getCurrentTournament } from '@/lib/tournamentServer'
import { buildPayoutLines } from '@/lib/tournament'
import { getGroupTies } from '@/lib/groupTies'

export async function GET() {
  const tournament = await getCurrentTournament()
  try {
    // Pot counts only SOLD teams. The group-stage divisor is (72 − group draws so far);
    // the live tie count lives in a tournament-scoped Settings row written by the importer.
    const teams = await prisma.team.findMany({
      where: { tournament, ownerId: { not: null } },
      select: { cost: true }
    })

    const totalPot = calculateTotalPot(teams)
    const groupTies = await getGroupTies(tournament)
    const payouts = buildPayoutLines(totalPot, tournament, groupTies)

    return NextResponse.json({
      totalPot: totalPot || 0,
      groupTies,
      payouts
    })
  } catch (error: any) {
    console.error('Error fetching stats:', error)
    console.error('Error details:', error?.message, error?.stack)

    // Return safe default values instead of error
    return NextResponse.json({
      totalPot: 0,
      groupTies: 0,
      payouts: buildPayoutLines(0, tournament, 0)
    })
  }
}
