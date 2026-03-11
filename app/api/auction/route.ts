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
      currentTeam,
      lastSale: null
    })
  } catch (error: any) {
    console.error('Error fetching auction state:', error)
    console.error('Error stack:', error?.stack)
    console.error('Error message:', error?.message)
    
    // Return safe default values instead of 500 error
    return NextResponse.json({
      isActive: false,
      currentTeamId: null,
      currentBid: 0,
      currentBidder: null,
      bids: [],
      lastBidTime: null,
      currentTeam: null,
      lastSale: null
    })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, teamId, bidder, amount } = body

    const dbState = await getAuctionState()
    let state = parseState(dbState)

    if (action === 'start' || action === 'next') {
      // 'next' only when no team is currently being auctioned (don't skip a team without selling)
      if (action === 'next' && state.currentTeamId != null) {
        return NextResponse.json(
          { error: 'A team is currently being auctioned. Use Sold after a bid, or wait for the countdown.' },
          { status: 400 }
        )
      }

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
      // Run sold in a transaction with row lock so two concurrent requests can't both advance.
      const result = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ id: number; isActive: boolean; currentTeamId: number | null; currentBid: number; currentBidder: string | null; bids: string; lastBidTime: bigint | null }>>`SELECT id, "isActive", "currentTeamId", "currentBid", "currentBidder", bids, "lastBidTime" FROM "AuctionState" LIMIT 1 FOR UPDATE`
        const lockedState = rows[0]
        if (!lockedState) return { noOp: true, state: null, currentTeam: null, error: null, status: 400 }

        const state = parseState(lockedState)
        if (!state.isActive || !state.currentTeamId) {
          return { noOp: true, state: null, currentTeam: null, error: 'No active auction', status: 400 }
        }

        const hasWinningBid = state.currentBidder && state.currentBid > 0
        if (!hasWinningBid) {
          const currentTeam = await tx.team.findUnique({ where: { id: state.currentTeamId } })
          return { noOp: true, state: { ...state, currentTeam }, currentTeam, error: null, status: 200 }
        }

        const MIN_BID_AGE_MS = 2000
        const lastBidTimeMs = state.lastBidTime != null ? Number(state.lastBidTime) : 0
        if (Date.now() - lastBidTimeMs < MIN_BID_AGE_MS) {
          const currentTeam = await tx.team.findUnique({ where: { id: state.currentTeamId } })
          return { noOp: true, state: { ...state, currentTeam }, currentTeam, error: 'Please wait a moment before selling so others can see the bid.', status: 400 }
        }

        let owner = await tx.owner.findFirst({ where: { name: state.currentBidder! } })
        if (!owner) {
          owner = await tx.owner.create({ data: { name: state.currentBidder! } })
        }
        const soldTeam = await tx.team.findUnique({ where: { id: state.currentTeamId } })
        await tx.team.update({
          where: { id: state.currentTeamId },
          data: { ownerId: owner.id, cost: state.currentBid }
        })

        const unassignedTeams = await tx.team.findMany({ where: { ownerId: null } })
        let updatedDbState
        if (unassignedTeams.length > 0) {
          const randomTeam = unassignedTeams[Math.floor(Math.random() * unassignedTeams.length)]
          updatedDbState = await tx.auctionState.update({
            where: { id: lockedState.id },
            data: {
              isActive: true,
              currentTeamId: randomTeam.id,
              currentBid: 0,
              currentBidder: null,
              bids: '[]',
              lastBidTime: null
            }
          })
        } else {
          updatedDbState = await tx.auctionState.update({
            where: { id: lockedState.id },
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
        return { noOp: false, state: parseState(updatedDbState), remainingTeams: unassignedTeams.length, error: null, status: 200 }
      })

      if (result.error && result.status === 400) {
        return NextResponse.json({ success: false, error: result.error, state: result.state, noOp: true }, { status: 400 })
      }
      if (result.noOp && result.state) {
        return NextResponse.json({ success: true, state: result.state, noOp: true })
      }
      if (result.noOp) {
        return NextResponse.json({ error: result.error || 'No active auction' }, { status: result.status || 400 })
      }
      return NextResponse.json({ success: true, state: result.state, remainingTeams: result.remainingTeams })
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
  } catch (error: any) {
    console.error('Error updating auction state:', error)
    console.error('Error stack:', error?.stack)
    console.error('Error message:', error?.message)
    return NextResponse.json(
      { error: 'Failed to update auction state', details: error?.message },
      { status: 500 }
    )
  }
}
