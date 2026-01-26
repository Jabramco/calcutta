import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// In-memory auction state (in production, use Redis or database)
let auctionState = {
  isActive: false,
  currentTeamId: null as number | null,
  currentBid: 0,
  currentBidder: null as string | null,
  bids: [] as Array<{ bidder: string; amount: number; timestamp: number }>,
  lastBidTime: null as number | null
}

export async function GET() {
  try {
    let currentTeam = null
    if (auctionState.currentTeamId) {
      currentTeam = await prisma.team.findUnique({
        where: { id: auctionState.currentTeamId }
      })
    }

    return NextResponse.json({
      ...auctionState,
      currentTeam
    })
  } catch (error) {
    console.error('Error fetching auction state:', error)
    return NextResponse.json(
      { error: 'Failed to fetch auction state' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, teamId, bidder, amount } = body

    if (action === 'start' || action === 'next') {
      // Get all unassigned teams
      const unassignedTeams = await prisma.team.findMany({
        where: { ownerId: null }
      })

      if (unassignedTeams.length === 0) {
        return NextResponse.json(
          { error: 'No teams available for auction' },
          { status: 400 }
        )
      }

      // Select random team
      const randomTeam = unassignedTeams[Math.floor(Math.random() * unassignedTeams.length)]

      auctionState = {
        isActive: true,
        currentTeamId: randomTeam.id,
        currentBid: 0,
        currentBidder: null,
        bids: [],
        lastBidTime: null // Timer only starts after first bid
      }

      return NextResponse.json({ success: true, state: auctionState })
    }

    if (action === 'bid') {
      if (!auctionState.isActive || !auctionState.currentTeamId) {
        return NextResponse.json(
          { error: 'No active auction' },
          { status: 400 }
        )
      }

      if (amount <= auctionState.currentBid) {
        return NextResponse.json(
          { error: 'Bid must be higher than current bid' },
          { status: 400 }
        )
      }

      auctionState.currentBid = amount
      auctionState.currentBidder = bidder
      auctionState.bids.push({ bidder, amount, timestamp: Date.now() })
      auctionState.lastBidTime = Date.now() // Reset timer on new bid

      return NextResponse.json({ success: true, state: auctionState })
    }

    if (action === 'sold') {
      if (!auctionState.isActive || !auctionState.currentTeamId) {
        return NextResponse.json(
          { error: 'No active auction' },
          { status: 400 }
        )
      }

      if (auctionState.currentBidder && auctionState.currentBid > 0) {
        // Find or create owner
        let owner = await prisma.owner.findFirst({
          where: { name: auctionState.currentBidder }
        })

        if (!owner) {
          owner = await prisma.owner.create({
            data: { name: auctionState.currentBidder }
          })
          console.log('Created owner:', owner)
        }

        // Assign team to winner
        const updatedTeam = await prisma.team.update({
          where: { id: auctionState.currentTeamId },
          data: {
            ownerId: owner.id,
            cost: auctionState.currentBid
          }
        })
        console.log('Updated team:', updatedTeam.name, 'to owner:', owner.name, 'for $', auctionState.currentBid)
      }

      // Check if more teams remain
      const unassignedTeams = await prisma.team.findMany({
        where: { ownerId: null }
      })

      if (unassignedTeams.length > 0) {
        // Automatically select next random team
        const randomTeam = unassignedTeams[Math.floor(Math.random() * unassignedTeams.length)]
        
        auctionState = {
          isActive: true,
          currentTeamId: randomTeam.id,
          currentBid: 0,
          currentBidder: null,
          bids: [],
          lastBidTime: null // Timer only starts after first bid
        }
      } else {
        // Auction complete
        auctionState = {
          isActive: false,
          currentTeamId: null,
          currentBid: 0,
          currentBidder: null,
          bids: [],
          lastBidTime: null
        }
      }

      return NextResponse.json({ 
        success: true, 
        state: auctionState,
        remainingTeams: unassignedTeams.length
      })
    }

    if (action === 'stop') {
      auctionState = {
        isActive: false,
        currentTeamId: null,
        currentBid: 0,
        currentBidder: null,
        bids: [],
        lastBidTime: null
      }

      return NextResponse.json({ success: true, state: auctionState })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error updating auction state:', error)
    return NextResponse.json(
      { error: 'Failed to update auction state' },
      { status: 500 }
    )
  }
}
