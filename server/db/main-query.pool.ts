import 'dotenv/config'

import { Pool } from 'pg'

const databaseUrl = process.env['DATABASE_URL']

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not configured')
}

const mainQueryPool = new Pool({
  connectionString: databaseUrl,
  max: 3,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 5000,
  query_timeout: 6000,
  application_name: 'creatlantis-public-api-directory',
})

export { mainQueryPool }

export async function closeMainQueryPool(): Promise<void> {
  await mainQueryPool.end()
}
