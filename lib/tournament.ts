/**
 * Shared tournament configuration.
 *
 * Both the March Madness (NCAA basketball) and World Cup (soccer) experiences run on
 * the EXACT SAME auction engine, components and API routes. The only differences are
 * the set of teams being auctioned, how they're grouped, and the payout structure.
 * Everything that differs between the two is centralized here so the rest of the app
 * can stay generic and parameterized (no forked auction logic).
 *
 * This module is import-safe from both client and server (no `next/headers`). For the
 * server-side request resolver, see `lib/tournamentServer.ts`.
 */

export type TournamentKey = 'marchmadness' | 'worldcup'

export const DEFAULT_TOURNAMENT: TournamentKey = 'marchmadness'
// Cookie name uses only RFC6265 token-safe characters (no colon) so every browser
// accepts it when set via document.cookie.
export const TOURNAMENT_COOKIE = 'calcutta_tournament'

export function isTournamentKey(value: unknown): value is TournamentKey {
  return value === 'marchmadness' || value === 'worldcup'
}

/** Which `Team` column a payout round reads. The 6 NCAA boolean columns are reused
 *  (remapped) for the World Cup knockout rounds; `groupWins`/`worstGd` are World-Cup only. */
export type TeamResultField =
  | 'round64'
  | 'round32'
  | 'sweet16'
  | 'elite8'
  | 'final4'
  | 'championship'
  | 'groupWins'
  | 'worstGd'

export interface PayoutRound {
  /** Stable identifier for this payout bucket. */
  key: string
  /** Which `Team` column holds the result for this bucket. */
  field: TeamResultField
  /** `boolean` = win/no-win; `count` = number of wins (group stage can be 0–3). */
  fieldType: 'boolean' | 'count'
  /** Long label (dashboard payout cards). */
  label: string
  /** Short label (auction sidebar payout panel). */
  shortLabel: string
  /** Fraction of the pot this bucket pays out in total. Drives the dollar amounts. */
  pctOfPot: number
  /** Display string for the "% of total" column (may differ from `pctOfPot`; see flag below). */
  pctLabel: string
  /** Number of winners the bucket is divided across → per-win = pot * pctOfPot / winners. */
  winners: number
}

export interface TournamentConfig {
  key: TournamentKey
  label: string
  icon: string
  /** Noun for the `region` column ("Region" for NCAA, "Group" for World Cup). */
  groupNoun: string
  /** Noun for the `seed` column ("Seed" for NCAA, "Team" for World Cup). */
  seedNoun: string
  /** Whether the group noun goes before ("Group A") or after ("South Region") the value. */
  regionLabelStyle: 'prefix' | 'suffix'
  /** All groups/regions in display order. */
  groups: string[]
  /** Per-bidder spend cap (dollars). */
  spendCap: number
  /** Total auctionable items (denominator for the auction progress bar). */
  auctionableCount: number
  /** Ordered payout buckets. */
  payoutRounds: PayoutRound[]
}

const MARCH_MADNESS: TournamentConfig = {
  key: 'marchmadness',
  label: 'March Madness',
  icon: '🏀',
  groupNoun: 'Region',
  seedNoun: 'Seed',
  regionLabelStyle: 'suffix',
  groups: ['South', 'West', 'East', 'Midwest'],
  spendCap: 250,
  // 4 regions × (seeds 1–13 + Dogs aggregate) = 56 auctionable items.
  auctionableCount: 56,
  // Mirrors the original PAYOUT_PERCENTAGES / WINNERS_PER_ROUND in lib/calculations.ts.
  payoutRounds: [
    { key: 'round64', field: 'round64', fieldType: 'boolean', label: 'Round of 64', shortLabel: '64', pctOfPot: 0.16, pctLabel: '16%', winners: 32 },
    { key: 'round32', field: 'round32', fieldType: 'boolean', label: 'Round of 32', shortLabel: '32', pctOfPot: 0.16, pctLabel: '16%', winners: 16 },
    { key: 'sweet16', field: 'sweet16', fieldType: 'boolean', label: 'Sweet 16', shortLabel: 'S16', pctOfPot: 0.24, pctLabel: '24%', winners: 8 },
    { key: 'elite8', field: 'elite8', fieldType: 'boolean', label: 'Elite 8', shortLabel: 'E8', pctOfPot: 0.16, pctLabel: '16%', winners: 4 },
    { key: 'final4', field: 'final4', fieldType: 'boolean', label: 'Final Four', shortLabel: 'F4', pctOfPot: 0.16, pctLabel: '16%', winners: 2 },
    { key: 'championship', field: 'championship', fieldType: 'boolean', label: 'Championship', shortLabel: 'Champ', pctOfPot: 0.12, pctLabel: '12%', winners: 1 }
  ]
}

