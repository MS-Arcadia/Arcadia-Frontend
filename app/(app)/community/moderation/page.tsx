"use client"

import { useState } from "react"
import Link from "next/link"
import { useInfiniteQuery } from "@tanstack/react-query"
import { Check, Loader2, ShieldCheck, X } from "lucide-react"

import { getModerationQueue } from "@/api/community"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useResolveReportMutation } from "@/queries/community"
import { formatRelative } from "@/lib/datetime"
import { useHasRole } from "@/stores/auth.store"
import type { CursorPage } from "@/types/common.api.type"
import type { Report } from "@/types/community.api.type"

export default function ModerationPage() {
  const isStaff = useHasRole("SUPPORT", "ADMIN")

  const queue = useInfiniteQuery<CursorPage<Report>>({
    queryKey: ["community", "moderation", "infinite"],
    queryFn: ({ pageParam }) =>
      getModerationQueue((pageParam as string | null) ?? null, 20),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.has_more ? last.next_cursor : undefined),
    staleTime: 15 * 1000,
    enabled: isStaff,
  })

  // Resolving invalidates and refetches the queue, but that round-trip has a
  // moment of lag — hiding the just-resolved card locally keeps the list from
  // flashing a report that is already dealt with.
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set())
  const reports = (queue.data?.pages.flatMap((page) => page.items) ?? []).filter(
    (report) => !resolvedIds.has(report.id)
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
          Resolving a report decides whether it stays up. Only Support and
          Admin can act on the queue.
        </p>
      </div>
    )
  }

  const firstLoad = queue.isPending
  const loadingMore = queue.isFetchingNextPage

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Community moderation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Open reports on posts and comments. Removing takes the content down;
          dismissing leaves it as it was — either way, a note explains the
          call.
        </p>
      </div>

      {firstLoad && (
        <div className="space-y-4">
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton key={index} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!firstLoad && queue.isError && (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          The queue did not load. Reload the page to try again.
        </p>
      )}

      {!firstLoad && !queue.isError && reports.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-16 text-center">
          <ShieldCheck
            className="mx-auto size-8 text-muted-foreground/40"
            strokeWidth={1.5}
            aria-hidden
          />
          <p className="mt-4 text-sm font-medium">Nothing waiting</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Reports appear here as the community sends them.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {reports.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            onResolved={() =>
              setResolvedIds((prev) => new Set(prev).add(report.id))
            }
          />
        ))}
      </div>

      {queue.hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={loadingMore}
            onClick={() => queue.fetchNextPage()}
          >
            {loadingMore && <Loader2 className="size-3.5 animate-spin" />}
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}

function ReportCard({
  report,
  onResolved,
}: {
  report: Report
  onResolved: () => void
}) {
  const resolve = useResolveReportMutation()
  const [note, setNote] = useState("")

  const busy = resolve.isPending
  const targetHref =
    report.target_type === "POST"
      ? `/community/${report.target_id}`
      : null

  return (
    <article className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{report.target_type}</Badge>
        <span className="text-xs text-muted-foreground">
          reported {formatRelative(report.created_at)} by{" "}
          <span className="font-mono text-foreground">
            {report.reporter_id.slice(0, 10)}…
          </span>
        </span>
        {targetHref && (
          <Button
            variant="link"
            size="sm"
            className="ms-auto"
            nativeButton={false}
            render={<Link href={targetHref} target="_blank" />}
          >
            View post
          </Button>
        )}
      </div>

      <p className="text-sm leading-relaxed">
        <span className="text-muted-foreground">Reason: </span>
        {report.reason}
      </p>

      <p className="text-xs text-muted-foreground/70">
        Target id{" "}
        <span className="font-mono text-foreground">{report.target_id}</span>
      </p>

      <div className="space-y-1.5 border-t border-border pt-3">
        <Label htmlFor={`note-${report.id}`} className="text-xs">
          Resolution note
        </Label>
        <Input
          id={`note-${report.id}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Required for both outcomes"
          className="min-h-9"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          className="min-h-9"
          disabled={busy || !note.trim()}
          onClick={() =>
            resolve.mutate(
              { reportId: report.id, action: "DISMISS", note: note.trim() },
              { onSuccess: onResolved }
            )
          }
        >
          {resolve.isPending ? (
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
          disabled={busy || !note.trim()}
          onClick={() =>
            resolve.mutate(
              { reportId: report.id, action: "REMOVE", note: note.trim() },
              { onSuccess: onResolved }
            )
          }
        >
          {resolve.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Check className="size-3.5" />
          )}
          Remove
        </Button>
      </div>

      {!note.trim() && (
        <p className="text-xs text-muted-foreground/70">
          A note is required before either action.
        </p>
      )}
    </article>
  )
}
