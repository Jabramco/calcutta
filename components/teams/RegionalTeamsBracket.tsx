'use client'

import type { TeamWithOwner } from '@/lib/types'
import { FIRST_ROUND_SEED_PAIRS, resolveBracketSlot } from '@/lib/bracket'
import { BracketMatchupCard } from '@/components/teams/BracketMatchupCard'

const REGIONS = ['South', 'West', 'East', 'Midwest'] as const

export function RegionalTeamsBracket({
  teamsByRegion
}: {
  teamsByRegion: Record<string, TeamWithOwner[]>
}) {
  return (
    <div className="space-y-8">
      {REGIONS.map((region) => {
        const regionTeams = teamsByRegion[region] || []
        const leftPairs = FIRST_ROUND_SEED_PAIRS.slice(0, 4)
        const rightPairs = FIRST_ROUND_SEED_PAIRS.slice(4, 8)

        return (
          <section key={region} className="space-y-4">
            <header>
              <h2 className="text-xl font-semibold text-white">
                {region}{' '}
                <span className="text-[#a0a0b8] text-base font-normal">({regionTeams.length} rows)</span>
              </h2>
              <p className="text-xs text-[#6a6a82] mt-1 uppercase tracking-wider">First round — bracket order</p>
            </header>

            <div className="overflow-x-auto">
              <div className="min-w-[min(100%,640px)] lg:min-w-0">
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-stretch gap-6 lg:gap-8">
                  <div className="flex-1 flex flex-col gap-4">
                    {leftPairs.map(([topSeed, bottomSeed], colIdx) => (
                      <BracketMatchupCard
                        key={`${region}-L-${colIdx}`}
                        top={resolveBracketSlot(regionTeams, topSeed)}
                        bottom={resolveBracketSlot(regionTeams, bottomSeed)}
                        pairIndex={colIdx}
                      />
                    ))}
                  </div>

                  <div
                    className="hidden lg:flex flex-col justify-around items-center w-px shrink-0 bg-gradient-to-b from-transparent via-[#2a2a38] to-transparent self-stretch min-h-[200px]"
                    aria-hidden
                  />

                  <div className="flex-1 flex flex-col gap-4">
                    {rightPairs.map(([topSeed, bottomSeed], colIdx) => {
                      const i = colIdx + 4
                      return (
                        <BracketMatchupCard
                          key={`${region}-R-${i}`}
                          top={resolveBracketSlot(regionTeams, topSeed)}
                          bottom={resolveBracketSlot(regionTeams, bottomSeed)}
                          pairIndex={i}
                        />
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )
      })}
    </div>
  )
}
