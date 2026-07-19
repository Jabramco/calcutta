'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import type { TournamentKey } from '@/lib/tournament'
import { Avatar, avatarSrcForName } from '@/components/Avatar'
import { formatCurrency } from '@/lib/calculations'

/**
 * Celebratory World Cup champion hero at the top of the dashboard: Spain are champions, so this
 * congratulates adua711 (owner of Spain) and shows their winnings, alongside a playful "biggest
 * loser" callout (the owner with the most negative net). It's an in-page hero (NOT a full-page
 * blocking takeover).
 *
 * Accurate figures: earnings come from the app's OWN payout logic via /api/leaderboard, which maps
 * every World Cup owner through calculateOwnerStats (the exact calc the Finances/owners pages use).
 * We show:
 *   - Winnings   = totalPayout (gross payout earned)
 *   - Net profit = totalPayout − totalInvestment
 *   - Biggest loser = the owner with the most negative net (totalPayout − totalInvestment)
 * Nothing is hardcoded — it's derived live so it always matches Finances.
 *
 * Dismissable × persists in localStorage, read via useSyncExternalStore with a SERVER snapshot of
 * "dismissed" so the hero is never in SSR markup (no hydration flash). World-Cup only.
 */
const DISMISS_KEY = 'calcutta_dismiss_champion_hero'
const DISMISS_EVENT = 'calcutta:champion-hero-dismissed'

// The champion team + owner for this tournament. Spain won; adua711 owns Spain.
const CHAMPION_TEAM = 'Spain'
const CHAMPION_OWNER = 'adua711'

