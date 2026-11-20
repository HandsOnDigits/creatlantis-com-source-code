import 'dotenv/config'
import { Temporal } from 'temporal-polyfill'
import postgres from '@prisma/orm-postgres/runtime'
import { contractFromJson } from '@prisma/orm-postgres/static'
import type { Contract } from './contract.d'
import contractJson from './contract.json' with { type: 'json' }

// The PostgreSQL date codec requires a global Temporal implementation.
Object.assign(globalThis, { Temporal })

export const contract = contractFromJson<Contract>(contractJson)

export const db = postgres({
  contract,
  url: process.env['DATABASE_URL']!,
})
