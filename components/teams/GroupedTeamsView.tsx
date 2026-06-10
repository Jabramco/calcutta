'use client'

import type { TeamWithOwner } from '@/lib/types'
import { formatCurrency } from '@/lib/calculations'
import { teamFlag } from '@/lib/tournament'
import { Avatar } from '@/components/Avatar'

/**
 * Group-stage standings view (World Cup). The NCAA bracket components are basketball
 * specific (4 regions, seeds 1–16, Final Four), so the World Cup renders its 12 groups
 * of 4 here instead. This is purely a teams display — it shares no auction logic.
 */
export function GroupedTeamsView({
  groups,
  teamsByGroup,
  groupNoun
}: {
  groups: string[]
  teamsByGroup: Record<string, TeamWithOwner[]>
  groupNoun: string
}) {
  return (
    <div>
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-white">Groups</h2>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map((group) => {
          const teams = (teamsByGroup[group] ?? []).slice().sort((a, b) => a.seed - b.seed)
          return (
            <div
              key={group}
              className="glass-card rounded-2xl border border-[#2a2a38] overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-[#2a2a38] flex items-center justify-between">
                <span className="text-sm font-bold text-white tracking-wide">
                  {groupNoun} {group}
                </span>
                <span className="text-[11px] text-[#6a6a82]">{teams.length} teams</span>
              </div>
              <ul className="divide-y divide-[#2a2a38]/70">
                {teams.map((team) => {
                  const flag = teamFlag(team.name, team.tournament)
                  return (
                  <li key={team.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        {flag && (
                          <span className="mr-1.5" aria-hidden>
                            {flag}
                          </span>
                        )}
                        {team.name}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-[#a0a0b8]">
                        {team.owner && <Avatar alt={team.owner.name} size={16} />}
                        <span className="truncate">{team.owner?.name ?? 'Unowned'}</span>
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
          )
        })}
      </div>
    </div>
  )
}
