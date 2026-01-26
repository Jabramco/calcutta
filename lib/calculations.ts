import { Team, Owner } from '@prisma/client'

// Payout percentages for each round
export const PAYOUT_PERCENTAGES = {
  round64: 0.16,    // 16% - 32 winners (0.5% per win)
  round32: 0.16,    // 16% - 16 winners (1% per win)
  sweet16: 0.24,    // 24% - 8 winners (3% per win)
  elite8: 0.16,     // 16% - 4 winners (4% per win)
  final4: 0.16,     // 16% - 2 winners (8% per win)
  championship: 0.12 // 12% - 1 winner (12% per win)
} as const

// Number of winners in each round
const WINNERS_PER_ROUND = {
  round64: 32,
  round32: 16,
  sweet16: 8,
  elite8: 4,
  final4: 2,
  championship: 1
} as const

/**
 * Calculate total pot from all team costs
 */
export function calculateTotalPot(teams: Pick<Team, 'cost'>[]): number {
  return teams.reduce((sum, team) => sum + Number(team.cost), 0)
}

/**
 * Calculate payout per win for each round based on total pot
 */
export function calculatePayoutPerWin(totalPot: number) {
  return {
    round64: (totalPot * PAYOUT_PERCENTAGES.round64) / WINNERS_PER_ROUND.round64,
    round32: (totalPot * PAYOUT_PERCENTAGES.round32) / WINNERS_PER_ROUND.round32,
    sweet16: (totalPot * PAYOUT_PERCENTAGES.sweet16) / WINNERS_PER_ROUND.sweet16,
    elite8: (totalPot * PAYOUT_PERCENTAGES.elite8) / WINNERS_PER_ROUND.elite8,
    final4: (totalPot * PAYOUT_PERCENTAGES.final4) / WINNERS_PER_ROUND.final4,
    championship: (totalPot * PAYOUT_PERCENTAGES.championship) / WINNERS_PER_ROUND.championship
  }
}

/**
 * Calculate total payout for a team based on rounds won
 */
export function calculateTeamPayout(
  team: Pick<Team, 'round64' | 'round32' | 'sweet16' | 'elite8' | 'final4' | 'championship'>,
  totalPot: number
): number {
  const payoutPerWin = calculatePayoutPerWin(totalPot)
  let payout = 0

  if (team.round64) payout += payoutPerWin.round64
  if (team.round32) payout += payoutPerWin.round32
  if (team.sweet16) payout += payoutPerWin.sweet16
  if (team.elite8) payout += payoutPerWin.elite8
  if (team.final4) payout += payoutPerWin.final4
  if (team.championship) payout += payoutPerWin.championship

  return payout
}

/**
 * Calculate statistics for an owner
 */
export interface OwnerStats {
  owner: Owner
  teamsCount: number
  totalInvestment: number
  totalPayout: number
  roi: number
}

export function calculateOwnerStats(
  owner: Owner,
  ownerTeams: (Pick<Team, 'cost' | 'round64' | 'round32' | 'sweet16' | 'elite8' | 'final4' | 'championship'>)[],
  totalPot: number
): OwnerStats {
  const totalInvestment = ownerTeams.reduce((sum, team) => sum + Number(team.cost), 0)
  const totalPayout = ownerTeams.reduce((sum, team) => sum + calculateTeamPayout(team, totalPot), 0)
  const roi = totalInvestment > 0 ? ((totalPayout - totalInvestment) / totalInvestment) * 100 : 0

  return {
    owner,
    teamsCount: ownerTeams.length,
    totalInvestment,
    totalPayout,
    roi
  }
}

/**
 * Get round percentage display for UI
 */
export function getRoundPercentages() {
  return {
    round64: `${PAYOUT_PERCENTAGES.round64 * 100}%`,
    round32: `${PAYOUT_PERCENTAGES.round32 * 100}%`,
    sweet16: `${PAYOUT_PERCENTAGES.sweet16 * 100}%`,
    elite8: `${PAYOUT_PERCENTAGES.elite8 * 100}%`,
    final4: `${PAYOUT_PERCENTAGES.final4 * 100}%`,
    championship: `${PAYOUT_PERCENTAGES.championship * 100}%`
  }
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`
}

/**
 * Format ROI percentage for display
 */
export function formatROI(roi: number): string {
  const sign = roi >= 0 ? '+' : ''
  return `${sign}${roi.toFixed(2)}%`
}
