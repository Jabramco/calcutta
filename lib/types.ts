import { Owner, Team } from '@prisma/client'
import type { PayoutLine } from '@/lib/tournament'

export type { Owner, Team }

export interface OwnerWithTeams extends Owner {
  teams: Team[]
}

export interface TeamWithOwner extends Team {
  owner: Owner | null
  /** Included on Dogs aggregate rows from `/api/teams`. */
  dogMembers?: Team[]
}

export interface LeaderboardEntry {
  owner: Owner
  teamsCount: number
  totalInvestment: number
  totalPayout: number
  roi: number
}

export interface GlobalStats {
  totalPot: number
  /** Live drawn group-stage matches; the group-stage divisor is (72 − groupTies). */
  groupTies?: number
  /** Tournament-aware payout buckets (see lib/tournament.ts). */
  payouts: PayoutLine[]
}

export interface FinanceEntry {
  owner: Owner
  amountOwed: number
  teamsCount: number
  payoutAmount: number
}
