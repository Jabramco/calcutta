import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getCurrentTournament } from '@/lib/tournamentServer'
import { GROUP_TIES_SETTING_KEY } from '@/lib/groupTies'

export async function POST() {
  try {
    // Check if user is admin
    const currentUser = await getCurrentUser()
    
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const tournament = await getCurrentTournament()

    // Clear team references first (ownerId FK), then delete owners — scoped to this tournament.
    await prisma.team.updateMany({
      where: { tournament },
      data: {
        ownerId: null,
        cost: 0,
        round64: false,
        round32: false,
        sweet16: false,
        elite8: false,
        final4: false,
        championship: false,
        groupWins: 0,
        worstGd: false,
        goalDiff: 0,
        biggestUpset: false,
      }
    })
    await prisma.owner.deleteMany({ where: { tournament } })

    await prisma.settings.deleteMany({ where: { tournament, key: 'lastAuctionSale' } })
    await prisma.settings.deleteMany({ where: { tournament, key: 'auctionEventLog' } })
    // Clear the group-stage tie count so the divisor resets to the full 72 until the next import.
    await prisma.settings.deleteMany({ where: { tournament, key: GROUP_TIES_SETTING_KEY } })

    // Reset auction state
    const existingState = await prisma.auctionState.findFirst({ where: { tournament } })
    if (existingState) {
      await prisma.auctionState.update({
        where: { id: existingState.id },
        data: {
          isActive: false,
          currentTeamId: null,
          currentBid: 0,
          currentBidder: null,
          bids: '[]',
          lastBidTime: null
        }
      })
    } else {
      await prisma.auctionState.create({
        data: {
          tournament,
          isActive: false,
          currentTeamId: null,
          currentBid: 0,
          currentBidder: null,
          bids: '[]',
          lastBidTime: null
        }
      })
    }

    return NextResponse.json({ 
      success: true,
      message: 'Auction restarted successfully'
    })
  } catch (error: unknown) {
    console.error('Error restarting auction:', error)
    const message = error instanceof Error ? error.message : 'Failed to restart auction'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
