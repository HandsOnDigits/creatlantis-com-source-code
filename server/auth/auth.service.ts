import argon2 from 'argon2'
import { createHash, randomBytes } from 'node:crypto'
import { SignJWT } from 'jose'

import { db } from '../../src/prisma/db'
import type { LoginInput, RegisterInput } from './auth.schemas'

const jwtSecret = process.env['JWT_SECRET']

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters')
}

const secret = new TextEncoder().encode(jwtSecret)

const accessTokenTtl = process.env['ACCESS_TOKEN_TTL'] ?? '15m'
const refreshTokenTtlDays = Number(process.env['REFRESH_TOKEN_TTL_DAYS'] ?? 30)

if (
  !Number.isSafeInteger(refreshTokenTtlDays) ||
  refreshTokenTtlDays < 1 ||
  refreshTokenTtlDays > 365
) {
  throw new Error('REFRESH_TOKEN_TTL_DAYS must be between 1 and 365')
}

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

async function createAccessToken(userId: number): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setIssuer('creatlantis-api')
    .setAudience('creatlantis-web')
    .setIssuedAt()
    .setExpirationTime(accessTokenTtl)
    .sign(secret)
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'sqlState' in error &&
    error.sqlState === '23505'
  )
}

export async function registerUser(input: RegisterInput) {
  const passwordHash = await argon2.hash(input.password, {
    type: argon2.argon2id,
  })

  try {
    const user = await db.orm.public.User.create({
      email: input.email,
      username: input.username,
      name: input.name ?? null,
      nameIsPublic: false,
      passwordHash,
    })

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      createdAt: user.createdAt,
    }
  } catch (error) {
    throw error
  }
}

export async function refreshUserSession(refreshToken: string) {
  const oldHash = hashRefreshToken(refreshToken)

  // Find the existing session.
  const session = await db.orm.public.Session.where({
    refreshTokenHash: oldHash,
  })
    .select('id', 'userId', 'expiresAt')
    .first()

  if (!session) {
    return null
  }

  // Reject expired sessions.
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await db.orm.public.Session.where({
      id: session.id,
      refreshTokenHash: oldHash,
    }).delete()

    return null
  }

  // Make sure the associated user still exists.
  const user = await db.orm.public.User.where({ id: session.userId })
    .select('id', 'email', 'username', 'name')
    .first()

  if (!user) {
    return null
  }

  // Generate a completely new refresh token.
  const newRefreshToken = randomBytes(32).toString('base64url')
  const newHash = hashRefreshToken(newRefreshToken)

  const expiresAt = new Date(
    Date.now() + refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  )

  // Atomic compare-and-update: only one request can rotate this old token.
  const updatedSession = await db.orm.public.Session.where({
    id: session.id,
    refreshTokenHash: oldHash,
  }).update({
    refreshTokenHash: newHash,
    expiresAt: expiresAt.toISOString(),
  })

  if (!updatedSession) {
    return null
  }

  const accessToken = await createAccessToken(user.id)

  return {
    accessToken,
    refreshToken: newRefreshToken,
    expiresAt: expiresAt.toISOString(),
    user,
  }
}

export async function logoutUser(refreshToken: string | undefined) {
  if (!refreshToken) {
    return
  }

  const refreshTokenHash = hashRefreshToken(refreshToken)

  await db.orm.public.Session.where({ refreshTokenHash }).delete()
}

export async function loginUser(input: LoginInput) {
  const user = await db.orm.public.User.where({ email: input.email })
    .select('id', 'email', 'username', 'name', 'passwordHash')
    .first()

  if (!user?.passwordHash) {
    return null
  }

  const passwordMatches = await argon2.verify(user.passwordHash, input.password)

  if (!passwordMatches) {
    return null
  }

  const refreshToken = randomBytes(32).toString('base64url')
  const refreshTokenHash = hashRefreshToken(refreshToken)

  const expiresAt = new Date(
    Date.now() + refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  )

  await db.orm.public.Session.create({
    userId: user.id,
    refreshTokenHash,
    expiresAt: expiresAt.toISOString(),
  })

  const accessToken = await createAccessToken(user.id)

  return {
    accessToken,
    refreshToken,
    expiresAt: expiresAt.toISOString(),
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
    },
  }
}
