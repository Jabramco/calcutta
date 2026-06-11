import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Owner } from '@prisma/client'
import { maybeAutoSyncTournament } from '@/lib/autoSyncTournament'
import { getCurrentTournament } from '@/lib/tournamentServer'
import { normalizeCountry } from '@/lib/tournamentImport'

const NCAA_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball'
// ESPN's public, key-less FIFA World Cup (soccer) scoreboard — same feed the
// World Cup importer uses; `dates=<year>` returns the full schedule (incl. upcoming
// "pre" fixtures) so the dashboard can show games before kickoff.
const WORLD_CUP_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world'

type TeamRow = {
  id: number
  name: string
  region: string | null
  owner: Owner | null
  dogTeamId: number | null
  dogTeam: { owner: Owner | null } | null
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreNameMatch(espnDisplay: string, dbName: string): number {
  const a = normalizeName(espnDisplay)
  const b = normalizeName(dbName)
  if (!a || !b) return 0
  if (a === b) return 1000
  if (b.startsWith(a + ' ') || b.endsWith(' ' + a) || b.includes(' ' + a + ' ')) return 800
  if (a.startsWith(b + ' ') || a.includes(' ' + b + ' ')) return 750
  if (b.includes(a)) return 400 + Math.min(a.length, 20)
  if (a.includes(b)) return 300 + Math.min(b.length, 20)
  const aw = new Set(a.split(' ').filter((w) => w.length > 2))
  const bw = b.split(' ').filter((w) => w.length > 2)
  let overlap = 0
  for (const w of bw) if (aw.has(w)) overlap += w.length
  return overlap > 5 ? overlap : 0
}

function effectiveOwner(t: TeamRow): Owner | null {
  if (t.owner) return t.owner
  if (t.dogTeam?.owner) return t.dogTeam.owner
  return null
}

/** ESPN competitor.score is string, number, or { displayValue, value } */
function competitorScore(c: { score?: unknown } | undefined): string | null {
  if (!c) return null
  const s = c.score as Record<string, unknown> | string | number | null | undefined
  if (s == null) return null
  if (typeof s === 'string' || typeof s === 'number') {
    const t = String(s).trim()
    return t.length ? t : null
  }
  if (typeof s === 'object') {
    if (s.displayValue != null) return String(s.displayValue)
    if (typeof s.value === 'number') return String(s.value)
  }
  return null
}

function matchTeam(
  espnName: string,
  teams: TeamRow[]
): { name: string; ownerName: string | null; ownerId: number | null } {
  let best: TeamRow | null = null
  let bestScore = 0
  for (const t of teams) {
    const s = scoreNameMatch(espnName, t.name)
    if (s > bestScore) {
      bestScore = s
      best = t
    }
  }
  if (!best || bestScore < 50) {
    return { name: espnName, ownerName: null, ownerId: null }
  }
  const o = effectiveOwner(best)
  return { name: espnName, ownerName: o?.name ?? null, ownerId: o?.id ?? null }
}

/** Humanize the ESPN soccer `season.slug` into a round/group label for the card. */
function worldCupRoundLabel(slug: string | undefined, group: string | null): string | null {
  if (slug === 'group-stage') return group ? `Group ${group}` : 'Group Stage'
  if (!slug) return null
  const map: Record<string, string> = {
    'round-of-32': 'Round of 32',
    'round-of-16': 'Round of 16',
    quarterfinals: 'Quarterfinals',
    quarterfinal: 'Quarterfinals',
    semifinals: 'Semifinals',
    semifinal: 'Semifinals',
    final: 'Final',
    'third-place': 'Third Place'
  }
  return (
    map[slug] ??
    slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  )
}

/** World Cup: exact-key match ESPN's country name to our seeded Team row so flags,
 *  canonical names, and owners render. Reuses the importer's normalizeCountry. */
function matchWorldCupTeam(
  espnName: string,
  byKey: Map<string, TeamRow>
): { name: string; ownerName: string | null; ownerId: number | null; region: string | null } {
  const t = byKey.get(normalizeCountry(espnName))
  if (!t) return { name: espnName, ownerName: null, ownerId: null, region: null }
  const o = effectiveOwner(t)
  return { name: t.name, ownerName: o?.name ?? null, ownerId: o?.id ?? null, region: t.region ?? null }
}

interface WcCompetitor {
  homeAway?: string
  score?: unknown
  team?: { displayName?: string; shortDisplayName?: string }
}
interface WcEvent {
  id?: string | number
  date?: string
  season?: { slug?: string }
  status?: { type?: { state?: string; completed?: boolean; shortDetail?: string; detail?: string } }
  competitions?: Array<{ competitors?: WcCompetitor[] }>
}

async function worldCupUpcomingGames(year: number, now: number) {
  const url = `${WORLD_CUP_API_BASE}/scoreboard?dates=${year}&limit=300`
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    return NextResponse.json(
      { error: 'Failed to fetch schedule from ESPN', games: [] },
      { status: 200 }
    )
  }

  const data = await response.json()
  const events = (data.events ?? []) as WcEvent[]

  const upcoming = events
    .filter((e) => (e.competitions?.[0]?.competitors?.length ?? 0) >= 2)
    .filter((e) => !e.status?.type?.completed)
    .sort((a, b) => new Date(a.date ?? '').getTime() - new Date(b.date ?? '').getTime())
    .slice(0, 24)

  const teams = await prisma.team.findMany({
    where: { tournament: 'worldcup' },
    include: { owner: true, dogTeam: { include: { owner: true } } }
  })
  const teamRows = teams as TeamRow[]
  const byKey = new Map<string, TeamRow>()
  for (const t of teamRows) byKey.set(normalizeCountry(t.name), t)

  const games = upcoming.map((event) => {
    const competitors = event.competitions?.[0]?.competitors ?? []
    const home = competitors.find((c) => c.homeAway === 'home')
    const away = competitors.find((c) => c.homeAway === 'away')
    const a = away?.team?.displayName || away?.team?.shortDisplayName || 'TBD'
    const h = home?.team?.displayName || home?.team?.shortDisplayName || 'TBD'
    const statusDetail = event.status?.type?.shortDetail || event.status?.type?.detail || 'Scheduled'
    const date = event.date as string
    const isLive = event.status?.type?.state === 'in'
    const completed = Boolean(event.status?.type?.completed)
    const awayMatched = matchWorldCupTeam(a, byKey)
    const homeMatched = matchWorldCupTeam(h, byKey)
    const awayPts = competitorScore(away)
    const homePts = competitorScore(home)
    const showScores =
      isLive ||
      completed ||
      (awayPts != null && homePts != null && (awayPts !== '0' || homePts !== '0'))
    const group = homeMatched.region ?? awayMatched.region
    const note = worldCupRoundLabel(event.season?.slug, group)

    return {
      id: String(event.id),
      date,
      dateMs: new Date(date).getTime(),
      status: statusDetail,
      isLive,
      bracketNote: note ?? null,
      away: {
        name: awayMatched.name,
        ownerName: awayMatched.ownerName,
        ownerId: awayMatched.ownerId,
        score: showScores ? awayPts : null
      },
      home: {
        name: homeMatched.name,
        ownerName: homeMatched.ownerName,
        ownerId: homeMatched.ownerId,
        score: showScores ? homePts : null
      }
    }
  })

  return NextResponse.json({ year, source: 'espn', games, fetchedAt: now })
}

