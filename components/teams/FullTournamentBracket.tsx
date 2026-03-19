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

function AdvanceSlot({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#2a2a38] bg-[#0c0c12]/90 px-1.5 py-2 text-center min-h-[52px] flex flex-col items-center justify-center">
      <span className="text-[8px] text-[#5a5a6e] uppercase tracking-wide leading-tight">{label}</span>
      <span className="text-[10px] text-[#3d3d4d] mt-0.5">TBD</span>
    </div>
  )
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
  const r64 = (
    <div className="flex flex-col gap-1.5 justify-between shrink-0 min-h-[360px] py-0.5">
      {FIRST_ROUND_SEED_PAIRS.map(([topSeed, bottomSeed], i) => (
        <BracketMatchupCard
          key={`${title}-${i}`}
          top={resolveBracketSlot(teams, topSeed)}
          bottom={resolveBracketSlot(teams, bottomSeed)}
          pairIndex={i}
          compact
        />
      ))}
    </div>
  )

  const r32 = (
    <div className="flex flex-col gap-1.5 justify-between min-h-[360px] py-0.5 w-[72px] sm:w-[80px]">
      {[0, 1, 2, 3].map((i) => (
        <AdvanceSlot key={`r32-${i}`} label="Round of 32" />
      ))}
    </div>
  )

  const s16 = (
    <div className="flex flex-col gap-1.5 justify-around min-h-[360px] py-0.5 w-[72px] sm:w-[80px]">
      {[0, 1].map((i) => (
        <AdvanceSlot key={`s16-${i}`} label="Sweet 16" />
      ))}
    </div>
  )

  const e8 = (
    <div className="flex flex-col justify-center min-h-[360px] py-0.5 w-[72px] sm:w-[88px]">
      <AdvanceSlot label="Elite 8" />
    </div>
  )

  /* Left half: R64 (outer) → … → E8 (toward center). Right half: E8 (toward center) → … → R64 (outer). */
  const cols =
    side === 'left' ? (
      <>
        <div>
          <RoundLabel>First round</RoundLabel>
          {r64}
        </div>
        <Connector />
        <div>
          <RoundLabel>Round of 32</RoundLabel>
          {r32}
        </div>
        <Connector />
        <div>
          <RoundLabel>Sweet 16</RoundLabel>
          {s16}
        </div>
        <Connector />
        <div>
          <RoundLabel>Elite 8</RoundLabel>
          {e8}
        </div>
      </>
    ) : (
      <>
        <div>
          <RoundLabel>Elite 8</RoundLabel>
          {e8}
        </div>
        <Connector />
        <div>
          <RoundLabel>Sweet 16</RoundLabel>
          {s16}
        </div>
        <Connector />
        <div>
          <RoundLabel>Round of 32</RoundLabel>
          {r32}
        </div>
        <Connector />
        <div>
          <RoundLabel>First round</RoundLabel>
          {r64}
        </div>
      </>
    )

  return (
    <div
      className={`rounded-xl border p-2 sm:p-3 backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.15)] ${accentClass}`}
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

function CenterHub() {
  return (
    <div className="flex flex-col justify-center gap-4 px-2 sm:px-4 min-w-[120px] sm:min-w-[160px] shrink-0">
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
          <AdvanceSlot label="Semifinal" />
          <AdvanceSlot label="Semifinal" />
        </div>
      </div>
      <div className="rounded-xl border border-[#2a2a38] bg-[#15151e]/95 p-3 text-center">
        <div className="text-[9px] uppercase tracking-[0.15em] text-[#a0a0b8] font-bold mb-2">National champion</div>
        <div className="rounded-lg border border-dashed border-[#00ceb8]/25 bg-[#0c0c12]/90 px-2 py-4">
          <span className="text-[10px] text-[#4a4a58]">TBD</span>
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
            <div className="flex flex-col gap-4 flex-1 min-w-0 lg:max-w-[520px]">
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

            <CenterHub />

            {/* Right: East + Midwest → center (mirror) */}
            <div className="flex flex-col gap-4 flex-1 min-w-0 max-w-[500px]">
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
