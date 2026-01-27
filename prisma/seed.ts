import { prisma } from '../lib/prisma'
import bcrypt from 'bcryptjs'

// NCAA Tournament 2026 Sample Data
const owners = [
  'Justin',
  'Ari',
  'Noah',
  'Sarah',
  'Mike',
  'Emily',
  'David',
  'Lisa',
  'Tom',
  'Rachel'
]

const regions = ['South', 'West', 'East', 'Midwest']

// Real NCAA teams for seeding
const teamNames = [
  // South Region
  'Duke', 'Florida State', 'Villanova', 'Memphis', 'Iowa State', 'Texas Tech', 'Clemson', 'Marquette',
  'Oklahoma', 'Utah', 'Nevada', 'Richmond', 'Charleston', 'Iona', 'Vermont', 'Fairleigh Dickinson',
  // West Region
  'Kansas', 'UCLA', 'Gonzaga', 'Northwestern', 'Saint Mary\'s', 'TCU', 'Michigan State', 'Maryland',
  'West Virginia', 'Boise State', 'NC State', 'Drake', 'Furman', 'UC Santa Barbara', 'Howard', 'Texas A&M Corpus Christi',
  // East Region
  'Purdue', 'Texas', 'Xavier', 'Virginia', 'Miami FL', 'Indiana', 'Iowa', 'Kentucky',
  'Auburn', 'Penn State', 'Pittsburgh', 'Providence', 'Oral Roberts', 'Louisiana', 'Montana State', 'Texas Southern',
  // Midwest Region
  'Houston', 'Arizona', 'Baylor', 'Alabama', 'San Diego State', 'Creighton', 'Missouri', 'USC',
  'Illinois', 'Arkansas', 'Arizona State', 'VCU', 'Akron', 'Grand Canyon', 'Colgate', 'Northern Kentucky'
]

async function main() {
  console.log('Starting seed...')

  // Clear existing data
  await prisma.team.deleteMany()
  await prisma.owner.deleteMany()
  await prisma.settings.deleteMany()
  await prisma.user.deleteMany()
  await prisma.auctionState.deleteMany()

  // Create admin user (you)
  const hashedPassword = await bcrypt.hash('admin123', 10) // Change this password!
  await prisma.user.create({
    data: {
      username: 'admin',
      password: hashedPassword,
      role: 'admin'
    }
  })
  console.log('Created admin user (username: admin, password: admin123)')

  // Create initial auction state
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
  console.log('Created initial auction state')

  // Create teams only (no owners assigned yet - that happens during auction)
  const teamsData = []
  let teamIndex = 0

  for (const region of regions) {
    for (let seed = 1; seed <= 16; seed++) {
      teamsData.push({
        name: teamNames[teamIndex],
        region,
        seed,
        ownerId: null,
        cost: 0,
        round64: false,
        round32: false,
        sweet16: false,
        elite8: false,
        final4: false,
        championship: false
      })
      
      teamIndex++
    }
  }

  // Create all teams
  for (const teamData of teamsData) {
    await prisma.team.create({
      data: teamData
    })
  }

  console.log(`Created ${teamsData.length} teams (ready for auction)`)

  // Create settings if needed
  await prisma.settings.create({
    data: {
      key: 'cap_amount',
      value: '200'
    }
  })

  console.log('Seed completed successfully!')
  console.log('🎉 All teams are ready for auction!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
