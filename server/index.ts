import 'dotenv/config'

import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { rateLimit } from 'express-rate-limit'

import { db } from '../src/prisma/db'
import { errorHandler } from './middleware/error-handler'
import authRoutes from './auth/auth.routes'
import usersRoutes from './users/users.routes'

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

app.use('/api', apiLimiter)

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/users', usersRoutes)

// Health
app.get('/api/health', async (_req, res) => {
  try {
    await db.connect()

    res.json({
      status: 'ok',
      database: 'connected',
    })
  } catch {
    res.status(503).json({
      status: 'error',
      database: 'unavailable',
    })
  }
})

// Centralized error handler - always last
app.use(errorHandler)

// Start server
const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})

// Graceful shutdown
async function shutdown() {
  server.close(async () => {
    try {
      await db.close()
    } finally {
      process.exit(0)
    }
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
