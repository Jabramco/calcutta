'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'
import type { TeamWithOwner } from '@/lib/types'
import { FIRST_ROUND_SEED_PAIRS, resolveBracketSlot } from '@/lib/bracket'
import { BracketMatchupCard } from '@/components/teams/BracketMatchupCard'

const REGIONS_LEFT: ReadonlyArray<{ name: string; accent: string }> = [
  { name: 'South', accent: 'border-amber-500/35 bg-amber-500/[0.06]' },
  { name: 'West', accent: 'border-orange-500/35 bg-orange-500/[0.06]' }
]

const REGIONS_RIGHT: ReadonlyArray<{ name: string; accent: string }> = [
  { name: 'East', accent: 'border-rose-500/35 bg-rose-500/[0.06]' },
  { name: 'Midwest', accent: 'border-sky-500/35 bg-sky-500/[0.06]' }
]

function RoundLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[9px] uppercase tracking-[0.12em] text-[#6a6a82] font-semibold text-center whitespace-nowrap mb-1.5">
      {children}
    </div>
  )
}

function Connector() {
  return (
    <div className="hidden sm:flex flex-col justify-center w-4 shrink-0" aria-hidden>
      <div className="h-px bg-gradient-to-r from-[#00ceb8]/50 to-[#00ceb8]/15" />
    </div>
  )
}

function AdvanceSlot({
  label,
  teamA,
  teamB,
  tall = false
}: {
  label: string
  teamA?: TeamWithOwner | null
  teamB?: TeamWithOwner | null
  tall?: boolean
}) {
  const orderedTeams = [teamA ?? null, teamB ?? null].sort((a, b) => {
    if (a && !b) return -1
    if (!a && b) return 1
    return 0
  })
  const primary = orderedTeams[0]
  const secondary = orderedTeams[1]
  const hasTeams = Boolean(primary || secondary)

  const shortName = (t: TeamWithOwner | null | undefined) => {
    if (!t?.name) return 'TBD'
    return t.name.split(/\s+/)[0] || t.name
  }

  const ownerName = (t: TeamWithOwner | null | undefined) => t?.owner?.name ?? '—'
  return (
    <div
      className={`rounded-lg border border-dashed border-[#2a2a38] bg-[#0c0c12]/90 px-1.5 py-2 text-center flex flex-col items-center justify-center ${
        tall ? 'min-h-[96px]' : 'min-h-[52px]'
      }`}
    >
      <span className="text-[8px] text-[#5a5a6e] uppercase tracking-wide leading-tight">{label}</span>
      {hasTeams ? (
        <div className="mt-0.5 leading-tight w-full">
          <div className="text-[10px] text-white font-medium truncate max-w-[64px] sm:max-w-[72px] mx-auto" title={primary?.name ?? 'TBD'}>
            {shortName(primary)}
          </div>
          <div className="text-[9px] text-[#a0a0b8] truncate max-w-[64px] sm:max-w-[72px] mx-auto" title={ownerName(primary)}>
            {ownerName(primary)}
          </div>
          <div className="text-[10px] text-[#6a6a82] truncate max-w-[64px] sm:max-w-[72px] mx-auto mt-0.5" title={secondary?.name ?? 'TBD'}>
            {shortName(secondary)}
          </div>
        </div>
      ) : (
        <span className="text-[10px] text-[#3d3d4d] mt-0.5">TBD</span>
      )}
    </div>
  )
}

function winnerFromPair(
  a: TeamWithOwner | null | undefined,
  b: TeamWithOwner | null | undefined,
  winKey: 'round64' | 'round32' | 'sweet16' | 'elite8'
): TeamWithOwner | null {
  const aWon = Boolean(a?.[winKey])
  const bWon = Boolean(b?.[winKey])
  if (aWon && !bWon) return a ?? null
  if (bWon && !aWon) return b ?? null
  return null
}

function pickTeamByWinKey(teams: TeamWithOwner[], winKey: 'elite8' | 'final4'): TeamWithOwner | null {
  const winners = teams.filter((t) => Boolean(t[winKey]))
  if (winners.length === 0) return null
  if (winners.length === 1) return winners[0] ?? null
  winners.sort((a, b) => Number(b.seed) - Number(a.seed))
  return winners[0] ?? null
}

