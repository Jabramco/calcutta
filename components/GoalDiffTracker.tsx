'use client'

import { useMemo } from 'react'
import type { TeamWithOwner } from '@/lib/types'
import { formatCurrency } from '@/lib/calculations'
import { teamFlag, type TournamentKey } from '@/lib/tournament'
import { Avatar, avatarSrcForName } from '@/components/Avatar'

/**
 * "Worst Goal Differential Race" — a World-Cup-only dashboard tracker for the 5% booby-prize
 * bucket awarded to the team with the WORST overall goal differential. Teams are sorted by
 * `goalDiff` ASCENDING (most-negative first, since the prize is for the WORST GD) and the team
 * currently holding the prize — the one the importer flagged `worstGd` — is highlighted so it
 * always matches the actual prize winner (rather than just inferring from position, which would
 * disagree on GD ties).
 *
 * Each row also shows the team's NEXT scheduled fixture (opponent + flag + kickoff), matched
 * from the same tournament-aware `/api/upcoming-games` feed that powers the rest of the
 * dashboard — so no extra ESPN calls. Teams whose next match isn't in the upcoming window
 * (eliminated / schedule not yet published) show a muted "No upcoming match".
 *
 * Tournament-aware: the GD prize is a World Cup concept, so the tracker renders nothing in
 * March Madness mode (the same shared dashboard simply omits it).
 *
 * Data: `goalDiff` (goalsFor − goalsAgainst over all completed matches) and the `worstGd` flag
 * are computed together by the importer and exposed verbatim on `/api/teams`, so the highlighted
 * "current worst" is exactly the team that would win the 5%.
 *
 * Early state: before any match completes no team is flagged `worstGd` (GDs are all 0), so we
 * show a muted "race hasn't started" note instead of an arbitrary 0-GD list.
 */
const MAX_CONTENDERS = 10

/** Minimal shape of an upcoming fixture from /api/upcoming-games (names are already our
 *  canonical DB names, so a normalized string match lines them up with tracker teams). */
export interface TrackerFixture {
  id: string
  date: string
  bracketNote: string | null
  home: { name: string }
  away: { name: string }
}

interface NextMatch {
  opponent: string
  date: string
  note: string | null
}

function formatGd(gd: number): string {
  if (gd > 0) return `+${gd}`
  if (gd < 0) return `\u2212${Math.abs(gd)}` // U+2212 minus sign
  return '0'
}

function formatKickoff(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  } catch {
    return iso
  }
}

/** Lightweight name key — the fixture feed already canonicalizes to our DB names, so trimming
 *  + lowercasing is enough to line a team up with its fixture without importing server code. */
function nameKey(s: string): string {
  return s.trim().toLowerCase()
}

export function GoalDiffTracker({
  teams,
  tournament,
  worstGdPayout = 0,
  fixtures = []
}: {
  teams: TeamWithOwner[]
  tournament: TournamentKey
  /** Current dollar amount of the 5% Worst-GD bucket, for header context. */
  worstGdPayout?: number
  /** Upcoming fixtures from /api/upcoming-games (reused — no extra fetch). */
  fixtures?: TrackerFixture[]
}) {
  const { contenders, hasResults, nextMatchByTeam } = useMemo(() => {
    const sorted = [...teams].sort((a, b) => {
      const gdA = Number(a.goalDiff ?? 0)
      const gdB = Number(b.goalDiff ?? 0)
      if (gdA !== gdB) return gdA - gdB // worst (most negative) first
      return a.name.localeCompare(b.name)
    })

    // Earliest upcoming fixture per team. Fixtures are pre-sorted ascending by the API, but
    // sort defensively so the FIRST entry we record for a team is genuinely its next match.
    const byKickoff = [...fixtures].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    const nextMatch = new Map<string, NextMatch>()
    for (const f of byKickoff) {
      const homeKey = nameKey(f.home.name)
      const awayKey = nameKey(f.away.name)
      if (!nextMatch.has(homeKey)) {
        nextMatch.set(homeKey, { opponent: f.away.name, date: f.date, note: f.bracketNote })
      }
      if (!nextMatch.has(awayKey)) {
        nextMatch.set(awayKey, { opponent: f.home.name, date: f.date, note: f.bracketNote })
      }
    }

    return {
      contenders: sorted.slice(0, MAX_CONTENDERS),
      hasResults: teams.some((t) => t.worstGd),
      nextMatchByTeam: nextMatch
    }
  }, [teams, fixtures])

  // World-Cup-only concept: omit entirely in March Madness.
  if (tournament !== 'worldcup') return null

  return (
    <section className="mb-6" aria-labelledby="gd-tracker-heading">
      <div className="glass-card rounded-2xl border border-[#2a2a38]">
        <div className="p-3 border-b border-[#2a2a38] flex items-center justify-between gap-2">
          <span id="gd-tracker-heading" className="text-sm font-semibold text-white">
            Worst Goal Differential Race
          </span>
          <span className="text-[11px] text-[#6a6a82]">
            Booby prize{worstGdPayout > 0 ? ` · ${formatCurrency(worstGdPayout)}` : ''}
          </span>
        </div>

        {!hasResults ? (
          <p className="text-sm text-[#a0a0b8] p-4">
            The race begins once matches are played — the team with the worst goal differential
            wins the 5% booby prize.
          </p>
        ) : (
          <ul className="divide-y divide-[#2a2a38]/70">
            {contenders.map((team, index) => {
              const flag = teamFlag(team.name, tournament)
              const gd = Number(team.goalDiff ?? 0)
              const isWorst = !!team.worstGd
              const next = nextMatchByTeam.get(nameKey(team.name))
              const oppFlag = next ? teamFlag(next.opponent, tournament) : ''
              return (
                <li
                  key={team.id}
                  className={`flex items-start justify-between gap-3 px-4 py-2.5 ${
                    isWorst ? 'bg-[#f5365c]/10' : ''
                  }`}
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
                        {team.name}
                      </span>
                      {isWorst && (
                        <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#f5365c]/20 text-[#f5365c]">
                          Currently winning
                        </span>
                      )}
                    </div>
                    <div className="mt-1 pl-6 text-[11px] text-[#6a6a82] truncate">
                      {next ? (
                        <>
                          <span className="text-[#a0a0b8]">Next:</span>{' '}
                          {oppFlag && (
                            <span className="mr-1" aria-hidden>
                              {oppFlag}
                            </span>
                          )}
                          <span className="text-[#a0a0b8]">{next.opponent}</span>
                          {next.note ? ` · ${next.note}` : ''} · {formatKickoff(next.date)}
                        </>
                      ) : (
                        <span className="italic">No upcoming match</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 pt-0.5">
                    {team.owner?.name && (
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        <Avatar src={avatarSrcForName(team.owner.name)} alt={team.owner.name} size={20} />
                        <span className="text-[11px] text-[#a0a0b8] truncate max-w-[7rem]">
                          {team.owner.name}
                        </span>
                      </span>
                    )}
                    <span
                      className={`text-sm tabular-nums font-semibold w-10 text-right ${
                        gd < 0 ? 'text-[#f5365c]' : gd > 0 ? 'text-[#2dce89]' : 'text-[#a0a0b8]'
                      }`}
                      title="Goal differential"
                    >
                      {formatGd(gd)}
                    </span>
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
