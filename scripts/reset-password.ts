import prisma from '../lib/prisma'
import bcrypt from 'bcryptjs'

/**
 * Reset (or create) a login user's password.
 *
 * Usage:
 *   npx tsx scripts/reset-password.ts <username> <newPassword> [role]
 *
 * Behavior:
 *   - If <username> already exists, its password is updated. Its existing role is kept
 *     unless an explicit [role] arg is given.
 *   - If <username> does NOT exist, it is created with role 'admin' (or [role] if given).
 *   - The password is bcrypt-hashed with cost 10 (matching prisma/seed.ts and the login route).
 *
 * Login matches the username EXACTLY (the API trims input, then does an exact lookup), so
 * this script operates on the exact username you pass. If a row exists with different
 * casing (e.g. "Justin" vs "justin"), it warns you — login is case-sensitive, so you must
 * reset the exact username people type to log in.
 *
 * To target PRODUCTION, set DATABASE_URL (and DIRECT_DATABASE_URL) to the prod values when
 * running — see the production instructions in the PR / SEED_PRODUCTION.md.
 */

const VALID_ROLES = ['admin', 'user'] as const
type Role = (typeof VALID_ROLES)[number]

function usageAndExit(message?: string): never {
  if (message) console.error(`Error: ${message}\n`)
  console.error('Usage: npx tsx scripts/reset-password.ts <username> <newPassword> [role]')
  console.error('  <username>     login username (exact match; case-sensitive)')
  console.error('  <newPassword>  new password to set')
  console.error('  [role]         optional: "admin" or "user" (default for NEW users: admin;')
  console.error('                 for EXISTING users: keep current role unless provided)')
  process.exit(1)
}

async function main() {
  const [, , usernameArg, newPassword, roleArg] = process.argv

  const username = typeof usernameArg === 'string' ? usernameArg.trim() : ''
  if (!username) usageAndExit('missing <username>')
  if (!newPassword) usageAndExit('missing <newPassword>')

  let role: Role | undefined
  if (roleArg !== undefined) {
    if (!(VALID_ROLES as readonly string[]).includes(roleArg)) {
      usageAndExit(`invalid role "${roleArg}" (expected one of: ${VALID_ROLES.join(', ')})`)
    }
    role = roleArg as Role
  }

  // Does an exact-match row already exist? (Login uses exact match, so that's what we report on.)
  const existing = await prisma.user.findUnique({ where: { username } })

  // Heads-up if a case-variant exists — login is case-sensitive, so a mismatched-case row
  // won't let someone log in as the casing they type.
  if (!existing) {
    const caseVariant = await prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } }
    })
    if (caseVariant) {
      console.warn(
        `⚠ No user named exactly "${username}", but a user "${caseVariant.username}" exists ` +
          `with different casing. Login is case-sensitive (exact match), so this will CREATE ` +
          `a separate "${username}" account. Re-run with that exact username if you meant to ` +
          `reset the existing one.`
      )
    }
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10)

  const user = await prisma.user.upsert({
    where: { username },
    update: { password: hashedPassword, ...(role ? { role } : {}) },
    create: { username, password: hashedPassword, role: role ?? 'admin' }
  })

  const action = existing ? 'Updated' : 'Created'
  console.log(`✓ ${action} login for username "${user.username}".`)
  console.log(`  Password: set (bcrypt cost 10).`)
  console.log(`  Role: ${user.role}.`)
  if (existing && !role) {
    console.log('  (Existing role kept — pass a [role] arg to change it.)')
  }
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
