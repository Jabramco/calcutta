'use client'

import { useEffect, useState } from 'react'
import { OwnerWithTeams } from '@/lib/types'
import { formatCurrency, calculateTotalPot, calculateOwnerStats } from '@/lib/calculations'

export default function FinancesPage() {
  const [owners, setOwners] = useState<OwnerWithTeams[]>([])
  const [totalPot, setTotalPot] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [ownersRes, teamsRes] = await Promise.all([
          fetch('/api/owners'),
          fetch('/api/teams')
        ])

        const ownersData = await ownersRes.json()
        const teamsData = await teamsRes.json()

        setOwners(ownersData)
        setTotalPot(calculateTotalPot(teamsData))
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-[#a0a0b8]">Loading...</div>
      </div>
    )
  }

  const totalOwed = owners.reduce((sum, owner) => {
    const amountOwed = owner.teams.reduce((s, t) => s + Number(t.cost), 0)
    return sum + amountOwed
  }, 0)

  const totalPayout = owners.reduce((sum, owner) => {
    const stats = calculateOwnerStats(owner, owner.teams, totalPot)
    return sum + stats.totalPayout
  }, 0)

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
      <h1 className="text-3xl font-bold mb-8 text-white">Finances</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="glass-card rounded-2xl p-6">
          <div className="text-sm text-[#a0a0b8] mb-1">Total Owed</div>
          <div className="text-3xl font-bold text-[#00ceb8]">{formatCurrency(totalOwed)}</div>
        </div>
        
        <div className="glass-card rounded-2xl p-6">
          <div className="text-sm text-[#a0a0b8] mb-1">Total Payout</div>
          <div className="text-3xl font-bold text-[#2dce89]">{formatCurrency(totalPayout)}</div>
        </div>
      </div>

      {/* Finance Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2a2a38]">
          <h2 className="text-xl font-semibold text-white">Owner Financial Status</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="glass-input border-b border-[#2a2a38]">
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider">
                  # Teams
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider">
                  Amount Owed
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider">
                  Payout Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a38]">
              {owners.map(owner => {
                const stats = calculateOwnerStats(owner, owner.teams, totalPot)
                const amountOwed = stats.totalInvestment
                const payoutAmount = stats.totalPayout

                return (
                  <tr key={owner.id} className="hover:glass-input transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                      {owner.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#a0a0b8]">
                      {stats.teamsCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-medium">
                      {formatCurrency(amountOwed)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#2dce89]">
                      {formatCurrency(payoutAmount)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="glass-input border-t-2 border-[#00ceb8]">
                <td colSpan={2} className="px-6 py-4 text-sm font-bold text-white">
                  TOTAL
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-[#00ceb8]">
                  {formatCurrency(totalOwed)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-[#2dce89]">
                  {formatCurrency(totalPayout)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
    </>
  )
}