const WORLD_CUP: TournamentConfig = {
  key: 'worldcup',
  label: 'World Cup',
  icon: '⚽',
  groupNoun: 'Group',
  seedNoun: 'Team',
  regionLabelStyle: 'prefix',
  groups: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'],
  spendCap: 250,
  // 12 groups × 4 teams = 48 auctionable items.
  auctionableCount: 48,
  // Percentages are the source of truth and sum to exactly 100% of the pot. All dollar
  // amounts are DERIVED from the live pot at render/calc time (see buildPayoutLines /
  // calculateTeamPayout), so they show $0 until winning bids build the pot up. The
  // $1,027 figure on the source image was only an illustrative pot, never hardcoded.
  //   Group Stage: 22% across 36 group matches  (e.g. $1,027 → $6.28 / win, $225.94 bucket)
  //   Round of 16: 16% / 8 winners (2% each)    (e.g. $1,027 → $20.54 / win)
  //   Round of 8:  16% / 4 winners (4% each)    (e.g. $1,027 → $41.08 / win)
  //   Final Four:  16% / 2 winners (8% each)    (e.g. $1,027 → $82.16 / win)
  //   Championship: 25% / 1 winner              (e.g. $1,027 → $256.75)
  //   Worst GD:    5% / 1                        (e.g. $1,027 → $51.35)
  //   Total: 22 + 16 + 16 + 16 + 25 + 5 = 100%.
  payoutRounds: [
    { key: 'groupStage', field: 'groupWins', fieldType: 'count', label: 'Group Stage Win', shortLabel: 'Group', pctOfPot: 0.22, pctLabel: '22%', winners: 36 },
    { key: 'round16', field: 'round64', fieldType: 'boolean', label: 'Round of 16', shortLabel: 'R16', pctOfPot: 0.16, pctLabel: '16%', winners: 8 },
    { key: 'round8', field: 'round32', fieldType: 'boolean', label: 'Round of 8', shortLabel: 'R8', pctOfPot: 0.16, pctLabel: '16%', winners: 4 },
    { key: 'finalFour', field: 'sweet16', fieldType: 'boolean', label: 'Final Four', shortLabel: 'FF', pctOfPot: 0.16, pctLabel: '16%', winners: 2 },
    { key: 'championship', field: 'elite8', fieldType: 'boolean', label: 'Championship', shortLabel: 'Champ', pctOfPot: 0.25, pctLabel: '25%', winners: 1 },
    { key: 'worstGd', field: 'worstGd', fieldType: 'boolean', label: 'Worst GD', shortLabel: 'GD', pctOfPot: 0.05, pctLabel: '5%', winners: 1 }
  ]
}

const CONFIGS: Record<TournamentKey, TournamentConfig> = {
  marchmadness: MARCH_MADNESS,
  worldcup: WORLD_CUP
}

export function getTournamentConfig(tournament: TournamentKey): TournamentConfig {
  return CONFIGS[tournament] ?? CONFIGS[DEFAULT_TOURNAMENT]
}

/** Coerce an unknown value (e.g. team.tournament) to a valid config. */
export function resolveConfig(tournament: unknown): TournamentConfig {
  return getTournamentConfig(isTournamentKey(tournament) ? tournament : DEFAULT_TOURNAMENT)
}

/** "South Region" (NCAA) / "Group A" (World Cup). */
export function formatRegion(config: TournamentConfig, region: string): string {
  return config.regionLabelStyle === 'prefix'
    ? `${config.groupNoun} ${region}`
    : `${region} ${config.groupNoun}`
}

/** The "<region>, Seed #<seed>" descriptor used in the auction announcement + current-team card. */
export function formatTeamDescriptor(
  config: TournamentConfig,
  team: { region: string; seed: number; isDogs?: boolean }
): string {
  const seedText = team.isDogs ? '14–16' : String(team.seed)
  return `${formatRegion(config, team.region)}, ${config.seedNoun} #${seedText}`
}

/**
 * Prisma `where` filter for teams that are still available for auction in a tournament.
 * March Madness: unsold seeds 1–13 + Dogs aggregates (member teams 14/15/16 excluded).
 * World Cup: every unsold team (no Dogs concept).
 */
export function auctionableTeamWhere(tournament: TournamentKey) {
  if (tournament === 'worldcup') {
    return { tournament, ownerId: null, dogTeamId: null }
  }
  return {
    tournament,
    ownerId: null,
    OR: [{ isDogs: true }, { seed: { gte: 1, lte: 13 }, dogTeamId: null }]
  }
}

