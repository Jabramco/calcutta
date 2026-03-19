import type { Prisma } from '@prisma/client'

/** Must match auction route Settings key for the live event log */
const AUCTION_EVENT_LOG_KEY = 'auctionEventLog'

/** Same pool identity as login, ignoring ASCII case (e.g. User "justin" ↔ Owner "Justin"). */
export function poolNameMatchesLogin(a: string, b: string): boolean {
  return a.localeCompare(b, undefined, { sensitivity: 'base' }) === 0
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Replace all occurrences of oldUsername in text, case-insensitive, with newUsername. */
function replaceUsernameInText(text: string, oldUsername: string, newUsername: string): string {
  if (!oldUsername) return text
  return text.replace(new RegExp(escapeRegExp(oldUsername), 'gi'), newUsername)
}

/**
 * When a login username changes, keep the calcutta pool consistent:
 * Owner row (if it matched the old login), live auction state, last sale, event log.
 * Call inside a Prisma transaction after updating the User row (or include User update in same tx).
 *
 * Owner lookup is case-insensitive so pool names still sync when casing differed from login.
 */
export async function propagateUsernameChange(
  tx: Prisma.TransactionClient,
  oldUsername: string,
  newUsername: string
): Promise<void> {
  if (!oldUsername || !newUsername || poolNameMatchesLogin(oldUsername, newUsername)) return

  let ownerWithOld = await tx.owner.findUnique({ where: { name: oldUsername } })
  if (!ownerWithOld) {
    ownerWithOld = await tx.owner.findFirst({
      where: { name: { equals: oldUsername, mode: 'insensitive' } }
    })
  }

  if (ownerWithOld) {
    const conflict = await tx.owner.findFirst({
      where: {
        name: { equals: newUsername, mode: 'insensitive' },
        NOT: { id: ownerWithOld.id }
      }
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
      typeof b.bidder === 'string' && poolNameMatchesLogin(b.bidder, oldUsername)
        ? { ...b, bidder: newUsername }
        : b
    )
    const patch: { bids: string; currentBidder?: string | null } = {
      bids: JSON.stringify(newBids)
    }
    if (st.currentBidder != null && poolNameMatchesLogin(st.currentBidder, oldUsername)) {
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
      if (typeof sale.winner === 'string' && poolNameMatchesLogin(sale.winner, oldUsername)) {
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
        if (
          typeof event.bidder === 'string' &&
          poolNameMatchesLogin(event.bidder, oldUsername)
        ) {
          event.bidder = newUsername
          changed = true
        }
        if (typeof event.message === 'string' && oldUsername) {
          const next = replaceUsernameInText(event.message, oldUsername, newUsername)
          if (next !== event.message) {
            event.message = next
            changed = true
          }
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
