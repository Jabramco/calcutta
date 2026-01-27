import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// NCAA API endpoint - using the correct structure
const NCAA_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball'

interface ESPNGame {
  id: string
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

    // Track updates
    let updatedTeams = 0
    const updates: string[] = []

    // Get all teams from our database
    const teams = await prisma.team.findMany()

    // Process each game
    for (const event of data.events) {
      if (!event.competitions?.[0]) continue
      
      const competition = event.competitions[0]
      const isCompleted = event.status?.type?.completed
      
      if (!isCompleted) continue

      // Check for tournament round info in notes
      const notes = competition.notes || []
      let roundName = ''
      
      for (const note of notes) {
        if (note.headline) {
          const headline = note.headline.toLowerCase()
          for (const [key, field] of Object.entries(ROUND_MAP)) {
            if (headline.includes(key)) {
              roundName = key
              break
            }
          }
        }
        if (roundName) break
      }

      if (!roundName) continue

      const roundKey = ROUND_MAP[roundName]
      if (!roundKey) continue

      // Find the winning team
      const competitors = competition.competitors || []
      const winner = competitors.find(c => c.winner)
      
      if (!winner) continue

      const winnerName = winner.team.displayName || winner.team.shortDisplayName

      // Try to match with our teams
      const matchedTeam = teams.find((team) => {
        const teamNameLower = team.name.toLowerCase()
        const winnerNameLower = winnerName.toLowerCase()
        
        return (
          teamNameLower === winnerNameLower ||
          teamNameLower.includes(winnerNameLower) ||
          winnerNameLower.includes(teamNameLower)
        )
      })

      if (matchedTeam) {
        // Update the team's round win
        await prisma.team.update({
          where: { id: matchedTeam.id },
          data: { [roundKey]: true }
        })

        updatedTeams++
        updates.push(`${matchedTeam.name} won ${roundKey} (${roundName})`)
        console.log(`Updated: ${matchedTeam.name} - ${roundKey}`)
      } else {
        console.log(`No match found for: ${winnerName} in round: ${roundName}`)
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
