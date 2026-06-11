'use client'

import { useEffect, useState } from 'react'
import { getTournamentConfig, teamFlag, type TournamentKey } from '@/lib/tournament'

export interface CountdownFixture {
  id: string
  /** ISO kickoff timestamp, e.g. "2026-06-11T19:00Z" */
  date: string
  awayName: string
  homeName: string
}

/** How long after kickoff we keep showing the celebratory "KICKING OFF NOW!" state
 *  before rolling over to count down to the next fixture. */
const KICKOFF_GRACE_MS = 60_000

function parseMs(iso: string): number {
  const ms = new Date(iso).getTime()
  return Number.isFinite(ms) ? ms : NaN
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

interface TimeParts {
  days: number
  hours: number
  minutes: number
  seconds: number
}

function splitRemaining(remainingMs: number): TimeParts {
  const totalSec = Math.max(0, Math.floor(remainingMs / 1000))
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60
  }
}

/**
 * Full-width, real-time countdown banner to the next kickoff.
 *
 * Tournament-parameterized: the target is derived from the passed-in fixtures
 * (the same tournament-aware /api/upcoming-games data the dashboard already
 * fetches) rather than hardcoded — so it always counts down to the EARLIEST
 * still-upcoming match and automatically rolls over to the next one. Renders
 * nothing when there are no upcoming fixtures (e.g. March Madness off-season),
 * so it never shows an empty/broken block.
 */
export function CountdownBanner({
  fixtures,
  tournament
}: {
  fixtures: CountdownFixture[]
  tournament: TournamentKey
}) {
  // Ticks every second on the client. Initialized lazily; the first render is
  // safe for SSR/hydration because the dashboard starts with no fixtures (so the
  // banner renders nothing) until the client fetch populates them.
  const [now, setNow] = useState<number>(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Earliest fixture overall (the "opener") — drives the hype headline copy.
  let earliest: { f: CountdownFixture; ms: number } | null = null
  // Earliest fixture still in the future — the countdown target.
  let nextUp: { f: CountdownFixture; ms: number } | null = null
  // A fixture that kicked off within the grace window — the celebratory state.
  let justKicked: { f: CountdownFixture; ms: number } | null = null

  for (const f of fixtures) {
    const ms = parseMs(f.date)
    if (Number.isNaN(ms)) continue
    if (!earliest || ms < earliest.ms) earliest = { f, ms }
    if (ms > now) {
      if (!nextUp || ms < nextUp.ms) nextUp = { f, ms }
    } else if (now - ms < KICKOFF_GRACE_MS) {
      if (!justKicked || ms > justKicked.ms) justKicked = { f, ms }
    }
  }

  const config = getTournamentConfig(tournament)

  const matchup = (f: CountdownFixture) => {
    const awayFlag = teamFlag(f.awayName, tournament)
    const homeFlag = teamFlag(f.homeName, tournament)
    return (
      <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <span className="font-semibold text-white">
          {awayFlag ? <span className="mr-1.5">{awayFlag}</span> : null}
          {f.awayName}
        </span>
        <span className="text-[#6a6a82] font-normal">vs</span>
        <span className="font-semibold text-white">
          {homeFlag ? <span className="mr-1.5">{homeFlag}</span> : null}
          {f.homeName}
        </span>
      </span>
    )
  }

  // Celebratory state: a match just kicked off (within the grace window).
  if (justKicked) {
    return (
      <section
        className="countdown-banner relative overflow-hidden rounded-2xl border border-[#00ceb8]/40 px-4 py-4 md:px-6 md:py-5 mb-6"
        aria-label={`${config.label}: ${justKicked.f.awayName} vs ${justKicked.f.homeName} is kicking off now`}
      >
        <div className="flex flex-col items-center text-center gap-1.5">
          <div className="flex items-center gap-2">
            <span className="countdown-pulse-dot inline-block h-2.5 w-2.5 rounded-full bg-[#2dce89]" aria-hidden />
            <span className="text-base md:text-xl font-extrabold uppercase tracking-[0.18em] text-[#2dce89]">
              Kicking off now!
            </span>
          </div>
          <div className="text-sm md:text-base">{matchup(justKicked.f)}</div>
        </div>
      </section>
    )
  }

  // No upcoming fixtures at all → hide entirely (no empty block).
  if (!nextUp) return null

  const isOpener = earliest != null && earliest.f.id === nextUp.f.id
  const headline = isOpener ? `${config.label} kicks off in` : 'Next match kicks off in'
  const { days, hours, minutes, seconds } = splitRemaining(nextUp.ms - now)

  const srText = `${headline} ${days} days, ${hours} hours, ${minutes} minutes, ${seconds} seconds`
  const units: { value: string; label: string }[] = [
    { value: String(days), label: 'Days' },
    { value: pad(hours), label: 'Hrs' },
    { value: pad(minutes), label: 'Min' },
    { value: pad(seconds), label: 'Sec' }
  ]

  return (
    <section
      className="countdown-banner relative overflow-hidden rounded-2xl border border-[#00ceb8]/40 px-4 py-4 md:px-6 md:py-5 mb-6"
      aria-label={srText}
      role="timer"
    >
      <div className="flex flex-col items-center gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="flex flex-col items-center gap-1 text-center md:items-start md:text-left">
          <div className="flex items-center gap-2">
            <span className="countdown-pulse-dot inline-block h-2.5 w-2.5 rounded-full bg-[#00ceb8]" aria-hidden />
            <span className="text-xs md:text-sm font-bold uppercase tracking-[0.18em] text-[#00ceb8]">
              {headline}
            </span>
          </div>
          <div className="text-sm md:text-base" aria-hidden>
            {matchup(nextUp.f)}
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3" aria-hidden>
          {units.map((u, i) => (
            <div key={u.label} className="flex items-center gap-2 md:gap-3">
              <div className="flex min-w-[3.25rem] flex-col items-center rounded-xl bg-[#0d0d14]/55 px-2.5 py-2 ring-1 ring-[#00ceb8]/15 md:min-w-[4rem] md:px-3.5 md:py-2.5">
                <span className="text-2xl md:text-4xl font-extrabold tabular-nums leading-none text-white drop-shadow-[0_0_12px_rgba(0,206,184,0.25)]">
                  {u.value}
                </span>
                <span className="mt-1 text-[10px] md:text-[11px] font-semibold uppercase tracking-wider text-[#7fd8ce]">
                  {u.label}
                </span>
              </div>
              {i < units.length - 1 && (
                <span className="text-xl md:text-3xl font-bold text-[#00ceb8]/50 leading-none">:</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default CountdownBanner
