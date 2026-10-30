export type MediaProcessingJob = {
  id: string
  originalKey: string
  originalFilename: string
  originalMimeType: string
  originalSize: bigint | null
  processingAttempts: number
}
