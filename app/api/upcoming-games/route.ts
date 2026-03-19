import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Owner } from '@prisma/client'

const NCAA_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball'

type TeamRow = {
  id: number
  name: string
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const yearParam = searchParams.get('year')
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getUTCFullYear()
    if (Number.isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 })
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

      return {
        id: String(event.id),
        date,
        dateMs: new Date(date).getTime(),
        status: statusDetail,
        isLive: event.status?.type?.state === 'in',
        bracketNote: note ?? null,
        away: matchTeam(a, teamRows),
        home: matchTeam(h, teamRows)
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
