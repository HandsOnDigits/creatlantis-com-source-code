import 'dotenv/config'

import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { rateLimit } from 'express-rate-limit'

import { db } from '../src/prisma/db'
import { errorHandler } from './middleware/error-handler'
import authRoutes from './auth/auth.routes'
import usersRoutes from './users/users.routes'
import profilesRoutes from './profiles/profiles.routes'
import mediaRoutes from './media/media.routes'
import postsRoutes from './posts/posts.routes'
import categoriesRoutes from './categories/categories.routes'
import reportsRoutes from './reports/reports.routes'
import liveRoutes from './live/live.routes'
import liveInternalRoutes from './live/live.internal.routes'

import { closeReportSubmissionPool } from './reports/report-submission.service'

import { startMediaReservationCleanup } from './media/media.cleanup'

const app = express()
const port = Number(process.env['API_PORT'] ?? 3000)

const frontendOrigin = process.env['FRONTEND_ORIGIN'] ?? 'http://localhost:5173'

// General application settings
app.disable('x-powered-by')

app.use(
  cors({
    origin: frontendOrigin,
    credentials: true,
  }),
)

app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please try again later.',
  },
})

app.use('/api/live', liveRoutes)
app.use('/api/live/internal', liveInternalRoutes)
app.use('/api', apiLimiter)

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/profiles', profilesRoutes)
app.use('/api/media', mediaRoutes)
app.use('/api/posts', postsRoutes)
app.use('/api/categories', categoriesRoutes)
app.use('/api/reports', reportsRoutes)

// Health
app.get('/api/health', async (_req, res) => {
  try {
    // Execute a lightweight database query to verify connectivity.
    await db.orm.public.User.where({ id: -1 }).first()

    res.json({
      status: 'ok',
      database: 'connected',
    })
  } catch (error) {
    console.error('Database health check failed:', error)

    res.status(503).json({
      status: 'error',
      database: 'unavailable',
    })
  }
})

// Centralized error handler - always last
app.use(errorHandler)

startMediaReservationCleanup()

// Start server
const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})

// Graceful shutdown
async function shutdown() {
  server.close(async () => {
    try {
      await Promise.all([db.close(), closeReportSubmissionPool()])
    } finally {
      process.exit(0)
    }
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
