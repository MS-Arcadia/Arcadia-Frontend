"use client"

import { useState } from "react"
import {
  Check,
  Flag,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
  X,
} from "lucide-react"

import { AuthorChip } from "@/components/community/author-chip"
import { ReportDialog } from "@/components/community/report-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import {
  useDeleteCommentMutation,
  useEditCommentMutation,
  useReportCommentMutation,
} from "@/queries/community"
import { formatRelative } from "@/lib/datetime"
import { useAuthStore, useHasRole } from "@/stores/auth.store"
import type { Comment } from "@/types/community.api.type"

interface Props {
  postId: string
  comment: Comment
}

export function CommentItem({ postId, comment }: Props) {
  const userId = useAuthStore((state) => state.user?.user_id)
  const isStaff = useHasRole("SUPPORT", "ADMIN")
  const isAuthor = userId === comment.author_id

  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(comment.body)
  const [reportOpen, setReportOpen] = useState(false)

  const editComment = useEditCommentMutation(postId)
  const deleteComment = useDeleteCommentMutation(postId)
  const reportComment = useReportCommentMutation()

  const removed = comment.status !== "ACTIVE"

  return (
    <div className="flex gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <AuthorChip
            authorId={comment.author_id}
            className="font-medium text-foreground"
          />
          <span aria-hidden>·</span>
          <span>{formatRelative(comment.created_at)}</span>
          {comment.edited_at && (
            <span className="text-muted-foreground/70">(edited)</span>
          )}
          {removed && (
            <Badge variant="destructive" className="ms-1">
              {comment.status === "REMOVED_BY_MODERATION"
                ? "Removed by Support"
                : "Deleted"}
            </Badge>
          )}
        </div>

        {editing ? (
          <div className="mt-1.5 space-y-2">
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="min-h-16 text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="min-h-8"
                disabled={editComment.isPending || !body.trim()}
                onClick={() =>
                  editComment.mutate(
                    { commentId: comment.id, body: body.trim() },
                    { onSuccess: () => setEditing(false) }
                  )
                }
              >
                {editComment.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="min-h-8"
                onClick={() => {
                  setEditing(false)
                  setBody(comment.body)
                }}
              >
                <X className="size-3.5" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-sm whitespace-pre-wrap text-foreground">
            {comment.body}
          </p>
        )}
      </div>

      {!editing && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Comment actions"
                className="flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              />
            }
          >
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {isAuthor && (
              <DropdownMenuItem onClick={() => setEditing(true)}>
                <Pencil className="size-3.5" />
                Edit
              </DropdownMenuItem>
            )}
            {(isAuthor || isStaff) && (
              <DropdownMenuItem
                variant="destructive"
                onClick={() => deleteComment.mutate(comment.id)}
              >
                <Trash2 className="size-3.5" />
                {isAuthor ? "Delete" : "Remove"}
              </DropdownMenuItem>
            )}
            {!isAuthor && (
              <DropdownMenuItem onClick={() => setReportOpen(true)}>
                <Flag className="size-3.5" />
                Report
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        title="Report this comment"
        isPending={reportComment.isPending}
        onSubmit={(reason) =>
          reportComment.mutate({ commentId: comment.id, reason })
        }
      />
    </div>
  )
}
