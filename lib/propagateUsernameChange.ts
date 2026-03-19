import type { Prisma } from '@prisma/client'

/** Must match auction route Settings key for the live event log */
const AUCTION_EVENT_LOG_KEY = 'auctionEventLog'

/**
 * When a login username changes, keep the calcutta pool consistent:
 * Owner row (if it matched the old login), live auction state, last sale, event log.
 * Call inside a Prisma transaction after updating the User row (or include User update in same tx).
 */
export async function propagateUsernameChange(
  tx: Prisma.TransactionClient,
  oldUsername: string,
  newUsername: string
): Promise<void> {
  if (!oldUsername || !newUsername || oldUsername === newUsername) return

  const ownerWithOld = await tx.owner.findUnique({ where: { name: oldUsername } })
  if (ownerWithOld) {
    const conflict = await tx.owner.findFirst({
      where: { name: newUsername, NOT: { id: ownerWithOld.id } }
    })
    if (conflict) {
      const err = new Error(
        `An owner named "${newUsername}" already exists in the pool. Rename or merge that owner first, or pick a different login name.`
      )
      ;(err as Error & { code?: string }).code = 'OWNER_NAME_CONFLICT'
      throw err
    }
    await tx.owner.update({ where: { id: ownerWithOld.id }, data: { name: newUsername } })
  }

  const st = await tx.auctionState.findFirst()
  if (st) {
    let bids: Array<{ bidder: string; amount: number; timestamp: number }> = []
    try {
      bids = JSON.parse(st.bids)
    } catch {
      bids = []
    }
    const newBids = bids.map((b) =>
      b.bidder === oldUsername ? { ...b, bidder: newUsername } : b
    )
    const patch: { bids: string; currentBidder?: string | null } = {
      bids: JSON.stringify(newBids)
    }
    if (st.currentBidder === oldUsername) {
      patch.currentBidder = newUsername
    }
    await tx.auctionState.update({ where: { id: st.id }, data: patch })
  }

  const saleRow = await tx.settings.findUnique({ where: { key: 'lastAuctionSale' } })
  if (saleRow?.value) {
    try {
      const sale = JSON.parse(saleRow.value) as {
        teamName: string
        winner: string
        amount: number
        remainingSpend?: number
      }
      if (sale.winner === oldUsername) {
        sale.winner = newUsername
        await tx.settings.update({
          where: { key: 'lastAuctionSale' },
          data: { value: JSON.stringify(sale) }
        })
      }
    } catch {
      /* ignore malformed */
    }
  }

  const logRow = await tx.settings.findUnique({ where: { key: AUCTION_EVENT_LOG_KEY } })
  if (logRow?.value) {
    try {
      const events = JSON.parse(logRow.value) as Array<{
        type: string
        message: string
        timestamp: number
        bidder?: string
        amount?: number
      }>
      let changed = false
      for (const event of events) {
        if (event.bidder === oldUsername) {
          event.bidder = newUsername
          changed = true
        }
        if (typeof event.message === 'string' && event.message.includes(oldUsername)) {
          event.message = event.message.split(oldUsername).join(newUsername)
          changed = true
        }
      }
      if (changed) {
        await tx.settings.update({
          where: { key: AUCTION_EVENT_LOG_KEY },
          data: { value: JSON.stringify(events) }
        })
      }
    } catch {
      /* ignore */
    }
  }
}