export async function GET(request: Request) {
  try {
    const tournament = await getCurrentTournament()
    await maybeAutoSyncTournament(tournament)

    const { searchParams } = new URL(request.url)
    const yearParam = searchParams.get('year')
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getUTCFullYear()
    if (Number.isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 })
    }

    if (tournament === 'worldcup') {
      return await worldCupUpcomingGames(year, Date.now())
    }

    const tournamentUrl = `${NCAA_API_BASE}/scoreboard?limit=200&dates=${year}0315-${year}0410&groups=100`
    const response = await fetch(tournamentUrl, { cache: 'no-store' })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch schedule from ESPN', games: [] },
        { status: 200 }
      )
    }

    const data = await response.json()
    const events = (data.events ?? []) as any[]

    const tournamentEvents = events.filter(
      (e) => e.season?.type === 3 && e.competitions?.[0]?.competitors?.length >= 2
    )

    const now = Date.now()
    const upcoming = tournamentEvents
      .filter((e) => !e.status?.type?.completed)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 24)

    const teams = await prisma.team.findMany({
      where: { tournament: 'marchmadness' },
      include: {
        owner: true,
        dogTeam: { include: { owner: true } }
      }
    })

    const teamRows = teams as TeamRow[]

    const games = upcoming.map((event) => {
      const comp = event.competitions[0]
      const note = comp.notes?.[0]?.headline as string | undefined
      const competitors = comp.competitors ?? []
      const home = competitors.find((c: any) => c.homeAway === 'home')
      const away = competitors.find((c: any) => c.homeAway === 'away')
      const a = away?.team?.displayName || away?.team?.shortDisplayName || 'TBD'
      const h = home?.team?.displayName || home?.team?.shortDisplayName || 'TBD'
      const statusDetail = event.status?.type?.shortDetail || event.status?.type?.detail || 'Scheduled'
      const date = event.date as string
      const isLive = event.status?.type?.state === 'in'
      const completed = Boolean(event.status?.type?.completed)
      const awayMatched = matchTeam(a, teamRows)
      const homeMatched = matchTeam(h, teamRows)
      const awayPts = competitorScore(away)
      const homePts = competitorScore(home)
      /** Avoid 0–0 noise before tip; show once live, final, or any non-zero side */
      const showScores =
        isLive ||
        completed ||
        (awayPts != null &&
          homePts != null &&
          (awayPts !== '0' || homePts !== '0'))

      return {
        id: String(event.id),
        date,
        dateMs: new Date(date).getTime(),
        status: statusDetail,
        isLive,
        bracketNote: note ?? null,
        away: { ...awayMatched, score: showScores ? awayPts : null },
        home: { ...homeMatched, score: showScores ? homePts : null }
      }
    })

    return NextResponse.json({
      year,
      source: 'espn',
      games,
      fetchedAt: now
    })
  } catch (error) {
    console.error('upcoming-games:', error)
    return NextResponse.json({ error: 'Failed to load games', games: [] }, { status: 200 })
  }
}
