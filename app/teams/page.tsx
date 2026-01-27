'use client'

import { useEffect, useState } from 'react'
import { TeamWithOwner, Owner } from '@/lib/types'
import { formatCurrency } from '@/lib/calculations'

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamWithOwner[]>([])
  const [owners, setOwners] = useState<Owner[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRegion, setExpandedRegion] = useState<string | null>('South')

  useEffect(() => {
    async function fetchData() {
      try {
        const [teamsRes, ownersRes] = await Promise.all([
          fetch('/api/teams', { cache: 'no-store' }),
          fetch('/api/owners', { cache: 'no-store' })
        ])

        const teamsData = await teamsRes.json()
        const ownersData = await ownersRes.json()

        setTeams(teamsData)
        setOwners(ownersData)
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

  const regions = ['South', 'West', 'East', 'Midwest']
  const teamsByRegion = regions.reduce((acc, region) => {
    acc[region] = teams.filter(t => t.region === region).sort((a, b) => a.seed - b.seed)
    return acc
  }, {} as Record<string, TeamWithOwner[]>)

  const downloadCSV = () => {
    // Create CSV header
    const headers = ['Region', 'Seed', 'Team', 'Owner', 'Cost', 'Round of 64', 'Round of 32', 'Sweet 16', 'Elite 8', 'Final 4', 'Championship']
    
    // Create CSV rows
    const rows = teams
      .sort((a, b) => {
        // Sort by region, then by seed
        const regionOrder = regions.indexOf(a.region) - regions.indexOf(b.region)
        if (regionOrder !== 0) return regionOrder
        return a.seed - b.seed
      })
      .map(team => [
        team.region,
        team.seed,
        team.name,
        team.owner?.name || 'Unassigned',
        team.cost,
        team.round64 ? 'Yes' : 'No',
        team.round32 ? 'Yes' : 'No',
        team.sweet16 ? 'Yes' : 'No',
        team.elite8 ? 'Yes' : 'No',
        team.final4 ? 'Yes' : 'No',
        team.championship ? 'Yes' : 'No'
      ])

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `calcutta-teams-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

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
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Teams</h1>
        <button
          onClick={downloadCSV}
          className="btn-gradient-primary px-6 py-2 rounded-lg font-medium transition-all"
        >
          Download CSV
        </button>
      </div>

      <div className="space-y-4">
        {regions.map(region => {
          const regionTeams = teamsByRegion[region] || []
          const isExpanded = expandedRegion === region

          return (
            <div key={region} className="glass-card rounded-2xl overflow-hidden">
              <button
                onClick={() => setExpandedRegion(isExpanded ? null : region)}
                className="w-full px-6 py-4 flex justify-between items-center hover:bg-[#1c1c28] transition-colors"
              >
                <h2 className="text-xl font-semibold text-white">{region} Region <span className="text-[#a0a0b8] text-base font-normal">({regionTeams.length} teams)</span></h2>
                <span className="text-2xl text-[#00ceb8]">{isExpanded ? '−' : '+'}</span>
              </button>

              {isExpanded && (
                <div className="border-t border-[#2a2a38]">
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="bg-[#1c1c28] border-b border-[#2a2a38]">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#a0a0b8] uppercase">Seed</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#a0a0b8] uppercase">Team</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#a0a0b8] uppercase">Owner</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#a0a0b8] uppercase">Cost</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-[#a0a0b8] uppercase">64</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-[#a0a0b8] uppercase">32</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-[#a0a0b8] uppercase">S16</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-[#a0a0b8] uppercase">E8</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-[#a0a0b8] uppercase">F4</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-[#a0a0b8] uppercase">Champ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2a2a38]">
                        {regionTeams.map(team => (
                          <tr key={team.id} className="hover:bg-[#1c1c28] transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">
                              {team.seed}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-white font-medium">
                              {team.name}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-[#a0a0b8]">
                                {team.owner?.name || <span className="text-[#6a6a82]">Unassigned</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-white font-medium">
                                {formatCurrency(Number(team.cost))}
                              </div>
                            </td>
                            {['round64', 'round32', 'sweet16', 'elite8', 'final4', 'championship'].map(round => (
                              <td key={round} className="px-4 py-3 whitespace-nowrap text-center">
                                {team[round as keyof TeamWithOwner] ? (
                                  <span className="text-[#2dce89] text-lg">✓</span>
                                ) : (
                                  <span className="text-[#2a2a38] text-lg">-</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
    </>
  )
}
