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

const COUNTDOWN_INTERVAL = 5000 // 5 seconds between warnings

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
  const currentTeamIdRef = useRef<number | null>(null)
  const lastAnnouncedTeamId = useRef<number | null>(null)
  const lastBidCount = useRef<number>(0)
  const hasAutoSold = useRef<boolean>(false)
  const [isInitialized, setIsInitialized] = useState(false)

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
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Only scroll if we're initialized and there are messages
    if (isInitialized && chatMessages.length > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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

    // If there's no lastBidTime yet (team just selected, no bids), don't show warnings
    // but still run the timer so users know bidding is open
    if (!auctionState.lastBidTime) {
      setCountdown(null)
      setWarningState('none')
      return
    }

    // Reset warning tracker if it's a new team
    if (currentTeamIdRef.current !== auctionState.currentTeam.id) {
      currentTeamIdRef.current = auctionState.currentTeam.id
      lastAnnouncedWarning.current = 'none'
      setWarningState('none')
      hasAutoSold.current = false
    }

    const now = Date.now()
    const elapsed = now - auctionState.lastBidTime
    const remaining = COUNTDOWN_INTERVAL - (elapsed % COUNTDOWN_INTERVAL)
    setCountdown(remaining)

    // Determine warning state and announce ONCE per state change
    if (elapsed >= COUNTDOWN_INTERVAL * 3) {
      // Auto-sell after "going twice" - but only if there's a valid bid
      if (!hasAutoSold.current && auctionState.currentBid > 0 && auctionState.currentBidder) {
        autoSoldTeam()
      }
    } else if (elapsed >= COUNTDOWN_INTERVAL * 2) {
      if (lastAnnouncedWarning.current !== 'twice') {
        setWarningState('twice')
        lastAnnouncedWarning.current = 'twice'
        addChatMessage({
          type: 'warning',
          message: '⚠️ Going TWICE!',
          timestamp: Date.now()
        })
      }
    } else if (elapsed >= COUNTDOWN_INTERVAL) {
      if (lastAnnouncedWarning.current === 'none') {
        setWarningState('once')
        lastAnnouncedWarning.current = 'once'
        addChatMessage({
          type: 'warning',
          message: '⚠️ Going once!',
          timestamp: Date.now()
        })
      }
    } else {
      // Reset state if time goes back (new bid placed)
      if (lastAnnouncedWarning.current !== 'none') {
        setWarningState('none')
        lastAnnouncedWarning.current = 'none'
        hasAutoSold.current = false
      }
    }
  }, [auctionState?.lastBidTime, auctionState?.currentTeam, countdown])

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
      
      // Check if new team was announced - only announce if we haven't already announced this team ID
      if (data.currentTeam && data.currentTeam.id !== lastAnnouncedTeamId.current) {
        lastAnnouncedTeamId.current = data.currentTeam.id
        currentTeamIdRef.current = data.currentTeam.id
        setWarningState('none')
        lastAnnouncedWarning.current = 'none'
        hasAutoSold.current = false
        lastBidCount.current = 0
        addChatMessage({
          type: 'bot',
          message: `Now auctioning: ${data.currentTeam.name} - ${data.currentTeam.region} Region, Seed #${data.currentTeam.seed}`,
          timestamp: Date.now()
        })
      }

      // Check for new bids - only announce if bid count increased
      if (data.bids && data.bids.length > lastBidCount.current) {
        const newBids = data.bids.slice(lastBidCount.current)
        lastBidCount.current = data.bids.length
        newBids.forEach((bid: any) => {
          setWarningState('none')
          lastAnnouncedWarning.current = 'none' // Reset warnings on new bid
          hasAutoSold.current = false // Reset auto-sell on new bid
          addChatMessage({
            type: 'bid',
            message: `${bid.bidder} bids ${formatCurrency(bid.amount)}!`,
            timestamp: bid.timestamp,
            bidder: bid.bidder,
            amount: bid.amount
          })
        })
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
        localStorage.removeItem('auctionChatHistory')
        
        addChatMessage({
          type: 'system',
          message: 'Auction started! First team selected randomly...',
          timestamp: Date.now()
        })
        await fetchAuctionState()
      }
    } catch (error) {
      console.error('Error starting auction:', error)
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
          message: '🎲 Selecting next team randomly...',
          timestamp: Date.now()
        })
        await fetchAuctionState()
      }
    } catch (error) {
      console.error('Error getting next team:', error)
    } finally {
      setLoading(false)
    }
  }

  const placeBid = async () => {
    if (!currentUser || !bidAmount) return

    const amount = parseFloat(bidAmount)
    if (isNaN(amount) || amount <= (auctionState?.currentBid || 0)) {
      alert(`Bid must be higher than current bid of ${formatCurrency(auctionState?.currentBid || 0)}`)
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
    if (!auctionState?.currentBidder || auctionState.currentBid === 0) return
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
        addChatMessage({
          type: 'sold',
          message: `🎊 SOLD to ${auctionState?.currentBidder} for ${formatCurrency(auctionState?.currentBid || 0)}!`,
          timestamp: Date.now()
        })
        
        // Reset state for next team
        lastAnnouncedWarning.current = 'none'
        setWarningState('none')
        lastAnnouncedTeamId.current = null // Force re-announcement of next team
        lastBidCount.current = 0
        
        if (data.remainingTeams > 0) {
          addChatMessage({
            type: 'system',
            message: `📊 ${data.remainingTeams} teams remaining. Next team coming up...`,
            timestamp: Date.now()
          })
        } else {
          addChatMessage({
            type: 'system',
            message: '🏁 Auction complete! All teams have been sold!',
            timestamp: Date.now()
          })
        }
        
        await fetchAuctionState()
        await fetchStats()
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
        localStorage.removeItem('auctionChatHistory')
        
        // Reset refs
        lastAnnouncedTeamId.current = null
        lastBidCount.current = 0
        lastAnnouncedWarning.current = 'none'
        hasAutoSold.current = false
        currentTeamIdRef.current = null
        
        addChatMessage({
          type: 'system',
          message: '🔄 Auction has been restarted! All data cleared.',
          timestamp: Date.now()
        })
        
        // Refresh data
        await fetchAuctionState()
        await fetchStats()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to restart auction')
      }
    } catch (error) {
      console.error('Error restarting auction:', error)
      alert('Failed to restart auction')
    } finally {
      setLoading(false)
    }
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
        <h1 className="text-3xl font-bold text-white">Live Auction</h1>
        <div className="text-right">
          <div className="text-sm text-[#a0a0b8]">Current Prize Pool</div>
          <div className="text-2xl font-bold text-[#00ceb8]">{formatCurrency(totalPot)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Team Card */}
        <div className="lg:col-span-1">
          <div className="glass-card rounded-2xl p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-white">Current Team</h2>
            
            {auctionState?.isActive && auctionState.currentTeam ? (
              <div>
                <div className="mb-4 p-4 glass-input rounded-xl">
                  <div className="text-3xl font-bold text-white mb-2">{auctionState.currentTeam.name}</div>
                  <div className="text-sm text-[#a0a0b8]">
                    {auctionState.currentTeam.region} Region • Seed #{auctionState.currentTeam.seed}
                  </div>
                </div>

                <div className="border-t border-[#2a2a38] pt-4 mb-4">
                  <div className="text-sm text-[#a0a0b8] mb-1">Current Bid</div>
                  <div className="text-4xl font-bold text-[#00ceb8]">
                    {formatCurrency(auctionState.currentBid)}
                  </div>
                  {auctionState.currentBidder && (
                    <div className="text-sm text-[#a0a0b8] mt-2">
                      Leading: <span className="font-bold text-white">{auctionState.currentBidder}</span>
                    </div>
                  )}
                </div>

                {countdown !== null && auctionState.currentBid > 0 && (
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
              </div>
            ) : auctionState?.isActive && !auctionState.currentTeam ? (
              <div className="text-center py-8">
                <div className="text-[#a0a0b8] mb-4">{teamsRemaining} teams remaining</div>
                <button
                  onClick={nextTeam}
                  disabled={loading}
                  className="btn-gradient-primary px-6 py-3 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
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
          </div>

          {/* Auction Controls - Admin Only */}
          {currentUser?.role === 'admin' && (
            <div className="glass-card rounded-2xl p-6">
              <h2 className="text-xl font-semibold mb-4 text-white">Controls</h2>
              
              <div className="space-y-3">
                {!auctionState?.isActive ? (
                  <button
                    onClick={startAuction}
                    disabled={loading}
                    className="btn-gradient-primary w-full px-4 py-3 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    Start Auction
                  </button>
                ) : auctionState.currentTeam ? (
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
                      className="btn-gradient-danger w-full px-4 py-2 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                    >
                      Pause Auction
                    </button>
                  </>
                ) : (
                  <button
                    onClick={stopAuction}
                    disabled={loading}
                    className="btn-gradient-danger w-full px-4 py-2 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    Stop Auction
                  </button>
                )}
                
                {/* Restart button - admin only */}
                <button
                  onClick={restartAuction}
                  disabled={loading}
                  className="btn-gradient-secondary w-full px-4 py-2 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  Restart Auction
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Chat & Bidding */}
        <div className="lg:col-span-2">
          <div className="glass-card rounded-2xl flex flex-col" style={{ height: '600px' }}>
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
                <div className="flex gap-2">
                  <div className="flex-1 px-4 py-2 glass-input rounded-xl text-white flex items-center">
                    Bidding as: <span className="font-bold ml-2">{currentUser.username}</span>
                  </div>
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder="Bid amount"
                    className="w-32 px-4 py-2 glass-input rounded-xl text-white placeholder-[#6a6a82] focus:outline-none focus:ring-2 focus:ring-[#00ceb8] focus:border-transparent transition-all"
                    disabled={!auctionState?.currentTeam}
                    step="0.01"
                    min={(auctionState?.currentBid || 0) + 0.01}
                    onKeyPress={(e) => e.key === 'Enter' && placeBid()}
                  />
                  <button
                    onClick={placeBid}
                    disabled={loading || !auctionState?.currentTeam || !bidAmount}
                    className="btn-gradient-primary px-6 py-2 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    Bid
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
