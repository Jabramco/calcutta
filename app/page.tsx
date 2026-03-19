'use client'

import {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
  type Dispatch,
  type SetStateAction,
  type MutableRefObject
} from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatROI } from '@/lib/calculations'
import { LeaderboardEntry, GlobalStats } from '@/lib/types'

type UpcomingSide = {
  name: string
  ownerName: string | null
  ownerId: number | null
  /** From ESPN when live / final (same scoreboard request — no extra API calls) */
  score: string | null
}
type UpcomingGame = {
  id: string
  date: string
  status: string
  isLive: boolean
  bracketNote: string | null
  away: UpcomingSide
  home: UpcomingSide
}

const MONEY_RAIN_SYMBOLS = ['$', '💵'] as const
/** Plate-forward mix for “Do dishes” confetti */
const DISH_RAIN_SYMBOLS = ['🍽️', '🍽️', '🍽️', '🥘', '🍴', '🥣'] as const

type RainParticle = {
  id: number
  leftPct: number
  durationSec: number
  delaySec: number
  driftPx: number
  symbol: string
  fontSizePx: number
}

const PAYOUT_ROWS: { key: keyof GlobalStats['payoutPerWin']; label: string }[] = [
  { key: 'round64', label: 'Round of 64' },
  { key: 'round32', label: 'Round of 32' },
  { key: 'sweet16', label: 'Sweet 16' },
  { key: 'elite8', label: 'Elite 8' },
  { key: 'final4', label: 'Final Four' },
  { key: 'championship', label: 'Championship' }
]

