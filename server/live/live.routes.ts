import { Router } from 'express'

import { requireAuth } from '../auth/auth.middleware'
import { addLiveClient, removeLiveClient } from './live.service'

const router = Router()

router.get('/events', requireAuth, (req, res) => {
  const userId = req.auth!.userId

  res.status(200)

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  res.flushHeaders()

  res.write(': connected\n\n')

  const clientId = addLiveClient(userId, res)

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': heartbeat\n\n')
    }
  }, 25_000)

  res.on('close', () => {
    clearInterval(heartbeat)
    removeLiveClient(clientId)
  })
})

export default router
