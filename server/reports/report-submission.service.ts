import 'dotenv/config'

import { Pool } from 'pg'

const reportsDatabaseUrl = process.env['REPORTS_DATABASE_URL']

if (!reportsDatabaseUrl) {
  throw new Error('REPORTS_DATABASE_URL is not configured')
}

const databaseUrl = new URL(reportsDatabaseUrl)

if (
  !['postgres:', 'postgresql:'].includes(databaseUrl.protocol) ||
  decodeURIComponent(databaseUrl.username) !== 'creatlantis_report_submitter' ||
  decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, '')) !==
    'creatlantis_admin'
) {
  throw new Error('Invalid report submission database configuration')
}

const reportsPool = new Pool({
  connectionString: reportsDatabaseUrl,
  max: 3,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 5000,
  query_timeout: 6000,
  application_name: 'creatlantis-public-api-reports',
})

export interface SubmitReportInput {
  reporterUserId: number
  targetType: 'USER' | 'POST' | 'MEDIA'
  targetId: string
  reason:
    | 'SPAM'
    | 'HARASSMENT'
    | 'HATE_SPEECH'
    | 'INAPPROPRIATE_CONTENT'
    | 'VIOLENCE'
    | 'IMPERSONATION'
    | 'COPYRIGHT'
    | 'OTHER'
  description: string | null
}

export async function submitReport(input: SubmitReportInput): Promise<string> {
  const result = await reportsPool.query<{ id: string }>(
    `
      SELECT public.submit_report(
        $1::integer,
        $2::text,
        $3::text,
        $4::text,
        $5::text,
        $6::json
      ) AS id
    `,
    [
      input.reporterUserId,
      input.targetType,
      input.targetId,
      input.reason,
      input.description,
      null,
    ],
  )

  const reportId = result.rows[0]?.id

  if (!reportId) {
    throw new Error('Report submission did not return an ID')
  }

  return reportId
}

export async function closeReportSubmissionPool(): Promise<void> {
  await reportsPool.end()
}
