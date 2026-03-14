import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const SPEND_CAP = 250

/** Total $ spent by owner (by name). Only displayable teams (dogTeamId null). */
async function getOwnerTotalSpend(prismaOrTx: any, ownerName: string): Promise<number> {
  const owner = await prismaOrTx.owner.findFirst({ where: { name: ownerName } })
  if (!owner) return 0
  const teams = await prismaOrTx.team.findMany({
    where: { ownerId: owner.id, dogTeamId: null },
    select: { cost: true }
  })
  return teams.reduce((sum: number, t: { cost: number }) => sum + Number(t.cost), 0)
}

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

const AUCTION_EVENT_LOG_KEY = 'auctionEventLog'
type AuctionEvent = { type: string; message: string; timestamp: number; bidder?: string; amount?: number }

async function appendAuctionEvent(prismaOrTx: any, event: AuctionEvent) {
  const row = await prismaOrTx.settings.findUnique({ where: { key: AUCTION_EVENT_LOG_KEY } })
  const events: AuctionEvent[] = row?.value ? (() => { try { return JSON.parse(row.value) } catch { return [] } })() : []
  events.push(event)
  await prismaOrTx.settings.upsert({
    where: { key: AUCTION_EVENT_LOG_KEY },
    create: { key: AUCTION_EVENT_LOG_KEY, value: JSON.stringify(events) },
    update: { value: JSON.stringify(events) }
  })
}

