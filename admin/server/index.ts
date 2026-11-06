import 'dotenv/config'

import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { rateLimit } from 'express-rate-limit'
import { db } from '../src/prisma/db'

import authRoutes from './auth/auth.routes'
import mfaRoutes from './auth/mfa.routes'

const app = express()

const PORT = Number(process.env['ADMIN_API_PORT'] ?? 3001)
const FRONTEND_ORIGIN =
  process.env['ADMIN_FRONTEND_ORIGIN'] ?? 'http://localhost:5174'

app.disable('x-powered-by')

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  }),
)

app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please try again later.',
  },
})

app.use('/api', apiLimiter)
app.use('/api/auth', authRoutes)
app.use('/api/mfa', mfaRoutes)

app.get('/api/health', async (_req, res, next) => {
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
      service: 'creatlantis-admin-api',
      database: 'connected',
    })
  } catch (error) {
    next(error)
  }
})

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error('Admin API error:', err)

    res.status(500).json({
      error: 'Internal server error.',
    })
  },
)

app.listen(PORT, () => {
  console.log(`CreAtlantis Admin API listening on port ${PORT}`)
})
