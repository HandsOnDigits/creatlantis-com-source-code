import { useCallback, useEffect, useState } from 'react'

interface AdminReport {
  id: string
  reporterUserId: number | null
  targetType: 'USER' | 'POST' | 'COMMENT' | 'MEDIA'
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
  status: 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED'
  assignedToAdminId: string | null
  createdAt: string
  updatedAt: string
}

interface ReportsResponse {
  data: AdminReport[]
  pagination: {
    page: number
    limit: number
    hasMore: boolean
  }
}

type ReportDetails = AdminReport & {
  targetAvailable: boolean
} & (
    | {
        targetType: 'USER'
        target: {
          id: number
          username: string
          name: string | null
          createdAt: string
        } | null
      }
    | {
        targetType: 'POST'
        target: {
          id: number
          type: string
          title: string
          content: string | null
          authorId: number
          publicationStatus: string
          createdAt: string
          author: {
            id: number
            username: string
            name: string | null
          } | null
          media: {
            id: string
            originalFilename: string
            originalMimeType: string
            originalSize: number
            width: number | null
            height: number | null
            status: string
          }[]
        } | null
      }
    | {
        targetType: 'MEDIA'
        target: {
          id: string
          userId: number
          originalFilename: string
          originalMimeType: string
          originalSize: number
          width: number | null
          height: number | null
          status: string
          createdAt: string
          post: {
            id: number
            title: string
            publicationStatus: string
            authorId: number
          } | null
        } | null
      }
    | {
        targetType: 'COMMENT'
        target: null
      }
  )

const API_URL = 'http://localhost:3001/api'

