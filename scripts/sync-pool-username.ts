/**
 * One-off: rename pool/auction identity from OLD → NEW (same as changing login OLD→NEW).
 *
 * Usage (from repo root, DATABASE_URL in .env):
 *   npx tsx scripts/sync-pool-username.ts <oldName> <newName>
 *
 * Example after login was already set to BrianGlover but Owner is still "justin":
 *   npx tsx scripts/sync-pool-username.ts justin BrianGlover
 */
import 'dotenv/config'
import prisma from '../lib/prisma'
import { propagateUsernameChange } from '../lib/propagateUsernameChange'

const from = process.argv[2]?.trim()
const to = process.argv[3]?.trim()

if (!from || !to) {
  console.error('Usage: npx tsx scripts/sync-pool-username.ts <oldPoolName> <newPoolName>')
  process.exit(1)
}

async function main() {
  await prisma.$transaction(async (tx) => {
    await propagateUsernameChange(tx, from, to)
  })
  console.log(`Synced pool identity: "${from}" → "${to}"`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
