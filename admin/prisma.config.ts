import { config } from 'dotenv'
import { definePrismaConfig } from 'prisma/config'
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config'

config({ path: '.env.migrate' })

export default definePrismaConfig({
  orm: ormConfig({
    contract: './src/prisma/contract.prisma',
    db: {
      connection: process.env['DATABASE_URL']!,
    },
  }),
})
