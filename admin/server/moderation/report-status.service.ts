import { db } from '../../src/prisma/db'

export type ReportFinalStatus = 'RESOLVED' | 'DISMISSED'

export class ReportStatusError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 404 | 409,
  ) {
    super(message)
    this.name = 'ReportStatusError'
  }
}

export interface UpdateReportStatusInput {
  reportId: string
  adminId: string
  status: ReportFinalStatus
  reason: string
  requestId?: string | null
}

export interface UpdateReportStatusResult {
  reportId: string
  status: ReportFinalStatus
  adminId: string
}

export async function updateReportStatus(
  input: UpdateReportStatusInput,
): Promise<UpdateReportStatusResult> {
  const reason = input.reason.trim()

  if (!reason) {
    throw new Error('An explanation is required.')
  }

  if (reason.length > 2000) {
    throw new Error('The explanation must not exceed 2000 characters.')
  }

  const action =
    input.status === 'RESOLVED' ? 'REPORT_RESOLVED' : 'REPORT_DISMISSED'

  return db.transaction(async (tx) => {
    const report = await tx.orm.public.Report.whereUnique({
      id: input.reportId,
    })
      .forUpdate()
      .first()

    if (!report) {
      throw new ReportStatusError('Report not found.', 404)
    }

    if (report.status !== 'PENDING' && report.status !== 'REVIEWING') {
      throw new ReportStatusError('This report has already been closed.', 409)
    }

    await tx.orm.public.Report.whereUnique({
      id: input.reportId,
    }).update({
      status: input.status,
      assignedToAdminId: input.adminId,
    })

    await tx.orm.public.ModerationAction.create({
      adminId: input.adminId,
      reportId: input.reportId,
      action,
      targetType: report.targetType,
      targetId: report.targetId,
      reason,
      details: {
        previousStatus: report.status,
        newStatus: input.status,
      },
      idempotencyKey: null,
    })

    await tx.orm.public.AdminAuditLog.create({
      adminId: input.adminId,
      event: action,
      targetType: 'REPORT',
      targetId: input.reportId,
      metadata: {
        reason,
        previousStatus: report.status,
        newStatus: input.status,
      },
      requestId: input.requestId ?? null,
    })

    return {
      reportId: input.reportId,
      status: input.status,
      adminId: input.adminId,
    }
  })
}
