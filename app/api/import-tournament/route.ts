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

    // Build a map of team wins by round
    const teamWins: Map<string, Set<string>> = new Map()

    // Get all teams from our database
    const teams = await prisma.team.findMany()

    // Process each game to build the win map
    for (const event of data.events) {
      if (!event.competitions?.[0]) continue
      
      const competition = event.competitions[0]
      const isCompleted = event.status?.type?.completed
      
      if (!isCompleted) continue

      // Check if this is actually a tournament game
      const isTournamentGame = event.season?.type === 3
      if (!isTournamentGame) continue

      // Check for tournament round info
      const notes = competition.notes || []
      let roundName = ''
      
      for (const note of notes) {
        if (note.headline) {
          const headline = note.headline.toLowerCase()
          for (const [key] of Object.entries(ROUND_MAP)) {
            if (headline.includes(key)) {
              roundName = key
              break
            }
          }
        }
        if (roundName) break
      }

      // If no round found in notes, try the event name
      if (!roundName && event.name) {
        const eventName = event.name.toLowerCase()
        for (const [key] of Object.entries(ROUND_MAP)) {
          if (eventName.includes(key)) {
            roundName = key
            break
          }
        }
      }

      if (!roundName) continue

      const roundKey = ROUND_MAP[roundName]
      if (!roundKey) continue

      // Find the winning team
      const competitors = competition.competitors || []
      const winner = competitors.find((c: any) => c.winner)
      
      if (!winner) continue

      const winnerName = winner.team.displayName || winner.team.shortDisplayName

      // Add this round win to the team's record
      if (!teamWins.has(winnerName)) {
        teamWins.set(winnerName, new Set())
      }
      teamWins.get(winnerName)!.add(roundKey)
      
      console.log(`${winnerName} won ${roundKey}`)
    }

    // Now update our database teams based on the accumulated wins
    let updatedTeams = 0
    const updates: string[] = []

    for (const [apiTeamName, rounds] of teamWins.entries()) {
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
        // Build the update data
        const updateData: any = {}
        
        // If they won the championship, they won all rounds
        if (rounds.has('championship')) {
          updateData.round64 = true
          updateData.round32 = true
          updateData.sweet16 = true
          updateData.elite8 = true
          updateData.final4 = true
          updateData.championship = true
        } else {
          // Otherwise, just mark the rounds they won
          if (rounds.has('round64')) updateData.round64 = true
          if (rounds.has('round32')) updateData.round32 = true
          if (rounds.has('sweet16')) updateData.sweet16 = true
          if (rounds.has('elite8')) updateData.elite8 = true
          if (rounds.has('final4')) updateData.final4 = true
        }

        // Update the team
        await prisma.team.update({
          where: { id: matchedTeam.id },
          data: updateData
        })

        updatedTeams++
        const roundsList = Array.from(rounds).join(', ')
        updates.push(`${matchedTeam.name}: ${roundsList}`)
        console.log(`Updated: ${matchedTeam.name} - ${roundsList}`)
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
