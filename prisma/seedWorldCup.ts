import { prisma } from '../lib/prisma'

/**
 * Seed the World Cup tournament: 48 teams across 12 groups (A–L) of 4.
 *
 * This ONLY touches rows where tournament = 'worldcup'. March Madness data
 * (tournament = 'marchmadness') is never read or modified, so the existing
 * production experience is left exactly as-is. The NCAA ESPN auto-import is
 * also scoped to March Madness, so it cannot overwrite these teams.
 *
 * Idempotent: re-running clears and recreates the World Cup data.
 *
 * Note on names: co-host annotations ("(Co-host)") from the source list are stored
 * as clean country names (e.g. "Mexico", "Canada", "United States"). Special
 * characters (Türkiye, Curaçao) are stored verbatim (UTF-8).
 */
const TOURNAMENT = 'worldcup'

const GROUPS: Record<string, string[]> = {
  A: ['Mexico', 'South Africa', 'South Korea', 'Czechia'],
  B: ['Canada', 'Bosnia and Herzegovina', 'Qatar', 'Switzerland'],
  C: ['Brazil', 'Morocco', 'Haiti', 'Scotland'],
  D: ['United States', 'Paraguay', 'Australia', 'Türkiye'],
  E: ['Germany', 'Curaçao', 'Ivory Coast', 'Ecuador'],
  F: ['Netherlands', 'Japan', 'Sweden', 'Tunisia'],
  G: ['Belgium', 'Egypt', 'Iran', 'New Zealand'],
  H: ['Spain', 'Cape Verde', 'Saudi Arabia', 'Uruguay'],
  I: ['France', 'Senegal', 'Iraq', 'Norway'],
  J: ['Argentina', 'Algeria', 'Austria', 'Jordan'],
  K: ['Portugal', 'DR Congo', 'Uzbekistan', 'Colombia'],
  L: ['England', 'Croatia', 'Ghana', 'Panama']
}

async function main() {
  console.log('Seeding World Cup teams...')

  // Clear ONLY World Cup data — March Madness is untouched.
  await prisma.team.deleteMany({ where: { tournament: TOURNAMENT } })
  await prisma.owner.deleteMany({ where: { tournament: TOURNAMENT } })
  await prisma.settings.deleteMany({ where: { tournament: TOURNAMENT } })
  await prisma.auctionState.deleteMany({ where: { tournament: TOURNAMENT } })

  let created = 0
  for (const [group, teams] of Object.entries(GROUPS)) {
    let position = 1
    for (const name of teams) {
      await prisma.team.create({
        data: {
          name,
          tournament: TOURNAMENT,
          region: group, // World Cup "group" reuses the NCAA `region` column.
          seed: position, // position within the group (1–4)
          ownerId: null,
          cost: 0
        }
      })
      position++
      created++
    }
  }

  // One auction state row for the World Cup experience.
  await prisma.auctionState.create({
    data: {
      tournament: TOURNAMENT,
      isActive: false,
      currentTeamId: null,
      currentBid: 0,
      currentBidder: null,
      bids: '[]',
      lastBidTime: null
    }
  })

  const total = await prisma.team.count({ where: { tournament: TOURNAMENT } })
  console.log(`Created ${created} World Cup teams (${total} total in 12 groups of 4).`)
  console.log('World Cup seed completed successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
