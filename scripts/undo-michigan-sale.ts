/**
 * One-off: Undo the mistaken Michigan sale (countdown bug).
 * - Puts Michigan back in the pool (ownerId = null, cost = 0).
 * - Refunds the buyer automatically (spend = sum of owned team costs).
 * - Clears lastAuctionSale if it was Michigan so UI doesn't show stale sale.
 *
 * Run: npx tsx scripts/undo-michigan-sale.ts
 */
import { prisma } from '../lib/prisma'

async function main() {
  // Find Michigan (name contains "Michigan" but not "Michigan State")
  const allWithMichigan = await prisma.team.findMany({
    where: {
      dogTeamId: null,
      name: { contains: 'Michigan', mode: 'insensitive' }
    },
    include: { owner: true }
  })
  const michigan = allWithMichigan.find((t) => t.name === 'Michigan' || (t.name.includes('Michigan') && !t.name.includes('Michigan State')))

  if (!michigan) {
    console.error('No team matching "Michigan" (excluding Michigan State) found.')
    console.error('Teams with "Michigan" in name:', allWithMichigan.map((t) => t.name))
    process.exit(1)
  }

  if (michigan.ownerId == null) {
    console.log('Michigan is already unassigned. Nothing to do.')
    return
  }

  const ownerName = michigan.owner?.name ?? 'unknown'
  const amount = michigan.cost

  console.log(`Undoing sale: ${michigan.name} was sold to ${ownerName} for $${amount}.`)
  console.log('Unassigning Michigan and setting cost to $0 (refunds the buyer).')

  await prisma.team.update({
    where: { id: michigan.id },
    data: { ownerId: null, cost: 0 }
  })

  // Clear lastAuctionSale if it was this team so UI doesn't show stale "Last sale"
  const lastSaleRow = await prisma.settings.findUnique({ where: { key: 'lastAuctionSale' } })
  if (lastSaleRow?.value) {
    try {
      const lastSale = JSON.parse(lastSaleRow.value) as { teamName: string }
      if (lastSale.teamName === michigan.name) {
        await prisma.settings.delete({ where: { key: 'lastAuctionSale' } })
        console.log(`Cleared lastAuctionSale (was ${michigan.name}).`)
      }
    } catch {
      // ignore
    }
  }

  console.log(`\n✓ Michigan returned to the pool. ${ownerName}'s spend has been reduced by $${amount}.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
