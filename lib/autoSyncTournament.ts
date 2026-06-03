import prisma from '@/lib/prisma'
import { runTournamentImport, runWorldCupImport } from '@/lib/tournamentImport'
import { DEFAULT_TOURNAMENT, type TournamentKey } from '@/lib/tournament'

const LAST_SYNC_KEY = 'tournamentAutoSyncLastMs'
const LOCK_UNTIL_KEY = 'tournamentAutoSyncLockUntilMs'

function parseMs(value: string | null | undefined): number {
  if (!value) return 0
  const n = parseInt(value, 10)
  return Number.isFinite(n) ? n : 0
}

function tournamentYear(): number {
  const env = process.env.TOURNAMENT_IMPORT_YEAR
  if (env) {
    const y = parseInt(env, 10)
    if (!Number.isNaN(y) && y >= 2000 && y <= 2100) return y
  }
  return new Date().getUTCFullYear()
}

/**
 * Run the ESPN import opportunistically during normal API traffic.
 * - No external cron required.
 * - Throttled by interval to avoid repeated imports.
 * - Best effort: never throws to callers.
 *
 * Parameterized by tournament: March Madness pulls the NCAA basketball scoreboard,
 * the World Cup pulls the FIFA soccer scoreboard. Throttle/lock state lives in
 * tournament-scoped Settings rows, so the two experiences sync independently and
 * one can never trigger or overwrite the other's import.
 */
export async function maybeAutoSyncTournament(
  tournament: TournamentKey = DEFAULT_TOURNAMENT
): Promise<void> {
  const now = Date.now()
  const intervalMin = Math.max(1, parseInt(process.env.TOURNAMENT_AUTO_SYNC_MINUTES ?? '15', 10) || 15)
  const minIntervalMs = intervalMin * 60 * 1000
  const lockWindowMs = 2 * 60 * 1000
  const SYNC_TOURNAMENT = tournament

  try {
    const settings = await prisma.settings.findMany({
      where: { tournament: SYNC_TOURNAMENT, key: { in: [LAST_SYNC_KEY, LOCK_UNTIL_KEY] } }
    })
    const byKey = new Map(settings.map((s) => [s.key, s.value]))
    const lastMs = parseMs(byKey.get(LAST_SYNC_KEY))
    const lockUntilMs = parseMs(byKey.get(LOCK_UNTIL_KEY))

    if (lockUntilMs > now) return
    if (lastMs > 0 && now - lastMs < minIntervalMs) return

    await prisma.settings.upsert({
      where: { tournament_key: { tournament: SYNC_TOURNAMENT, key: LOCK_UNTIL_KEY } },
      update: { value: String(now + lockWindowMs) },
      create: { tournament: SYNC_TOURNAMENT, key: LOCK_UNTIL_KEY, value: String(now + lockWindowMs) }
    })

    const result =
      tournament === 'worldcup'
        ? await runWorldCupImport(tournamentYear())
        : await runTournamentImport(tournamentYear())
    if (!result.success && result.status !== 404) {
      console.warn(`[autoSyncTournament] ${tournament} import did not fully succeed:`, result.error)
    }

    await prisma.settings.upsert({
      where: { tournament_key: { tournament: SYNC_TOURNAMENT, key: LAST_SYNC_KEY } },
      update: { value: String(Date.now()) },
      create: { tournament: SYNC_TOURNAMENT, key: LAST_SYNC_KEY, value: String(Date.now()) }
    })

    await prisma.settings.upsert({
      where: { tournament_key: { tournament: SYNC_TOURNAMENT, key: LOCK_UNTIL_KEY } },
      update: { value: '0' },
      create: { tournament: SYNC_TOURNAMENT, key: LOCK_UNTIL_KEY, value: '0' }
    })
  } catch (error) {
    console.error('[autoSyncTournament] skipped due to error:', error)
  }
}
