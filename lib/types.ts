import { Owner, Team } from '@prisma/client'

export type { Owner, Team }

export interface OwnerWithTeams extends Owner {
  teams: Team[]
}

export interface TeamWithOwner extends Team {
  owner: Owner | null
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
  payoutPerWin: {
    round64: number
    round32: number
    sweet16: number
    elite8: number
    final4: number
    championship: number
  }
  percentages: {
    round64: string
    round32: string
    sweet16: string
    elite8: string
    final4: string
    championship: string
  }
}

export interface FinanceEntry {
  owner: Owner
  amountOwed: number
  teamsCount: number
  payoutAmount: number
}
