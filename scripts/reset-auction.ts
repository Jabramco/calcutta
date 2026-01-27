import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function resetAuction() {
  console.log('Resetting auction data...')

  // Delete all owners
  await prisma.owner.deleteMany()
  console.log('✓ Cleared all owners')

  // Reset all teams - remove owners, costs, and all round wins
  await prisma.team.updateMany({
    data: {
      ownerId: null,
      cost: 0,
      round64: false,
      round32: false,
      sweet16: false,
      elite8: false,
      final4: false,
      championship: false
    }
  })
  console.log('✓ Reset all team assignments, costs, and round wins')

  // Reset auction state
  const existingState = await prisma.auctionState.findFirst()
  if (existingState) {
    await prisma.auctionState.update({
      where: { id: existingState.id },
      data: {
        isActive: false,
        currentTeamId: null,
        currentBid: 0,
        currentBidder: null,
        bids: '[]',
        lastBidTime: null
      }
    })
  } else {
    await prisma.auctionState.create({
      data: {
        isActive: false,
        currentTeamId: null,
        currentBid: 0,
        currentBidder: null,
        bids: '[]',
        lastBidTime: null
      }
    })
  }
  console.log('✓ Reset auction state')

  // Verify
  const unassignedCount = await prisma.team.count({
    where: { ownerId: null }
  })
  console.log(`✓ ${unassignedCount} teams ready for auction`)

  console.log('\n🎉 Ready for auction day! All teams are unassigned and ready to bid on.')
}

resetAuction()
  .catch((e) => {
    console.error('Error resetting auction:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