export default function ReportsPage() {
  const [reports, setReports] = useState<AdminReport[]>([])
  const [selectedReport, setSelectedReport] = useState<ReportDetails | null>(
    null,
  )
  const [reportDetailsLoading, setReportDetailsLoading] = useState(false)
  const [reportDetailsError, setReportDetailsError] = useState<string | null>(
    null,
  )
  const [reportsPage, setReportsPage] = useState(1)
  const [reportsHasMore, setReportsHasMore] = useState(false)
  const [reportsLoading, setReportsLoading] = useState(true)
  const [reportsError, setReportsError] = useState<string | null>(null)
  const [reportActionReason, setReportActionReason] = useState('')
  const [reportActionLoading, setReportActionLoading] = useState(false)
  const [reportActionError, setReportActionError] = useState<string | null>(
    null,
  )

  const loadReports = useCallback(async (targetPage: number) => {
    setReportsLoading(true)
    setReportsError(null)

    try {
      const response = await fetch(
        `${API_URL}/moderation/reports?status=PENDING&page=${targetPage}&limit=10`,
        {
          credentials: 'include',
          cache: 'no-store',
        },
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error ?? 'Unable to load reports.')
      }

      const data = result as ReportsResponse

      setReports(data.data)
      setReportsPage(data.pagination.page)
      setReportsHasMore(data.pagination.hasMore)
    } catch (err) {
      setReportsError(
        err instanceof Error ? err.message : 'An unexpected error occurred.',
      )
    } finally {
      setReportsLoading(false)
    }
  }, [])

  const loadReportDetails = useCallback(async (reportId: string) => {
    setReportDetailsLoading(true)
    setReportDetailsError(null)
    setSelectedReport(null)
    setReportActionReason('')
    setReportActionError(null)

    try {
      const response = await fetch(
        `${API_URL}/moderation/reports/${reportId}`,
        {
          credentials: 'include',
          cache: 'no-store',
        },
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error ?? 'Failed to load report details.')
      }

      setSelectedReport(result.data as ReportDetails)
    } catch (err) {
      setReportDetailsError(
        err instanceof Error ? err.message : 'Failed to load report details.',
      )
    } finally {
      setReportDetailsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadReports(1)
  }, [loadReports])

  async function updateReportStatus(status: 'resolve' | 'dismiss') {
    if (!selectedReport) return

    const reason = reportActionReason.trim()

    if (!reason) {
      setReportActionError('An explanation is required.')
      return
    }

    setReportActionLoading(true)
    setReportActionError(null)

    try {
      const response = await fetch(
        `${API_URL}/moderation/reports/${selectedReport.id}/${status}`,
        {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason }),
        },
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update the report.')
      }

      setSelectedReport((current) =>
        current
          ? {
              ...current,
              status: result.status,
              assignedToAdminId: result.adminId,
            }
          : current,
      )

      setReportActionReason('')
      await loadReports(reportsPage)
    } catch (err) {
      setReportActionError(
        err instanceof Error ? err.message : 'An unexpected error occurred.',
      )
    } finally {
      setReportActionLoading(false)
    }
  }

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Report moderation</h1>
          <p className="text-admin-muted mt-2 text-sm">
            Review reports submitted by users.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadReports(reportsPage)}
          disabled={reportsLoading}
          className="border-admin-border rounded-lg border px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {reportDetailsLoading && (
        <p className="text-admin-muted">Loading report details...</p>
      )}

      {reportDetailsError && (
        <p role="alert" className="mb-4 text-sm text-red-400">
          {reportDetailsError}
        </p>
      )}

      {selectedReport && (
        <section className="border-admin-border mb-8 rounded-xl border p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Report details</h2>
            <button
              type="button"
              onClick={() => {
                setSelectedReport(null)
                setReportActionReason('')
                setReportActionError(null)
              }}
              className="text-admin-muted text-sm hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <p>
              <strong>Report ID:</strong> {selectedReport.id}
            </p>
            <p>
              <strong>Target:</strong> {selectedReport.targetType} —{' '}
              {selectedReport.targetId}
            </p>
            <p>
              <strong>Reason:</strong> {selectedReport.reason}
            </p>
            <p>
              <strong>Description:</strong>{' '}
              {selectedReport.description || 'No description provided.'}
            </p>
            <p>
              <strong>Status:</strong> {selectedReport.status}
            </p>
            <p>
              <strong>Target available:</strong>{' '}
              {selectedReport.targetAvailable ? 'Yes' : 'No'}
            </p>
          </div>

          <div className="mt-5 border-t border-white/10 pt-4">
            <h3 className="font-semibold">Reported content</h3>

            {selectedReport.targetType === 'USER' && selectedReport.target && (
              <div className="mt-2 space-y-1 text-sm">
                <p>
                  <strong>Username:</strong> {selectedReport.target.username}
                </p>
                <p>
                  <strong>Name:</strong>{' '}
                  {selectedReport.target.name || 'Not public'}
                </p>
                <p>
                  <strong>User ID:</strong> {selectedReport.target.id}
                </p>
              </div>
            )}

            {selectedReport.targetType === 'POST' && selectedReport.target && (
              <div className="mt-2 space-y-1 text-sm">
                <p>
                  <strong>Title:</strong> {selectedReport.target.title}
                </p>
                <p>
                  <strong>Type:</strong> {selectedReport.target.type}
                </p>
                <p>
                  <strong>Author:</strong>{' '}
                  {selectedReport.target.author?.username || 'Unavailable'}
                </p>
                <p>
                  <strong>Publication status:</strong>{' '}
                  {selectedReport.target.publicationStatus}
                </p>
                <p>
                  <strong>Content:</strong>{' '}
                  {selectedReport.target.content || 'No text content.'}
                </p>
                <p>
                  <strong>Media:</strong> {selectedReport.target.media.length}
                </p>
              </div>
            )}

            {selectedReport.targetType === 'MEDIA' && selectedReport.target && (
              <div className="mt-2 space-y-1 text-sm">
                <p>
                  <strong>Filename:</strong>{' '}
                  {selectedReport.target.originalFilename}
                </p>
                <p>
                  <strong>MIME type:</strong>{' '}
                  {selectedReport.target.originalMimeType}
                </p>
                <p>
                  <strong>Size:</strong> {selectedReport.target.originalSize}{' '}
                  bytes
                </p>
                <p>
                  <strong>Status:</strong> {selectedReport.target.status}
                </p>
                <p>
                  <strong>Dimensions:</strong>{' '}
                  {selectedReport.target.width ?? '?'} ×{' '}
                  {selectedReport.target.height ?? '?'}
                </p>
                <p>
                  <strong>Linked post:</strong>{' '}
                  {selectedReport.target.post?.title || 'Unavailable'}
                </p>
              </div>
            )}

            {selectedReport.targetType === 'COMMENT' && (
              <p className="mt-2 text-sm">
                Comment inspection is not available yet.
              </p>
            )}

            {!selectedReport.target && (
              <p className="text-admin-muted mt-2 text-sm">
                The reported target could not be found.
              </p>
            )}
          </div>

          {selectedReport.status === 'PENDING' ||
          selectedReport.status === 'REVIEWING' ? (
            <div className="mt-6 border-t border-white/10 pt-4">
              <h3 className="font-semibold">Review decision</h3>

              <label
                htmlFor="report-action-reason"
                className="mt-3 block text-sm font-medium"
              >
                Explanation (required)
              </label>

              <textarea
                id="report-action-reason"
                value={reportActionReason}
                onChange={(event) => setReportActionReason(event.target.value)}
                maxLength={2000}
                rows={4}
                disabled={reportActionLoading}
                placeholder="Explain why this report is being resolved or dismissed..."
                className="border-admin-border mt-1 w-full rounded-lg border bg-black/20 p-3 text-sm outline-none focus:border-white/40"
              />

              {reportActionError && (
                <p className="mt-2 text-sm text-red-400" role="alert">
                  {reportActionError}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void updateReportStatus('resolve')}
                  disabled={reportActionLoading || !reportActionReason.trim()}
                  className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold hover:bg-green-600 disabled:opacity-50"
                >
                  {reportActionLoading ? 'Processing...' : 'Resolve report'}
                </button>

                <button
                  type="button"
                  onClick={() => void updateReportStatus('dismiss')}
                  disabled={reportActionLoading || !reportActionReason.trim()}
                  className="rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold hover:bg-gray-500 disabled:opacity-50"
                >
                  {reportActionLoading ? 'Processing...' : 'Dismiss report'}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-admin-muted mt-6 border-t border-white/10 pt-4 text-sm">
              This report has been closed with status: {selectedReport.status}.
            </p>
          )}
        </section>
      )}

      {reportsError && (
        <p
          role="alert"
          className="mb-5 rounded-lg bg-red-500/10 p-3 text-sm text-red-400"
        >
          {reportsError}
        </p>
      )}

      {reportsLoading ? (
        <p className="text-admin-muted">Loading reports...</p>
      ) : reports.length === 0 ? (
        <div className="border-admin-border rounded-xl border p-8 text-center">
          <p className="font-medium">No pending reports</p>
          <p className="text-admin-muted mt-2 text-sm">
            New user reports will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <article
              key={report.id}
              className="border-admin-border rounded-xl border bg-white/2 p-5"
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">
                    {report.reason.replaceAll('_', ' ')}
                  </h2>

                  <p className="text-admin-muted mt-1 text-sm">
                    {report.targetType} #{report.targetId}
                  </p>

                  <p className="text-admin-muted mt-1 text-sm">
                    Reporter: {report.reporterUserId ?? 'Anonymous'}
                  </p>
                </div>

                <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
                  {report.status}
                </span>
              </div>

              {report.description && (
                <p className="mb-4 text-sm whitespace-pre-wrap text-white/80">
                  {report.description}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-admin-muted text-xs">
                  Submitted {new Date(report.createdAt).toLocaleString()}
                </span>

                <span className="text-admin-muted text-xs">
                  Report ID: {report.id}
                </span>

                <button
                  type="button"
                  onClick={() => void loadReportDetails(report.id)}
                  className="border-admin-border rounded-lg border px-3 py-2 text-sm hover:bg-white/5"
                >
                  View details
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => void loadReports(reportsPage - 1)}
          disabled={reportsLoading || reportsPage <= 1}
          className="border-admin-border rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
        >
          Previous
        </button>

        <span className="text-admin-muted text-sm">Page {reportsPage}</span>

        <button
          type="button"
          onClick={() => void loadReports(reportsPage + 1)}
          disabled={reportsLoading || !reportsHasMore}
          className="border-admin-border rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </section>
  )
}
