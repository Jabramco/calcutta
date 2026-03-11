'use client'

import { useEffect, useState, useRef } from 'react'
import { formatCurrency } from '@/lib/calculations'

interface AuctionState {
  isActive: boolean
  currentTeamId: number | null
  currentBid: number
  currentBidder: string | null
  bids: Array<{ bidder: string; amount: number; timestamp: number }>
  lastBidTime: number | null
  currentTeam?: {
    id: number
    name: string
    region: string
    seed: number
  }
}

interface ChatMessage {
  type: 'bot' | 'bid' | 'sold' | 'system' | 'warning'
  message: string
  timestamp: number
  bidder?: string
  amount?: number
}

const COUNTDOWN_INTERVAL = 3000 // 3 seconds between warnings

export default function AuctionPage() {
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [currentUser, setCurrentUser] = useState<{username: string, role: string} | null>(null)
  const [bidAmount, setBidAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [warningState, setWarningState] = useState<'none' | 'once' | 'twice'>('none')
  const [totalPot, setTotalPot] = useState(0)
  const [teamsRemaining, setTeamsRemaining] = useState(64)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastAnnouncedWarning = useRef<'none' | 'once' | 'twice'>('none')
  const lastAnnouncedBucketRef = useRef<number>(0) // 0=none, 1=once, 2=twice — only add chat when we enter a new bucket
  const lastDisplayedSecondsRef = useRef<number>(-1)
  const lastSetWarningStateRef = useRef<'none' | 'once' | 'twice'>('none')
  const currentTeamIdRef = useRef<number | null>(null)
  const lastAnnouncedTeamId = useRef<number | null>(null)
  const lastBidCount = useRef<number>(0)
  const lastShownSaleTeamRef = useRef<string | null>(null)
  const hasAutoSold = useRef<boolean>(false)
  const auctionStateRef = useRef<AuctionState | null>(null)
  const isFirstFetchAfterMountRef = useRef<boolean>(true)
  const mountedAtRef = useRef<number>(Date.now())
  const reconnectGraceUntilRef = useRef<number>(0)
  const [isInitialized, setIsInitialized] = useState(false)
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false })
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    auctionStateRef.current = auctionState
  }, [auctionState])

  // Fetch current user
  useEffect(() => {
    fetchCurrentUser()
  }, [])

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        setCurrentUser(data.user)
      }
    } catch (error) {
      console.error('Error fetching current user:', error)
    }
  }

  const showToast = (message: string) => {
    // Clear any existing timeout
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
    }
    
    // Show the toast
    setToast({ message, visible: true })
    
    // Auto-hide after 3 seconds
    toastTimeoutRef.current = setTimeout(() => {
      setToast({ message: '', visible: false })
    }, 3000)
  }

  // Load chat history from localStorage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem('auctionChatHistory')
    if (savedMessages) {
      try {
        setChatMessages(JSON.parse(savedMessages))
      } catch (e) {
        console.error('Error loading chat history:', e)
      }
    }
    setIsInitialized(true)
  }, [])

  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('auctionChatHistory', JSON.stringify(chatMessages))
    }
  }, [chatMessages, isInitialized])

  useEffect(() => {
    fetchAuctionState()
    fetchStats()
    const interval = setInterval(() => {
      fetchAuctionState()
      fetchStats()
    }, 1000) // Poll every second for accurate countdown
    return () => {
      clearInterval(interval)
      // Clean up toast timeout on unmount
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    // Only scroll if we're initialized and there are messages
    if (isInitialized && chatMessages.length > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }
  }, [chatMessages, isInitialized])

  // Countdown timer logic
  useEffect(() => {
    if (!auctionState?.isActive || !auctionState.currentTeam) {
      setCountdown(null)
      setWarningState('none')
      lastAnnouncedWarning.current = 'none'
      hasAutoSold.current = false
      return
    }

    // Reset warning tracker if it's a new team
    if (currentTeamIdRef.current !== auctionState.currentTeam.id) {
      currentTeamIdRef.current = auctionState.currentTeam.id
      lastAnnouncedWarning.current = 'none'
      lastAnnouncedBucketRef.current = 0
      lastSetWarningStateRef.current = 'none'
      setWarningState('none')
      hasAutoSold.current = false
    }

    // If there's no lastBidTime yet (team just selected, no bids), show "waiting for bids"
    // NEVER start countdown without at least one bid
    if (!auctionState.lastBidTime || !auctionState.bids || auctionState.bids.length === 0) {
      setCountdown(null)
      setWarningState('none')
      return
    }

    // Set up interval to update countdown every 100ms. Use ref for latest state so we never
    // fire autoSoldTeam() based on stale closure (e.g. after server already advanced to next team).
    const interval = setInterval(() => {
      const latest = auctionStateRef.current
      if (!latest?.bids || latest.bids.length === 0 || !latest.lastBidTime) return
      if (latest.currentTeam?.id !== currentTeamIdRef.current) return // team changed, don't act on old team

      const now = Date.now()
      const elapsed = now - latest.lastBidTime
      const remaining = COUNTDOWN_INTERVAL - (elapsed % COUNTDOWN_INTERVAL)
      const seconds = Math.ceil(remaining / 1000)
      if (seconds !== lastDisplayedSecondsRef.current) {
        lastDisplayedSecondsRef.current = seconds
        setCountdown(remaining)
      }

      // Determine warning state and announce ONCE per state change.
      // Don't auto-sell: for 5s after mount, when tab is hidden, or for 5s after reconnect (stale state).
      const gracePeriodMs = 5000
      const tabVisible = typeof document !== 'undefined' && document.visibilityState === 'visible'
      const pastReconnectGrace = Date.now() > reconnectGraceUntilRef.current
      if (elapsed >= COUNTDOWN_INTERVAL * 3) {
        if (
          tabVisible &&
          pastReconnectGrace &&
          !hasAutoSold.current &&
          latest.currentBid > 0 &&
          latest.currentBidder &&
          latest.bids.length > 0 &&
          Date.now() - mountedAtRef.current > gracePeriodMs
        ) {
          autoSoldTeam()
        }
      } else if (elapsed >= COUNTDOWN_INTERVAL * 2) {
        if (lastAnnouncedBucketRef.current < 2) {
          lastAnnouncedBucketRef.current = 2
          lastSetWarningStateRef.current = 'twice'
          setWarningState('twice')
          lastAnnouncedWarning.current = 'twice'
          addChatMessage({
            type: 'warning',
            message: 'Going TWICE!',
            timestamp: Date.now()
          })
        } else if (lastSetWarningStateRef.current !== 'twice') {
          lastSetWarningStateRef.current = 'twice'
          setWarningState('twice')
          lastAnnouncedWarning.current = 'twice'
        }
      } else if (elapsed >= COUNTDOWN_INTERVAL) {
        if (lastAnnouncedBucketRef.current < 1) {
          lastAnnouncedBucketRef.current = 1
          lastSetWarningStateRef.current = 'once'
          setWarningState('once')
          lastAnnouncedWarning.current = 'once'
          addChatMessage({
            type: 'warning',
            message: 'Going once!',
            timestamp: Date.now()
          })
        } else if (lastSetWarningStateRef.current !== 'once') {
          lastSetWarningStateRef.current = 'once'
          setWarningState('once')
          lastAnnouncedWarning.current = 'once'
        }
      } else if (elapsed < 1000) {
        if (lastAnnouncedBucketRef.current > 0) {
          lastAnnouncedBucketRef.current = 0
          lastSetWarningStateRef.current = 'none'
          setWarningState('none')
          lastAnnouncedWarning.current = 'none'
          hasAutoSold.current = false
        }
      }
    }, 100) // Update every 100ms

    return () => clearInterval(interval)
  }, [auctionState?.lastBidTime, auctionState?.currentTeam, auctionState?.isActive, auctionState?.bids])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats')
      const data = await response.json()
      setTotalPot(data.totalPot)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const fetchAuctionState = async () => {
    try {
      const response = await fetch('/api/auction')
      const data = await response.json()

      const usedServerEvents = data.events && Array.isArray(data.events)
      if (usedServerEvents) {
        // Keep server event log as base; append "Going once" / "Going TWICE" if we're in that phase
        // (server doesn't store these, so they'd disappear on next poll otherwise)
        const base = data.events as ChatMessage[]
        const warning = lastAnnouncedWarning.current
        const now = Date.now()
        const messages =
          warning === 'once'
            ? [...base, { type: 'warning' as const, message: 'Going once!', timestamp: now }]
            : warning === 'twice'
              ? [...base, { type: 'warning' as const, message: 'Going once!', timestamp: now - COUNTDOWN_INTERVAL }, { type: 'warning' as const, message: 'Going TWICE!', timestamp: now }]
              : base
        setChatMessages(messages)
        if (data.currentTeam) {
          lastAnnouncedTeamId.current = data.currentTeam.id
          currentTeamIdRef.current = data.currentTeam.id
        } else {
          lastAnnouncedTeamId.current = null
          currentTeamIdRef.current = null
        }
        lastBidCount.current = data.bids?.length ?? 0
        if (data.lastSale?.teamName) lastShownSaleTeamRef.current = data.lastSale.teamName
        isFirstFetchAfterMountRef.current = false
      } else {
        // Fallback when server doesn't send events: incremental updates (e.g. lastSale, now auctioning, new bids)
        const lastSale = data.lastSale
        if (lastSale && lastSale.teamName && lastSale.winner != null && lastSale.teamName !== lastShownSaleTeamRef.current) {
          lastShownSaleTeamRef.current = lastSale.teamName
          addChatMessage({
            type: 'sold',
            message: `SOLD to ${lastSale.winner} for ${formatCurrency(lastSale.amount)}!`,
            timestamp: Date.now()
          })
        }
        if (data.currentTeam) {
          const prevTeamId = lastAnnouncedTeamId.current
          const isNewTeam = prevTeamId !== data.currentTeam.id
          lastAnnouncedTeamId.current = data.currentTeam.id
          currentTeamIdRef.current = data.currentTeam.id
          setWarningState('none')
          lastAnnouncedWarning.current = 'none'
          hasAutoSold.current = false
          if (isNewTeam) {
            lastBidCount.current = data.bids?.length ?? 0
            if (!isFirstFetchAfterMountRef.current) {
              addChatMessage({
                type: 'bot',
                message: `Now auctioning: ${data.currentTeam.name} - ${data.currentTeam.region} Region, Seed #${data.currentTeam.seed}`,
                timestamp: Date.now()
              })
            }
          }
        }
        isFirstFetchAfterMountRef.current = false
        if (data.bids && data.bids.length > lastBidCount.current) {
          const newBids = data.bids.slice(lastBidCount.current)
          lastBidCount.current = data.bids.length
          newBids.forEach((bid: any) => {
            setWarningState('none')
            lastAnnouncedWarning.current = 'none'
            hasAutoSold.current = false
            addChatMessage({
              type: 'bid',
              message: `${bid.bidder} bids ${formatCurrency(bid.amount)}!`,
              timestamp: bid.timestamp,
              bidder: bid.bidder,
              amount: bid.amount
            })
          })
        }
      }

      if (data.currentTeam) {
        setWarningState('none')
        lastAnnouncedWarning.current = 'none'
        hasAutoSold.current = false
      }

      // If we just got state where countdown is already past 15s (e.g. we reconnected after being offline),
      // don't auto-sell for 5s so we don't immediately fire sold on reconnect.
      if (data.lastBidTime && data.bids?.length > 0 && data.currentBid > 0) {
        const elapsed = Date.now() - Number(data.lastBidTime)
        if (elapsed >= COUNTDOWN_INTERVAL * 3) {
          reconnectGraceUntilRef.current = Date.now() + 5000
        }
      }

      // Count remaining teams
      if (data.isActive && !data.currentTeam) {
        const teamsResponse = await fetch('/api/teams')
        const teams = await teamsResponse.json()
        const remaining = teams.filter((t: any) => !t.ownerId).length
        setTeamsRemaining(remaining)
      }

      setAuctionState(data)
    } catch (error) {
      console.error('Error fetching auction state:', error)
    }
  }

  const addChatMessage = (message: ChatMessage) => {
    setChatMessages(prev => [...prev, message])
  }

  const startAuction = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/auction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' })
      })

      if (response.ok) {
        // Clear chat history when starting fresh auction
        setChatMessages([])
        lastShownSaleTeamRef.current = null
        localStorage.removeItem('auctionChatHistory')
        
        addChatMessage({
          type: 'system',
          message: 'Auction started! First team selected randomly...',
          timestamp: Date.now()
        })
        await fetchAuctionState()
      } else {
        const data = await response.json().catch(() => ({}))
        showToast(data?.error || 'Failed to start auction')
      }
    } catch (error) {
      console.error('Error starting auction:', error)
      showToast('Failed to start auction')
    } finally {
      setLoading(false)
    }
  }

  const nextTeam = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/auction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'next' })
      })

      if (response.ok) {
        addChatMessage({
          type: 'system',
          message: 'Selecting next team randomly...',
          timestamp: Date.now()
        })
        await fetchAuctionState()
      } else {
        const data = await response.json().catch(() => ({}))
        showToast(data?.error || 'Could not advance to next team')
      }
    } catch (error) {
      console.error('Error getting next team:', error)
      showToast('Error getting next team')
    } finally {
      setLoading(false)
    }
  }

  const placeBid = async () => {
    if (!currentUser || !bidAmount) return

    const amount = parseFloat(bidAmount)
    if (isNaN(amount) || amount <= (auctionState?.currentBid || 0)) {
      showToast('Must be higher than current highest bid')
      return
    }

    // Prevent users from outbidding themselves
    if (auctionState?.currentBidder === currentUser.username) {
      showToast("Don't outbid yourself silly")
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'bid', 
          bidder: currentUser.username,
          amount 
        })
      })

      if (response.ok) {
        setBidAmount('')
        await fetchAuctionState()
        await fetchStats()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to place bid')
      }
    } catch (error) {
      console.error('Error placing bid:', error)
    } finally {
      setLoading(false)
    }
  }

  const autoSoldTeam = async () => {
    const state = auctionStateRef.current
    if (!state?.currentBidder || state.currentBid === 0) return
    if (!state?.bids || state.bids.length === 0) return
    if (loading) return // Prevent concurrent sells
    if (hasAutoSold.current) return // Already sold this team

    // Prevent double-selling
    hasAutoSold.current = true // Mark as sold immediately
    setLoading(true)
    
    try {
      const response = await fetch('/api/auction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sold' })
      })

      if (response.ok) {
        const data = await response.json()
        // Server returned no-op (e.g. another client already sold); don't add SOLD or advance UI
        if (data.noOp) {
          hasAutoSold.current = false
          await fetchAuctionState()
          setLoading(false)
          return
        }
        addChatMessage({
          type: 'sold',
          message: `SOLD to ${state.currentBidder} for ${formatCurrency(state.currentBid || 0)}!`,
          timestamp: Date.now()
        })
        lastShownSaleTeamRef.current = state.currentTeam?.name ?? null

        // Reset state for next team (do NOT set lastAnnouncedTeamId = null here; the next
        // fetch will see the new team id and we'll add one "Now auctioning" line. Setting
        // it to null would let two concurrent fetches both add the same team.)
        lastAnnouncedWarning.current = 'none'
        setWarningState('none')
        lastBidCount.current = 0
        
        if (data.remainingTeams > 0) {
          addChatMessage({
            type: 'system',
            message: `${data.remainingTeams} teams remaining. Next team coming up...`,
            timestamp: Date.now()
          })
        } else {
          addChatMessage({
            type: 'system',
            message: 'Auction complete! All teams have been sold!',
            timestamp: Date.now()
          })
        }
        
        await fetchAuctionState()
        await fetchStats()
      } else {
        const data = await response.json().catch(() => ({}))
        hasAutoSold.current = false
        if (data?.error) showToast(data.error)
        await fetchAuctionState()
      }
    } catch (error) {
      console.error('Error selling team:', error)
      hasAutoSold.current = false // Reset on error
    } finally {
      setLoading(false)
    }
  }

  const soldTeam = async () => {
    if (!auctionState?.currentBidder) {
      alert('No bids placed yet!')
      return
    }

    await autoSoldTeam()
  }

  const stopAuction = async () => {
    setLoading(true)
    try {
      await fetch('/api/auction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      })
      
      addChatMessage({
        type: 'system',
        message: 'Auction paused',
        timestamp: Date.now()
      })
      await fetchAuctionState()
    } catch (error) {
      console.error('Error stopping auction:', error)
    } finally {
      setLoading(false)
    }
  }

  const resumeAuction = async () => {
    setLoading(true)
    try {
      await fetch('/api/auction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' })
      })
      
      addChatMessage({
        type: 'system',
        message: 'Auction resumed',
        timestamp: Date.now()
      })
      await fetchAuctionState()
    } catch (error) {
      console.error('Error resuming auction:', error)
    } finally {
      setLoading(false)
    }
  }

  const restartAuction = async () => {
    if (!confirm('Are you sure you want to restart the auction? This will reset all teams, clear all owners, and set the prize pool to $0. This action cannot be undone.')) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auction/restart', {
        method: 'POST'
      })

      if (response.ok) {
        // Clear chat history
        setChatMessages([])
        lastShownSaleTeamRef.current = null
        localStorage.removeItem('auctionChatHistory')
        
        // Reset refs
        lastAnnouncedTeamId.current = null
        lastBidCount.current = 0
        lastAnnouncedWarning.current = 'none'
        hasAutoSold.current = false
        currentTeamIdRef.current = null
        
        addChatMessage({
          type: 'system',
          message: 'Auction has been restarted! All data cleared.',
          timestamp: Date.now()
        })
        
        // Refresh data
        await fetchAuctionState()
        await fetchStats()
      } else {
        const data = await response.json().catch(() => ({}))
        showToast(data?.error || 'Failed to restart auction')
      }
    } catch (error) {
      console.error('Error restarting auction:', error)
      showToast('Failed to restart auction')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Toast Notification */}
      {toast.visible && (
        <div className="fixed left-1/2 z-50 animate-slide-down" style={{ top: '80px' }}>
          <div className="rounded-xl px-6 py-4 shadow-lg bg-gradient-to-r from-[#f5365c] to-[#ff6b6b] border-2 border-[#ff0000]">
            <p className="text-white font-semibold">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Animated background orbs */}
      <div className="glass-bg">
        <div className="orb orb-1"></div>
      </div>

      {/* On desktop: constrain to viewport so chat fits without page scroll (nav ~5rem) */}
      <div className="flex flex-col lg:h-[calc(100vh-5rem)] min-h-0 lg:overflow-hidden glass-content">
        <div className="container mx-auto px-4 pt-6 pb-4 flex-shrink-0">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-white">Live Auction</h1>
            <div className="text-right">
              <div className="text-sm text-[#a0a0b8]">Current Prize Pool</div>
              <div className="text-2xl font-bold text-[#00ceb8]">{formatCurrency(totalPot ?? 0)}</div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6 pb-6">
        {/* Current Team Card */}
        <div className="lg:col-span-1">
          <h2 className="text-xl font-semibold mb-4 text-white">Current Team</h2>
          
          {auctionState?.isActive && auctionState.currentTeam ? (
            <div>
              <div className="mb-6 p-6 glass-card rounded-2xl border-2 border-[#00ceb8] shadow-lg shadow-[#00ceb8]/40 bg-gradient-to-br from-[#00ceb8]/10 to-transparent">
                <div className="text-3xl font-bold text-white mb-2">{auctionState.currentTeam.name}</div>
                <div className="text-sm text-[#00ceb8] font-medium">
                  {auctionState.currentTeam.region} Region • Seed #{auctionState.currentTeam.seed}
                </div>
              </div>

              <div className="glass-card rounded-2xl p-6 mb-6">
                <div className="mb-4">
                  <div className="text-sm text-[#a0a0b8] mb-1">Current Bid</div>
                  <div className="text-4xl font-bold text-[#00ceb8]">
                    {formatCurrency(auctionState.currentBid ?? 0)}
                  </div>
                  {auctionState.currentBidder && (
                    <div className="text-sm text-[#a0a0b8] mt-2">
                      Leading: <span className="font-bold text-white">{auctionState.currentBidder}</span>
                    </div>
                  )}
                </div>

                {countdown !== null && (auctionState.currentBid ?? 0) > 0 && (
                  <div className={`p-3 rounded-lg text-center ${
                    warningState === 'twice' ? 'bg-[#f5365c]/20 border border-[#f5365c]' :
                    warningState === 'once' ? 'bg-[#fb6340]/20 border border-[#fb6340]' :
                    'glass-input'
                  }`}>
                    <div className="text-xs text-[#a0a0b8]">Time remaining</div>
                    <div className="text-2xl font-bold text-white">
                      {Math.ceil(countdown / 1000)}s
                    </div>
                    {warningState !== 'none' && (
                      <div className="text-sm font-bold text-[#f5365c] mt-1">
                        {warningState === 'twice' ? 'Going TWICE!' : 'Going once!'}
                      </div>
                    )}
                  </div>
                )}

                {!auctionState.lastBidTime && (
                  <div className="text-center text-sm text-[#a0a0b8] italic">
                    Waiting for first bid...
                  </div>
                )}
              </div>
            </div>
          ) : auctionState?.isActive && !auctionState.currentTeam ? (
              <div className="text-center py-8">
                <div className="text-[#a0a0b8] mb-4">{teamsRemaining} teams remaining</div>
                <button
                  onClick={nextTeam}
                  disabled={loading}
                  className="btn-gradient-primary px-6 py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  Next Team (Random)
                </button>
              </div>
            ) : (
              <div className="text-center py-8 text-[#a0a0b8]">
                {auctionState?.isActive === false && auctionState.currentTeamId === null 
                  ? 'Auction completed!'
                  : 'No active auction'
                }
              </div>
            )}

          {/* Auction Controls - Admin Only */}
          {currentUser?.role === 'admin' && (
            <div className="glass-card rounded-2xl p-6">
              <h2 className="text-xl font-semibold mb-4 text-white">Controls</h2>
              
              <div className="space-y-3">
                {!auctionState?.isActive && !auctionState?.currentTeamId ? (
                  <button
                    onClick={startAuction}
                    disabled={loading}
                    className="btn-gradient-primary w-full px-4 py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    Start Auction
                  </button>
                ) : !auctionState?.isActive && auctionState?.currentTeamId ? (
                  <button
                    onClick={resumeAuction}
                    disabled={loading}
                    className="btn-gradient-primary w-full px-4 py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    Resume Auction
                  </button>
                ) : auctionState?.currentTeam ? (
                  <>
                    <button
                      onClick={soldTeam}
                      disabled={loading || !auctionState.currentBidder}
                      className="btn-gradient-dark w-full px-4 py-3 text-[#00ceb8] rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                    >
                      Sold! (Manual)
                    </button>
                    <button
                      onClick={stopAuction}
                      disabled={loading}
                      className="btn-gradient-dark w-full px-4 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                    >
                      Pause Auction
                    </button>
                  </>
                ) : (
                  <button
                    onClick={stopAuction}
                    disabled={loading}
                    className="btn-gradient-dark w-full px-4 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    Stop Auction
                  </button>
                )}
                
                {/* Restart button - admin only */}
                <button
                  onClick={restartAuction}
                  disabled={loading}
                  className="btn-gradient-danger-outline w-full px-4 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  Restart Auction
                </button>
              </div>
            </div>
          )}
          </div>

        {/* Chat & Bidding */}
        <div className="lg:col-span-2 flex flex-col min-h-[400px] lg:min-h-0">
          <div className="glass-card rounded-2xl flex flex-col min-h-[400px] lg:min-h-0 lg:flex-1 overflow-hidden">
            <div className="p-4 border-b border-[#2a2a38]">
              <h2 className="text-xl font-semibold text-white">Auction Chat</h2>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.map((msg, index) => (
                <div key={index} className={`${
                  msg.type === 'bot' ? 'bg-[#4cc9f0]/10 border-l-4 border-[#4cc9f0]' :
                  msg.type === 'bid' ? 'bg-[#2dce89]/10 border-l-4 border-[#2dce89]' :
                  msg.type === 'sold' ? 'bg-[#9d4edd]/10 border-l-4 border-[#9d4edd]' :
                  msg.type === 'warning' ? 'bg-[#fb6340]/10 border-l-4 border-[#fb6340]' :
                  'bg-[#1c1c28] border-l-4 border-[#2a2a38]'
                } p-3 rounded-lg`}>
                  <div className="text-sm text-white font-medium">{msg.message}</div>
                  <div className="text-xs text-[#6a6a82] mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Bid Input */}
            <div className="p-4 border-t border-[#2a2a38] glass-input">
              {currentUser ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder="Bid amount"
                    className="flex-1 px-4 py-2 rounded-xl text-white placeholder-[#a0a0b8] focus:outline-none focus:ring-2 focus:ring-[#00ceb8] focus:border-transparent transition-all bg-[#0d0d14] border border-[#2a2a38]"
                    disabled={!auctionState?.currentTeam}
                    step="5"
                    min="5"
                    onKeyPress={(e) => e.key === 'Enter' && placeBid()}
                  />
                  <button
                    onClick={placeBid}
                    disabled={loading || !auctionState?.currentTeam || !bidAmount}
                    className="btn-gradient-primary px-6 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-semibold whitespace-nowrap w-full sm:w-auto"
                  >
                    Place Bid
                  </button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-[#a0a0b8] mb-2">Please log in to place bids</p>
                  <a href="/login" className="text-[#00ceb8] hover:text-[#00b5a1] font-medium transition-colors">Login</a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
