import { B2Client } from '@backblaze-labs/b2-sdk'
import {
  presignS3GetObjectUrl,
  presignS3PutObjectUrl,
  type B2S3Config,
} from '@backblaze-labs/b2-sdk/s3'
import { decodeFileName } from '@backblaze-labs/b2-sdk/raw'

import { createHash } from 'node:crypto'

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

async function getStagingS3Config(): Promise<B2S3Config> {
  const client = await getStagingClient()

  return {
    accountInfo: client.accountInfo,
    applicationKeyId: stagingApplicationKeyId,
    applicationKey: stagingApplicationKey,
  }
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
  const client = await getStagingClient()

  const response = await client.raw.downloadFileByName(
    client.accountInfo.getDownloadUrl(),
    client.accountInfo.getAuthToken(),
    stagingBucketName,
    fileName,
    { method: 'HEAD' },
  )

  if (response.status === 404) {
    throw new Error('Staging object not found.')
  }

  if (response.status !== 200) {
    throw new Error(
      `Staging object metadata request failed with HTTP ${response.status}.`,
    )
  }

  const headers = response.headers
  const encodedFileName = headers.get('x-bz-file-name')

  return {
    fileName: encodedFileName ? decodeFileName(encodedFileName) : null,
    fileId: headers.get('x-bz-file-id'),
    contentType: headers.get('content-type'),
    contentLength: headers.get('content-length'),
    contentSha1: headers.get('x-bz-content-sha1'),
  }
}

export async function downloadOriginalBuffer(
  fileName: string,
  maxBytes: number,
): Promise<Buffer> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error('Invalid maximum download size.')
  }

  const client = await getStagingClient()

  const response = await client.raw.downloadFileByName(
    client.accountInfo.getDownloadUrl(),
    client.accountInfo.getAuthToken(),
    stagingBucketName,
    fileName,
  )

  if (response.status === 404) {
    throw new Error('Staging object not found.')
  }

  if (response.status !== 200 || !response.body) {
    throw new Error(`Staging download failed with HTTP ${response.status}.`)
  }

  const contentLength = Number(response.headers.get('content-length'))

  if (
    !Number.isSafeInteger(contentLength) ||
    contentLength <= 0 ||
    contentLength > maxBytes
  ) {
    throw new Error('Staging object has an invalid or excessive size.')
  }

  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let totalSize = 0

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      const chunk = Buffer.from(value)
      totalSize += chunk.length

      if (totalSize > maxBytes || totalSize > contentLength) {
        await reader.cancel()
        throw new Error('Staging download exceeded its expected size.')
      }

      chunks.push(chunk)
    }
  } finally {
    reader.releaseLock()
  }

  if (totalSize !== contentLength) {
    throw new Error('Staging download size does not match its metadata.')
  }

  return Buffer.concat(chunks, totalSize)
}

export async function uploadMediaVariant(
  fileName: string,
  buffer: Buffer,
  contentType: string,
) {
  const client = await getStagingClient()
  const bucketId = client.accountInfo.getAllowedBucketId()

  if (!bucketId) {
    throw new Error('Staging key is not restricted to an allowed bucket.')
  }

  const upload = await client.raw.getUploadUrl(
    client.accountInfo.getApiUrl(),
    client.accountInfo.getAuthToken(),
    { bucketId },
  )

  const result = await client.raw.uploadFile(
    upload.uploadUrl,
    {
      authorization: upload.authorizationToken,
      fileName: fileName.split('/').map(encodeURIComponent).join('/'),
      contentType,
      contentLength: buffer.byteLength,
      contentSha1: createHash('sha1').update(buffer).digest('hex'),
    },
    new Uint8Array(buffer),
  )

  return {
    fileId: result.fileId,
    fileName: result.fileName,
    contentType: result.contentType,
    contentLength: result.contentLength,
  }
}

export async function deleteOriginalObject(fileName: string): Promise<void> {
  const client = await getStagingClient()

  const response = await client.raw.downloadFileByName(
    client.accountInfo.getDownloadUrl(),
    client.accountInfo.getAuthToken(),
    stagingBucketName,
    fileName,
    { method: 'HEAD' },
  )

  if (response.status === 404) {
    return
  }

  if (response.status !== 200) {
    throw new Error(
      `Staging object metadata request failed with HTTP ${response.status}.`,
    )
  }

  const rawFileId = response.headers.get('x-bz-file-id')

  if (!rawFileId) {
    throw new Error('Staging object metadata did not contain a file ID.')
  }

  const fileId = rawFileId as Parameters<
    typeof client.raw.deleteFileVersion
  >[2]['fileId']

  await client.raw.deleteFileVersion(
    client.accountInfo.getApiUrl(),
    client.accountInfo.getAuthToken(),
    {
      fileName,
      fileId,
    },
  )
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

export async function verifyPublicObject(
  fileName: string,
  expectedContentLength: number,
  expectedContentType: string,
): Promise<boolean> {
  const url = getMediaVariantUrl(fileName)

  const response = await fetch(url, {
    method: 'HEAD',
    cache: 'no-store',
  })

  if (response.status === 404) {
    return false
  }

  if (!response.ok) {
    throw new Error(
      `Public object verification failed: HTTP ${response.status}`,
    )
  }

  const contentLength = Number(response.headers.get('content-length'))
  const contentType = response.headers.get('content-type')

  if (
    contentLength !== expectedContentLength ||
    contentType !== expectedContentType
  ) {
    throw new Error('Public object metadata does not match the expected file.')
  }

  return true
}
