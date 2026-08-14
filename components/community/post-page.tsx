"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "nextjs-toploader/app"
import { useInfiniteQuery } from "@tanstack/react-query"
import { ArrowLeft, Loader2, MessageCircle, Send } from "lucide-react"

import { getComments } from "@/api/community"
import { CommentItem } from "@/components/community/comment-item"
import { PostCard } from "@/components/community/post-card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useAddCommentMutation, usePostQuery } from "@/queries/community"
import { useAuthStore } from "@/stores/auth.store"
import type { CursorPage } from "@/types/common.api.type"
import type { Comment } from "@/types/community.api.type"

interface Props {
  postId: string
}

export function PostPage({ postId }: Props) {
  const router = useRouter()
  const userId = useAuthStore((state) => state.userId)
  const signedIn = userId !== null
  const { data: post, isPending, isError } = usePostQuery(postId)

  const comments = useInfiniteQuery<CursorPage<Comment>>({
    queryKey: ["community", "posts", postId, "comments", "infinite"],
    queryFn: ({ pageParam }) =>
      getComments(postId, (pageParam as string | null) ?? null, 20),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.has_more ? last.next_cursor : undefined),
    staleTime: 15 * 1000,
    enabled: Boolean(postId),
  })

  const commentItems = comments.data?.pages.flatMap((page) => page.items) ?? []

  const [draft, setDraft] = useState("")
  const addComment = useAddCommentMutation(postId)

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-10 lg:px-10">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    )
  }

  if (isError || !post) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center lg:px-10">
        <h1 className="text-lg font-semibold">No such post</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been removed or deleted.
        </p>
        <Button
          variant="outline"
          className="mt-5 min-h-11"
          nativeButton={false}
          render={<Link href="/community" prefetch />}
        >
          Back to community
        </Button>
      </div>
    )
  }

  const commentsLoading = comments.isPending
  const loadingMore = comments.isFetchingNextPage

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-10 lg:px-10">
      <Button
        variant="ghost"
        size="sm"
        className="-ms-2 gap-1.5"
        nativeButton={false}
        render={<Link href={`/community?game=${post.game_id}`} prefetch />}
      >
        <ArrowLeft className="size-3.5 rtl:rotate-180" />
        Community
      </Button>

      <PostCard
        post={post}
        detail
        onDeleted={() => router.push("/community")}
      />

      <Separator />

      <section className="space-y-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <MessageCircle className="size-4" aria-hidden />
          Comments
        </h2>

        {signedIn ? (
          <div className="space-y-1.5">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Add a comment..."
              className="min-h-16"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                className="min-h-9 gap-1.5"
                disabled={addComment.isPending || !draft.trim()}
                onClick={() =>
                  addComment.mutate(draft.trim(), {
                    onSuccess: () => setDraft(""),
                  })
                }
              >
                {addComment.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                Comment
              </Button>
            </div>
          </div>
        ) : (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            Comments are public. Writing one needs an account.
            <Button
              variant="link"
              className="h-auto min-h-0 p-0 text-sm"
              nativeButton={false}
              render={
                <Link
                  href={`/sign-in?next=${encodeURIComponent(`/community/${postId}`)}`}
                  prefetch
                />
              }
            >
              Sign in to comment
            </Button>
          </p>
        )}

        {commentsLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        )}

        {!commentsLoading && comments.isError && (
          <p className="text-sm text-muted-foreground">
            Comments did not load. Reload the page to try again.
          </p>
        )}

        {!commentsLoading && !comments.isError && commentItems.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {signedIn
              ? "No comments yet. Be the first to say something."
              : "No comments yet."}
          </p>
        )}

        {commentItems.length > 0 && (
          <div className="divide-y divide-border">
            {commentItems.map((comment) => (
              <CommentItem key={comment.id} postId={postId} comment={comment} />
            ))}
          </div>
        )}

        {comments.hasNextPage && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              disabled={loadingMore}
              onClick={() => comments.fetchNextPage()}
            >
              {loadingMore && <Loader2 className="size-3.5 animate-spin" />}
              Load more comments
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}
