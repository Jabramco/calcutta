import prisma from '../lib/prisma'

async function makeAdmin() {
  const username = 'justin'
  
  const user = await prisma.user.update({
    where: { username },
    data: { role: 'admin' }
  })
  
  console.log(`✓ ${user.username} is now an admin!`)
}

makeAdmin()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
