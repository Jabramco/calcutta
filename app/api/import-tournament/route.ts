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

    // Filter and sort tournament games by date
    const tournamentGames = data.events
      .filter((event: any) => event.season?.type === 3 && event.status?.type?.completed)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())

    console.log(`Found ${tournamentGames.length} completed tournament games`)

    // Track winners at each stage to build the bracket
    const teamWins: Map<string, Set<string>> = new Map() // team name -> set of rounds won
    
    // Round order for progression
    const roundOrder = ['round64', 'round32', 'sweet16', 'elite8', 'final4', 'championship']

    // Get all teams from our database
    const teams = await prisma.team.findMany()

    // Process games and count wins per team
    const teamGameCount: Map<string, number> = new Map()

    for (const event of tournamentGames) {
      if (!event.competitions?.[0]) continue
      
      const competition = event.competitions[0]
      const competitors = competition.competitors || []
      
      if (competitors.length !== 2) continue

      const winner = competitors.find((c: any) => c.winner)
      if (!winner) continue

      const winnerName = winner.team.displayName || winner.team.shortDisplayName
      
      // Count games won
      const currentCount = teamGameCount.get(winnerName) || 0
      teamGameCount.set(winnerName, currentCount + 1)
    }

    console.log('\n=== Game Win Counts ===')
    // Convert to array and sort by wins
    const sortedTeams = Array.from(teamGameCount.entries())
      .sort((a, b) => b[1] - a[1])
    
    for (const [team, wins] of sortedTeams) {
      console.log(`${team}: ${wins} wins`)
    }

    // Map wins to rounds:
    // 1 win = won round64 only
    // 2 wins = won round64 + round32
    // 3 wins = won round64 + round32 + sweet16
    // 4 wins = won round64 + round32 + sweet16 + elite8
    // 5 wins = won round64 + round32 + sweet16 + elite8 + final4
    // 6 wins = won all rounds including championship
    for (const [teamName, winCount] of teamGameCount.entries()) {
      const rounds = new Set<string>()
      
      // Mark rounds based on number of wins
      for (let i = 0; i < Math.min(winCount, 6); i++) {
        rounds.add(roundOrder[i])
      }
      
      if (rounds.size > 0) {
        teamWins.set(teamName, rounds)
      }
    }

    console.log('\n=== Final Team Progress ===')
    // Find the champion (6 wins)
    let championName = ''
    for (const [team, rounds] of teamWins.entries()) {
      const roundsList = Array.from(rounds).sort((a, b) => 
        roundOrder.indexOf(a) - roundOrder.indexOf(b)
      )
      console.log(`${team}: ${roundsList.join(', ')}`)
      
      if (rounds.has('championship')) {
        championName = team
        console.log(`  *** CHAMPION ***`)
      }
    }

    // Verify only one champion
    const championCount = Array.from(teamWins.values())
      .filter(rounds => rounds.has('championship')).length
    
    if (championCount !== 1) {
      console.warn(`WARNING: Found ${championCount} champions, expected exactly 1`)
    }

    // Now update our database teams
    let updatedTeams = 0
    const updates: string[] = []

    for (const [apiTeamName, wonRounds] of teamWins.entries()) {
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
        const updateData: any = {
          round64: wonRounds.has('round64'),
          round32: wonRounds.has('round32'),
          sweet16: wonRounds.has('sweet16'),
          elite8: wonRounds.has('elite8'),
          final4: wonRounds.has('final4'),
          championship: wonRounds.has('championship')
        }

        // Update the team
        await prisma.team.update({
          where: { id: matchedTeam.id },
          data: updateData
        })

        updatedTeams++
        const winCount = wonRounds.size
        updates.push(`${matchedTeam.name}: ${winCount} win${winCount !== 1 ? 's' : ''}`)
        console.log(`Updated: ${matchedTeam.name} - ${wonRounds.size} tournament wins`)
      } else {
        console.log(`No match found for: ${apiTeamName}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${year} tournament results`,
      champion: championName,
      tournamentGames: tournamentGames.length,
      updatedTeams,
      updates: updates.slice(0, 20)
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