function RegionHalf({
  title,
  accentClass,
  teams,
  side
}: {
  title: string
  accentClass: string
  teams: TeamWithOwner[]
  side: 'left' | 'right'
}) {
  const firstRoundPairs = FIRST_ROUND_SEED_PAIRS.map(([topSeed, bottomSeed]) => ({
    top: resolveBracketSlot(teams, topSeed),
    bottom: resolveBracketSlot(teams, bottomSeed)
  }))
  const firstRoundWinners = firstRoundPairs.map((pair) =>
    winnerFromPair(pair.top.team, pair.bottom.team, 'round64')
  )
  const roundOf32Matchups: ReadonlyArray<readonly [number, number]> = [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7]
  ]
  const roundOf32Teams = firstRoundWinners
  const roundOf32Winners = roundOf32Matchups.map(([a, b]) =>
    winnerFromPair(roundOf32Teams[a], roundOf32Teams[b], 'round32')
  )
  const sweet16Matchups: ReadonlyArray<readonly [number, number]> = [
    [0, 1],
    [2, 3]
  ]
  const sweet16Winners = sweet16Matchups.map(([a, b]) =>
    winnerFromPair(roundOf32Winners[a], roundOf32Winners[b], 'sweet16')
  )

  const r64 = (
    <div className="flex flex-col gap-1.5 shrink-0 py-0.5">
      {firstRoundPairs.map((pair, i) => (
        <BracketMatchupCard
          key={`${title}-${i}`}
          top={pair.top}
          bottom={pair.bottom}
          pairIndex={i}
          compact
        />
      ))}
    </div>
  )

  const r32 = (
    <div className="flex flex-col gap-1.5 py-0.5 w-[72px] sm:w-[88px]">
      {roundOf32Teams.map((team, i) => (
        <AdvanceSlot
          key={`r32-${i}`}
          label="Round of 32"
          teamA={team}
          tall
        />
      ))}
    </div>
  )

  const s16 = (
    <div className="flex flex-col gap-1.5 py-0.5 w-[72px] sm:w-[88px]">
      {roundOf32Winners.map((team, i) => (
        <div key={`s16-lane-${i}`} className="min-h-[198px] flex items-center">
          <AdvanceSlot
            key={`s16-${i}`}
            label="Sweet 16"
            teamA={team}
            tall
          />
        </div>
      ))}
    </div>
  )

  const e8 = (
    <div className="flex flex-1 flex-col justify-center gap-12 sm:gap-20 py-0.5 min-h-0 w-full">
      {sweet16Winners.map((team, i) => (
        <AdvanceSlot key={`e8-${i}`} label="Elite 8" teamA={team} tall />
      ))}
    </div>
  )

  /* Left half: R64 (outer) → … → E8 (toward center). Right half: E8 (toward center) → … → R64 (outer). */
  const cols =
    side === 'left' ? (
      <>
        <div className="shrink-0">
          <RoundLabel>First round</RoundLabel>
          {r64}
        </div>
        <Connector />
        <div className="shrink-0">
          <RoundLabel>Round of 32</RoundLabel>
          {r32}
        </div>
        <Connector />
        <div className="shrink-0">
          <RoundLabel>Sweet 16</RoundLabel>
          {s16}
        </div>
        <Connector />
        <div className="shrink-0 flex flex-col self-stretch min-h-0 w-[72px] sm:w-[88px]">
          <RoundLabel>Elite 8</RoundLabel>
          {e8}
        </div>
      </>
    ) : (
      <>
        <div className="shrink-0 flex flex-col self-stretch min-h-0 w-[72px] sm:w-[88px]">
          <RoundLabel>Elite 8</RoundLabel>
          {e8}
        </div>
        <Connector />
        <div className="shrink-0">
          <RoundLabel>Sweet 16</RoundLabel>
          {s16}
        </div>
        <Connector />
        <div className="shrink-0">
          <RoundLabel>Round of 32</RoundLabel>
          {r32}
        </div>
        <Connector />
        <div className="shrink-0">
          <RoundLabel>First round</RoundLabel>
          {r64}
        </div>
      </>
    )

  return (
    <div
      className={`inline-block rounded-xl border p-2 sm:p-3 backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.15)] overflow-hidden ${accentClass}`}
    >
      <div className="text-center mb-2">
        <span className="inline-block px-3 py-0.5 rounded-md bg-[#1c1c28]/90 border border-[#2a2a38] text-[11px] font-bold text-white tracking-wide">
          {title}
        </span>
      </div>
      <div className="flex items-stretch gap-0 flex-row">{cols}</div>
    </div>
  )
}

