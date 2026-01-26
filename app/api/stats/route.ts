import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateTotalPot, calculatePayoutPerWin, getRoundPercentages } from '@/lib/calculations'

export async function GET() {
  try {
    // Only count teams that have been sold (have an owner)
    const teams = await prisma.team.findMany({
      where: {
        ownerId: { not: null }
      },
      select: { cost: true }
    })

    const totalPot = calculateTotalPot(teams)
    const payoutPerWin = calculatePayoutPerWin(totalPot)
    const percentages = getRoundPercentages()

    return NextResponse.json({
      totalPot,
      payoutPerWin,
      percentages
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
