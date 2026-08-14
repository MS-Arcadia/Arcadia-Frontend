"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Eye,
  EyeOff,
  Flag,
  MessageCircle,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react"

import { AttachmentGallery } from "@/components/community/attachment-gallery"
import { AuthorChip } from "@/components/community/author-chip"
import { EditPostDialog } from "@/components/community/edit-post-dialog"
import { GameChip } from "@/components/community/game-chip"
import { ReactionPicker } from "@/components/community/reaction-picker"
import { ReportDialog } from "@/components/community/report-dialog"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  useDeletePostMutation,
  useReportPostMutation,
} from "@/queries/community"
import { formatRelative } from "@/lib/datetime"
import { cn } from "@/lib/utils"
import { useAuthStore, useHasRole } from "@/stores/auth.store"
import type { Post } from "@/types/community.api.type"

interface Props {
  post: Post
  /** True on the post's own detail page: no click-to-navigate, larger type. */
  detail?: boolean
  /** Hide the game chip when the feed is already scoped to that game. */
  showGame?: boolean
  /** Fires after a successful delete/remove — the detail page uses this to
   *  send the reader back to the feed rather than showing a 404. */
  onDeleted?: () => void
}

export function PostCard({
  post,
  detail = false,
  showGame = true,
  onDeleted,
}: Props) {
  const router = useRouter()
  const userId = useAuthStore((state) => state.user?.user_id)
  const isStaff = useHasRole("SUPPORT", "ADMIN")
  const isAuthor = userId === post.author_id

  const [spoilerRevealed, setSpoilerRevealed] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  const deletePost = useDeletePostMutation()
  const reportPost = useReportPostMutation()

  function goToDetail() {
    if (!detail) router.push(`/community/${post.id}`)
  }

  function stop(event: React.SyntheticEvent) {
    event.stopPropagation()
  }

  const removed = post.status !== "ACTIVE"

  return (
    <article
      onClick={goToDetail}
      className={cn(
        "rounded-xl border border-border bg-card p-4",
        !detail &&
          "cursor-pointer transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
      )}
      {...(!detail
        ? {
            tabIndex: 0,
            role: "link",
            onKeyDown: (event: React.KeyboardEvent) => {
              if (event.key === "Enter") goToDetail()
            },
          }
        : {})}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1.5">
          {showGame && <GameChip gameId={post.game_id} />}
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <AuthorChip
              authorId={post.author_id}
              className="font-medium text-foreground"
            />
            <span aria-hidden>·</span>
            <span>{formatRelative(post.created_at)}</span>
            {post.edited_at && (
              <span className="text-muted-foreground/70">(edited)</span>
            )}
            {removed && (
              <Badge variant="destructive" className="ms-1">
                {post.status === "REMOVED_BY_MODERATION"
                  ? "Removed by Support"
                  : "Deleted"}
              </Badge>
            )}
          </div>
        </div>

        <div onClick={stop}>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label="Post actions"
                  className="flex min-h-8 min-w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                />
              }
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {isAuthor && (
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="size-3.5" />
                  Edit
                </DropdownMenuItem>
              )}
              {(isAuthor || isStaff) && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() =>
                    deletePost.mutate(post.id, { onSuccess: onDeleted })
                  }
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
        </div>
      </div>

      <div className="mt-2 space-y-3">
        {post.spoiler && !spoilerRevealed ? (
          <button
            type="button"
            onClick={(event) => {
              stop(event)
              setSpoilerRevealed(true)
            }}
            className="flex min-h-16 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <EyeOff className="size-4" aria-hidden />
            Spoiler — click to show
          </button>
        ) : (
          <>
            {post.spoiler && (
              <button
                type="button"
                onClick={(event) => {
                  stop(event)
                  setSpoilerRevealed(false)
                }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Eye className="size-3.5" aria-hidden />
                Hide spoiler
              </button>
            )}
            <p
              className={cn(
                "whitespace-pre-wrap text-foreground",
                detail
                  ? "text-sm leading-relaxed"
                  : "line-clamp-6 text-sm leading-relaxed"
              )}
            >
              {post.body || (
                <span className="text-muted-foreground">(no text)</span>
              )}
            </p>
          </>
        )}

        {post.attachments.length > 0 && (!post.spoiler || spoilerRevealed) && (
          <AttachmentGallery attachments={post.attachments} />
        )}

        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                #{tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div
        className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3"
        onClick={stop}
      >
        <ReactionPicker postId={post.id} reactions={post.reactions} />

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {detail ? (
            <span className="flex items-center gap-1">
              <MessageCircle className="size-3.5" aria-hidden />
              {post.comment_count}
            </span>
          ) : (
            <Link
              href={`/community/${post.id}`}
              className="flex items-center gap-1 hover:text-foreground"
            >
              <MessageCircle className="size-3.5" aria-hidden />
              {post.comment_count}
            </Link>
          )}
          <span className="flex items-center gap-1">
            <Eye className="size-3.5" aria-hidden />
            {post.view_count}
          </span>
        </div>
      </div>

      <div onClick={stop}>
        <EditPostDialog
          post={post}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
        <ReportDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          title="Report this post"
          isPending={reportPost.isPending}
          onSubmit={(reason) => reportPost.mutate({ postId: post.id, reason })}
        />
      </div>
    </article>
  )
}