function formatGameTime(iso: string): string {
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

function MatchupCard({ g, liveHighlight }: { g: UpcomingGame; liveHighlight: boolean }) {
  return (
    <li
      className={`min-w-0 rounded-xl bg-[#15151e]/90 backdrop-blur-sm border p-4 shadow-[0_8px_32px_rgba(0,0,0,0.25)] transition-all ${
        liveHighlight
          ? 'border-[#f5365c]/45 shadow-[0_0_0_1px_rgba(245,54,92,0.15),0_12px_40px_rgba(245,54,92,0.08)]'
          : 'border-[#2a2a38] hover:border-[#00ceb8]/35 hover:shadow-[0_12px_40px_rgba(0,206,184,0.08)]'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-[#a0a0b8] mb-3">
        <span>{formatGameTime(g.date)}</span>
        {g.isLive && (
          <span className="px-2 py-0.5 rounded bg-[#f5365c]/20 text-[#f5365c] font-semibold">Live</span>
        )}
        <span className="text-[#6a6a82]">{g.status}</span>
        {g.bracketNote && (
          <span className="text-[#6a6a82] truncate max-w-full">{g.bracketNote}</span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 md:gap-4 items-center">
        <TeamBlock side={g.away} align="left" />
        <div className="flex flex-col items-center justify-center gap-1 text-center">
          {(g.away.score != null || g.home.score != null) && (
            <span className="text-lg font-bold tabular-nums text-white tracking-tight">
              {g.away.score ?? '–'} <span className="text-[#6a6a82] font-normal">–</span>{' '}
              {g.home.score ?? '–'}
            </span>
          )}
          <span className="text-[#6a6a82] text-sm hidden md:block">@</span>
        </div>
        <TeamBlock side={g.home} align="right" />
      </div>
    </li>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [stats, setStats] = useState<GlobalStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'roi' | 'payout'>('roi')
  const [games, setGames] = useState<UpcomingGame[]>([])
  const [gamesMeta, setGamesMeta] = useState<{ error?: string } | null>(null)
  const [gamesLoading, setGamesLoading] = useState(true)
  const [moneyRainParticles, setMoneyRainParticles] = useState<RainParticle[]>([])
  const moneyRainClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [dishRainParticles, setDishRainParticles] = useState<RainParticle[]>([])
  const dishRainClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const spawnRain = useCallback(
    (
      symbols: readonly string[],
      count: number,
      setParticles: Dispatch<SetStateAction<RainParticle[]>>,
      clearRef: MutableRefObject<ReturnType<typeof setTimeout> | null>
    ) => {
      if (clearRef.current) {
        clearTimeout(clearRef.current)
        clearRef.current = null
      }
      const base = Date.now()
      const next: RainParticle[] = []
      for (let i = 0; i < count; i++) {
        next.push({
          id: base + i,
          leftPct: Math.random() * 100,
          durationSec: 2.2 + Math.random() * 2.8,
          delaySec: Math.random() * 1.4,
          driftPx: (Math.random() - 0.5) * 120,
          symbol: symbols[Math.floor(Math.random() * symbols.length)]!,
          fontSizePx: 18 + Math.floor(Math.random() * 22)
        })
      }
      setParticles(next)
      const maxMs = Math.ceil(
        Math.max(...next.map((p) => (p.durationSec + p.delaySec) * 1000)) + 400
      )
      clearRef.current = setTimeout(() => {
        setParticles([])
        clearRef.current = null
      }, maxMs)
    },
    []
  )

  const makeItRain = useCallback(() => {
    spawnRain(MONEY_RAIN_SYMBOLS, 72, setMoneyRainParticles, moneyRainClearRef)
  }, [spawnRain])

  const makeDishesRain = useCallback(() => {
    spawnRain(DISH_RAIN_SYMBOLS, 80, setDishRainParticles, dishRainClearRef)
  }, [spawnRain])

  useEffect(() => {
    return () => {
      if (moneyRainClearRef.current) clearTimeout(moneyRainClearRef.current)
      if (dishRainClearRef.current) clearTimeout(dishRainClearRef.current)
    }
  }, [])

  useEffect(() => {
    async function fetchData() {
      try {
        const [leaderboardRes, statsRes] = await Promise.all([
          fetch('/api/leaderboard', { cache: 'no-store' }),
          fetch('/api/stats', { cache: 'no-store' })
        ])
        setLeaderboard(await leaderboardRes.json())
        setStats(await statsRes.json())
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
    const onVis = () => {
      if (!document.hidden) fetchData()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadGames() {
      setGamesLoading(true)
      try {
        const year = new Date().getUTCFullYear()
        const res = await fetch(`/api/upcoming-games?year=${year}`, { cache: 'no-store' })
        const data = await res.json()
        if (cancelled) return
        setGames(Array.isArray(data.games) ? data.games : [])
        setGamesMeta(data.error ? { error: data.error } : null)
      } catch {
        if (!cancelled) {
          setGames([])
          setGamesMeta({ error: 'Could not load schedule' })
        }
      } finally {
        if (!cancelled) setGamesLoading(false)
      }
    }
    loadGames()
    return () => {
      cancelled = true
    }
  }, [])

  const sortedLeaderboard = useMemo(() => {
    return [...leaderboard].sort((a, b) =>
      sortBy === 'roi' ? b.roi - a.roi : b.totalPayout - a.totalPayout
    )
  }, [leaderboard, sortBy])

  /** Top section: in-progress games only */
  const gamesLiveSorted = useMemo(() => {
    return [...games.filter((g) => g.isLive)].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )
  }, [games])

  /** Bottom section: scheduled / not yet live */
  const gamesUpcomingSorted = useMemo(() => {
    return [...games.filter((g) => !g.isLive)].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )
  }, [games])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-[#a0a0b8]">Loading...</div>
      </div>
    )
  }

  return (
    <>
      {(moneyRainParticles.length > 0 || dishRainParticles.length > 0) && (
        <div
          className="fixed inset-0 z-[300] pointer-events-none overflow-hidden"
          aria-hidden
        >
          {moneyRainParticles.map((p) => (
            <span
              key={`m-${p.id}`}
              className="money-rain-particle"
              style={{
                left: `${p.leftPct}%`,
                animationDuration: `${p.durationSec}s`,
                animationDelay: `${p.delaySec}s`,
                fontSize: p.fontSizePx,
                ['--money-drift' as string]: `${p.driftPx}px`
              }}
            >
              {p.symbol}
            </span>
          ))}
          {dishRainParticles.map((p) => (
            <span
              key={`d-${p.id}`}
              className="money-rain-particle dish-rain-particle"
              style={{
                left: `${p.leftPct}%`,
                animationDuration: `${p.durationSec}s`,
                animationDelay: `${p.delaySec}s`,
                fontSize: p.fontSizePx,
                ['--money-drift' as string]: `${p.driftPx}px`
              }}
            >
              {p.symbol}
            </span>
          ))}
        </div>
      )}

      <div className="glass-bg">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>

      <div className="container mx-auto px-4 py-6 md:py-8 glass-content max-w-7xl">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-sm text-[#a0a0b8] mt-1 max-w-2xl">
            Prize pool, payouts, standings, and matchups.
          </p>
        </header>

        <div
          className="dashboard-pay-banner relative z-0 mb-6 flex flex-col gap-3 rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div className="relative z-10 flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/25 backdrop-blur-sm ring-1 ring-white/15" aria-hidden>
              <svg
                className="h-7 w-7 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
              >
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
              </svg>
            </span>
            <p className="text-sm font-semibold text-white drop-shadow-sm sm:text-base">
              Kial, Fewl, and Mic. Pay Fammy
            </p>
          </div>
          <button
            type="button"
            onClick={makeDishesRain}
            className="relative z-10 shrink-0 rounded-lg border border-red-400/50 bg-gradient-to-b from-[#e11d48] to-[#9f1239] px-4 py-2 text-sm font-bold text-white shadow-[0_4px_18px_rgba(220,38,38,0.45)] transition-all hover:brightness-110 hover:shadow-[0_6px_24px_rgba(220,38,38,0.55)] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-[#1a0a0c]"
          >
            Do dishes
          </button>
        </div>

        {/* Live games only — under banner */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-white mb-5">Live games</h2>

          {gamesLoading ? (
            <p className="text-sm text-[#a0a0b8]">Loading schedule…</p>
          ) : gamesMeta?.error && games.length === 0 ? (
            <p className="text-sm text-[#fb6340]">{gamesMeta.error}</p>
          ) : games.length === 0 ? (
            <p className="text-sm text-[#a0a0b8]">
              No upcoming or live tournament games in this window (mid-March through early April). Check back
              during the tournament.
            </p>
          ) : gamesLiveSorted.length === 0 ? (
            <p className="text-sm text-[#a0a0b8]">No games live right now.</p>
          ) : (
            <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4 list-none p-0 m-0">
              {gamesLiveSorted.map((g) => (
                <MatchupCard key={g.id} g={g} liveHighlight />
              ))}
            </ul>
          )}
        </section>

        {/* Leaderboard (left) + Payout per win (right) */}
        <div className="flex flex-col lg:flex-row lg:items-stretch gap-4 lg:gap-6 mb-6">
          <div className="glass-card rounded-2xl border border-[#2a2a38] flex flex-col min-h-[260px] max-h-[420px] lg:flex-1 lg:min-w-0 order-1">
            <div className="p-3 border-b border-[#2a2a38] flex items-center justify-between gap-2 shrink-0">
              <span className="text-sm font-semibold text-white">Leaderboard</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'roi' | 'payout')}
                className="text-xs px-2 py-1.5 bg-[#1c1c28] border border-[#2a2a38] rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#00ceb8]"
                aria-label="Sort leaderboard"
              >
                <option value="roi">By ROI</option>
                <option value="payout">By payout</option>
              </select>
            </div>
            <div className="overflow-y-auto flex-1 p-0">
              {sortedLeaderboard.length === 0 ? (
                <p className="text-sm text-[#a0a0b8] p-4">No owners yet. Run the auction to get started.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[#1c1c28]/95 backdrop-blur-sm z-10">
                    <tr className="text-left text-[10px] uppercase tracking-wider text-[#6a6a82]">
                      <th className="pl-3 pr-1 py-2 w-8">#</th>
                      <th className="pr-2 py-2">Name</th>
                      <th className="pr-2 py-2 text-right">Invest</th>
                      <th className="pr-3 py-2 text-right">Earned</th>
                      <th className="pr-3 py-2 text-right">ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedLeaderboard.map((entry, index) => (
                      <tr
                        key={entry.owner.id}
                        onClick={() => router.push(`/owners/${entry.owner.id}`)}
                        className="border-t border-[#2a2a38]/60 hover:bg-[#23232f]/80 cursor-pointer transition-colors"
                      >
                        <td className="pl-3 pr-1 py-2.5 text-[#6a6a82] tabular-nums">{index + 1}</td>
                        <td className="pr-2 py-2.5 font-medium text-[#00ceb8] truncate max-w-[140px] md:max-w-[200px]" title={entry.owner.name}>
                          {entry.owner.name}
                        </td>
                        <td className="pr-2 py-2.5 text-right text-white tabular-nums text-xs">
                          {formatCurrency(entry.totalInvestment)}
                        </td>
                        <td className="pr-3 py-2.5 text-right text-[#2dce89] font-semibold tabular-nums text-xs">
                          {formatCurrency(entry.totalPayout)}
                        </td>
                        <td
                          className={`pr-3 py-2.5 text-right font-semibold tabular-nums text-xs ${
                            entry.roi >= 100
                              ? 'text-[#2dce89]'
                              : entry.roi >= 0
                                ? 'text-[#00ceb8]'
                                : 'text-[#f5365c]'
                          }`}
                        >
                          {formatROI(entry.roi)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {stats && (
            <div className="glass-card rounded-2xl p-4 w-full lg:w-[200px] xl:w-[220px] shrink-0 border border-[#2a2a38] order-2 lg:max-h-[420px] lg:overflow-y-auto">
              <div className="text-xs font-semibold text-[#00ceb8] uppercase tracking-wider mb-3">
                Payout / win
              </div>
              <ul className="space-y-2 text-xs">
                {PAYOUT_ROWS.map(({ key, label }) => (
                  <li key={key} className="flex flex-col gap-0.5 border-b border-[#2a2a38]/80 pb-2 last:border-0 last:pb-0">
                    <span className="text-[#6a6a82] leading-tight">{label}</span>
                    <span className="text-white font-semibold tabular-nums">
                      {formatCurrency(stats.payoutPerWin[key])}
                    </span>
                    <span className="text-[10px] text-[#6a6a82]">{stats.percentages[key]} of pot</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Total prize pool — full width below */}
        {stats && (
          <div className="glass-card p-5 md:p-6 rounded-2xl border border-[#2a2a38] mb-8 w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-center sm:text-left min-w-0">
              <div className="text-xs text-[#a0a0b8] uppercase tracking-wider mb-2">Total prize pool</div>
              <div className="text-3xl md:text-4xl font-bold text-[#00ceb8] tabular-nums">
                {formatCurrency(stats.totalPot)}
              </div>
            </div>
            <button
              type="button"
              onClick={makeItRain}
              className="shrink-0 self-center sm:self-auto px-5 py-2.5 rounded-xl font-semibold text-sm text-[#0d0d14] bg-gradient-to-br from-[#00e6cf] via-[#00ceb8] to-[#00a892] shadow-[0_4px_20px_rgba(0,206,184,0.35)] hover:shadow-[0_6px_28px_rgba(0,206,184,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all border border-[#00ceb8]/50 focus:outline-none focus:ring-2 focus:ring-[#00ceb8] focus:ring-offset-2 focus:ring-offset-[#12121a]"
            >
              Bradie
            </button>
          </div>
        )}

        {/* Scheduled / not-yet-live — same ESPN feed as Live */}
        {!gamesLoading && games.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-bold text-white mb-5">Upcoming games</h2>
            {gamesUpcomingSorted.length === 0 ? (
              <p className="text-sm text-[#a0a0b8]">No scheduled games in the current feed.</p>
            ) : (
              <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4 list-none p-0 m-0">
                {gamesUpcomingSorted.map((g) => (
                  <MatchupCard key={g.id} g={g} liveHighlight={false} />
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </>
  )
}

function TeamBlock({ side, align }: { side: UpcomingSide; align: 'left' | 'right' }) {
  const router = useRouter()
  const ownerClick =
    side.ownerId != null
      ? () => router.push(`/owners/${side.ownerId}`)
      : undefined
  return (
    <div className={align === 'right' ? 'md:text-right' : ''}>
      <div className={`font-semibold text-white ${align === 'right' ? 'md:justify-end' : ''}`}>
        {side.name}
      </div>
      {side.ownerName ? (
        <button
          type="button"
          onClick={ownerClick}
          className={`text-sm mt-1 text-[#00ceb8] hover:underline ${ownerClick ? 'cursor-pointer' : ''}`}
          disabled={!ownerClick}
        >
          {side.ownerName}
        </button>
      ) : (
        <div className="text-sm mt-1 text-[#6a6a82]">Unowned / no match</div>
      )}
    </div>
  )
}
