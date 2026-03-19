/**
 * One-off: Unassign these teams (return to pool) so they can be re-auctioned.
 * Refunds the owner automatically (their spend = sum of owned team costs).
 *
 * Run: npx tsx scripts/unassign-teams.ts
 */
import { prisma } from '../lib/prisma'

const TEAMS_TO_UNASSIGN = [
  { nameMatch: 'BYU', expectedCost: 62 },
  { nameMatch: 'Ohio State', expectedCost: 79 },
  { nameMatch: 'Michigan State', expectedCost: 69 },
  { nameMatch: 'Louisville', expectedCost: 5 },
  { nameMatch: 'Dogs East', expectedCost: 20 }
]

async function main() {
  const allTeams = await prisma.team.findMany({
    where: { dogTeamId: null },
    include: { owner: true }
  })

  const toUnassign: { id: number; name: string; cost: number; ownerName: string | null }[] = []

  for (const { nameMatch, expectedCost } of TEAMS_TO_UNASSIGN) {
    const team = allTeams.find((t) => {
      if (nameMatch === 'Dogs East') return t.isDogs && t.region === 'East'
      return t.name.includes(nameMatch) || t.name === nameMatch
    })
    if (!team) {
      console.warn(`No team found for "${nameMatch}" (expected $${expectedCost})`)
      continue
    }
    if (team.ownerId == null) {
      console.warn(`Team "${team.name}" ($${team.cost}) is already unassigned, skipping`)
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

  console.log('Unassigning and resetting cost to $0:')
  for (const t of toUnassign) {
    console.log(`  - ${t.name} (was $${t.cost}, owner: ${t.ownerName ?? '?'})`)
  }

  await prisma.team.updateMany({
    where: { id: { in: toUnassign.map((t) => t.id) } },
    data: { ownerId: null, cost: 0 }
  })

  console.log(`\n✓ ${toUnassign.length} team(s) returned to the pool. Owners' spending is now reduced by those amounts.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
