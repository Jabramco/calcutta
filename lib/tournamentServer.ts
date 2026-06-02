import { cookies } from 'next/headers'
import {
  DEFAULT_TOURNAMENT,
  TOURNAMENT_COOKIE,
  isTournamentKey,
  type TournamentKey
} from '@/lib/tournament'

/**
 * Resolve the active tournament for the current request.
 *
 * The selected experience lives client-side (localStorage + a mirrored cookie set by
 * ModeContext). Because the cookie travels automatically with every same-origin fetch,
 * API routes can stay generic and simply read it here — no need to thread a tournament
 * param through dozens of fetch call sites. Falls back to March Madness (production).
 */
export async function getCurrentTournament(): Promise<TournamentKey> {
  try {
    const store = await cookies()
    const value = store.get(TOURNAMENT_COOKIE)?.value
    if (isTournamentKey(value)) return value
  } catch {
    // cookies() can throw outside a request scope; fall back to the default.
  }
  return DEFAULT_TOURNAMENT
}
