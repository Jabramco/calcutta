import { NextResponse } from 'next/server'
import { getCurrentTournament } from '@/lib/tournamentServer'
import { getGroupTies } from '@/lib/groupTies'

/**
 * Live count of DRAWN group-stage matches for the active tournament. Client pages that compute
 * payouts from `/api/teams` fetch this so their group-stage divisor (72 − ties) matches the
 * server routes (stats / leaderboard) exactly. March Madness has no group stage → returns 0.
 */
export async function GET() {
  const tournament = await getCurrentTournament()
  const groupTies = await getGroupTies(tournament)
  return NextResponse.json({ tournament, groupTies })
}