function CenterHub({
  finalFourTeams,
  nationalChampionshipTeams
}: {
  finalFourTeams: Array<TeamWithOwner | null>
  nationalChampionshipTeams: Array<TeamWithOwner | null>
}) {
  return (
    <div className="flex flex-col justify-center gap-4 px-2 sm:px-4 min-w-[120px] sm:min-w-[160px] shrink-0">
      <div className="rounded-xl border border-[#2a2a38] bg-[#15151e]/95 p-3 text-center">
        <div className="text-[9px] uppercase tracking-[0.15em] text-[#a0a0b8] font-bold mb-2">National Championship</div>
        <div className="space-y-2">
          <AdvanceSlot label="Championship" teamA={nationalChampionshipTeams[0] ?? null} />
          <AdvanceSlot label="Championship" teamA={nationalChampionshipTeams[1] ?? null} />
        </div>
      </div>

      <div className="rounded-xl border border-[#00ceb8]/30 bg-[#0f1514]/95 p-3 text-center shadow-[0_0_24px_rgba(0,206,184,0.08)]">
        <div className="flex justify-center mb-2">
          <Image
            src="/logo.svg"
            alt="Calcutta"
            width={40}
            height={40}
            className="object-contain opacity-95"
          />
        </div>
        <div className="text-[9px] uppercase tracking-[0.15em] text-[#00ceb8]/90 font-bold mb-2">Final Four</div>
        <div className="space-y-2">
          <AdvanceSlot label="Final Four" teamA={finalFourTeams[0] ?? null} />
          <AdvanceSlot label="Final Four" teamA={finalFourTeams[1] ?? null} />
          <AdvanceSlot label="Final Four" teamA={finalFourTeams[2] ?? null} />
          <AdvanceSlot label="Final Four" teamA={finalFourTeams[3] ?? null} />
        </div>
      </div>
    </div>
  )
}

export function FullTournamentBracket({
  teamsByRegion
}: {
  teamsByRegion: Record<string, TeamWithOwner[]>
}) {
  const finalFourTeams: Array<TeamWithOwner | null> = [
    pickTeamByWinKey(teamsByRegion.South || [], 'elite8'),
    pickTeamByWinKey(teamsByRegion.West || [], 'elite8'),
    pickTeamByWinKey(teamsByRegion.East || [], 'elite8'),
    pickTeamByWinKey(teamsByRegion.Midwest || [], 'elite8')
  ]

  const championshipCandidates = [
    ...(teamsByRegion.South || []),
    ...(teamsByRegion.West || []),
    ...(teamsByRegion.East || []),
    ...(teamsByRegion.Midwest || [])
  ].filter((t) => Boolean(t.final4))

  const nationalChampionshipTeams: Array<TeamWithOwner | null> = [
    championshipCandidates[0] ?? null,
    championshipCandidates[1] ?? null
  ]

  return (
    <div>
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-white">Full bracket</h2>
      </header>

      <div className="overflow-x-auto overflow-y-hidden pb-1">
        {/* Min width keeps quadrants + center in one horizontal band; scroll on narrow viewports */}
        <div className="min-w-[1040px]">
          <div className="flex flex-row items-stretch justify-center gap-3 sm:gap-4">
            {/* Left: South + West → center */}
            <div className="flex flex-col gap-4 items-start">
              {REGIONS_LEFT.map(({ name, accent }) => (
                <RegionHalf
                  key={name}
                  title={name}
                  accentClass={accent}
                  teams={teamsByRegion[name] || []}
                  side="left"
                />
              ))}
            </div>

            <CenterHub
              finalFourTeams={finalFourTeams}
              nationalChampionshipTeams={nationalChampionshipTeams}
            />

            {/* Right: East + Midwest → center (mirror) */}
            <div className="flex flex-col gap-4 items-start">
              {REGIONS_RIGHT.map(({ name, accent }) => (
                <RegionHalf
                  key={name}
                  title={name}
                  accentClass={accent}
                  teams={teamsByRegion[name] || []}
                  side="right"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
