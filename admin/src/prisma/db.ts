import 'dotenv/config'

import postgres from '@prisma/orm-postgres/runtime'
import { contractFromJson } from '@prisma/orm-postgres/static'

import type { Contract } from './contract.d'
import contractJson from './contract.json' with { type: 'json' }

const databaseUrl = process.env['ADMIN_DATABASE_URL']

if (!databaseUrl) {
  throw new Error('ADMIN_DATABASE_URL is not configured.')
}

const databaseName = decodeURIComponent(
  new URL(databaseUrl).pathname.replace(/^\/+/, ''),
)

if (databaseName !== 'creatlantis_admin') {
  throw new Error(
    'Admin API must connect exclusively to the creatlantis_admin database.',
  )
}

export const contract = contractFromJson<Contract>(contractJson)

export const db = postgres({
  contract,
  url: databaseUrl,
})
