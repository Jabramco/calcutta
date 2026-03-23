import type { Team } from '@prisma/client'
import { FIRST_ROUND_SEED_PAIRS } from '@/lib/bracket'

function hasAnyWin(t: Team): boolean {
  return !!(t.round64 || t.round32 || t.sweet16 || t.elite8 || t.final4 || t.championship)
}

function findInRegion(all: Team[], region: string, seed: number): Team | undefined {
  return all.find((t) => t.region === region && t.seed === seed)
}

function partnerSeed(seed: number): number | null {
  const pair = FIRST_ROUND_SEED_PAIRS.find(([a, b]) => a === seed || b === seed)
  if (!pair) return null
  return pair[0] === seed ? pair[1] : pair[0]
}

function frPairIndex(seed: number): number {
  return FIRST_ROUND_SEED_PAIRS.findIndex(([a, b]) => a === seed || b === seed)
}

/** All seeds in the two first-round games that feed this R32 slot (0–3). */
function seedsForR32Slot(r32Slot: number): number[] {
  const p0 = r32Slot * 2
  const p1 = r32Slot * 2 + 1
  const a = FIRST_ROUND_SEED_PAIRS[p0]
  const b = FIRST_ROUND_SEED_PAIRS[p1]
  return [a[0], a[1], b[0], b[1]]
}

const OPP_REGION_FOR_FINAL_FOUR: Record<string, string> = {
  South: 'West',
  West: 'South',
  East: 'Midwest',
  Midwest: 'East'
}

/**
 * True if this team has been eliminated (lost) given current round flags for all teams
 * in the pool. Uses NCAA first-round pairings per region; Final Four uses standard
 * South/West vs East/Midwest pairing.
 */
export function isTeamEliminated(team: Team, allTeams: Team[]): boolean {
  if (!allTeams.length) return false
  if (team.championship) return false

  const started = allTeams.some(hasAnyWin)
  if (!started) return false

  const pi = frPairIndex(team.seed)
  if (pi < 0) return false

  // Lost round of 64
  if (!team.round64) {
    const ps = partnerSeed(team.seed)
    if (ps == null) return false
    const opp = findInRegion(allTeams, team.region, ps)
    return Boolean(opp?.round64)
  }

  // Lost round of 32
  if (!team.round32) {
    const oppPi = pi % 2 === 0 ? pi + 1 : pi - 1
    const [s1, s2] = FIRST_ROUND_SEED_PAIRS[oppPi]
    for (const s of [s1, s2]) {
      const u = findInRegion(allTeams, team.region, s)
      if (u && u.round32 && u.id !== team.id) return true
    }
    return false
  }

  // Lost Sweet 16
  if (!team.sweet16) {
    const r32Slot = Math.floor(pi / 2)
    const s16Slot = Math.floor(r32Slot / 2)
    const oppR32Slots = s16Slot === 0 ? [2, 3] : [0, 1]
    const seeds = [...seedsForR32Slot(oppR32Slots[0]), ...seedsForR32Slot(oppR32Slots[1])]
    for (const s of seeds) {
      const u = findInRegion(allTeams, team.region, s)
      if (u && u.sweet16 && u.id !== team.id) return true
    }
    return false
  }

  // Lost Elite 8
  if (!team.elite8) {
    const r32Slot = Math.floor(pi / 2)
    const s16Slot = Math.floor(r32Slot / 2)
    const oppS16 = s16Slot === 0 ? 1 : 0
    const seeds = [...seedsForR32Slot(oppS16 * 2), ...seedsForR32Slot(oppS16 * 2 + 1)]
    for (const s of seeds) {
      const u = findInRegion(allTeams, team.region, s)
      if (u && u.elite8 && u.id !== team.id) return true
    }
    return false
  }

  // Lost Final Four semifinal
  if (!team.final4) {
    const oppRegion = OPP_REGION_FOR_FINAL_FOUR[team.region]
    if (!oppRegion) return false
    return allTeams.some((u) => u.region === oppRegion && u.final4 && u.id !== team.id)
  }

  // Lost national championship
  if (!team.championship) {
    return allTeams.some((u) => u.championship && u.id !== team.id)
  }

  return false
}

/** True if this owner has at least one team still in the tournament (not eliminated). */
export function ownerHasAliveTeamInPool(ownerTeams: Team[], poolTeams: Team[]): boolean {
  if (!ownerTeams.length) return false
  return ownerTeams.some((t) => !isTeamEliminated(t, poolTeams))
}
