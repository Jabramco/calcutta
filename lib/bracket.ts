import type { TeamWithOwner } from '@/lib/types'

/** NCAA regional first-round seed pairings (1 vs 16, 8 vs 9, …). */
export const FIRST_ROUND_SEED_PAIRS: ReadonlyArray<[number, number]> = [
  [1, 16],
  [8, 9],
  [5, 12],
  [4, 13],
  [6, 11],
  [3, 14],
  [7, 10],
  [2, 15]
]

export type BracketSlotDisplay = {
  seed: number
  name: string
  team: TeamWithOwner | null
  /** True when this row is a 15/16 dog member name but stats belong to the Dogs aggregate. */
  isDogMemberOnly: boolean
}

/**
 * Map a regional seed (1–16) to display info. Seeds 14–16 use the Dogs row + dogMembers names.
 */
export function resolveBracketSlot(regionTeams: TeamWithOwner[], seed: number): BracketSlotDisplay {
  const dogs = regionTeams.find((t) => t.isDogs)
  const dogNames = dogs?.dogMembers ?? []

  if (seed <= 13) {
    const team = regionTeams.find((t) => !t.isDogs && t.seed === seed)
    return {
      seed,
      name: team?.name ?? `Seed ${seed} (TBD)`,
      team: team ?? null,
      isDogMemberOnly: false
    }
  }

  if (!dogs) {
    return {
      seed,
      name: `Seed ${seed}`,
      team: null,
      isDogMemberOnly: false
    }
  }

  if (seed === 14) {
    const name =
      dogNames.length > 0 ? `${dogs.name}: ${dogNames.map((m) => m.name).join(', ')}` : dogs.name
    return { seed: 14, name, team: dogs, isDogMemberOnly: false }
  }

  const idx = seed - 14
  const memberName = dogNames[idx]?.name ?? `Seed ${seed}`
  return {
    seed,
    name: memberName,
    team: dogs,
    isDogMemberOnly: seed > 14
  }
}
