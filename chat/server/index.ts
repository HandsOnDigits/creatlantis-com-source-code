import 'dotenv/config'

import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { db } from '../prisma/db.js'

import { notesRouter } from './notes/notes.routes.js'

const app = express()

const PORT = Number(process.env.CHAT_API_PORT ?? 3002)
const FRONTEND_ORIGIN =
  process.env.CHAT_FRONTEND_ORIGIN ?? 'http://localhost:5173'

app.disable('x-powered-by')

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  }),
)

app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())
app.use('/api/notes', notesRouter)

app.get('/api/health', async (_req, res) => {
  try {
    const query = db.raw.sql`
      SELECT 1 AS "ok"
    `
      .returnsRow({
        ok: 'pg/int4@1',
      })
      .build()

    await db.query(query)

    res.json({
      status: 'ok',
      service: 'creatlantis-chat-api',
      database: 'connected',
    })
  } catch (error) {
    console.error('Chat API health check failed:', error)

    res.status(503).json({
      status: 'error',
      service: 'creatlantis-chat-api',
      database: 'disconnected',
    })
  }
})

app.listen(PORT, () => {
  console.log(`CreAtlantis Chat API listening on port ${PORT}`)
})
