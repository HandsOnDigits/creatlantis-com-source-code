import { createHash, randomBytes } from 'node:crypto'
import { db } from '../src/prisma/db'

async function main() {
  const daysArgument = process.argv[2]
  let expiresAt: string | null = null

  if (daysArgument !== undefined) {
    const days = Number(daysArgument)

    if (!Number.isSafeInteger(days) || days < 1 || days > 3650) {
      throw new Error('Expiration must be between 1 and 3650 days')
    }

    expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
  }

  const inviteKey = randomBytes(32).toString('base64url')
  const keyHash = createHash('sha256').update(inviteKey).digest('hex')

  await db.orm.public.InviteKey.create({
    keyHash,
    expiresAt,
  })

  console.log('\nInvite key created successfully.\n')
  console.log(inviteKey)
  console.log(
    '\nCopy and distribute this key now. It cannot be retrieved later.',
  )
  console.log(
    expiresAt ? `Expires: ${expiresAt}` : 'Expiration: none (valid until used)',
  )
}

main().catch((error: unknown) => {
  console.error('Failed to create invite key:', error)
  process.exitCode = 1
})
