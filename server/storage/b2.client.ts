import { B2Client, BufferSource } from '@backblaze-labs/b2-sdk'
import {
  presignS3PutObjectUrl,
  type B2S3Config,
} from '@backblaze-labs/b2-sdk/s3'

const applicationKeyId = requiredEnv('B2_MEDIA_APPLICATION_KEY_ID')
const applicationKey = requiredEnv('B2_MEDIA_APPLICATION_KEY')
const bucketName = requiredEnv('B2_MEDIA_BUCKET')

function requiredEnv(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }

  return value
}

export async function createOriginalDownloadUrl(
  fileName: string,
): Promise<string> {
  return getMediaVariantUrl(fileName)
}

let clientPromise: Promise<B2Client> | undefined

export function getMediaVariantUrl(objectKey: string): string {
  const baseUrl = requiredEnv('B2_MEDIA_PUBLIC_BASE_URL').replace(/\/+$/, '')

  const encodedKey = objectKey.split('/').map(encodeURIComponent).join('/')

  return `${baseUrl}/${encodedKey}`
}

async function getClient(): Promise<B2Client> {
  clientPromise ??= (async () => {
    const client = new B2Client({
      applicationKeyId,
      applicationKey,
    })

    await client.authorize()

    return client
  })()

  return clientPromise
}

async function getS3Config(): Promise<B2S3Config> {
  const client = await getClient()

  return {
    accountInfo: client.accountInfo,
    applicationKeyId,
    applicationKey,
  }
}

async function getBucket() {
  const client = await getClient()
  const bucket = await client.getBucket(bucketName)

  if (!bucket) {
    throw new Error(`B2 bucket not found: ${bucketName}`)
  }

  return bucket
}

export async function createOriginalUploadUrl(
  fileName: string,
  contentType: string,
  contentLength: number,
): Promise<string> {
  return presignS3PutObjectUrl({
    ...(await getS3Config()),
    bucketName,
    fileName,
    expiresIn: 300,
    contentType,
    contentLength,
  })
}

export async function getOriginalObjectMetadata(fileName: string) {
  const bucket = await getBucket()
  const { headers } = await bucket.head(fileName)

  return {
    fileName: headers.fileName,
    fileId: headers.fileId,
    contentType: headers.contentType,
    contentLength: headers.contentLength,
    contentSha1: headers.contentSha1,
  }
}

export async function downloadOriginalBuffer(
  fileName: string,
  maxBytes: number,
): Promise<Buffer> {
  const bucket = await getBucket()
  const result = await bucket.download(fileName)

  const expectedSize = result.headers.contentLength

  if (
    !Number.isSafeInteger(expectedSize) ||
    expectedSize < 1 ||
    expectedSize > maxBytes
  ) {
    throw new Error('Original image has an invalid or excessive size')
  }

  const reader = result.body.getReader()
  const chunks: Buffer[] = []
  let totalSize = 0

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      totalSize += value.byteLength

      if (totalSize > maxBytes || totalSize > expectedSize) {
        await reader.cancel()
        throw new Error('Original image exceeds its expected size')
      }

      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock()
  }

  if (totalSize !== expectedSize) {
    throw new Error('Downloaded original image has an unexpected size')
  }

  return Buffer.concat(chunks, totalSize)
}

export async function uploadMediaVariant(
  fileName: string,
  buffer: Buffer,
  contentType: string,
) {
  const bucket = await getBucket()

  const result = await bucket.upload({
    fileName,
    source: new BufferSource(buffer),
    contentType,
  })

  return {
    fileId: result.fileId,
    fileName: result.fileName,
    contentType: result.contentType,
    contentLength: result.contentLength,
  }
}

export async function deleteOriginalObject(fileName: string): Promise<void> {
  const bucket = await getBucket()

  // Returns null when the object does not exist.
  const file = await bucket.getFileInfoByName(fileName)

  if (!file) {
    return
  }

  await bucket.deleteFileVersion(fileName, file.fileId)
}
