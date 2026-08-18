"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Check, Flag, Loader2, ShieldCheck, X } from "lucide-react"

import {
  getOpenReviewReports,
  resolveReviewReport,
  type ReviewReport,
} from "@/api/reviews"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatRelative } from "@/lib/datetime"
import { useHasRole } from "@/stores/auth.store"

export default function ReviewReportsPage() {
  const isStaff = useHasRole("SUPPORT", "ADMIN")

  const [page, setPage] = useState(0)
  const pageSize = 20

  const queue = useQuery({
    queryKey: ["review-reports", page],
    queryFn: () => getOpenReviewReports(pageSize, page * pageSize),
    staleTime: 15_000,
    enabled: isStaff,
  })

  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set())
  const reports = (queue.data?.reports ?? []).filter(
    (r) => !resolvedIds.has(r.id)
  )

  if (!isStaff) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <ShieldCheck
          className="mx-auto size-8 text-muted-foreground/40"
          strokeWidth={1.5}
          aria-hidden
        />
        <h1 className="mt-4 text-lg font-semibold">Support only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Only Support and Admin can manage review reports.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Review reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Open reports on buyer reviews. Remove deletes the review; dismiss
          leaves it as it was.
        </p>
      </div>

      {queue.isPending && (
        <div className="space-y-4">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!queue.isPending && queue.isError && (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Failed to load reports. Reload to try again.
        </p>
      )}

      {!queue.isPending && !queue.isError && reports.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-16 text-center">
          <Flag
            className="mx-auto size-8 text-muted-foreground/40"
            strokeWidth={1.5}
            aria-hidden
          />
          <p className="mt-4 text-sm font-medium">Nothing waiting</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Reports on buyer reviews appear here as users send them.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {reports.map((report) => (
          <ReviewReportCard
            key={report.id}
            report={report}
            onResolved={() =>
              setResolvedIds((prev) => new Set(prev).add(report.id))
            }
          />
        ))}
      </div>

      {(queue.data?.total ?? 0) > pageSize && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={(page + 1) * pageSize >= (queue.data?.total ?? 0)}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}

function ReviewReportCard({
  report,
  onResolved,
}: {
  report: ReviewReport
  onResolved: () => void
}) {
  const [busy, setBusy] = useState(false)

  const handleResolve = async (deleteReview: boolean) => {
    setBusy(true)
    try {
      await resolveReviewReport(report.review_id, report.id, deleteReview)
      onResolved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">REVIEW</Badge>
        <span className="text-xs text-muted-foreground">
          {report.created_at
            ? `reported ${formatRelative(report.created_at)}`
            : "reported"}
          {" by "}
          <span className="font-mono text-foreground">
            {report.reporter_id.slice(0, 10)}…
          </span>
        </span>
      </div>

      <p className="text-sm leading-relaxed">
        <span className="text-muted-foreground">Reason: </span>
        {report.reason}
      </p>

      <p className="text-xs text-muted-foreground/70">
        Review id{" "}
        <span className="font-mono text-foreground">{report.review_id}</span>
      </p>

      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <Button
          variant="outline"
          size="sm"
          className="min-h-9"
          disabled={busy}
          onClick={() => handleResolve(false)}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <X className="size-3.5" />
          )}
          Dismiss
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="min-h-9"
          disabled={busy}
          onClick={() => handleResolve(true)}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Check className="size-3.5" />
          )}
          Remove review
        </Button>
      </div>
    </article>
  )
}
