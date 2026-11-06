import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_VERSION = 1
const NONCE_LENGTH = 12

export interface EncryptedMfaSecret {
  ciphertext: Buffer
  nonce: Buffer
  authTag: Buffer
  encryptionKeyVersion: number
}

function getEncryptionKey(version: number): Buffer {
  if (version !== 1) {
    throw new Error(`Unsupported MFA encryption key version: ${version}`)
  }

  const encoded = process.env['ADMIN_MFA_ENCRYPTION_KEY_V1']

  if (!encoded) {
    throw new Error('ADMIN_MFA_ENCRYPTION_KEY_V1 is not configured.')
  }

  const key = Buffer.from(encoded, 'base64')

  if (key.length !== 32 || key.toString('base64') !== encoded) {
    throw new Error(
      'ADMIN_MFA_ENCRYPTION_KEY_V1 must be a valid base64-encoded 32-byte key.',
    )
  }

  return key
}

export function encryptMfaSecret(secret: string): EncryptedMfaSecret {
  if (!secret) {
    throw new Error('Cannot encrypt an empty MFA secret.')
  }

  const key = getEncryptionKey(KEY_VERSION)
  const nonce = randomBytes(NONCE_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, nonce)

  const ciphertext = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ])

  return {
    ciphertext,
    nonce,
    authTag: cipher.getAuthTag(),
    encryptionKeyVersion: KEY_VERSION,
  }
}

export function decryptMfaSecret(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  authTag: Uint8Array,
  encryptionKeyVersion: number,
): string {
  if (nonce.byteLength !== NONCE_LENGTH || authTag.byteLength !== 16) {
    throw new Error('Invalid encrypted MFA secret parameters.')
  }

  const key = getEncryptionKey(encryptionKeyVersion)

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(nonce))

  decipher.setAuthTag(Buffer.from(authTag))

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext)),
    decipher.final(),
  ])

  return plaintext.toString('utf8')
}
