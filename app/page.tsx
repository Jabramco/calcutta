'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatROI } from '@/lib/calculations'
import { LeaderboardEntry, GlobalStats } from '@/lib/types'

type UpcomingSide = { name: string; ownerName: string | null; ownerId: number | null }
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

type MoneyRainParticle = {
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

/** Match ESPN game time to the user's local calendar date (same day as `ref`, default now). */
function isGameOnLocalCalendarDay(isoDate: string, ref: Date = new Date()): boolean {
  const game = new Date(isoDate)
  if (Number.isNaN(game.getTime())) return false
  return (
    game.getFullYear() === ref.getFullYear() &&
    game.getMonth() === ref.getMonth() &&
    game.getDate() === ref.getDate()
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
  const [moneyRainParticles, setMoneyRainParticles] = useState<MoneyRainParticle[]>([])
  const moneyRainClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const makeItRain = useCallback(() => {
    if (moneyRainClearRef.current) {
      clearTimeout(moneyRainClearRef.current)
      moneyRainClearRef.current = null
    }
    const base = Date.now()
    const count = 72
    const next: MoneyRainParticle[] = []
    for (let i = 0; i < count; i++) {
      next.push({
        id: base + i,
        leftPct: Math.random() * 100,
        durationSec: 2.2 + Math.random() * 2.8,
        delaySec: Math.random() * 1.4,
        driftPx: (Math.random() - 0.5) * 120,
        symbol: MONEY_RAIN_SYMBOLS[Math.floor(Math.random() * MONEY_RAIN_SYMBOLS.length)],
        fontSizePx: 18 + Math.floor(Math.random() * 22)
      })
    }
    setMoneyRainParticles(next)
    const maxMs = Math.ceil(
      Math.max(...next.map((p) => (p.durationSec + p.delaySec) * 1000)) + 400
    )
    moneyRainClearRef.current = setTimeout(() => {
      setMoneyRainParticles([])
      moneyRainClearRef.current = null
    }, maxMs)
  }, [])

  useEffect(() => {
    return () => {
      if (moneyRainClearRef.current) clearTimeout(moneyRainClearRef.current)
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

  const gamesToday = useMemo(() => {
    const now = new Date()
    return games.filter((g) => isGameOnLocalCalendarDay(g.date, now))
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
      {moneyRainParticles.length > 0 && (
        <div
          className="fixed inset-0 z-[300] pointer-events-none overflow-hidden"
          aria-hidden
        >
          {moneyRainParticles.map((p) => (
            <span
              key={p.id}
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

        {/* Upcoming games — today only (local date); matchup cards float below */}
        <section className="mt-2 mb-10">
          <h2 className="text-lg font-bold text-white">Upcoming games</h2>
          <p className="text-xs text-[#a0a0b8] mt-1 mb-5">
            Showing games on{' '}
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}{' '}
            (your local time)
          </p>

          {gamesLoading ? (
            <p className="text-sm text-[#a0a0b8]">Loading schedule…</p>
          ) : gamesMeta?.error && games.length === 0 ? (
            <p className="text-sm text-[#fb6340]">{gamesMeta.error}</p>
          ) : games.length === 0 ? (
            <p className="text-sm text-[#a0a0b8]">
              No upcoming or live tournament games in this window (mid-March through early April). Check back
              during the tournament.
            </p>
          ) : gamesToday.length === 0 ? (
            <p className="text-sm text-[#a0a0b8]">No games scheduled for today.</p>
          ) : (
            <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4 list-none p-0 m-0">
              {gamesToday.map((g) => (
                <li
                  key={g.id}
                  className="min-w-0 rounded-xl bg-[#15151e]/90 backdrop-blur-sm border border-[#2a2a38] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.25)] hover:border-[#00ceb8]/35 hover:shadow-[0_12px_40px_rgba(0,206,184,0.08)] transition-all"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#a0a0b8] mb-3">
                    <span>{formatGameTime(g.date)}</span>
                    {g.isLive && (
                      <span className="px-2 py-0.5 rounded bg-[#f5365c]/20 text-[#f5365c] font-semibold">
                        Live
                      </span>
                    )}
                    <span className="text-[#6a6a82]">{g.status}</span>
                    {g.bracketNote && (
                      <span className="text-[#6a6a82] truncate max-w-full">{g.bracketNote}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 md:gap-4 items-center">
                    <TeamBlock side={g.away} align="left" />
                    <span className="text-[#6a6a82] text-sm text-center hidden md:block">@</span>
                    <TeamBlock side={g.home} align="right" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
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
