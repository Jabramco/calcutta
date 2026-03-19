import { prisma } from '@/lib/prisma'

const NCAA_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball'

export type TournamentImportSuccess = {
  success: true
  message: string
  champion: string
  tournamentGames: number
  updatedTeams: number
  updatedNames: number
  updates: string[]
}

export type TournamentImportFailure = {
  success: false
  status: number
  error: string
  details?: string
}

export type TournamentImportResult = TournamentImportSuccess | TournamentImportFailure

/**
 * Fetch ESPN NCAA tournament scoreboard and sync team names + round-win flags.
 * Used by admin POST and scheduled cron. Does not touch DB if ESPN returns no tournament events.
 */
export async function runTournamentImport(year: number): Promise<TournamentImportResult> {
  console.log(`[tournamentImport] Fetching tournament data for ${year}...`)

  const tournamentUrl = `${NCAA_API_BASE}/scoreboard?limit=100&dates=${year}0315-${year}0410&groups=100`

  const response = await fetch(tournamentUrl, { cache: 'no-store' })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    console.error(`[tournamentImport] ESPN status ${response.status}`, errorText.slice(0, 200))
    return {
      success: false,
      status: 502,
      error: `Failed to fetch tournament data: ${response.status}`,
      details: errorText.slice(0, 500)
    }
  }

  const data = await response.json()
  console.log(`[tournamentImport] Received ${data.events?.length || 0} events`)

  if (!data.events || data.events.length === 0) {
    return {
      success: false,
      status: 404,
      error: 'No tournament games found for this year'
    }
  }

  const allTournamentEvents = (data.events as any[]).filter((e: any) => e.season?.type === 3)

  if (allTournamentEvents.length === 0) {
    console.warn('[tournamentImport] No season-type-3 events; skipping DB updates to avoid wiping wins')
    return {
      success: false,
      status: 404,
      error:
        'No NCAA tournament games in ESPN response for this year. Database unchanged (avoids clearing round wins).'
    }
  }

  const tournamentGames = (data.events as any[])
    .filter((event: any) => event.season?.type === 3 && event.status?.type?.completed)
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())

  console.log(
    `[tournamentImport] ${allTournamentEvents.length} tournament events, ${tournamentGames.length} completed`
  )

  const isFirstFourEvent = (event: any) => {
    const note = event.competitions?.[0]?.notes?.[0]?.headline as string | undefined
    if (note?.toLowerCase().includes('first four')) return true
    const date = event.date ? new Date(event.date) : null
    if (!date) return false
    const month = date.getUTCMonth()
    const day = date.getUTCDate()
    if (month === 2 && (day === 17 || day === 18)) return true
    return false
  }

  const REGIONS = ['East', 'West', 'South', 'Midwest'] as const
  const bracketByRegionSeed: Record<string, Map<number, string>> = {}
  REGIONS.forEach((r) => {
    bracketByRegionSeed[r] = new Map()
  })

  const eventsByDate = [...allTournamentEvents].sort(
    (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )
  for (const event of eventsByDate) {
    const note = event.competitions?.[0]?.notes?.[0]?.headline as string | undefined
    const regionMatch = note?.match(/(East|West|South|Midwest) Region/)
    const region = regionMatch ? regionMatch[1] : null
    if (!region || !REGIONS.includes(region as (typeof REGIONS)[number])) continue
    const competitors = event.competitions?.[0]?.competitors ?? []
    const completed = event.status?.type?.completed

    if (isFirstFourEvent(event) && completed && competitors.length === 2) {
      const winner = competitors.find((c: any) => c.winner)
      if (winner) {
        const winnerName = winner.team?.displayName || winner.team?.shortDisplayName
        const winnerSeed = winner.curatedRank?.current
        if (
          winnerName &&
          winnerName !== 'TBD' &&
          typeof winnerSeed === 'number' &&
          winnerSeed >= 1 &&
          winnerSeed <= 16
        ) {
          bracketByRegionSeed[region].set(winnerSeed, winnerName)
        }
      }
      continue
    }

    if (isFirstFourEvent(event)) continue

    for (const c of competitors) {
      const displayName = c.team?.displayName || c.team?.shortDisplayName
      if (!displayName || displayName === 'TBD') continue
      const seed = c.curatedRank?.current
      if (typeof seed !== 'number' || seed < 1 || seed > 16) continue
      const map = bracketByRegionSeed[region]
      if (!map.has(seed)) map.set(seed, displayName)
    }
  }

  const teams = await prisma.team.findMany()
  let updatedNames = 0
  for (const team of teams) {
    if (team.isDogs) continue
    const map = bracketByRegionSeed[team.region]
    if (!map) continue
    const apiName = map.get(team.seed)
    if (!apiName) continue
    if (team.name !== apiName) {
      await prisma.team.update({ where: { id: team.id }, data: { name: apiName } })
      updatedNames++
    }
  }
  console.log(`[tournamentImport] Updated ${updatedNames} team names`)

  const teamsAfterBracket = await prisma.team.findMany()

  await prisma.team.updateMany({
    data: {
      round64: false,
      round32: false,
      sweet16: false,
      elite8: false,
      final4: false,
      championship: false
    }
  })

  const bracketGamesOnly = tournamentGames.filter((e: any) => !isFirstFourEvent(e))

  const roundOrder = ['round64', 'round32', 'sweet16', 'elite8', 'final4', 'championship']
  const teamWins: Map<string, Set<string>> = new Map()
  const teamGameCount: Map<string, number> = new Map()

  for (const event of bracketGamesOnly) {
    if (!event.competitions?.[0]) continue

    const competition = event.competitions[0]
    const competitors = competition.competitors || []

    if (competitors.length !== 2) continue

    const winner = competitors.find((c: any) => c.winner)
    if (!winner) continue

    const winnerName = winner.team.displayName || winner.team.shortDisplayName

    const currentCount = teamGameCount.get(winnerName) || 0
    teamGameCount.set(winnerName, currentCount + 1)
  }

  for (const [teamName, winCount] of teamGameCount.entries()) {
    const rounds = new Set<string>()

    for (let i = 0; i < Math.min(winCount, 6); i++) {
      rounds.add(roundOrder[i])
    }

    if (rounds.size > 0) {
      teamWins.set(teamName, rounds)
    }
  }

  let championName = ''
  for (const [team, rounds] of teamWins.entries()) {
    if (rounds.has('championship')) {
      championName = team
      break
    }
  }

  let updatedTeams = 0
  const updates: string[] = []

  for (const [apiTeamName, wonRounds] of teamWins.entries()) {
    const matchedTeam = teamsAfterBracket.find((team) => {
      const teamNameLower = team.name.toLowerCase()
      const apiNameLower = apiTeamName.toLowerCase()
      return (
        teamNameLower === apiNameLower ||
        teamNameLower.includes(apiNameLower) ||
        apiNameLower.includes(teamNameLower)
      )
    })

    if (matchedTeam) {
      const updateData = {
        round64: wonRounds.has('round64'),
        round32: wonRounds.has('round32'),
        sweet16: wonRounds.has('sweet16'),
        elite8: wonRounds.has('elite8'),
        final4: wonRounds.has('final4'),
        championship: wonRounds.has('championship')
      }
      await prisma.team.update({
        where: { id: matchedTeam.id },
        data: updateData
      })
      updatedTeams++
      const winCount = wonRounds.size
      updates.push(`${matchedTeam.name}: ${winCount} win${winCount !== 1 ? 's' : ''}`)
    } else {
      console.log(`[tournamentImport] No match found for: ${apiTeamName}`)
    }
  }

  const dogsTeams = await prisma.team.findMany({
    where: { isDogs: true },
    include: { dogMembers: true }
  })
  for (const dogsTeam of dogsTeams) {
    const members = dogsTeam.dogMembers
    if (members.length === 0) continue
    const aggregated = {
      round64: members.some((m) => m.round64),
      round32: members.some((m) => m.round32),
      sweet16: members.some((m) => m.sweet16),
      elite8: members.some((m) => m.elite8),
      final4: members.some((m) => m.final4),
      championship: members.some((m) => m.championship)
    }
    await prisma.team.update({
      where: { id: dogsTeam.id },
      data: aggregated
    })
  }

  return {
    success: true,
    message:
      tournamentGames.length > 0
        ? `Successfully imported ${year} tournament results`
        : `Updated ${year} bracket (${updatedNames} team names). No games completed yet.`,
    champion: championName,
    tournamentGames: tournamentGames.length,
    updatedTeams,
    updatedNames,
    updates: updates.slice(0, 20)
  }
}
