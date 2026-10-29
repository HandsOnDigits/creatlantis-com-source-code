import 'dotenv/config'
import express from 'express'
import { db } from '../src/prisma/db'
import { z } from 'zod'

const app = express()
const port = Number(process.env['API_PORT'] ?? 3000)

app.disable('x-powered-by')
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', async (_req, res) => {
  try {
    await db.connect()
    res.json({ status: 'ok', database: 'connected' })
  } catch {
    res.status(503).json({ status: 'error', database: 'unavailable' })
  }
})

app.get('/api/users', async (_req, res) => {
  try {
    const users = await db.orm.public.User.select(
      'id',
      'username',
      'name',
      'createdAt',
    )
      .orderBy((user) => user.id.asc())
      .limit(100)
      .all()

    res.json({ data: users })
  } catch (error) {
    console.error('Failed to fetch users:', error)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

const createUserSchema = z.object({
  email: z.string().trim().email().max(254),
  username: z.string().trim().min(1).max(50).optional(),
  name: z.string().trim().min(1).max(100).optional(),
})

app.post('/api/users', async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid user data',
      details: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    })
    return
  }

  try {
    const user = await db.orm.public.User.create({
      email: parsed.data.email,
      username: parsed.data.username ?? null,
      name: parsed.data.name ?? null,
    })

    res.status(201).json({
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        createdAt: user.createdAt,
      },
    })
  } catch (error) {
    console.error('Failed to create user:', error)

    res.status(500).json({
      error: 'Failed to create user',
    })
  }
})

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})

async function shutdown() {
  server.close(async () => {
    await db.close()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