interface LeaderRow {
  owner: { name: string }
  totalInvestment: number
  totalPayout: number
  roi: number
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

const CONFETTI = [
  { left: '8%', color: '#ffd54a', delay: '0s' },
  { left: '22%', color: '#c8102e', delay: '0.6s' },
  { left: '38%', color: '#ffe27a', delay: '1.1s' },
  { left: '54%', color: '#ffd54a', delay: '0.3s' },
  { left: '68%', color: '#c8102e', delay: '1.4s' },
  { left: '82%', color: '#ffe27a', delay: '0.9s' },
  { left: '92%', color: '#ffd54a', delay: '1.8s' }
]

export function ChampionHero({ tournament }: { tournament: TournamentKey }) {
  const dismissed = useSyncExternalStore(subscribeDismissed, readDismissed, () => true)
  const [rows, setRows] = useState<LeaderRow[] | null>(null)
  const [loaded, setLoaded] = useState(false)

  const active = tournament === 'worldcup' && !dismissed

  useEffect(() => {
    if (!active) return
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/leaderboard', { cache: 'no-store' })
        const json = (await res.json()) as LeaderRow[]
        if (!cancelled) setRows(Array.isArray(json) ? json : [])
      } catch {
        if (!cancelled) setRows([])
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

  const champion = rows?.find((r) => r.owner.name.toLowerCase() === CHAMPION_OWNER.toLowerCase())
  const championNet = champion ? champion.totalPayout - champion.totalInvestment : null

  // Biggest loser = most negative net (payout − invested) across all ranked owners.
  const loser =
    rows && rows.length > 0
      ? rows.reduce((worst, r) =>
          r.totalPayout - r.totalInvestment < worst.totalPayout - worst.totalInvestment ? r : worst
        )
      : null
  const loserNet = loser ? loser.totalPayout - loser.totalInvestment : null

  return (
    <section aria-label="World Cup champion" className="mb-6">
      <div className="champion-hero relative overflow-hidden glass-card rounded-2xl border border-[#ffd54a]/35 bg-gradient-to-br from-[#2a1f06] via-[#12100a] to-[#2a0a0d]">
        {/* Confetti */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className="champion-confetti absolute top-0 block h-2 w-1.5 rounded-[1px]"
              style={{ left: c.left, backgroundColor: c.color, animationDelay: c.delay }}
            />
          ))}
        </div>

        {/* Glow accents */}
        <div className="pointer-events-none absolute -top-20 -left-16 h-56 w-56 rounded-full bg-[#ffd54a]/25 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-[#c8102e]/25 blur-3xl" aria-hidden />

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss champion banner"
          className="absolute top-2.5 right-2.5 z-10 h-8 w-8 flex items-center justify-center rounded-full text-[#f0dca0] hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-[#ffd54a]/60"
        >
          <span aria-hidden className="text-lg leading-none">×</span>
        </button>

        <div className="relative p-5 sm:p-7">
          <div className="text-center mb-6">
            <div className="text-[11px] uppercase tracking-[0.24em] font-semibold text-[#ffd54a]">
              World Cup Champions
            </div>
            <h2 className="mt-1 text-3xl sm:text-4xl font-black tracking-tight text-white">
              <span className="champion-trophy mr-1" aria-hidden>🏆</span>
              <span className="bg-gradient-to-r from-[#ffe27a] via-[#ffd54a] to-[#c8102e] bg-clip-text text-transparent">
                {CHAMPION_TEAM} are champions!
              </span>
              <span className="ml-1" aria-hidden>🇪🇸</span>
            </h2>
            <p className="mt-1 text-sm text-[#e6e0cf]">
              Campeones del mundo — take a bow. <span className="text-[#ffd54a] font-semibold">Praised be, he.</span>
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Champion owner */}
            <div className="champion-panel relative overflow-hidden rounded-xl border border-[#ffd54a]/40 bg-[#15120a]/80 backdrop-blur-sm p-4" style={{ animationDelay: '0.15s' }}>
              <div className="flex items-center gap-4">
                <div className="shrink-0 rounded-full p-[3px] bg-gradient-to-br from-[#ffe27a] to-[#c8102e] shadow-[0_6px_20px_rgba(255,213,74,0.35)]">
                  <Avatar src={avatarSrcForName(CHAMPION_OWNER)} alt={CHAMPION_OWNER} size={72} className="block" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#ffd54a]">Champion · owner of {CHAMPION_TEAM} 🇪🇸</div>
                  <div className="text-xl font-black text-white truncate">Congrats, {champion?.owner.name ?? CHAMPION_OWNER}!</div>
                  {loaded && champion ? (
                    <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
                      <span className="text-sm">
                        <span className="text-[#9a9ab0]">Winnings </span>
                        <span className="text-[#ffe27a] font-black text-lg tabular-nums">{formatCurrency(champion.totalPayout)}</span>
                      </span>
                      {championNet != null && (
                        <span className="text-xs text-[#9a9ab0]">
                          Net profit <span className="text-[#2dce89] font-semibold tabular-nums">+{formatCurrency(championNet)}</span>
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1.5 text-sm text-[#9a9ab0]">{loaded ? 'Winnings unavailable' : 'Tallying winnings…'}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Biggest loser */}
            <div className="champion-panel relative overflow-hidden rounded-xl border border-[#2a2a38] bg-[#12121c]/80 backdrop-blur-sm p-4" style={{ animationDelay: '0.28s' }}>
              <div className="flex items-center gap-4">
                <div className="shrink-0 rounded-full p-[3px] bg-gradient-to-br from-[#3a3a48] to-[#c8102e]/60 grayscale">
                  <Avatar src={loser ? avatarSrcForName(loser.owner.name) : undefined} alt={loser?.owner.name ?? ''} size={56} className="block" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#ff8a9a]">Biggest loser 💸</div>
                  {loaded && loser && loserNet != null ? (
                    <>
                      <div className="text-lg font-bold text-white truncate">{loser.owner.name}</div>
                      <div className="mt-0.5 text-sm">
                        <span className="text-[#9a9ab0]">Down </span>
                        <span className="text-[#ff6b7a] font-black text-lg tabular-nums">{formatCurrency(Math.abs(loserNet))}</span>
                        <span className="text-xs text-[#7a7a8e]"> on the tournament</span>
                      </div>
                    </>
                  ) : (
                    <div className="mt-1.5 text-sm text-[#9a9ab0]">{loaded ? 'No data' : 'Counting losses…'}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
