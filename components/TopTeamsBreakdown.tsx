'use client'

import { useMemo } from 'react'
import type { Team, TeamWithOwner } from '@/lib/types'
import {
  formatCurrency,
  calculateTeamPayout,
  calculateTotalPot,
  sumGroupWins
} from '@/lib/calculations'
import { teamFlag, getRoundsWon } from '@/lib/tournament'
import type { TournamentKey } from '@/lib/tournament'

/**
 * Dashboard explainer that sits next to the Leaderboard and answers "which teams have
 * earned the most, and WHY". It reuses the app's shared, tournament-aware payout engine
 * end-to-end:
 *   - per-team dollars from `calculateTeamPayout` (same as the owner-detail page / leaderboard),
 *   - the live pot + group-stage divisor from `calculateTotalPot` / `sumGroupWins`,
 *   - the human-readable "why" badges from `getRoundsWon` (config-driven payout buckets),
 *   - World Cup flags from `teamFlag`.
 * Because every number flows through the same helpers, the amounts here match the rest of
 * the app. It edits none of the payout files — it only consumes their exports.
 *
 * Tournament-aware automatically: `getRoundsWon`/`calculateTeamPayout` resolve each team's
 * config from `team.tournament`, so the World Cup shows its 8 buckets (Group ×N, R32, R16,
 * QF, SF, Final, Upset, GD) and March Madness shows its NCAA buckets (R64…CHAMP).
 *
 * Pre-results state: payouts derive from the live pot + results, so before any team has
 * earned anything we render a muted "No points awarded yet" note instead of an empty block.
 */
const MAX_TOP_TEAMS = 5

export function TopTeamsBreakdown({
  teams,
  tournament
}: {
  teams: TeamWithOwner[]
  tournament: TournamentKey
}) {
  const topTeams = useMemo(() => {
    const totalPot = calculateTotalPot(teams)
    const actualGroupWins = sumGroupWins(teams)
    return teams
      .map((team) => ({
        team,
        earnings: calculateTeamPayout(team, totalPot, actualGroupWins),
        why: getRoundsWon(team as Team, tournament)
      }))
      .filter((row) => row.earnings > 0)
      .sort((a, b) => b.earnings - a.earnings)
      .slice(0, MAX_TOP_TEAMS)
  }, [teams, tournament])

  return (
    <section className="mb-6" aria-labelledby="top-teams-heading">
      <div className="glass-card rounded-2xl border border-[#2a2a38]">
        <div className="p-3 border-b border-[#2a2a38] flex items-center justify-between gap-2">
          <span id="top-teams-heading" className="text-sm font-semibold text-white">
            Top teams
          </span>
          <span className="text-[11px] text-[#6a6a82]">Who&apos;s earning &amp; why</span>
        </div>

        {topTeams.length === 0 ? (
          <p className="text-sm text-[#a0a0b8] p-4">
            No points awarded yet — earnings appear here once results come in.
          </p>
        ) : (
          <ul className="divide-y divide-[#2a2a38]/70">
            {topTeams.map((row, index) => {
              const flag = teamFlag(row.team.name, tournament)
              return (
                <li
                  key={row.team.id}
                  className="flex items-start justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs tabular-nums text-[#6a6a82] w-4 shrink-0">
                        {index + 1}
                      </span>
                      <span className="text-sm font-semibold text-white truncate">
                        {flag && (
                          <span className="mr-1.5" aria-hidden>
                            {flag}
                          </span>
                        )}
                        {row.team.name}
                      </span>
                      {row.team.owner?.name && (
                        <span className="text-[11px] text-[#a0a0b8] truncate">
                          · {row.team.owner.name}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1 pl-6">
                      {row.why.map((bucket) => (
                        <span
                          key={bucket.key}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#2dce89]/15 text-[#2dce89]"
                        >
                          {bucket.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-sm tabular-nums text-[#2dce89] font-semibold shrink-0">
                    {formatCurrency(row.earnings)}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
