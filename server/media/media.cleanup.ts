import { db } from '../../src/prisma/db'
import { deleteOriginalObject } from '../storage/b2.client'

const CLEANUP_INTERVAL_MS = 60 * 1000
const BATCH_SIZE = 100
const SIGNED_URL_EXPIRY_MS = 5 * 60 * 1000

let cleanupRunning = false

export async function cleanupExpiredUploadReservations(): Promise<void> {
  if (cleanupRunning) return

  cleanupRunning = true

  try {
    const now = Date.now()

    const allReservations = await db.orm.public.UploadReservation.orderBy(
      (reservation) => reservation.expiresAt.asc(),
    ).all()

    const reservations = allReservations
      .filter(
        (reservation) =>
          new Date(reservation.expiresAt).getTime() + SIGNED_URL_EXPIRY_MS <=
          now,
      )
      .slice(0, BATCH_SIZE)

    for (const reservation of reservations) {
      try {
        await deleteOriginalObject(reservation.objectKey)

        await db.orm.public.UploadReservation.where({
          id: reservation.id,
        }).delete()

        console.log(`Cleaned up upload reservation: ${reservation.id}`)
      } catch (error) {
        console.error(
          `Failed to clean upload reservation ${reservation.id}:`,
          error,
        )
      }
    }
  } finally {
    cleanupRunning = false
  }
}

export function startMediaReservationCleanup(): void {
  void cleanupExpiredUploadReservations()

  const timer = setInterval(() => {
    void cleanupExpiredUploadReservations()
  }, CLEANUP_INTERVAL_MS)

  timer.unref()
}
