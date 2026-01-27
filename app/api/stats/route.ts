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
      totalPot: totalPot || 0,
      payoutPerWin,
      percentages
    })
  } catch (error: any) {
    console.error('Error fetching stats:', error)
    console.error('Error details:', error?.message, error?.stack)
    
    // Return safe default values instead of error
    return NextResponse.json({
      totalPot: 0,
      payoutPerWin: {
        round64: 0,
        round32: 0,
        sweet16: 0,
        elite8: 0,
        final4: 0,
        championship: 0
      },
      percentages: getRoundPercentages()
    })
  }
}
