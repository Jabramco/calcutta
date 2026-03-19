/**
 * Fun facts from the auction event log + current team assignments.
 *
 * Run: npx tsx scripts/auction-fun-facts.ts
 */
import { prisma } from '../lib/prisma'

const AUCTION_EVENT_LOG_KEY = 'auctionEventLog'

type AuctionEvent = {
  type: string
  message: string
  timestamp: number
  bidder?: string
  amount?: number
}

function parseTeamFromNowAuctioning(message: string): string | null {
  const m = message.match(/^Now auctioning:\s*(.+?)\s*-\s*.+Region/)
  return m ? m[1].trim() : null
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

async function main() {
  const row = await prisma.settings.findUnique({ where: { key: AUCTION_EVENT_LOG_KEY } })
  if (!row?.value) {
    console.log('No auction event log found (key: auctionEventLog). Nothing to analyze.')
    return
  }

  let events: AuctionEvent[] = []
  try {
    events = JSON.parse(row.value) as AuctionEvent[]
  } catch {
    console.error('Could not parse auction event log JSON.')
    process.exit(1)
  }

  events = [...events].sort((a, b) => a.timestamp - b.timestamp)

  const bidCounts = new Map<string, number>()
  let lastAmount: number | null = null
  let currentTeamLabel: string | null = null
  let segmentBidCount = 0
  const teamRoundBids: { team: string; bids: number }[] = []
  let teamRounds = 0
  let firstBid: { bidder: string; amount: number; ts: number } | null = null
  let lastBid: { bidder: string; amount: number; ts: number } | null = null

  type JumpRecord = {
    bidder: string
    jump: number
    fromAmount: number
    toAmount: number
    teamLabel: string | null
  }
  let bestJump: JumpRecord | null = null

  for (const ev of events) {
    if (ev.type === 'bot' && ev.message.startsWith('Now auctioning:')) {
      if (currentTeamLabel != null && segmentBidCount > 0) {
        teamRoundBids.push({ team: currentTeamLabel, bids: segmentBidCount })
      }
      lastAmount = null
      segmentBidCount = 0
      currentTeamLabel = parseTeamFromNowAuctioning(ev.message) ?? ev.message
      teamRounds++
      continue
    }
    if (ev.type === 'system' && ev.message.includes('Auction started')) {
      lastAmount = null
      currentTeamLabel = null
      segmentBidCount = 0
      continue
    }
    if (ev.type === 'bid' && ev.bidder && typeof ev.amount === 'number') {
      const bidder = ev.bidder.trim()
      bidCounts.set(bidder, (bidCounts.get(bidder) ?? 0) + 1)
      segmentBidCount++

      if (!firstBid) firstBid = { bidder, amount: ev.amount, ts: ev.timestamp }
      lastBid = { bidder, amount: ev.amount, ts: ev.timestamp }

      if (lastAmount !== null) {
        const jump = ev.amount - lastAmount
        if (jump > 0 && (!bestJump || jump > bestJump.jump)) {
          bestJump = {
            bidder,
            jump,
            fromAmount: lastAmount,
            toAmount: ev.amount,
            teamLabel: currentTeamLabel
          }
        }
      }
      lastAmount = ev.amount
    }
    if (ev.type === 'sold') {
      if (currentTeamLabel != null && segmentBidCount > 0) {
        teamRoundBids.push({ team: currentTeamLabel, bids: segmentBidCount })
      }
      lastAmount = null
      segmentBidCount = 0
    }
  }

  if (currentTeamLabel != null && segmentBidCount > 0) {
    teamRoundBids.push({ team: currentTeamLabel, bids: segmentBidCount })
  }

  const bidders = [...bidCounts.entries()].filter(([, n]) => n > 0)
  if (bidders.length === 0) {
    console.log('No bid events found in the log.')
    return
  }

  const totalBids = bidders.reduce((s, [, n]) => s + n, 0)
  const maxCount = Math.max(...bidders.map(([, n]) => n))
  const minCount = Math.min(...bidders.map(([, n]) => n))
  const mostBidsNames = bidders.filter(([, n]) => n === maxCount).map(([name]) => name)
  const fewestBidsNames = bidders.filter(([, n]) => n === minCount).map(([name]) => name)

  const hottestTeam =
    teamRoundBids.length > 0
      ? teamRoundBids.reduce((a, b) => (b.bids > a.bids ? b : a), teamRoundBids[0])
      : null

  // DB: sold teams (auctionable rows only)
  const soldTeams = await prisma.team.findMany({
    where: {
      ownerId: { not: null },
      dogTeamId: null,
      isDogs: false,
      seed: { gte: 1, lte: 13 }
    },
    include: { owner: true }
  })

  const byOwner = new Map<string, { count: number; spend: number }>()
  for (const t of soldTeams) {
    const name = t.owner?.name ?? '?'
    const cur = byOwner.get(name) ?? { count: 0, spend: 0 }
    cur.count += 1
    cur.spend += t.cost
    byOwner.set(name, cur)
  }

  let topBuyer: { name: string; count: number; spend: number } | null = null
  for (const [name, v] of byOwner) {
    if (!topBuyer || v.count > topBuyer.count || (v.count === topBuyer.count && v.spend > topBuyer.spend)) {
      topBuyer = { name, count: v.count, spend: v.spend }
    }
  }

  const withCost = soldTeams.filter((t) => t.cost > 0)
  const priciest = withCost.length ? withCost.reduce((a, b) => (b.cost > a.cost ? b : a)) : null
  const cheapest = withCost.length ? withCost.reduce((a, b) => (b.cost < a.cost ? b : a)) : null
  const totalPot = withCost.reduce((s, t) => s + t.cost, 0)
  const avgSale = withCost.length ? totalPot / withCost.length : 0

  const pct = (n: number) => ((n / totalBids) * 100).toFixed(1)

  const facts: string[] = []

  facts.push(
    `**The machine:** ${mostBidsNames.join(' & ')} placed the most bids — **${maxCount}** — that’s **${pct(maxCount)}%** of all **${totalBids}** bids in the log.`
  )

  facts.push(
    `**Minimum effort:** ${fewestBidsNames.join(' & ')} each logged only **${minCount}** bid${minCount === 1 ? '' : 's'} — fewest of anyone who bid at all.`
  )

  if (bestJump) {
    facts.push(
      `**Biggest flex:** **${bestJump.bidder}** jumped the price by **+$${bestJump.jump}** ($${bestJump.fromAmount} → **$${bestJump.toAmount}**) on **${bestJump.teamLabel ?? 'a team'}** — the largest single step vs the bid right before it.`
    )
  }

  if (hottestTeam) {
    facts.push(
      `**Most chaotic lot:** **${hottestTeam.team}** drew **${hottestTeam.bids}** bids before the hammer — the busiest team in the log.`
    )
  }

  facts.push(
    `**Scale:** **${teamRounds}** “now auctioning” rounds and **${bidders.length}** unique bidders in the event log.`
  )

  if (firstBid && lastBid) {
    const spanMin = Math.round((lastBid.ts - firstBid.ts) / 60000)
    facts.push(
      `**Bookends:** First logged bid: **${firstBid.bidder}** at **$${firstBid.amount}** (${formatTime(firstBid.ts)}). Last: **${lastBid.bidder}** at **$${lastBid.amount}** (${formatTime(lastBid.ts)}) — about **${spanMin}** minutes between them.`
    )
  }

  if (topBuyer) {
    facts.push(
      `**Shopping spree (current roster):** **${topBuyer.name}** owns the most teams in the DB right now — **${topBuyer.count}** teams for **$${topBuyer.spend.toFixed(0)}** total (seeds 1–13 only).`
    )
  }

  if (priciest?.owner) {
    facts.push(
      `**Top ticket:** **${priciest.name}** sold for **$${priciest.cost.toFixed(0)}** to **${priciest.owner.name}** — highest winning bid on the board.`
    )
  }

  if (cheapest?.owner && cheapest.id !== priciest?.id) {
    facts.push(
      `**Steal of the night:** **${cheapest.name}** went for just **$${cheapest.cost.toFixed(0)}** to **${cheapest.owner.name}** — lowest sale among assigned seeds 1–13.`
    )
  } else if (cheapest?.owner) {
    facts.push(
      `**Bargain baseline:** Cheapest sale was **$${cheapest.cost.toFixed(0)}** (**${cheapest.name}**, **${cheapest.owner.name}**).`
    )
  }

  facts.push(
    `**Pot math:** **${withCost.length}** teams sold (seeds 1–13) total **$${totalPot.toFixed(0)}** in winning bids — average **$${avgSale.toFixed(0)}** per team.`
  )

  const sortedRounds = [...teamRoundBids].sort((a, b) => b.bids - a.bids)
  if (facts.length < 10 && sortedRounds[1]) {
    facts.push(
      `**Runner-up chaos:** **${sortedRounds[1].team}** had **${sortedRounds[1].bids}** bids — second-busiest lot.`
    )
  }
  const bidValues = [...bidders.map(([, n]) => n)].sort((a, b) => a - b)
  const medianBids = bidValues.length % 2 === 1
    ? bidValues[(bidValues.length - 1) / 2]
    : (bidValues[bidValues.length / 2 - 1] + bidValues[bidValues.length / 2]) / 2
  if (facts.length < 10) {
    facts.push(
      `**Middle of the pack:** Median bids per bidder was **${medianBids}** (min **${minCount}**, max **${maxCount}**).`
    )
  }

  console.log('\n🎲 10 fun facts — auction last night\n')
  facts.slice(0, 10).forEach((f, i) => {
    console.log(`${i + 1}. ${f.replace(/\*\*/g, '')}\n`)
  })

  console.log('--- Bid leaderboard ---')
  for (const [name, n] of [...bidders].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name}: ${n}`)
  }
  console.log('')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
