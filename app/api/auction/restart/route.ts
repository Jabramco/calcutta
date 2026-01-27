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

    // Delete all owners
    await prisma.owner.deleteMany()

    // Reset all teams - remove owners, costs, and wins
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

    // Reset auction state
    const existingState = await prisma.auctionState.findFirst()
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
  } catch (error) {
    console.error('Error restarting auction:', error)
    return NextResponse.json(
      { error: 'Failed to restart auction' },
      { status: 500 }
    )
  }
}
