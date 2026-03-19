/**
 * One-off: Unassign Michigan State and Texas Tech, refund buyers.
 * Run: npx tsx scripts/unassign-michigan-state-texas-tech.ts
 */
import { prisma } from '../lib/prisma'

const NAME_MATCHES = ['Michigan State', 'Texas Tech']

async function main() {
  const teams = await prisma.team.findMany({
    where: { dogTeamId: null },
    include: { owner: true }
  })

  const toUnassign: { id: number; name: string; cost: number; ownerName: string | null }[] = []
  for (const match of NAME_MATCHES) {
    const team = teams.find((t) => t.name === match || t.name.includes(match))
    if (!team) {
      console.warn(`No team found for "${match}"`)
      continue
    }
    if (team.ownerId == null) {
      console.warn(`"${team.name}" is already unassigned, skipping`)
      continue
    }
    toUnassign.push({
      id: team.id,
      name: team.name,
      cost: team.cost,
      ownerName: team.owner?.name ?? null
    })
  }

  if (toUnassign.length === 0) {
    console.log('No teams to unassign.')
    return
  }

  console.log('Unassigning and refunding:')
  for (const t of toUnassign) {
    console.log(`  - ${t.name} (was $${t.cost}, owner: ${t.ownerName ?? '?'})`)
  }

  await prisma.team.updateMany({
    where: { id: { in: toUnassign.map((t) => t.id) } },
    data: { ownerId: null, cost: 0 }
  })

  // Clear lastAuctionSale if it was one of these teams
  const lastSaleRow = await prisma.settings.findUnique({ where: { key: 'lastAuctionSale' } })
  if (lastSaleRow?.value) {
    try {
      const lastSale = JSON.parse(lastSaleRow.value) as { teamName: string }
      if (toUnassign.some((t) => t.name === lastSale.teamName)) {
        await prisma.settings.delete({ where: { key: 'lastAuctionSale' } })
        console.log(`Cleared lastAuctionSale (was ${lastSale.teamName}).`)
      }
    } catch {
      // ignore
    }
  }

  console.log(`\n✓ ${toUnassign.length} team(s) returned to the pool. Buyers' spend reduced by the amounts above.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
