import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Helper function to get or create auction state
async function getAuctionState() {
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
}

// Helper function to parse state from database
function parseState(dbState: any) {
  return {
    isActive: dbState.isActive,
    currentTeamId: dbState.currentTeamId,
    currentBid: dbState.currentBid,
    currentBidder: dbState.currentBidder,
    bids: JSON.parse(dbState.bids),
    lastBidTime: dbState.lastBidTime ? Number(dbState.lastBidTime) : null
  }
}

export async function GET() {
  try {
    const dbState = await getAuctionState()
    const state = parseState(dbState)
    
    let currentTeam = null
    if (state.currentTeamId) {
      currentTeam = await prisma.team.findUnique({
        where: { id: state.currentTeamId }
      })
    }

    return NextResponse.json({
      ...state,
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

    const dbState = await getAuctionState()
    let state = parseState(dbState)

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

      // Update state in database
      const updatedDbState = await prisma.auctionState.update({
        where: { id: dbState.id },
        data: {
          isActive: true,
          currentTeamId: randomTeam.id,
          currentBid: 0,
          currentBidder: null,
          bids: '[]',
          lastBidTime: null // Timer starts after first bid
        }
      })

      return NextResponse.json({ success: true, state: parseState(updatedDbState) })
    }

    if (action === 'bid') {
      if (!state.isActive || !state.currentTeamId) {
        return NextResponse.json(
          { error: 'No active auction' },
          { status: 400 }
        )
      }

      if (amount <= state.currentBid) {
        return NextResponse.json(
          { error: 'Bid must be higher than current bid' },
          { status: 400 }
        )
      }

      const newBid = { bidder, amount, timestamp: Date.now() }
      state.bids.push(newBid)

      // Update state in database
      const updatedDbState = await prisma.auctionState.update({
        where: { id: dbState.id },
        data: {
          currentBid: amount,
          currentBidder: bidder,
          bids: JSON.stringify(state.bids),
          lastBidTime: BigInt(Date.now())
        }
      })

      return NextResponse.json({ success: true, state: parseState(updatedDbState) })
    }

    if (action === 'sold') {
      if (!state.isActive || !state.currentTeamId) {
        return NextResponse.json(
          { error: 'No active auction' },
          { status: 400 }
        )
      }

      if (state.currentBidder && state.currentBid > 0) {
        // Find or create owner
        let owner = await prisma.owner.findFirst({
          where: { name: state.currentBidder }
        })

        if (!owner) {
          owner = await prisma.owner.create({
            data: { name: state.currentBidder }
          })
          console.log('Created owner:', owner)
        }

        // Assign team to winner
        const updatedTeam = await prisma.team.update({
          where: { id: state.currentTeamId },
          data: {
            ownerId: owner.id,
            cost: state.currentBid
          }
        })
        console.log('Updated team:', updatedTeam.name, 'to owner:', owner.name, 'for $', state.currentBid)
      }

      // Check if more teams remain
      const unassignedTeams = await prisma.team.findMany({
        where: { ownerId: null }
      })

      let updatedDbState
      if (unassignedTeams.length > 0) {
        // Automatically select next random team
        const randomTeam = unassignedTeams[Math.floor(Math.random() * unassignedTeams.length)]
        
        updatedDbState = await prisma.auctionState.update({
          where: { id: dbState.id },
          data: {
            isActive: true,
            currentTeamId: randomTeam.id,
            currentBid: 0,
            currentBidder: null,
            bids: '[]',
            lastBidTime: null // Timer starts after first bid
          }
        })
      } else {
        // Auction complete
        updatedDbState = await prisma.auctionState.update({
          where: { id: dbState.id },
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
        state: parseState(updatedDbState),
        remainingTeams: unassignedTeams.length
      })
    }

    if (action === 'stop') {
      // Pause the auction but preserve current team and bids
      const updatedDbState = await prisma.auctionState.update({
        where: { id: dbState.id },
        data: {
          isActive: false
        }
      })

      return NextResponse.json({ success: true, state: parseState(updatedDbState) })
    }

    if (action === 'resume') {
      if (!state.currentTeamId) {
        return NextResponse.json(
          { error: 'No team to resume auction for' },
          { status: 400 }
        )
      }

      // Resume the auction with the current team
      const updatedDbState = await prisma.auctionState.update({
        where: { id: dbState.id },
        data: {
          isActive: true,
          lastBidTime: state.currentBid > 0 ? BigInt(Date.now()) : null
        }
      })

      return NextResponse.json({ success: true, state: parseState(updatedDbState) })
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
