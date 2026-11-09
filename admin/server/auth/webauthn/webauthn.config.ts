const rpName = process.env['ADMIN_WEBAUTHN_RP_NAME']
const rpID = process.env['ADMIN_WEBAUTHN_RP_ID']
const origin = process.env['ADMIN_WEBAUTHN_ORIGIN']

if (!rpName || !rpID || !origin) {
  throw new Error('WebAuthn configuration is incomplete.')
}

const parsedOrigin = new URL(origin)

if (parsedOrigin.origin !== origin) {
  throw new Error('ADMIN_WEBAUTHN_ORIGIN must not contain a path.')
}

if (
  parsedOrigin.hostname !== rpID &&
  !parsedOrigin.hostname.endsWith(`.${rpID}`)
) {
  throw new Error('WebAuthn origin does not match the relying party ID.')
}

if (
  process.env['NODE_ENV'] === 'production' &&
  parsedOrigin.protocol !== 'https:'
) {
  throw new Error('WebAuthn requires HTTPS in production.')
}

export const webauthnConfig = {
  rpName,
  rpID,
  origin,
} as const
