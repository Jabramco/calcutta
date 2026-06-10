'use client'

import type { TeamWithOwner } from '@/lib/types'
import { formatCurrency } from '@/lib/calculations'
import { teamFlag, formatTeamDescriptor, type TournamentConfig } from '@/lib/tournament'

/**
 * Teams grouped by their auction OWNER (shared by both tournaments). This is the "Owners"
 * counterpart to the group/region "Groups" view — same team-row presentation, just grouped
 * by who won each team instead of by group/region. It reads only the already-fetched,
 * tournament-scoped `teams` (each with its `owner` relation), so it works unchanged for
 * March Madness and the World Cup.
 *
 * Teams with no owner (unsold / pre-auction) are collected into a trailing "Unowned"
 * section so nothing is hidden and a null `ownerId` never crashes the view.
 *
 * Owners are sorted by total spend (descending), then name — the biggest spenders surface
 * first, which is the most useful ordering for an auction. "Unowned" always sorts last.
 */
interface OwnerGroup {
  key: string
  name: string
  teams: TeamWithOwner[]
  totalSpent: number
  isUnowned: boolean
}

export function OwnersTeamsView({
  teams,
  config
}: {
  teams: TeamWithOwner[]
  config: TournamentConfig
}) {
  const byOwner = new Map<string, OwnerGroup>()
  const UNOWNED_KEY = '__unowned__'

  for (const team of teams) {
    const owner = team.owner
    const key = owner ? `owner-${owner.id}` : UNOWNED_KEY
    let group = byOwner.get(key)
    if (!group) {
      group = {
        key,
        name: owner?.name ?? 'Unowned',
        teams: [],
        totalSpent: 0,
        isUnowned: !owner
      }
      byOwner.set(key, group)
    }
    group.teams.push(team)
    group.totalSpent += Number(team.cost) || 0
  }

  const groups = [...byOwner.values()].sort((a, b) => {
    // Unowned always last; otherwise by total spend desc, then name.
    if (a.isUnowned !== b.isUnowned) return a.isUnowned ? 1 : -1
    if (b.totalSpent !== a.totalSpent) return b.totalSpent - a.totalSpent
    return a.name.localeCompare(b.name)
  })

  // Sort each owner's teams by group/region then seed for a stable, readable order.
  for (const group of groups) {
    group.teams.sort((a, b) => {
      const regionOrder = config.groups.indexOf(a.region) - config.groups.indexOf(b.region)
      if (regionOrder !== 0) return regionOrder
      return a.seed - b.seed
    })
  }

  const ownerCount = groups.filter((g) => !g.isUnowned).length

  return (
    <div>
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-white">
          Owners{' '}
          <span className="text-sm font-normal text-[#6a6a82]">
            ({ownerCount} {ownerCount === 1 ? 'owner' : 'owners'})
          </span>
        </h2>
      </header>

      {groups.length === 0 ? (
        <div className="glass-card rounded-2xl border border-[#2a2a38] px-4 py-8 text-center text-sm text-[#a0a0b8]">
          No teams to display.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <div
              key={group.key}
              className="glass-card rounded-2xl border border-[#2a2a38] overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-[#2a2a38] flex items-center justify-between gap-2">
                <span
                  className={`text-sm font-bold tracking-wide truncate ${
                    group.isUnowned ? 'text-[#a0a0b8]' : 'text-white'
                  }`}
                >
                  {group.name}
                </span>
                <span className="text-[11px] text-[#6a6a82] shrink-0">
                  {group.teams.length} {group.teams.length === 1 ? 'team' : 'teams'}
                  {!group.isUnowned && group.totalSpent > 0 && (
                    <> · {formatCurrency(group.totalSpent)}</>
                  )}
                </span>
              </div>
              <ul className="divide-y divide-[#2a2a38]/70">
                {group.teams.map((team) => {
                  const flag = teamFlag(team.name, team.tournament)
                  return (
                    <li
                      key={team.id}
                      className="flex items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {flag && (
                            <span className="mr-1.5" aria-hidden>
                              {flag}
                            </span>
                          )}
                          {team.name}
                        </div>
                        <div className="text-xs text-[#a0a0b8] truncate">
                          {formatTeamDescriptor(config, team)}
                        </div>
                      </div>
                      <div className="text-sm tabular-nums text-[#00ceb8] font-semibold shrink-0">
                        {Number(team.cost) > 0 ? formatCurrency(Number(team.cost)) : '—'}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
