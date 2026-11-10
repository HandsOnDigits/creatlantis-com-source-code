import { B2Client, BufferSource } from '@backblaze-labs/b2-sdk'
import {
  presignS3GetObjectUrl,
  presignS3PutObjectUrl,
  type B2S3Config,
} from '@backblaze-labs/b2-sdk/s3'

const stagingApplicationKeyId = requiredEnv('B2_STAGING_APPLICATION_KEY_ID')
const stagingApplicationKey = requiredEnv('B2_STAGING_APPLICATION_KEY')
const stagingBucketName = requiredEnv('B2_STAGING_BUCKET')

const publicApplicationKeyId = requiredEnv('B2_PUBLIC_APPLICATION_KEY_ID')
const publicApplicationKey = requiredEnv('B2_PUBLIC_APPLICATION_KEY')
const publicBucketName = requiredEnv('B2_PUBLIC_BUCKET')

let stagingClientPromise: Promise<B2Client> | undefined
let publicClientPromise: Promise<B2Client> | undefined

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
  return presignS3GetObjectUrl({
    ...(await getStagingS3Config()),
    bucketName: stagingBucketName,
    fileName,
    expiresIn: 120,
  })
}

export function getMediaVariantUrl(objectKey: string): string {
  const baseUrl = requiredEnv('B2_PUBLIC_BASE_URL').replace(/\/+$/, '')

  const encodedKey = objectKey.split('/').map(encodeURIComponent).join('/')

  return `${baseUrl}/${encodedKey}`
}

async function getStagingClient(): Promise<B2Client> {
  stagingClientPromise ??= (async () => {
    const client = new B2Client({
      applicationKeyId: stagingApplicationKeyId,
      applicationKey: stagingApplicationKey,
    })

    await client.authorize()
    return client
  })()

  return stagingClientPromise
}

async function getPublicClient(): Promise<B2Client> {
  publicClientPromise ??= (async () => {
    const client = new B2Client({
      applicationKeyId: publicApplicationKeyId,
      applicationKey: publicApplicationKey,
    })

    await client.authorize()
    return client
  })()

  return publicClientPromise
}

async function getStagingS3Config(): Promise<B2S3Config> {
  const client = await getStagingClient()

  return {
    accountInfo: client.accountInfo,
    applicationKeyId: stagingApplicationKeyId,
    applicationKey: stagingApplicationKey,
  }
}

async function getStagingBucket() {
  const client = await getStagingClient()
  const bucket = await client.getBucket(stagingBucketName)

  if (!bucket) {
    throw new Error(`B2 staging bucket not found: ${stagingBucketName}`)
  }

  return bucket
}

async function getPublicS3Config(): Promise<B2S3Config> {
  const client = await getPublicClient()

  return {
    accountInfo: client.accountInfo,
    applicationKeyId: publicApplicationKeyId,
    applicationKey: publicApplicationKey,
  }
}

export async function createOriginalUploadUrl(
  fileName: string,
  contentType: string,
  contentLength: number,
): Promise<string> {
  return presignS3PutObjectUrl({
    ...(await getStagingS3Config()),
    bucketName: stagingBucketName,
    fileName,
    expiresIn: 300,
    contentType,
    contentLength,
  })
}

export async function getOriginalObjectMetadata(fileName: string) {
  const bucket = await getStagingBucket()
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
  const bucket = await getStagingBucket()
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
  const bucket = await getStagingBucket()

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
  const bucket = await getStagingBucket()

  // Returns null when the object does not exist.
  const file = await bucket.getFileInfoByName(fileName)

  if (!file) {
    return
  }

  await bucket.deleteFileVersion(fileName, file.fileId)
}

export async function uploadPublicObject(
  fileName: string,
  buffer: Buffer,
  contentType: string,
) {
  const url = await presignS3PutObjectUrl({
    ...(await getPublicS3Config()),
    bucketName: publicBucketName,
    fileName,
    expiresIn: 300,
    contentType,
    contentLength: buffer.byteLength,
  })

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: new Uint8Array(buffer),
  })

  if (!response.ok) {
    throw new Error(`Public B2 upload failed: HTTP ${response.status}`)
  }

  return {
    fileName,
    contentType,
    contentLength: buffer.byteLength,
  }
}
