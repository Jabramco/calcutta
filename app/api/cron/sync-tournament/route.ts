import { NextResponse } from 'next/server'
import { runTournamentImport } from '@/lib/tournamentImport'

/**
 * Scheduled sync of ESPN tournament results → team names + round wins (payouts / leaderboard).
 *
 * Security: requires `Authorization: Bearer <CRON_SECRET>`.
 * On Vercel, set env `CRON_SECRET`; cron invocations include this header automatically.
 *
 * Year: `TOURNAMENT_IMPORT_YEAR` (e.g. 2026), else current UTC calendar year.
 *
 * Vercel cron schedule is in `vercel.json`. **Hobby** allows at most one cron run per day;
 * use a daily expression (e.g. `0 8 * * *`). For every-15-min sync, use **Pro** or an
 * external scheduler (e.g. cron-job.org) calling this route with the Bearer secret.
 */
function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 8) return false
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

function tournamentYear(): number {
  const env = process.env.TOURNAMENT_IMPORT_YEAR
  if (env) {
    const y = parseInt(env, 10)
    if (!Number.isNaN(y) && y >= 2000 && y <= 2100) return y
  }
  return new Date().getUTCFullYear()
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const year = tournamentYear()
  const started = Date.now()

  try {
    const result = await runTournamentImport(year)

    if (!result.success) {
      return NextResponse.json(
        {
          ok: false,
          year,
          error: result.error,
          details: result.details,
          durationMs: Date.now() - started
        },
        { status: result.status === 404 ? 200 : result.status }
      )
    }

    return NextResponse.json({
      ok: true,
      year,
      message: result.message,
      champion: result.champion,
      tournamentGames: result.tournamentGames,
      updatedTeams: result.updatedTeams,
      updatedNames: result.updatedNames,
      durationMs: Date.now() - started
    })
  } catch (e: unknown) {
    const err = e as { message?: string }
    console.error('[cron/sync-tournament]', e)
    return NextResponse.json(
      { ok: false, year, error: err?.message ?? 'Sync failed', durationMs: Date.now() - started },
      { status: 500 }
    )
  }
}
