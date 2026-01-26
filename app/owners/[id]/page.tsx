'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { OwnerWithTeams } from '@/lib/types'
import { formatCurrency, formatROI, calculateTeamPayout, calculateTotalPot } from '@/lib/calculations'

export default function OwnerPage() {
  const params = useParams()
  const [owner, setOwner] = useState<OwnerWithTeams | null>(null)
  const [totalPot, setTotalPot] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [ownerRes, teamsRes] = await Promise.all([
          fetch(`/api/owners/${params.id}`),
          fetch('/api/teams')
        ])

        const ownerData = await ownerRes.json()
        const teamsData = await teamsRes.json()

        setOwner(ownerData)
        setTotalPot(calculateTotalPot(teamsData))
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [params.id])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-[#a0a0b8]">Loading...</div>
      </div>
    )
  }

  if (!owner) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-[#a0a0b8]">Owner not found</div>
      </div>
    )
  }

  const totalInvestment = owner.teams.reduce((sum, team) => sum + Number(team.cost), 0)
  const totalPayout = owner.teams.reduce((sum, team) => sum + calculateTeamPayout(team, totalPot), 0)
  const roi = totalInvestment > 0 ? ((totalPayout - totalInvestment) / totalInvestment) * 100 : 0

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/" className="text-[#00ceb8] hover:text-[#00b5a1] mb-6 inline-flex items-center gap-2 font-medium transition-colors">
        <span>←</span> Back to Dashboard
      </Link>

      <div className="bg-[#15151e] rounded-2xl border border-[#2a2a38] p-6 mb-8">
        <h1 className="text-3xl font-bold mb-6 text-white">{owner.name}</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#1c1c28] border border-[#2a2a38] p-4 rounded-xl">
            <div className="text-sm text-[#a0a0b8] mb-1">Total Teams</div>
            <div className="text-3xl font-bold text-[#00ceb8]">{owner.teams.length}</div>
          </div>
          
          <div className="bg-[#1c1c28] border border-[#2a2a38] p-4 rounded-xl">
            <div className="text-sm text-[#a0a0b8] mb-1">Total Investment</div>
            <div className="text-3xl font-bold text-[#f5365c]">{formatCurrency(totalInvestment)}</div>
          </div>
          
          <div className="bg-[#1c1c28] border border-[#2a2a38] p-4 rounded-xl">
            <div className="text-sm text-[#a0a0b8] mb-1">Total Payout</div>
            <div className="text-3xl font-bold text-[#2dce89]">{formatCurrency(totalPayout)}</div>
          </div>
          
          <div className={`border p-4 rounded-xl ${roi >= 0 ? 'bg-[#2dce89]/10 border-[#2dce89]/30' : 'bg-[#f5365c]/10 border-[#f5365c]/30'}`}>
            <div className="text-sm text-[#a0a0b8] mb-1">ROI</div>
            <div className={`text-3xl font-bold ${roi >= 0 ? 'text-[#2dce89]' : 'text-[#f5365c]'}`}>
              {formatROI(roi)}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#15151e] rounded-2xl border border-[#2a2a38] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2a2a38]">
          <h2 className="text-xl font-semibold text-white">Teams</h2>
        </div>

        {owner.teams.length === 0 ? (
          <div className="px-6 py-8 text-center text-[#a0a0b8]">
            No teams owned yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-[#1c1c28] border-b border-[#2a2a38]">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#a0a0b8] uppercase">Region</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#a0a0b8] uppercase">Seed</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#a0a0b8] uppercase">Team</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#a0a0b8] uppercase">Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#a0a0b8] uppercase">Rounds Won</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#a0a0b8] uppercase">Payout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a38]">
                {owner.teams.map(team => {
                  const roundsWon = []
                  if (team.round64) roundsWon.push('64')
                  if (team.round32) roundsWon.push('32')
                  if (team.sweet16) roundsWon.push('S16')
                  if (team.elite8) roundsWon.push('E8')
                  if (team.final4) roundsWon.push('F4')
                  if (team.championship) roundsWon.push('🏆')

                  const teamPayout = calculateTeamPayout(team, totalPot)

                  return (
                    <tr key={team.id} className="hover:bg-[#1c1c28] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {team.region}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                        {team.seed}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                        {team.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[#a0a0b8]">
                        {formatCurrency(Number(team.cost))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {roundsWon.length > 0 ? (
                          <div className="flex gap-1">
                            {roundsWon.map((round, i) => (
                              <span key={i} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-[#2dce89]/20 text-[#2dce89]">
                                {round}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[#6a6a82]">None</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#2dce89]">
                        {formatCurrency(teamPayout)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
