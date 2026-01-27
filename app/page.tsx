'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatROI } from '@/lib/calculations'
import { LeaderboardEntry, GlobalStats } from '@/lib/types'

export default function DashboardPage() {
  const router = useRouter()
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [stats, setStats] = useState<GlobalStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'roi' | 'payout'>('roi')

  useEffect(() => {
    async function fetchData() {
      try {
        const [leaderboardRes, statsRes] = await Promise.all([
          fetch('/api/leaderboard', { cache: 'no-store' }),
          fetch('/api/stats', { cache: 'no-store' })
        ])

        const leaderboardData = await leaderboardRes.json()
        const statsData = await statsRes.json()

        setLeaderboard(leaderboardData)
        setStats(statsData)
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchData()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    if (sortBy === 'roi') {
      return b.roi - a.roi
    } else {
      return b.totalPayout - a.totalPayout
    }
  })

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-[#a0a0b8]">Loading...</div>
      </div>
    )
  }

  return (
    <>
      {/* Animated background orbs */}
      <div className="glass-bg">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
        <div className="orb orb-4"></div>
      </div>

      <div className="container mx-auto px-4 py-8 glass-content">
      <h1 className="text-3xl font-bold mb-8 text-white">Dashboard</h1>

      {/* Global Stats */}
      {stats && (
        <div className="glass-card rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-6 text-white">Tournament Stats</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-input p-5 rounded-xl">
              <div className="text-sm text-[#a0a0b8] mb-1">Total Prize Pool</div>
              <div className="text-3xl font-bold text-[#00ceb8]">
                {formatCurrency(stats.totalPot)}
              </div>
            </div>
            
            {Object.entries(stats.payoutPerWin).map(([round, payout]) => (
              <div key={round} className="glass-input p-5 rounded-xl">
                <div className="text-sm text-[#a0a0b8] mb-1">
                  {round.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}
                </div>
                <div className="text-2xl font-bold text-white">{formatCurrency(payout)}</div>
                <div className="text-xs text-[#6a6a82] mt-1">
                  {stats.percentages[round as keyof typeof stats.percentages]} of pot
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-[#2a2a38]">
          <h2 className="text-xl font-semibold text-white">Owner Leaderboard</h2>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-[#a0a0b8]">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'roi' | 'payout')}
              className="px-3 py-2 bg-[#1c1c28] border border-[#2a2a38] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00ceb8] focus:border-transparent transition-all"
            >
              <option value="roi">ROI %</option>
              <option value="payout">Total Payout</option>
            </select>
          </div>
        </div>

        {leaderboard.length === 0 ? (
          <div className="p-8 text-center text-[#a0a0b8]">
            No owners yet. Start the auction to begin!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-[#1c1c28] border-b border-[#2a2a38]">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider">
                    Owner
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider">
                    Teams
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider">
                    Investment
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider">
                    Payout
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider">
                    ROI
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a38]">
                {sortedLeaderboard.map((entry, index) => (
                  <tr 
                    key={entry.owner.id} 
                    onClick={() => router.push(`/owners/${entry.owner.id}`)}
                    className="hover:bg-[#1c1c28] hover:shadow-lg transition-all cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-sm font-bold text-white">#{index + 1}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-[#00ceb8] font-medium">
                        {entry.owner.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {entry.teamsCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {formatCurrency(entry.totalInvestment)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#2dce89]">
                      {formatCurrency(entry.totalPayout)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                        entry.roi >= 100 
                          ? 'bg-[#2dce89]/20 text-[#2dce89]' 
                          : entry.roi >= 0 
                          ? 'bg-[#00ceb8]/20 text-[#00ceb8]'
                          : 'bg-[#f5365c]/20 text-[#f5365c]'
                      }`}>
                        {formatROI(entry.roi)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    </>
  )
}
