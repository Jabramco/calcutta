import { prisma } from '@/lib/prisma'
import type { TournamentKey } from '@/lib/tournament'

/**
 * Tournament-scoped Settings key holding the number of DRAWN group-stage matches.
 * Written by the World Cup importer on every run (reset + recomputed from the live ESPN
 * feed), and read by every payout consumer so the group-stage divisor (72 − ties) is
 * identical on the server and the client.
 */
export const GROUP_TIES_SETTING_KEY = 'group_ties'

/** Read the live group-stage draw count for a tournament (0 if unset / on error). */
export async function getGroupTies(tournament: TournamentKey): Promise<number> {
  try {
    const row = await prisma.settings.findUnique({
      where: { tournament_key: { tournament, key: GROUP_TIES_SETTING_KEY } }
    })
    const n = parseInt(row?.value ?? '0', 10)
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}
