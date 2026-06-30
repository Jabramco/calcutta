'use client'

import { useEffect, useState } from 'react'
import { teamFlag } from '@/lib/tournament'

/**
 * World Cup knockout bracket (Round of 32 → Final) for the Teams page. It reuses the dark
 * glass-card styling of the March Madness bracket, but because the World Cup knockout is a
 * single linear bracket of real fixtures (not region/seed-derived like the NCAA bracket), the
 * matchups come straight from the ESPN fifa.world feed via /api/world-cup-bracket — the same
 * feed the importer/upcoming-games use, matched to our seeded teams (flags + owners) by the
 * shared normalizeCountry canonicalization. Winners (ESPN `winner` flag) are highlighted and
 * advance, which is exactly what the knockout payout columns credit, so the bracket agrees
 * with the payouts. Upcoming/in-progress matchups render gracefully (TBD names, no winner).
 */
interface BracketSide {
  name: string
  ownerName: string | null
  score: number | null
  winner: boolean
  /** True when this slot is an undecided knockout placeholder (render as TBD). */
  tbd: boolean
}
interface BracketMatchup {
  id: string
  date: string | null
  state: string
  completed: boolean
  status: string
  home: BracketSide
  away: BracketSide
}
interface BracketRound {
  slug: string
  label: string
  matchups: BracketMatchup[]
}
interface BracketData {
  rounds: BracketRound[]
  champion: { name: string; ownerName: string | null } | null
}

function formatKickoff(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  } catch {
    return ''
  }
}

function SideRow({ side, decided }: { side: BracketSide; decided: boolean }) {
  const tbd = side.tbd || !side.name.trim()
  const flag = tbd ? '' : teamFlag(side.name, 'worldcup')
  const loser = decided && !side.winner
  return (
    <div
      className={`flex items-center justify-between gap-2 px-2.5 py-1.5 ${
        side.winner ? 'bg-[#2dce89]/12' : ''
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {flag && (
          <span className="shrink-0" aria-hidden>
            {flag}
          </span>
        )}
        <div className="min-w-0">
          <div
            className={`text-[12px] leading-tight truncate ${
              tbd ? 'text-[#5a5a6e] italic' : loser ? 'text-[#8a8a9a]' : 'text-white font-medium'
            } ${side.winner ? 'font-semibold' : ''}`}
            title={tbd ? 'TBD' : side.name}
          >
            {tbd ? 'TBD' : side.name}
          </div>
          {!tbd && (
            <div
              className="text-[10px] text-[#7a7a8e] truncate leading-tight"
              title={side.ownerName ?? 'Unowned'}
            >
              {side.ownerName ?? 'Unowned'}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {side.winner && (
          <span className="text-[#2dce89] text-[11px]" aria-label="advanced" title="Advanced">
            ✓
          </span>
        )}
        {side.score != null && (
          <span
            className={`tabular-nums text-[12px] w-4 text-right ${
              side.winner ? 'text-[#2dce89] font-bold' : 'text-[#a0a0b8]'
            }`}
          >
            {side.score}
          </span>
        )}
      </div>
    </div>
  )
}

function MatchupCard({ m }: { m: BracketMatchup }) {
  const decided = m.completed && (m.home.winner || m.away.winner)
  const live = m.state === 'in'
  return (
    <div
      className={`rounded-lg border bg-[#15151e]/90 backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.2)] overflow-hidden w-[180px] ${
        live ? 'border-[#a78bfa]/50' : 'border-[#2a2a38]'
      }`}
    >
      <div className="px-2.5 py-1 bg-[#1c1c28]/90 border-b border-[#2a2a38] flex items-center justify-between gap-2">
        <span className="text-[9px] uppercase tracking-wider text-[#6a6a82] font-semibold truncate">
          {live ? 'Live' : m.completed ? 'Final' : formatKickoff(m.date) || 'Scheduled'}
        </span>
        {live && (
          <span className="text-[9px] font-bold text-[#c084fc] uppercase">{m.status}</span>
        )}
      </div>
      <div className="divide-y divide-[#2a2a38]">
        <SideRow side={m.home} decided={decided} />
        <SideRow side={m.away} decided={decided} />
      </div>
    </div>
  )
}

export function WorldCupBracket() {
  const [data, setData] = useState<BracketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/world-cup-bracket', { cache: 'no-store' })
        const json = await res.json()
        if (!cancelled) {
          setData(json)
          setError(Boolean(json?.error) && (json?.rounds?.length ?? 0) === 0)
        }
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <div className="text-center text-[#a0a0b8] py-8">Loading bracket…</div>
  }
  if (error || !data || data.rounds.every((r) => r.matchups.length === 0)) {
    return (
      <div className="glass-card rounded-2xl border border-[#2a2a38] px-4 py-8 text-center text-sm text-[#a0a0b8]">
        The knockout bracket appears once Round of 32 fixtures are scheduled.
      </div>
    )
  }

  return (
    <div>
      <header className="mb-4 flex items-baseline gap-3">
        <h2 className="text-lg font-semibold text-white">Knockout bracket</h2>
        {data.champion && (
          <span className="text-sm text-[#ffd54a]">
            🏆 {teamFlag(data.champion.name, 'worldcup')} {data.champion.name}
            {data.champion.ownerName ? ` · ${data.champion.ownerName}` : ''}
          </span>
        )}
      </header>

      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4 items-start min-w-max">
          {data.rounds.map((round) => (
            <div key={round.slug} className="shrink-0">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[#6a6a82] font-semibold text-center mb-2 whitespace-nowrap">
                {round.label}
                <span className="text-[#4a4a58]"> · {round.matchups.length}</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {round.matchups.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#2a2a38] bg-[#0c0c12]/80 w-[180px] px-2.5 py-6 text-center text-[11px] text-[#5a5a6e]">
                    TBD
                  </div>
                ) : (
                  round.matchups.map((m) => <MatchupCard key={m.id} m={m} />)
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
