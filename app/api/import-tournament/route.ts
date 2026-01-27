import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// NCAA API endpoint - using the correct structure
const NCAA_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball'

interface ESPNGame {
  id: string
  name?: string
  season?: {
    type?: number
  }
  status: {
    type: {
      completed: boolean
    }
  }
  competitions: Array<{
    competitors: Array<{
      team: {
        displayName: string
        shortDisplayName: string
      }
      winner: boolean
      seed?: number
    }>
    notes?: Array<{
      headline?: string
    }>
  }>
}

// Map round names to our database fields
const ROUND_MAP: Record<string, keyof typeof prisma.team.fields> = {
  'first round': 'round64',
  'round of 64': 'round64',
  'second round': 'round32',
  'round of 32': 'round32',
  'sweet 16': 'sweet16',
  'sweet sixteen': 'sweet16',
  'elite 8': 'elite8',
  'elite eight': 'elite8',
  'final four': 'final4',
  'semifinals': 'final4',
  'championship': 'championship',
  'final': 'championship'
}

export async function POST(request: Request) {
  try {
    const { year } = await request.json()
    
    if (!year) {
      return NextResponse.json(
        { error: 'Year is required' },
        { status: 400 }
      )
    }

    console.log(`Fetching tournament data for ${year}...`)

    // Fetch tournament games - ESPN API groups tournament ID by year
    // 2024 tournament would be around March-April 2024
    const tournamentUrl = `${NCAA_API_BASE}/scoreboard?limit=100&dates=${year}0315-${year}0410&groups=100`
    
    console.log(`Fetching from: ${tournamentUrl}`)
    
    const response = await fetch(tournamentUrl)

    if (!response.ok) {
      console.error(`ESPN API returned status: ${response.status}`)
      const errorText = await response.text()
      console.error('Error response:', errorText)
      return NextResponse.json(
        { error: `Failed to fetch tournament data: ${response.status}` },
        { status: 500 }
      )
    }

    const data = await response.json()
    console.log(`Received ${data.events?.length || 0} events`)

    if (!data.events || data.events.length === 0) {
      return NextResponse.json(
        { error: 'No tournament games found for this year' },
        { status: 404 }
      )
    }

    // Track the deepest round each team reached
    const teamProgress: Map<string, string> = new Map()
    
    // Round order for progression
    const roundOrder = ['round64', 'round32', 'sweet16', 'elite8', 'final4', 'championship']

    // Get all teams from our database
    const teams = await prisma.team.findMany()

    console.log('Starting to process games...')

    // Process each game to determine team progress
    for (const event of data.events) {
      if (!event.competitions?.[0]) continue
      
      const competition = event.competitions[0]
      const isCompleted = event.status?.type?.completed
      
      if (!isCompleted) continue

      // Check if this is actually a tournament game (postseason type 3)
      const isTournamentGame = event.season?.type === 3
      if (!isTournamentGame) {
        console.log(`Skipping non-tournament: ${event.name}`)
        continue
      }

      // Debug: log the event to see what data we have
      console.log(`\nProcessing game: ${event.name}`)
      console.log(`  Date: ${event.date}`)
      if (competition.notes) {
        console.log(`  Notes: ${JSON.stringify(competition.notes)}`)
      }

      // Identify the round - check multiple places
      let roundName = ''
      let roundKey = ''
      
      // First check notes
      const notes = competition.notes || []
      for (const note of notes) {
        if (note.headline) {
          const headline = note.headline.toLowerCase()
          console.log(`  Checking note headline: ${headline}`)
          for (const [key] of Object.entries(ROUND_MAP)) {
            if (headline.includes(key)) {
              roundName = key
              roundKey = ROUND_MAP[key]
              break
            }
          }
        }
        if (roundKey) break
      }

      // Then check event name
      if (!roundKey && event.name) {
        const eventName = event.name.toLowerCase()
        console.log(`  Checking event name: ${eventName}`)
        for (const [key] of Object.entries(ROUND_MAP)) {
          if (eventName.includes(key)) {
            roundName = key
            roundKey = ROUND_MAP[key]
            break
          }
        }
      }

      if (!roundKey) {
        console.log(`  ❌ Could not identify round for: ${event.name}`)
        continue
      }

      console.log(`  ✓ Identified as: ${roundKey} (${roundName})`)

      // Get both teams and the winner
      const competitors = competition.competitors || []
      if (competitors.length !== 2) {
        console.log(`  ❌ Invalid number of competitors: ${competitors.length}`)
        continue
      }

      const winner = competitors.find((c: any) => c.winner)
      const loser = competitors.find((c: any) => !c.winner)
      
      if (!winner || !loser) {
        console.log(`  ❌ Could not identify winner/loser`)
        continue
      }

      const winnerName = winner.team.displayName || winner.team.shortDisplayName
      const loserName = loser.team.displayName || loser.team.shortDisplayName

      console.log(`  Winner: ${winnerName}`)
      console.log(`  Loser: ${loserName}`)

      // Winner WON this round - mark this as their latest win
      const currentRoundIndex = roundOrder.indexOf(roundKey)
      const existingRoundIndex = teamProgress.has(winnerName) 
        ? roundOrder.indexOf(teamProgress.get(winnerName)!) 
        : -1
      
      // Update if this is a deeper round
      if (currentRoundIndex > existingRoundIndex) {
        teamProgress.set(winnerName, roundKey)
        console.log(`  → ${winnerName} WON ${roundKey}`)
      }

      // Loser LOST this round, so their last win was the previous round
      if (currentRoundIndex > 0) {
        const previousRound = roundOrder[currentRoundIndex - 1]
        const existingLoserIndex = teamProgress.has(loserName) 
          ? roundOrder.indexOf(teamProgress.get(loserName)!) 
          : -1
        
        // Only update if they haven't progressed further already
        if (currentRoundIndex - 1 > existingLoserIndex) {
          teamProgress.set(loserName, previousRound)
          console.log(`  → ${loserName} last win: ${previousRound}`)
        }
      } else {
        // Lost in round64 means they won nothing
        if (!teamProgress.has(loserName)) {
          console.log(`  → ${loserName} eliminated in first round (no wins)`)
        }
      }
    }

    console.log(`\n=== Final Team Progress ===`)
    for (const [team, round] of teamProgress.entries()) {
      console.log(`${team}: ${round}`)
    }

    // Now update our database teams based on how far they progressed
    let updatedTeams = 0
    const updates: string[] = []

    for (const [apiTeamName, deepestRound] of teamProgress.entries()) {
      // Try to match with our teams
      const matchedTeam = teams.find((team) => {
        const teamNameLower = team.name.toLowerCase()
        const apiNameLower = apiTeamName.toLowerCase()
        
        return (
          teamNameLower === apiNameLower ||
          teamNameLower.includes(apiNameLower) ||
          apiNameLower.includes(teamNameLower)
        )
      })

      if (matchedTeam) {
        // Mark all rounds they WON (up to and including their deepest round won)
        const deepestIndex = roundOrder.indexOf(deepestRound)
        const updateData: any = {
          round64: false,
          round32: false,
          sweet16: false,
          elite8: false,
          final4: false,
          championship: false
        }
        
        // Mark all rounds they actually won
        for (let i = 0; i <= deepestIndex; i++) {
          updateData[roundOrder[i]] = true
        }

        // Update the team
        await prisma.team.update({
          where: { id: matchedTeam.id },
          data: updateData
        })

        updatedTeams++
        updates.push(`${matchedTeam.name} won through ${deepestRound}`)
        console.log(`Updated: ${matchedTeam.name} - won through ${deepestRound}`)
      } else {
        console.log(`No match found for: ${apiTeamName}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${year} tournament results`,
      tournamentGames: data.events.length,
      updatedTeams,
      updates: updates.slice(0, 20) // Limit to first 20 for display
    })
  } catch (error: any) {
    console.error('Error importing tournament data:', error)
    console.error('Error stack:', error?.stack)
    return NextResponse.json(
      { error: 'Failed to import tournament data', details: error?.message },
      { status: 500 }
    )
  }
}

// Reset all tournament results
export async function DELETE() {
  try {
    await prisma.team.updateMany({
      data: {
        round64: false,
        round32: false,
        sweet16: false,
        elite8: false,
        final4: false,
        championship: false
      }
    })

    return NextResponse.json({
      success: true,
      message: 'All tournament results have been reset'
    })
  } catch (error: any) {
    console.error('Error resetting tournament results:', error)
    return NextResponse.json(
      { error: 'Failed to reset tournament results', details: error?.message },
      { status: 500 }
    )
  }
}
