import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runTournamentImport } from '@/lib/tournamentImport'

export async function POST(request: Request) {
  try {
    const { year } = await request.json()
    const y = Number(year)

    if (!year || Number.isNaN(y) || y < 2000 || y > 2100) {
      return NextResponse.json({ error: 'Valid year is required' }, { status: 400 })
    }

    const result = await runTournamentImport(y)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: result.status }
      )
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      champion: result.champion,
      tournamentGames: result.tournamentGames,
      updatedTeams: result.updatedTeams,
      updatedNames: result.updatedNames,
      updates: result.updates
    })
  } catch (error: unknown) {
    const err = error as { message?: string; stack?: string }
    console.error('Error importing tournament data:', error)
    console.error('Error stack:', err?.stack)
    return NextResponse.json(
      { error: 'Failed to import tournament data', details: err?.message },
      { status: 500 }
    )
  }
}

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
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Error resetting tournament results:', error)
    return NextResponse.json(
      { error: 'Failed to reset tournament results', details: err?.message },
      { status: 500 }
    )
  }
}
