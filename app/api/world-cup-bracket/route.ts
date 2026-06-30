import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Owner } from '@prisma/client'
import { getCurrentTournament } from '@/lib/tournamentServer'
import { normalizeCountry } from '@/lib/tournamentImport'

// Same key-less ESPN FIFA World Cup feed the importer + upcoming-games use; it carries the
// full knockout schedule (both teams, scores, status, winner flag) for every round.
const WORLD_CUP_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world'

// Knockout rounds in bracket order. The 3rd-place match is intentionally excluded — it isn't
// part of the championship bracket path. Keys are the ESPN `season.slug` values.
const KNOCKOUT_ROUNDS: ReadonlyArray<{ slug: string; label: string }> = [
  { slug: 'round-of-32', label: 'Round of 32' },
  { slug: 'round-of-16', label: 'Round of 16' },
  { slug: 'quarterfinals', label: 'Quarterfinals' },
  { slug: 'semifinals', label: 'Semifinals' },
  { slug: 'final', label: 'Final' }
]

interface EspnCompetitor {
  homeAway?: string
  winner?: boolean
  score?: unknown
  team?: { displayName?: string; shortDisplayName?: string }
}
interface EspnEvent {
  id?: string | number
  date?: string
  season?: { slug?: string }
  status?: { type?: { state?: string; completed?: boolean; shortDetail?: string; detail?: string } }
  competitions?: Array<{ competitors?: EspnCompetitor[] }>
}

type TeamRow = {
  name: string
  owner: Owner | null
  dogTeam: { owner: Owner | null } | null
}

function competitorScore(c: EspnCompetitor | undefined): number | null {
  if (!c) return null
  const s = c.score as Record<string, unknown> | string | number | null | undefined
  if (s == null) return null
  if (typeof s === 'number') return s
  if (typeof s === 'string') {
    const n = parseInt(s, 10)
    return Number.isFinite(n) ? n : null
  }
  if (typeof s === 'object') {
    if (typeof s.value === 'number') return s.value
    if (s.displayValue != null) {
      const n = parseInt(String(s.displayValue), 10)
      return Number.isFinite(n) ? n : null
    }
  }
  return null
}

export async function GET() {
  const tournament = await getCurrentTournament()
  // World-Cup-only feature; other tournaments get an empty bracket (the UI is WC-gated anyway).
  if (tournament !== 'worldcup') {
    return NextResponse.json({ rounds: [], champion: null })
  }

  try {
    const year = new Date().getUTCFullYear()
    const res = await fetch(`${WORLD_CUP_API_BASE}/scoreboard?dates=${year}&limit=300`, {
      cache: 'no-store'
    })
    if (!res.ok) {
      return NextResponse.json({ rounds: [], champion: null, error: 'ESPN fetch failed' })
    }
    const data = await res.json()
    const events = (data.events ?? []) as EspnEvent[]

    // Canonical-name → our seeded Team (with owner) so flags + owners line up with the bracket.
    const teams = (await prisma.team.findMany({
      where: { tournament: 'worldcup' },
      include: { owner: true, dogTeam: { include: { owner: true } } }
    })) as TeamRow[]
    const byKey = new Map<string, TeamRow>()
    for (const t of teams) byKey.set(normalizeCountry(t.name), t)

    // Resolve an ESPN competitor name to our seeded team. Undecided knockout slots come back
    // from ESPN as placeholders like "Round of 32 3 Winner" that match no seeded team — those
    // are flagged `tbd` so the bracket shows a clean "TBD" rather than the placeholder text.
    const resolve = (espnName: string | undefined) => {
      const raw = espnName ?? ''
      const t = raw ? byKey.get(normalizeCountry(raw)) : undefined
      const owner = t?.owner ?? t?.dogTeam?.owner ?? null
      return { name: t?.name ?? '', ownerName: owner?.name ?? null, tbd: !t }
    }

    let champion: { name: string; ownerName: string | null } | null = null

    const rounds = KNOCKOUT_ROUNDS.map(({ slug, label }) => {
      const matchups = events
        .filter((e) => e.season?.slug === slug)
        .filter((e) => (e.competitions?.[0]?.competitors?.length ?? 0) >= 2)
        .sort((a, b) => new Date(a.date ?? '').getTime() - new Date(b.date ?? '').getTime())
        .map((e) => {
          const cs = e.competitions?.[0]?.competitors ?? []
          const homeC = cs.find((c) => c.homeAway === 'home') ?? cs[0]
          const awayC = cs.find((c) => c.homeAway === 'away') ?? cs[1]
          const completed = Boolean(e.status?.type?.completed)
          const state = e.status?.type?.state ?? 'pre' // 'pre' | 'in' | 'post'
          const showScore = completed || state === 'in'
          const home = resolve(homeC?.team?.displayName || homeC?.team?.shortDisplayName)
          const away = resolve(awayC?.team?.displayName || awayC?.team?.shortDisplayName)

          if (slug === 'final' && completed) {
            if (homeC?.winner) champion = home
            else if (awayC?.winner) champion = away
          }

          return {
            id: String(e.id ?? `${slug}-${home.name}-${away.name}`),
            date: e.date ?? null,
            state,
            completed,
            status: e.status?.type?.shortDetail || e.status?.type?.detail || 'Scheduled',
            home: {
              ...home,
              score: showScore ? competitorScore(homeC) : null,
              winner: Boolean(homeC?.winner)
            },
            away: {
              ...away,
              score: showScore ? competitorScore(awayC) : null,
              winner: Boolean(awayC?.winner)
            }
          }
        })
      return { slug, label, matchups }
    })

    return NextResponse.json({ rounds, champion })
  } catch (error) {
    console.error('world-cup-bracket:', error)
    return NextResponse.json({ rounds: [], champion: null, error: 'Failed to build bracket' })
  }
}
