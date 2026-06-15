import { prisma } from '@/lib/prisma'
import { fifaRank } from '@/lib/tournament'
import { GROUP_TIES_SETTING_KEY } from '@/lib/groupTies'

const NCAA_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball'
// ESPN's public, key-less soccer API. The FIFA World Cup league slug is `fifa.world`
// (mirrors the NCAA `mens-college-basketball` host + response shape: leagues/events/
// competitions/competitors with team.displayName, score, status.type.state).
const WORLD_CUP_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world'

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

  // The ESPN NCAA import only ever touches the March Madness teams; the World Cup
  // (and any other tournament) is never read or written here.
  const IMPORT_TOURNAMENT = 'marchmadness'
  const teams = await prisma.team.findMany({ where: { tournament: IMPORT_TOURNAMENT } })
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

  const teamsAfterBracket = await prisma.team.findMany({ where: { tournament: IMPORT_TOURNAMENT } })

  await prisma.team.updateMany({
    where: { tournament: IMPORT_TOURNAMENT },
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
    where: { tournament: IMPORT_TOURNAMENT, isDogs: true },
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

// ---------------------------------------------------------------------------
// World Cup (FIFA, soccer) importer
//
// Shares the exact same return contract (TournamentImportResult) and the same
// "reset result columns, then re-apply from the live feed" shape as the NCAA
// importer above, and is driven by the same throttled orchestration in
// lib/autoSyncTournament.ts. Only the sport-specific feed parsing differs (soccer
// fixtures/groups/knockout rounds + goal differential vs. basketball bracket).
//
// It is HARD-SCOPED to tournament = 'worldcup' and never reads or writes March
// Madness rows, exactly mirroring how runTournamentImport() is scoped to
// 'marchmadness'.
// ---------------------------------------------------------------------------

const WORLD_CUP_TOURNAMENT = 'worldcup'

// Minimal shape of the ESPN soccer scoreboard payload we rely on (typed so the
// World Cup importer stays free of `any`).
interface EspnCompetitor {
  winner?: boolean
  score?: string | number | null
  team?: { displayName?: string; shortDisplayName?: string }
}
interface EspnEvent {
  season?: { slug?: string }
  competitions?: Array<{
    status?: { type?: { completed?: boolean } }
    competitors?: EspnCompetitor[]
  }>
}
interface EspnScoreboard {
  events?: EspnEvent[]
}

/**
 * Normalize a country name to a stable key for matching ESPN's feed against our
 * seeded Team rows. Strips diacritics + punctuation, drops the "and" stopword,
 * then sorts the remaining tokens so word-order/punctuation differences collapse:
 *   "Bosnia and Herzegovina" / "Bosnia-Herzegovina" → "bosnia herzegovina"
 *   "DR Congo" / "Congo DR"                          → "congo dr"
 *   "South Korea" / "Korea South" (either order)     → "korea south"
 * Accented names that already match verbatim (Türkiye, Curaçao) collapse cleanly too.
 */
export function normalizeCountry(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && w !== 'and')
    .sort()
    .join(' ')
}

/** ESPN competitor.score is a string for soccer (e.g. "2"); parse to a number. */
function parseScore(raw: unknown): number | null {
  if (raw == null) return null
  const n = parseInt(String(raw), 10)
  return Number.isFinite(n) ? n : null
}

/**
 * Fetch the ESPN FIFA World Cup scoreboard and sync the 'worldcup' Team rows. Columns
 * are remapped per the payout config in lib/tournament.ts (NCAA column → WC round):
 *  - groupWins    : number of group-stage matches won (0–6)
 *  - round64      : won a Round of 32 match  (payout bucket "Round of 32 Win")
 *  - round32      : won a Round of 16 match  (payout bucket "Round of 16 Win")
 *  - sweet16      : won a Quarterfinal match (payout bucket "Quarterfinal Win")
 *  - elite8       : won a Semifinal match    (payout bucket "Semifinal Win")
 *  - championship : won the Final            (payout bucket "Final Win", = champion)
 *  - worstGd      : the single team with the worst (lowest) goal differential across all
 *                   completed matches (payout bucket "Worst Goal Diff" booby prize)
 *  - biggestUpset : the single team that pulled off the biggest FIFA-ranking upset in one
 *                   completed match (payout bucket "Biggest Upset")
 *  - final4       : unused for the World Cup (left false).
 *
 * The 2026 World Cup is a 48-team field whose knockout is R32 → R16 → QF → SF → Final
 * (5 rounds), each an individually paid bucket. Knockout buckets pay for WINNING a match
 * in that round, so each boolean is set on the match winner only. Group stage is also
 * win-based (groupWins).
 *
 * Biggest upset: for every completed match where both teams have a known FIFA ranking
 * (see lib/tournament.ts fifaRank), the magnitude is (winner's rank number − loser's rank
 * number); it only counts when the winner is the worse-ranked (numerically larger) team.
 * The match with the largest positive magnitude wins the bucket for its victor.
 *
 * Does not touch the DB when ESPN returns no completed matches (avoids clearing
 * standings before kickoff), and never reads/writes March Madness rows.
 */
export async function runWorldCupImport(year: number): Promise<TournamentImportResult> {
  console.log(`[worldCupImport] Fetching World Cup data for ${year}...`)

  // `dates=<year>` scopes to the tournament season; limit covers all 104 matches
  // (72 group + 16 R32 + 8 R16 + 4 QF + 2 SF + 1 3rd-place + 1 final) — the default
  // page size caps at 100 and would drop the semifinals/final.
  const url = `${WORLD_CUP_API_BASE}/scoreboard?dates=${year}&limit=300`

  let response: Response
  try {
    response = await fetch(url, { cache: 'no-store' })
  } catch (err) {
    return {
      success: false,
      status: 502,
      error: 'Failed to reach ESPN World Cup API',
      details: err instanceof Error ? err.message : String(err)
    }
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    console.error(`[worldCupImport] ESPN status ${response.status}`, errorText.slice(0, 200))
    return {
      success: false,
      status: 502,
      error: `Failed to fetch World Cup data: ${response.status}`,
      details: errorText.slice(0, 500)
    }
  }

  const data = (await response.json()) as EspnScoreboard
  const events = data.events ?? []
  console.log(`[worldCupImport] Received ${events.length} events`)

  const completed = events.filter((e) => e.competitions?.[0]?.status?.type?.completed)
  console.log(`[worldCupImport] ${completed.length} completed matches`)

  if (completed.length === 0) {
    return {
      success: false,
      status: 404,
      error:
        'No completed World Cup matches in ESPN response yet. Database unchanged (avoids clearing results).'
    }
  }

  // Round slug → which boolean column a WIN in that round sets (per lib/tournament.ts).
  // 2026 knockout is R32 → R16 → QF → SF → Final, all individually paid on a win.
  const ROUND_FIELD: Record<string, 'round64' | 'round32' | 'sweet16' | 'elite8' | 'championship'> = {
    'round-of-32': 'round64', // payout bucket "Round of 32 Win"
    'round-of-16': 'round32', // payout bucket "Round of 16 Win"
    quarterfinals: 'sweet16', // payout bucket "Quarterfinal Win"
    semifinals: 'elite8', // payout bucket "Semifinal Win"
    final: 'championship' // payout bucket "Final Win" (= champion)
  }

  // FIFA rankings of OUR seeded teams, keyed by normalized name so ESPN feed names
  // (variants/diacritics) match the same way groupWins etc. are matched. Only teams we
  // both seed AND have a ranking for participate in the biggest-upset computation, which
  // also guarantees the prize lands on an auctioned team.
  const wcTeams = await prisma.team.findMany({ where: { tournament: WORLD_CUP_TOURNAMENT } })
  const rankByKey = new Map<string, number>()
  for (const t of wcTeams) {
    const r = fifaRank(t.name)
    if (typeof r === 'number') rankByKey.set(normalizeCountry(t.name), r)
  }

  // Track the single biggest FIFA-ranking upset across all completed matches.
  let upsetWinnerKey: string | null = null
  let upsetMagnitude = 0

  // Count DRAWN group-stage matches. The group-stage payout divisor is (72 − ties): every
  // group match is assumed to yield a win until it's actually drawn. Recomputed each run.
  let groupTies = 0

  // Accumulate per ESPN team (keyed by normalized name).
  type Agg = {
    espnName: string
    groupWins: number
    round64: boolean
    round32: boolean
    sweet16: boolean
    elite8: boolean
    championship: boolean
    goalsFor: number
    goalsAgainst: number
    playedAny: boolean
  }
  const agg = new Map<string, Agg>()
  const ensure = (espnName: string): Agg => {
    const key = normalizeCountry(espnName)
    let a = agg.get(key)
    if (!a) {
      a = {
        espnName,
        groupWins: 0,
        round64: false,
        round32: false,
        sweet16: false,
        elite8: false,
        championship: false,
        goalsFor: 0,
        goalsAgainst: 0,
        playedAny: false
      }
      agg.set(key, a)
    }
    return a
  }

  let championName = ''

  for (const event of completed) {
    const comp = event.competitions?.[0]
    const competitors = comp?.competitors ?? []
    if (competitors.length !== 2) continue
    const slug = event.season?.slug as string | undefined

    const [c0, c1] = competitors
    const name0 = c0.team?.displayName || c0.team?.shortDisplayName
    const name1 = c1.team?.displayName || c1.team?.shortDisplayName
    if (!name0 || !name1) continue
    const s0 = parseScore(c0.score)
    const s1 = parseScore(c1.score)

    const a0 = ensure(name0)
    const a1 = ensure(name1)
    a0.playedAny = true
    a1.playedAny = true

    // Goal differential accumulates over every completed match (group + knockout).
    if (s0 != null && s1 != null) {
      a0.goalsFor += s0
      a0.goalsAgainst += s1
      a1.goalsFor += s1
      a1.goalsAgainst += s0
    }

    // Biggest-upset check runs on EVERY completed match (group + knockout) that has a
    // winner and where both teams have a known FIFA ranking. magnitude = winnerRank −
    // loserRank, only counted when the winner is the worse-ranked (larger rank number).
    const key0 = normalizeCountry(name0)
    const key1 = normalizeCountry(name1)
    const rank0 = rankByKey.get(key0)
    const rank1 = rankByKey.get(key1)
    const upsetWinnerKeyThis = c0.winner ? key0 : c1.winner ? key1 : null
    if (upsetWinnerKeyThis && rank0 != null && rank1 != null) {
      const winnerRank = upsetWinnerKeyThis === key0 ? rank0 : rank1
      const loserRank = upsetWinnerKeyThis === key0 ? rank1 : rank0
      const magnitude = winnerRank - loserRank
      if (magnitude > upsetMagnitude) {
        upsetMagnitude = magnitude
        upsetWinnerKey = upsetWinnerKeyThis
      }
    }

    if (slug === 'group-stage') {
      // ESPN sets winner=true on the victor; draws leave both false.
      if (c0.winner) a0.groupWins++
      else if (c1.winner) a1.groupWins++
      else groupTies++ // a drawn group match: credits no team, shrinks the divisor by 1.
      continue
    }

    // Knockout rounds: R32 / R16 / QF / SF / Final each credit the MATCH WINNER only.
    const field = slug ? ROUND_FIELD[slug] : undefined
    if (!field) continue
    const winnerComp = c0.winner ? c0 : c1.winner ? c1 : null
    if (!winnerComp) continue
    const winnerAgg = winnerComp === c0 ? a0 : a1
    winnerAgg[field] = true
    if (field === 'championship') {
      championName = winnerComp.team?.displayName || winnerComp.team?.shortDisplayName || ''
    }
  }

  // Apply to DB — scoped to World Cup rows ONLY. Reuse the rows fetched above (they're
  // unchanged so far; only result columns are written below).
  const teams = wcTeams

  // Worst goal differential booby prize: the single tracked (seeded) team with ≥1
  // completed match whose (goalsFor − goalsAgainst) is the lowest. Restricted to our
  // own rows so the prize always lands on an auctioned team. Provisional while live.
  const dbKeys = new Set(teams.map((t) => normalizeCountry(t.name)))
  let worstKey: string | null = null
  let worstGd = Number.POSITIVE_INFINITY
  for (const [key, a] of agg.entries()) {
    if (!a.playedAny || !dbKeys.has(key)) continue
    const gd = a.goalsFor - a.goalsAgainst
    if (gd < worstGd) {
      worstGd = gd
      worstKey = key
    }
  }

  // Reset result columns first so eliminated/draw outcomes are reflected (mirrors NCAA importer).
  await prisma.team.updateMany({
    where: { tournament: WORLD_CUP_TOURNAMENT },
    data: {
      groupWins: 0,
      round64: false,
      round32: false,
      sweet16: false,
      elite8: false,
      final4: false,
      championship: false,
      worstGd: false,
      biggestUpset: false
    }
  })

  let updatedTeams = 0
  const updates: string[] = []

  for (const team of teams) {
    const key = normalizeCountry(team.name)
    const a = agg.get(key)
    if (!a) continue
    const isWorst = worstKey === key
    const isUpset = upsetWinnerKey === key
    await prisma.team.update({
      where: { id: team.id },
      data: {
        groupWins: a.groupWins,
        round64: a.round64,
        round32: a.round32,
        sweet16: a.sweet16,
        elite8: a.elite8,
        championship: a.championship,
        worstGd: isWorst,
        biggestUpset: isUpset
      }
    })
    updatedTeams++
    const parts: string[] = []
    if (a.groupWins) parts.push(`${a.groupWins} group win${a.groupWins !== 1 ? 's' : ''}`)
    if (a.round64) parts.push('R32')
    if (a.round32) parts.push('R16')
    if (a.sweet16) parts.push('QF')
    if (a.elite8) parts.push('SF')
    if (a.championship) parts.push('Champion')
    if (isWorst) parts.push('worstGD')
    if (isUpset) parts.push(`biggestUpset(+${upsetMagnitude})`)
    if (parts.length) updates.push(`${team.name}: ${parts.join(', ')}`)
  }

  // Persist the live group-stage draw count (tournament-scoped) so every payout consumer
  // (server routes + client pages) derives the same divisor (72 − ties). Recomputed each run.
  await prisma.settings.upsert({
    where: { tournament_key: { tournament: WORLD_CUP_TOURNAMENT, key: GROUP_TIES_SETTING_KEY } },
    update: { value: String(groupTies) },
    create: { tournament: WORLD_CUP_TOURNAMENT, key: GROUP_TIES_SETTING_KEY, value: String(groupTies) }
  })

  console.log(`[worldCupImport] Updated ${updatedTeams} World Cup teams; group ties=${groupTies}`)

  return {
    success: true,
    message: `Successfully imported ${year} World Cup results (${completed.length} completed matches)`,
    champion: championName,
    tournamentGames: completed.length,
    updatedTeams,
    updatedNames: 0,
    updates: updates.slice(0, 20)
  }
}
