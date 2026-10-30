import type { ErrorRequestHandler } from 'express'

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  // PostgreSQL unique constraint violation
  if (
    typeof error === 'object' &&
    error !== null &&
    'sqlState' in error &&
    error.sqlState === '23505'
  ) {
    res.status(409).json({
      error: 'A record with this value already exists',
    })
    return
  }

  console.error('API error:', error)

  res.status(500).json({
    error: 'Internal server error',
  })
}
