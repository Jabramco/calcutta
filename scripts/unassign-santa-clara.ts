/**
 * One-off: Unassign Santa Clara Broncos (Midwest, Seed #10), refund buyer.
 * Run: npx tsx scripts/unassign-santa-clara.ts
 */
import { prisma } from '../lib/prisma'

async function main() {
  const team = await prisma.team.findFirst({
    where: {
      dogTeamId: null,
      name: { contains: 'Santa Clara', mode: 'insensitive' },
      region: 'Midwest',
      seed: 10
    },
    include: { owner: true }
  })

  if (!team) {
    console.error('Santa Clara Broncos (Midwest, Seed #10) not found.')
    process.exit(1)
  }

  if (team.ownerId == null) {
    console.log('Santa Clara Broncos is already unassigned.')
    return
  }

  const ownerName = team.owner?.name ?? 'unknown'
  const amount = team.cost
  console.log(`Unassigning: ${team.name} - ${team.region} Region, Seed #${team.seed} (was $${amount}, owner: ${ownerName})`)

  await prisma.team.update({
    where: { id: team.id },
    data: { ownerId: null, cost: 0 }
  })

  const lastSaleRow = await prisma.settings.findUnique({ where: { key: 'lastAuctionSale' } })
  if (lastSaleRow?.value) {
    try {
      const lastSale = JSON.parse(lastSaleRow.value) as { teamName: string }
      if (lastSale.teamName === team.name) {
        await prisma.settings.delete({ where: { key: 'lastAuctionSale' } })
        console.log('Cleared lastAuctionSale.')
      }
    } catch {
      // ignore
    }
  }

  console.log(`✓ ${team.name} returned to the pool. ${ownerName}'s spend reduced by $${amount}.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
