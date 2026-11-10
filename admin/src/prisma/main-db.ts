import 'dotenv/config'

import postgres from '@prisma/orm-postgres/runtime'
import { contractFromJson } from '@prisma/orm-postgres/static'

import type { Contract } from '../../../src/prisma/contract.d'
import contractJson from '../../../src/prisma/contract.json' with { type: 'json' }

const databaseUrl = process.env['MAIN_DATABASE_URL']

if (!databaseUrl) {
  throw new Error('MAIN_DATABASE_URL is not configured.')
}

const databaseName = decodeURIComponent(
  new URL(databaseUrl).pathname.replace(/^\/+/, ''),
)

if (databaseName !== 'creatlantis') {
  throw new Error(
    'Admin moderation service must connect exclusively to the creatlantis database.',
  )
}

export const mainContract = contractFromJson<Contract>(contractJson)

export const mainDb = postgres({
  contract: mainContract,
  url: databaseUrl,
})
