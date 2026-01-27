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
      </div>

      <div className="container mx-auto px-4 py-8 glass-content">
      <h1 className="text-3xl font-bold mb-8 text-white">Dashboard</h1>

      {/* Global Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="glass-card p-6 rounded-2xl">
            <div className="text-sm text-[#a0a0b8] mb-2 uppercase tracking-wider">Total Prize Pool</div>
            <div className="text-3xl font-bold text-[#00ceb8]">
              {formatCurrency(stats.totalPot)}
            </div>
          </div>
          
          {Object.entries(stats.payoutPerWin).map(([round, payout]) => (
            <div key={round} className="glass-card p-6 rounded-2xl">
              <div className="text-sm text-[#a0a0b8] mb-2 uppercase tracking-wider">
                {round.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}
              </div>
              <div className="text-2xl font-bold text-white">{formatCurrency(payout)}</div>
              <div className="text-xs text-[#6a6a82] mt-2">
                {stats.percentages[round as keyof typeof stats.percentages]} of pot
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Leaderboard */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h2 className="text-2xl font-bold text-white">Owner Leaderboard</h2>
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
          <div className="glass-card rounded-2xl p-8 text-center text-[#a0a0b8]">
            No owners yet. Start the auction to begin!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sortedLeaderboard.map((entry, index) => (
              <div
                key={entry.owner.id}
                onClick={() => router.push(`/owners/${entry.owner.id}`)}
                className="glass-card p-6 rounded-2xl hover:shadow-xl hover:scale-105 transition-all cursor-pointer relative"
              >
                {/* Rank Badge */}
                <div className="absolute -top-3 -right-3 w-12 h-12 bg-gradient-to-br from-[#00ceb8] to-[#00b5a1] rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-[#0d0d14] font-bold text-base">#{index + 1}</span>
                </div>

                {/* Owner Name */}
                <h3 className="text-xl font-bold text-[#00ceb8] mb-4 pr-8">
                  {entry.owner.name}
                </h3>

                {/* Stats Grid */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#a0a0b8] uppercase tracking-wider">Teams</span>
                    <span className="text-white font-semibold">{entry.teamsCount}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#a0a0b8] uppercase tracking-wider">Investment</span>
                    <span className="text-white font-semibold">{formatCurrency(entry.totalInvestment)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#a0a0b8] uppercase tracking-wider">Payout</span>
                    <span className="text-[#2dce89] font-bold">{formatCurrency(entry.totalPayout)}</span>
                  </div>

                  {/* ROI Badge */}
                  <div className="pt-3 mt-3 border-t border-[#2a2a38]">
                    <div className={`text-center py-2 rounded-lg font-bold text-lg ${
                      entry.roi >= 100 
                        ? 'bg-[#2dce89]/20 text-[#2dce89]' 
                        : entry.roi >= 0 
                        ? 'bg-[#00ceb8]/20 text-[#00ceb8]'
                        : 'bg-[#f5365c]/20 text-[#f5365c]'
                    }`}>
                      {formatROI(entry.roi)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  )
}
