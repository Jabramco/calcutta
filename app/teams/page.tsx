'use client'

import { useEffect, useState } from 'react'
import { TeamWithOwner, Owner } from '@/lib/types'
import { formatCurrency } from '@/lib/calculations'
import { useAuth } from '@/lib/hooks/useAuth'

export default function TeamsPage() {
  const { user: currentUser } = useAuth()
  const [teams, setTeams] = useState<TeamWithOwner[]>([])
  const [owners, setOwners] = useState<Owner[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRegion, setExpandedRegion] = useState<string | null>('South')
  const [tournamentYear, setTournamentYear] = useState('2024')
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState('')

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

  const importTournamentResults = async () => {
    if (!tournamentYear || isNaN(Number(tournamentYear))) {
      alert('Please enter a valid year')
      return
    }

    setImporting(true)
    setImportMessage('')

    try {
      const response = await fetch('/api/import-tournament', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: tournamentYear })
      })

      const data = await response.json()

      if (response.ok) {
        setImportMessage(`✓ Imported ${data.tournamentGames} tournament games. Updated ${data.updatedTeams} teams.`)
        // Refresh teams data
        const teamsRes = await fetch('/api/teams', { cache: 'no-store' })
        const teamsData = await teamsRes.json()
        setTeams(teamsData)
      } else {
        setImportMessage(`✗ ${data.error || 'Failed to import tournament data'}`)
      }
    } catch (error) {
      console.error('Error importing tournament results:', error)
      setImportMessage('✗ Failed to import tournament data')
    } finally {
      setImporting(false)
    }
  }

  const resetTournamentResults = async () => {
    if (!confirm('Are you sure you want to reset all tournament results? This will remove all win checkboxes.')) {
      return
    }

    setImporting(true)
    setImportMessage('')

    try {
      const response = await fetch('/api/import-tournament', {
        method: 'DELETE'
      })

      const data = await response.json()

      if (response.ok) {
        setImportMessage('✓ All tournament results have been reset')
        // Refresh teams data
        const teamsRes = await fetch('/api/teams', { cache: 'no-store' })
        const teamsData = await teamsRes.json()
        setTeams(teamsData)
      } else {
        setImportMessage(`✗ ${data.error || 'Failed to reset tournament results'}`)
      }
    } catch (error) {
      console.error('Error resetting tournament results:', error)
      setImportMessage('✗ Failed to reset tournament results')
    } finally {
      setImporting(false)
    }
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
      </div>

      <div className="container mx-auto px-4 py-8 glass-content">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-3xl font-bold text-white">Teams</h1>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={downloadCSV}
            className="btn-gradient-primary px-6 py-2 rounded-lg font-medium transition-all"
          >
            Download CSV
          </button>
        </div>
      </div>

      {/* Admin Tournament Import Controls */}
      {currentUser?.role === 'admin' && (
        <div className="glass-card p-6 rounded-2xl mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Import Tournament Results</h2>
          <p className="text-sm text-[#a0a0b8] mb-4">
            Import real tournament data from NCAA API to automatically update team wins for each round.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="flex-1">
              <label className="block text-sm text-[#a0a0b8] mb-2">Tournament Year</label>
              <input
                type="number"
                value={tournamentYear}
                onChange={(e) => setTournamentYear(e.target.value)}
                placeholder="2024"
                min="2010"
                max="2030"
                className="w-full px-4 py-2 bg-[#1c1c28] border border-[#2a2a38] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#00ceb8] focus:border-transparent transition-all"
                disabled={importing}
              />
            </div>
            
            <button
              onClick={importTournamentResults}
              disabled={importing}
              className="btn-gradient-primary px-6 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {importing ? 'Importing...' : 'Import Results'}
            </button>
            
            <button
              onClick={resetTournamentResults}
              disabled={importing}
              className="btn-gradient-danger-outline px-6 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              Reset All
            </button>
          </div>

          {importMessage && (
            <div className={`mt-4 p-3 rounded-lg text-sm ${
              importMessage.startsWith('✓') 
                ? 'bg-[#2dce89]/20 text-[#2dce89]' 
                : 'bg-[#f5365c]/20 text-[#f5365c]'
            }`}>
              {importMessage}
            </div>
          )}
        </div>
      )}

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
