'use client'

import { useEffect, useState } from 'react'
import { TeamWithOwner } from '@/lib/types'
import { useAuth } from '@/lib/hooks/useAuth'
import { RegionalTeamsBracket } from '@/components/teams/RegionalTeamsBracket'
import { FullTournamentBracket } from '@/components/teams/FullTournamentBracket'
import { GroupedTeamsView } from '@/components/teams/GroupedTeamsView'
import { OwnersTeamsView } from '@/components/teams/OwnersTeamsView'
import { useMode } from '@/components/ModeContext'
import { getTournamentConfig } from '@/lib/tournament'

/** Top-level Teams page view: by group/region ("groups") or by auction owner ("owners"). */
type TeamsView = 'groups' | 'owners'

/** Year passed to ESPN bracket import (admin “Import results”). */
const TOURNAMENT_IMPORT_YEAR = 2026

export default function TeamsPage() {
  const { user: currentUser } = useAuth()
  const { mode } = useMode()
  const config = getTournamentConfig(mode)
  const isWorldCup = mode === 'worldcup'
  const [teams, setTeams] = useState<TeamWithOwner[]>([])
  const [groupTies, setGroupTies] = useState(0)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState('')
  const [bracketLayout, setBracketLayout] = useState<'regional' | 'full'>('full')
  const [view, setView] = useState<TeamsView>('owners')

  useEffect(() => {
    async function fetchData() {
      try {
        const [teamsRes, tiesRes] = await Promise.all([
          fetch('/api/teams', { cache: 'no-store' }),
          fetch('/api/group-ties', { cache: 'no-store' })
        ])
        const teamsData = await teamsRes.json()
        setTeams(teamsData)
        const tiesData = await tiesRes.json().catch(() => ({ groupTies: 0 }))
        setGroupTies(Number(tiesData?.groupTies) || 0)
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

  const regions = config.groups
  const teamsByRegion = regions.reduce((acc, region) => {
    acc[region] = teams.filter(t => t.region === region).sort((a, b) => a.seed - b.seed)
    return acc
  }, {} as Record<string, TeamWithOwner[]>)

  const downloadCSV = () => {
    // Result columns are tournament-aware: March Madness keeps its NCAA columns verbatim,
    // while the World Cup exports its own payout-bucket columns (group stage, knockout
    // rounds, biggest upset, worst GD) driven by the shared payout config.
    const baseHeaders = ['Region', 'Seed', 'Team', 'Owner', 'Cost']
    const roundCols = isWorldCup ? config.payoutRounds : null
    const headers = roundCols
      ? [...baseHeaders, ...roundCols.map(r => r.label)]
      : [...baseHeaders, 'Round of 64', 'Round of 32', 'Sweet 16', 'Elite 8', 'Final 4', 'Championship']

    // Create CSV rows
    const rows = teams
      .sort((a, b) => {
        // Sort by region, then by seed
        const regionOrder = regions.indexOf(a.region) - regions.indexOf(b.region)
        if (regionOrder !== 0) return regionOrder
        return a.seed - b.seed
      })
      .map(team => {
        const base = [
          team.region,
          team.seed,
          team.name,
          team.owner?.name || 'Unassigned',
          team.cost
        ]
        if (roundCols) {
          return [
            ...base,
            ...roundCols.map(r => {
              const value = (team as unknown as Record<string, unknown>)[r.field]
              return r.fieldType === 'count' ? Number(value ?? 0) : value ? 'Yes' : 'No'
            })
          ]
        }
        return [
          ...base,
          team.round64 ? 'Yes' : 'No',
          team.round32 ? 'Yes' : 'No',
          team.sweet16 ? 'Yes' : 'No',
          team.elite8 ? 'Yes' : 'No',
          team.final4 ? 'Yes' : 'No',
          team.championship ? 'Yes' : 'No'
        ]
      })

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
    setImporting(true)
    setImportMessage('')

    try {
      const response = await fetch('/api/import-tournament', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: TOURNAMENT_IMPORT_YEAR })
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
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center">
          <div
            className="inline-flex rounded-lg border border-[#2a2a38] bg-[#1c1c28]/80 p-0.5"
            role="group"
            aria-label="Group teams by"
          >
            <button
              type="button"
              onClick={() => setView('owners')}
              aria-pressed={view === 'owners'}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                view === 'owners'
                  ? 'bg-[#00ceb8]/20 text-[#00ceb8]'
                  : 'text-[#a0a0b8] hover:text-white'
              }`}
            >
              Owners
            </button>
            <button
              type="button"
              onClick={() => setView('groups')}
              aria-pressed={view === 'groups'}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                view === 'groups'
                  ? 'bg-[#00ceb8]/20 text-[#00ceb8]'
                  : 'text-[#a0a0b8] hover:text-white'
              }`}
            >
              Groups
            </button>
          </div>
          {!isWorldCup && view === 'groups' && (
            <div
              className="inline-flex rounded-lg border border-[#2a2a38] bg-[#1c1c28]/80 p-0.5"
              role="group"
              aria-label="Bracket layout"
            >
              <button
                type="button"
                onClick={() => setBracketLayout('full')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  bracketLayout === 'full'
                    ? 'bg-[#00ceb8]/20 text-[#00ceb8]'
                    : 'text-[#a0a0b8] hover:text-white'
                }`}
              >
                Full bracket
              </button>
              <button
                type="button"
                onClick={() => setBracketLayout('regional')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  bracketLayout === 'regional'
                    ? 'bg-[#00ceb8]/20 text-[#00ceb8]'
                    : 'text-[#a0a0b8] hover:text-white'
                }`}
              >
                By region
              </button>
            </div>
          )}
          <button
            onClick={downloadCSV}
            className="btn-gradient-primary px-6 py-2 rounded-lg font-medium transition-all"
          >
            Download CSV
          </button>
        </div>
      </div>

      {/* Admin Tournament Import Controls (NCAA / March Madness only) */}
      {currentUser?.role === 'admin' && !isWorldCup && (
        <div className="glass-card p-6 rounded-2xl mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Import tournament results</h2>
          <p className="text-sm text-[#a0a0b8] mb-4">
            Pulls {TOURNAMENT_IMPORT_YEAR} NCAA men&apos;s tournament data from ESPN and updates team names and
            round wins (same logic as the automatic sync).
          </p>
          <p className="text-xs text-[#6a6a82] mb-4 leading-relaxed">
            <span className="text-[#00ceb8]/90 font-medium">Automatic updates:</span> If the host runs Vercel Cron
            with <code className="text-[#a0a0b8]">CRON_SECRET</code> and{' '}
            <code className="text-[#a0a0b8]">TOURNAMENT_IMPORT_YEAR</code> set, payouts refresh about every 15
            minutes during the tournament—no need to click import unless you want an immediate pull.
          </p>

          <button
            onClick={importTournamentResults}
            disabled={importing}
            className="btn-gradient-primary px-6 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? 'Importing…' : `Import ${TOURNAMENT_IMPORT_YEAR} results`}
          </button>

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

      {view === 'owners' ? (
        <OwnersTeamsView teams={teams} config={config} groupTies={groupTies} />
      ) : isWorldCup ? (
        <GroupedTeamsView
          groups={config.groups}
          teamsByGroup={teamsByRegion}
          groupNoun={config.groupNoun}
        />
      ) : bracketLayout === 'regional' ? (
        <RegionalTeamsBracket teamsByRegion={teamsByRegion} />
      ) : (
        <FullTournamentBracket teamsByRegion={teamsByRegion} />
      )}
    </div>
    </>
  )
}
