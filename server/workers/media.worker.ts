import { db } from '../../src/prisma/db'
import { processMediaJob } from './media.processor'

export type MediaJob = NonNullable<Awaited<ReturnType<typeof claimMediaJob>>>

async function claimMediaJob() {
  return db.transaction(async (tx) => {
    const media = tx.orm.public.Media
    const now = new Date().toISOString()

    const job = await media
      .where((m, { fns }) =>
        fns.and(
          m.status.eq('UPLOADED'),
          fns.or(m.nextAttemptAt.isNull(), m.nextAttemptAt.lte(now)),
        ),
      )
      .orderBy((m) => m.createdAt.asc())
      .forUpdate({ skipLocked: true })
      .first()

    if (!job) return null

    const attempts = job.processingAttempts + 1

    await media.where({ id: job.id }).update({
      status: 'PROCESSING',
      processingAttempts: attempts,
      processingError: null,
      nextAttemptAt: null,
    })

    return {
      ...job,
      status: 'PROCESSING' as const,
      processingAttempts: attempts,
      nextAttemptAt: null,
    }
  })
}

async function handleProcessingFailure(
  job: { id: string; processingAttempts: number },
  error: unknown,
): Promise<void> {
  const maxAttempts = 5
  const failed = job.processingAttempts >= maxAttempts

  const delayMs = Math.min(1000 * 2 ** job.processingAttempts, 60 * 60 * 1000)

  const message = error instanceof Error ? error.message : String(error)

  await db.orm.public.Media.where({ id: job.id }).update({
    status: failed ? 'FAILED' : 'UPLOADED',
    processingError: message.slice(0, 2000),
    nextAttemptAt: failed ? null : new Date(Date.now() + delayMs).toISOString(),
  })

  if (failed) {
    console.error(
      `Media ${job.id} failed after ${maxAttempts} attempts:`,
      message,
    )
  }
}

async function runWorker(): Promise<void> {
  console.log('Media worker started')

  while (true) {
    try {
      const job = await claimMediaJob()

      if (!job) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
        continue
      }

      console.log(`Processing media ${job.id}`)

      try {
        await processMediaJob(job)
        console.log(`Media ${job.id} processed successfully`)
      } catch (error) {
        console.error(`Media ${job.id} failed:`, error)
        await handleProcessingFailure(job, error)
      }
    } catch (error) {
      console.error('Media worker error:', error)
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }
}

runWorker().catch((error) => {
  console.error('Media worker stopped:', error)
  process.exitCode = 1
})
