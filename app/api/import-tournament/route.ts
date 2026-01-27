import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// NCAA API endpoint
const NCAA_API_BASE = 'https://ncaa-api.henrygd.me'

interface NCAATournamentGame {
  game: {
    gameID: string
    gameState: string
    home: {
      names: {
        full: string
      }
      winner: boolean
      seed: string
    }
    away: {
      names: {
        full: string
      }
      winner: boolean
      seed: string
    }
    bracketRound: string
    startDate: string
  }
}

// Map NCAA API round names to our database fields
const ROUND_MAP: Record<string, keyof typeof prisma.team.fields> = {
  '1': 'round64',
  '2': 'round32',
  '3': 'sweet16',
  '4': 'elite8',
  '5': 'final4',
  '6': 'championship'
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

    // Fetch March Madness games for the specified year
    // The tournament runs from mid-March to early April
    const marchGames = await fetch(`${NCAA_API_BASE}/scoreboard/basketball-men/d1/${year}/03`)
    const aprilGames = await fetch(`${NCAA_API_BASE}/scoreboard/basketball-men/d1/${year}/04`)

    if (!marchGames.ok || !aprilGames.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch tournament data from NCAA API' },
        { status: 500 }
      )
    }

    const marchData = await marchGames.json()
    const aprilData = await aprilGames.json()

    // Combine all games
    const allGames: NCAATournamentGame[] = [
      ...(marchData.games || []),
      ...(aprilData.games || [])
    ]

    // Filter for tournament games only (those with bracketRound)
    const tournamentGames = allGames.filter(
      (item) => item.game?.bracketRound && item.game.gameState === 'final'
    )

    if (tournamentGames.length === 0) {
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

    // Process each tournament game
    for (const item of tournamentGames) {
      const { game } = item
      const roundKey = ROUND_MAP[game.bracketRound]

      if (!roundKey) continue

      // Find the winning team
      const winnerName = game.home.winner ? game.home.names.full : game.away.names.full

      // Try to match with our teams (case-insensitive, partial match)
      const matchedTeam = teams.find((team) => {
        const teamNameLower = team.name.toLowerCase()
        const winnerNameLower = winnerName.toLowerCase()
        
        // Check for exact match or if one contains the other
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
        updates.push(`${matchedTeam.name} won ${roundKey}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${year} tournament results`,
      tournamentGames: tournamentGames.length,
      updatedTeams,
      updates
    })
  } catch (error: any) {
    console.error('Error importing tournament data:', error)
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
