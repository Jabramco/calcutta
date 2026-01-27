import { prisma } from '@/lib/prisma'

// Ensure AuctionState table exists and has initial data
export async function ensureAuctionState() {
  try {
    // Try to find existing state
    const state = await prisma.auctionState.findFirst()
    return state
  } catch (error: any) {
    // If table doesn't exist, we can't create it from application code
    // This needs to be handled by migrations
    console.error('AuctionState table does not exist. Migrations need to be run.')
    throw error
  }
}

// Helper function to get or create auction state
export async function getOrCreateAuctionState() {
  try {
    let state = await prisma.auctionState.findFirst()
    
    if (!state) {
      // Create initial state if it doesn't exist
      state = await prisma.auctionState.create({
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
    
    return state
  } catch (error) {
    console.error('Error getting or creating auction state:', error)
    throw error
  }
}
