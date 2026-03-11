import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

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

    // Clear team references first (ownerId FK), then delete owners
    await prisma.team.updateMany({
      data: {
        ownerId: null,
        cost: 0,
        round64: false,
        round32: false,
        sweet16: false,
        elite8: false,
        final4: false,
        championship: false,
      }
    })
    await prisma.owner.deleteMany()

    // Reset auction state via raw SQL so it works with or without lastSale column (migration)
    const existingState = await prisma.auctionState.findFirst()
    if (existingState) {
      await prisma.$executeRaw`UPDATE "AuctionState" SET "isActive" = false, "currentTeamId" = null, "currentBid" = 0, "currentBidder" = null, bids = '[]', "lastBidTime" = null WHERE id = ${existingState.id}`
      try {
        await prisma.$executeRaw`UPDATE "AuctionState" SET "lastSale" = null WHERE id = ${existingState.id}`
      } catch {
        // lastSale column may not exist yet
      }
    } else {
      await prisma.$executeRaw`INSERT INTO "AuctionState" ("isActive", "currentTeamId", "currentBid", "currentBidder", bids, "lastBidTime", "updatedAt") VALUES (false, null, 0, null, '[]', null, NOW())`
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
