import { generateSecret, generateURI, verify } from 'otplib'

import QRCode from 'qrcode'

const ISSUER = 'CreAtlantis Admin'
const PERIOD_SECONDS = 30

export interface TotpEnrollment {
  secret: string
  uri: string
  qrCodeDataUrl: string
}

export interface TotpVerification {
  valid: boolean
  timeStep: number | null
}

export async function createTotpEnrollment(
  email: string,
): Promise<TotpEnrollment> {
  const secret = generateSecret({ length: 20 })

  const uri = generateURI({
    issuer: ISSUER,
    label: email,
    secret,
    algorithm: 'sha1',
    digits: 6,
    period: PERIOD_SECONDS,
  })

  const qrCodeDataUrl = await QRCode.toDataURL(uri, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 300,
  })

  return {
    secret,
    uri,
    qrCodeDataUrl,
  }
}

export async function verifyTotpCode(
  secret: string,
  token: string,
  lastAcceptedTimeStep: bigint | null,
): Promise<TotpVerification> {
  if (!/^\d{6}$/.test(token)) {
    return {
      valid: false,
      timeStep: null,
    }
  }

  const previousStep =
    lastAcceptedTimeStep === null ? undefined : Number(lastAcceptedTimeStep)

  if (
    previousStep !== undefined &&
    (!Number.isSafeInteger(previousStep) || previousStep < 0)
  ) {
    throw new Error('Invalid stored MFA time step.')
  }

  // Capture the epoch once to keep the calculation consistent.
  const epoch = Math.floor(Date.now() / 1000)

  const result = await verify({
    secret,
    token,
    epoch,
    digits: 6,
    algorithm: 'sha1',
    period: PERIOD_SECONDS,
    epochTolerance: [30, 0],
    afterTimeStep: previousStep,
  })

  if (!result.valid) {
    return {
      valid: false,
      timeStep: null,
    }
  }

  const timeStep = Math.floor(epoch / PERIOD_SECONDS) + result.delta

  return {
    valid: true,
    timeStep,
  }
}