export interface PayoutLine {
  key: string
  label: string
  shortLabel: string
  pctLabel: string
  winners: number
  /** Dollars paid per individual win. */
  perWin: number
  /** Total dollars allocated to this bucket. */
  bucketTotal: number
}

/** Derive the per-win + total dollar amounts for each payout bucket from the pot size. */
export function buildPayoutLines(totalPot: number, tournament: TournamentKey): PayoutLine[] {
  const safePot = totalPot || 0
  return getTournamentConfig(tournament).payoutRounds.map((round) => ({
    key: round.key,
    label: round.label,
    shortLabel: round.shortLabel,
    pctLabel: round.pctLabel,
    winners: round.winners,
    perWin: (safePot * round.pctOfPot) / round.winners,
    bucketTotal: safePot * round.pctOfPot
  }))
}

/**
 * World Cup country flags.
 *
 * We DERIVE the flag at render time from this name → ISO 3166-1 alpha-2 map rather than
 * persisting a column on Team — it's lower friction (no schema change / reseed), keeps the
 * flag data co-located with the rest of the tournament config, and the team names are a
 * stable key. March Madness teams are NCAA schools and are intentionally absent here, so
 * they never get a flag and their display is unchanged.
 *
 * Names match the seeded values verbatim (co-hosts stored clean, e.g. "Mexico"; accented
 * names stored UTF-8, e.g. "Türkiye", "Curaçao"). England/Scotland have no alpha-2 code, so
 * they use ISO 3166-2 subdivision codes (GB-ENG / GB-SCT) rendered as regional-indicator
 * *tag sequences* (🏴…); platforms that can't render a subdivision flag fall back to the
 * plain waving black flag 🏴.
 */
const WORLD_CUP_COUNTRY_CODES: Record<string, string> = {
  // Group A
  Mexico: 'MX', 'South Africa': 'ZA', 'South Korea': 'KR', Czechia: 'CZ',
  // Group B
  Canada: 'CA', 'Bosnia and Herzegovina': 'BA', Qatar: 'QA', Switzerland: 'CH',
  // Group C
  Brazil: 'BR', Morocco: 'MA', Haiti: 'HT', Scotland: 'GB-SCT',
  // Group D
  'United States': 'US', Paraguay: 'PY', Australia: 'AU', 'Türkiye': 'TR',
  // Group E
  Germany: 'DE', 'Curaçao': 'CW', 'Ivory Coast': 'CI', Ecuador: 'EC',
  // Group F
  Netherlands: 'NL', Japan: 'JP', Sweden: 'SE', Tunisia: 'TN',
  // Group G
  Belgium: 'BE', Egypt: 'EG', Iran: 'IR', 'New Zealand': 'NZ',
  // Group H
  Spain: 'ES', 'Cape Verde': 'CV', 'Saudi Arabia': 'SA', Uruguay: 'UY',
  // Group I
  France: 'FR', Senegal: 'SN', Iraq: 'IQ', Norway: 'NO',
  // Group J
  Argentina: 'AR', Algeria: 'DZ', Austria: 'AT', Jordan: 'JO',
  // Group K
  Portugal: 'PT', 'DR Congo': 'CD', Uzbekistan: 'UZ', Colombia: 'CO',
  // Group L
  England: 'GB-ENG', Croatia: 'HR', Ghana: 'GH', Panama: 'PA'
}

const REGIONAL_INDICATOR_OFFSET = 0x1f1e6 - 0x41 // distance from 'A' to 🇦

/** Build a subdivision flag tag sequence, e.g. 'gbeng' → 🏴 England, 'gbsct' → 🏴 Scotland. */
function subdivisionFlag(subdivision: string): string {
  const tags = [...subdivision.toLowerCase()]
    .map((ch) => String.fromCodePoint(0xe0000 + ch.charCodeAt(0)))
    .join('')
  return `\u{1F3F4}${tags}\u{E007F}`
}

function flagEmojiFromCode(code: string): string {
  if (code === 'GB-ENG') return subdivisionFlag('gbeng')
  if (code === 'GB-SCT') return subdivisionFlag('gbsct')
  if (!/^[A-Z]{2}$/.test(code)) return ''
  return String.fromCodePoint(
    ...[...code].map((ch) => ch.charCodeAt(0) + REGIONAL_INDICATOR_OFFSET)
  )
}

/**
 * Flag emoji for a team, or '' when none applies. Only World Cup teams get a flag — March
 * Madness keeps its NCAA-school display unchanged. Pass the team's tournament so MM is never
 * decorated even if a school name ever collided with a country name.
 */
export function teamFlag(name: string, tournament?: unknown): string {
  if (tournament !== undefined && tournament !== 'worldcup') return ''
  const code = WORLD_CUP_COUNTRY_CODES[name]
  return code ? flagEmojiFromCode(code) : ''
}
