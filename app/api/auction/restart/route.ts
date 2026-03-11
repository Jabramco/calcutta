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

    // Reset auction state (include lastSale when column exists)
    const existingState = await prisma.auctionState.findFirst()
    const resetData = {
      isActive: false,
      currentTeamId: null,
      currentBid: 0,
      currentBidder: null,
      bids: '[]',
      lastBidTime: null,
      lastSale: null
    }
    if (existingState) {
      await prisma.auctionState.update({
        where: { id: existingState.id },
        data: resetData
      })
    } else {
      await prisma.auctionState.create({
        data: resetData
      })
    }

    return NextResponse.json({ 
      success: true,
      message: 'Auction restarted successfully'
    })
  } catch (error) {
    console.error('Error restarting auction:', error)
    return NextResponse.json(
      { error: 'Failed to restart auction' },
      { status: 500 }
    )
  }
}