export async function GET() {
  try {
    const dbState = await getAuctionState()
    const state = parseState(dbState)
    
    let currentTeam = null
    if (state.currentTeamId) {
      currentTeam = await prisma.team.findUnique({
        where: { id: state.currentTeamId },
        include: { dogMembers: { select: { name: true }, orderBy: { seed: 'asc' } } }
      })
    }

    // So clients that rejoin see "SOLD to X for $Y!" — stored in Settings to avoid schema change
    let lastSale: { teamName: string; winner: string; amount: number; remainingSpend?: number } | null = null
    const lastSaleRow = await prisma.settings.findUnique({ where: { key: 'lastAuctionSale' } })
    if (lastSaleRow?.value) {
      try {
        lastSale = JSON.parse(lastSaleRow.value) as { teamName: string; winner: string; amount: number; remainingSpend?: number }
      } catch {
        lastSale = null
      }
    }

    // Full auction event log so any device sees full history (bids, sold, now auctioning, etc.)
    let events: AuctionEvent[] = []
    const eventLogRow = await prisma.settings.findUnique({ where: { key: AUCTION_EVENT_LOG_KEY } })
    if (eventLogRow?.value) {
      try {
        events = JSON.parse(eventLogRow.value) as AuctionEvent[]
      } catch {
        events = []
      }
    }

    return NextResponse.json({
      ...state,
      currentTeam,
      lastSale,
      events
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
      lastSale: null,
      events: []
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

      // Unassigned = seeds 1–13 or Dogs (exclude member teams 14/15/16)
      const unassignedTeams = await prisma.team.findMany({
        where: {
          ownerId: null,
          OR: [
            { isDogs: true },
            { seed: { gte: 1, lte: 13 }, dogTeamId: null }
          ]
        }
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

      const now = Date.now()
      if (action === 'start') {
        await appendAuctionEvent(prisma, { type: 'system', message: 'Auction started! First team selected randomly...', timestamp: now })
      }
      await appendAuctionEvent(prisma, { type: 'bot', message: `Now auctioning: ${randomTeam.name} - ${randomTeam.region} Region, Seed #${randomTeam.seed}`, timestamp: now + (action === 'start' ? 1 : 0) })

      return NextResponse.json({ success: true, state: parseState(updatedDbState) })
    }

    if (action === 'bid') {
      const bidAmount = typeof amount === 'number' ? amount : parseFloat(amount)
      if (typeof bidder !== 'string' || !bidder.trim()) {
        return NextResponse.json({ error: 'Bidder is required' }, { status: 400 })
      }
      if (Number.isNaN(bidAmount) || bidAmount <= 0) {
        return NextResponse.json({ error: 'Valid bid amount is required' }, { status: 400 })
      }
      // Serialize bids with a transaction + row lock so 20 concurrent bidders can't overwrite each other
      const formatCurrency = (n: number) => `$${Number(n).toFixed(2)}`
      const now = Date.now()
      try {
        const updatedDbState = await prisma.$transaction(async (tx) => {
          const rows = await tx.$queryRaw<Array<{ id: number; isActive: boolean; currentTeamId: number | null; currentBid: number; currentBidder: string | null; bids: string; lastBidTime: bigint | null }>>`SELECT id, "isActive", "currentTeamId", "currentBid", "currentBidder", bids, "lastBidTime" FROM "AuctionState" LIMIT 1 FOR UPDATE`
          const locked = rows[0]
          if (!locked) throw new Error('NO_STATE')

          const lockedState = parseState(locked)
          if (!lockedState.isActive || !lockedState.currentTeamId) throw new Error('NO_ACTIVE_AUCTION')
          if (bidAmount <= lockedState.currentBid) throw new Error('BID_TOO_LOW')

          const currentTotal = await getOwnerTotalSpend(tx, bidder.trim())
          if (currentTotal + bidAmount > SPEND_CAP) throw new Error('SPEND_CAP_EXCEEDED')

          const newBid = { bidder: bidder.trim(), amount: bidAmount, timestamp: now }
          const bids = [...lockedState.bids, newBid]
          const updated = await tx.auctionState.update({
            where: { id: locked.id },
            data: {
              currentBid: bidAmount,
              currentBidder: bidder.trim(),
              bids: JSON.stringify(bids),
              lastBidTime: BigInt(now)
            }
          })
          await appendAuctionEvent(tx, { type: 'bid', message: `${bidder.trim()} bids ${formatCurrency(bidAmount)}!`, timestamp: now, bidder: bidder.trim(), amount: bidAmount })
          return updated
        })
        return NextResponse.json({ success: true, state: parseState(updatedDbState) })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        if (msg === 'SPEND_CAP_EXCEEDED') return NextResponse.json({ error: "You can't spend over $250" }, { status: 400 })
        if (msg === 'BID_TOO_LOW') return NextResponse.json({ error: 'Bid must be higher than current bid' }, { status: 400 })
        if (msg === 'NO_ACTIVE_AUCTION') return NextResponse.json({ error: 'No active auction' }, { status: 400 })
        if (msg === 'NO_STATE') return NextResponse.json({ error: 'No active auction' }, { status: 400 })
        throw e
      }
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

        const totalSpend = await getOwnerTotalSpend(tx, state.currentBidder!)
        const remainingSpend = SPEND_CAP - totalSpend
        const formatCurrency = (n: number) => `$${Number(n).toFixed(2)}`
        const soldMessage = `SOLD to ${state.currentBidder} for ${formatCurrency(state.currentBid)}! (${formatCurrency(remainingSpend)} remaining to spend)`

        const lastSaleJson = JSON.stringify({
          teamName: soldTeam?.name ?? 'Team',
          winner: state.currentBidder,
          amount: state.currentBid,
          remainingSpend
        })
        await tx.settings.upsert({
          where: { key: 'lastAuctionSale' },
          create: { key: 'lastAuctionSale', value: lastSaleJson },
          update: { value: lastSaleJson }
        })

        const unassignedTeams = await tx.team.findMany({
          where: {
            ownerId: null,
            OR: [
              { isDogs: true },
              { seed: { gte: 1, lte: 13 }, dogTeamId: null }
            ]
          }
        })
        const now = Date.now()
        await appendAuctionEvent(tx, { type: 'sold', message: soldMessage, timestamp: now })

        let updatedDbState
        if (unassignedTeams.length > 0) {
          const randomTeam = unassignedTeams[Math.floor(Math.random() * unassignedTeams.length)]
          await appendAuctionEvent(tx, { type: 'bot', message: `Now auctioning: ${randomTeam.name} - ${randomTeam.region} Region, Seed #${randomTeam.seed}`, timestamp: now + 1 })
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
        return { noOp: false, state: parseState(updatedDbState), remainingTeams: unassignedTeams.length, remainingSpend, error: null, status: 200 }
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
      return NextResponse.json({ success: true, state: result.state, remainingTeams: result.remainingTeams, remainingSpend: result.remainingSpend })
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
