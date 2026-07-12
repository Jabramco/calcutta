'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { teamFlag } from '@/lib/tournament'
import type { TournamentKey } from '@/lib/tournament'
import { Avatar, avatarSrcForName } from '@/components/Avatar'

/**
 * Cinematic, "trailer-style" hero at the top of the World Cup dashboard previewing next week's
 * semifinals (the Final 4). It's an in-page hero section (NOT a full-page blocking takeover) so the
 * dashboard stays usable around it.
 *
 * Live data: the two semifinal matchups come straight from /api/world-cup-bracket (the same ESPN
 * fifa.world feed the bracket/importer use), which resolves each side to our seeded team — flag via
 * teamFlag(name) and owner via the shared normalizeCountry canonicalization. Owner avatars use the
 * shared Avatar component (perfect-circle guarantee). Undecided SF slots render as "TBD".
 *
 * "Video": there is no video asset in the repo, so this ships an animated CSS/keyframe trailer.
 * The component accepts an optional `videoSrc` (+ `poster`) so a real looping <video> can be dropped
 * in later behind the same hero with zero call-site churn.
 *
 * Dismissable × persists in localStorage under a stable key, read via useSyncExternalStore with a
 * SERVER snapshot of "dismissed" so the hero is never in SSR markup (no hydration flash). World-Cup
 * only — hidden in March Madness.
 */
const DISMISS_KEY = 'calcutta_dismiss_semifinal_preview'
const DISMISS_EVENT = 'calcutta:semifinal-preview-dismissed'

interface BracketSide {
  name: string
  ownerName: string | null
  score: number | null
  winner: boolean
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
}

function subscribeDismissed(onChange: () => void): () => void {
  window.addEventListener(DISMISS_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(DISMISS_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

function formatKickoff(iso: string | null): string {
  if (!iso) return 'Date TBD'
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  } catch {
    return 'Date TBD'
  }
}

function SideBlock({ side }: { side: BracketSide }) {
  const tbd = side.tbd || !side.name.trim()
  const flag = tbd ? '' : teamFlag(side.name, 'worldcup')
  return (
    <div className="flex flex-col items-center gap-2 min-w-0 flex-1">
      <div className="relative rounded-full p-[2px] bg-gradient-to-br from-[#00e6cf] to-[#ffd54a]">
        <Avatar
          src={tbd ? undefined : avatarSrcForName(side.ownerName)}
          alt={side.ownerName ?? 'TBD'}
          size={52}
          className="block"
        />
      </div>
      <div className="text-2xl leading-none" aria-hidden>
        {flag || '⚽'}
      </div>
      <div className="text-center min-w-0 w-full">
        <div
          className={`text-sm font-bold truncate ${tbd ? 'text-[#7a7a8e] italic' : 'text-white'}`}
          title={tbd ? 'TBD' : side.name}
        >
          {tbd ? 'TBD' : side.name}
        </div>
        <div className="text-[11px] text-[#9a9ab0] truncate" title={side.ownerName ?? 'Unowned'}>
          {tbd ? '—' : side.ownerName ?? 'Unowned'}
        </div>
      </div>
    </div>
  )
}

function MatchupPanel({ m, index }: { m: BracketMatchup; index: number }) {
  return (
    <div
      className="semifinal-panel relative overflow-hidden rounded-xl border border-[#2a2a38] bg-[#12121c]/80 backdrop-blur-sm p-4"
      style={{ animationDelay: `${0.15 + index * 0.12}s` }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#00e6cf]">
          Semifinal {index + 1}
        </span>
        <span className="text-[11px] font-semibold text-[#ffd54a]">{formatKickoff(m.date)}</span>
      </div>
      <div className="flex items-center gap-3">
        <SideBlock side={m.home} />
        <div className="shrink-0 flex flex-col items-center">
          <span className="semifinal-vs text-lg font-black bg-gradient-to-r from-[#00e6cf] to-[#ffd54a] bg-clip-text text-transparent">
            VS
          </span>
        </div>
        <SideBlock side={m.away} />
      </div>
    </div>
  )
}

export function SemifinalPreviewHero({
  tournament,
  videoSrc,
  poster
}: {
  tournament: TournamentKey
  /** Optional: drop in a real looping trailer video later; falls back to the CSS animation. */
  videoSrc?: string
  poster?: string
}) {
  const dismissed = useSyncExternalStore(subscribeDismissed, readDismissed, () => true)
  const [data, setData] = useState<BracketData | null>(null)
  const [loaded, setLoaded] = useState(false)

  const active = tournament === 'worldcup' && !dismissed

  useEffect(() => {
    if (!active) return
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/world-cup-bracket', { cache: 'no-store' })
        const json = (await res.json()) as BracketData
        if (!cancelled) setData(json)
      } catch {
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [active])

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // ignore persistence failure; the event below still hides it for this session.
    }
    window.dispatchEvent(new Event(DISMISS_EVENT))
  }

  if (!active) return null

  const semis = data?.rounds?.find((r) => r.slug === 'semifinals')
  const matchups = semis?.matchups ?? []

  // Once loaded, if there are no semifinal fixtures yet, don't render an empty hero.
  if (loaded && matchups.length === 0) return null

  return (
    <section aria-label="World Cup semifinals preview" className="mb-6">
      <div className="semifinal-hero relative overflow-hidden glass-card rounded-2xl border border-[#00ceb8]/30 bg-gradient-to-br from-[#0a1f1c] via-[#101019] to-[#1c160a]">
        {/* Optional real video layer (behind content); ships without one today. */}
        {videoSrc && (
          <video
            className="absolute inset-0 h-full w-full object-cover opacity-30"
            src={videoSrc}
            poster={poster}
            autoPlay
            muted
            loop
            playsInline
            aria-hidden
          />
        )}

        {/* Glow / flare accents */}
        <div className="pointer-events-none absolute -top-20 -left-16 h-56 w-56 rounded-full bg-[#00e6cf]/20 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-[#ffd54a]/20 blur-3xl" aria-hidden />
        <span className="semifinal-flare pointer-events-none absolute top-6 right-16 text-lg" aria-hidden style={{ animationDelay: '0s' }}>✨</span>
        <span className="semifinal-flare pointer-events-none absolute bottom-8 left-10 text-base" aria-hidden style={{ animationDelay: '1s' }}>⭐</span>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss semifinals preview"
          className="absolute top-2.5 right-2.5 z-10 h-8 w-8 flex items-center justify-center rounded-full text-[#bfeee7] hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-[#00ceb8]/60"
        >
          <span aria-hidden className="text-lg leading-none">×</span>
        </button>

        <div className="relative p-5 sm:p-6">
          <div className="text-center mb-5">
            <div className="text-[11px] uppercase tracking-[0.24em] font-semibold text-[#00e6cf] flex items-center justify-center gap-2">
              <span aria-hidden>⚽</span> The Final 4 · Next week <span aria-hidden>⚽</span>
            </div>
            <h2 className="mt-1 text-3xl sm:text-4xl font-black tracking-tight">
              <span className="bg-gradient-to-r from-[#00e6cf] via-white to-[#ffd54a] bg-clip-text text-transparent">
                SEMIFINALS
              </span>
            </h2>
            <p className="mt-1 text-sm text-[#c8c8d8]">
              Four teams, four owners, one step from the final. Here&apos;s who&apos;s left.
            </p>
          </div>

          {!loaded ? (
            <div className="text-center text-[#a0a0b8] py-6 text-sm">Loading matchups…</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {matchups.map((m, i) => (
                <MatchupPanel key={m.id} m={m} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
