"use client"

import {
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"

import {
  addComment,
  clearReaction,
  communityKeys,
  createPost,
  deleteComment,
  deletePost,
  editComment,
  editPost,
  getComments,
  getExploreFeed,
  getGameFeed,
  getModerationQueue,
  getPost,
  reportComment,
  reportPost,
  resolveReport,
  searchPosts,
  setReaction,
  type CreatePostInput,
  type EditPostBody,
  type FeedFilters,
} from "@/api/community"
import { useCommunityReactionsStore } from "@/stores/community-reactions.store"
import type { CursorPage } from "@/types/common.api.type"
import type {
  Post,
  ReactionSummary,
  ResolutionAction,
} from "@/types/community.api.type"

export function useGameFeedQuery(gameId: string, filters: FeedFilters) {
  return useQuery({
    queryKey: communityKeys.gameFeed(gameId, filters),
    queryFn: () => getGameFeed(gameId, filters),
    staleTime: 30 * 1000,
    enabled: Boolean(gameId),
  })
}

export function useExploreFeedQuery(filters: FeedFilters) {
  return useQuery({
    queryKey: communityKeys.exploreFeed(filters),
    queryFn: () => getExploreFeed(filters),
    staleTime: 30 * 1000,
  })
}

export function useSearchPostsQuery(query: string, filters: FeedFilters) {
  return useQuery({
    queryKey: communityKeys.search(query, filters),
    queryFn: () => searchPosts(query, filters),
    staleTime: 15 * 1000,
    enabled: query.trim().length > 0,
  })
}

export function usePostQuery(id: string) {
  return useQuery({
    queryKey: communityKeys.post(id),
    queryFn: () => getPost(id),
    staleTime: 15 * 1000,
    enabled: Boolean(id),
  })
}

export function useCommentsQuery(postId: string, cursor: string | null) {
  return useQuery({
    queryKey: communityKeys.comments(postId, cursor),
    queryFn: () => getComments(postId, cursor),
    staleTime: 15 * 1000,
    enabled: Boolean(postId),
  })
}

export function useModerationQueueQuery(cursor: string | null) {
  return useQuery({
    queryKey: communityKeys.moderationQueue(cursor),
    queryFn: () => getModerationQueue(cursor),
    staleTime: 15 * 1000,
  })
}

/** Feeds everywhere a post could appear — a new post, edit or delete touches
 *  its game's feed, the explore feed, and its own detail page all at once. */
function useCommunityInvalidation() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: communityKeys.all })
  }
}

export function useCreatePostMutation() {
  const invalidate = useCommunityInvalidation()
  return useMutation({
    mutationFn: (input: CreatePostInput) => createPost(input),
    onSuccess: () => {
      invalidate()
      toast.success("Posted")
    },
  })
}

export function useEditPostMutation() {
  const client = useQueryClient()
  const invalidate = useCommunityInvalidation()
  return useMutation({
    mutationFn: (args: { id: string; body: EditPostBody }) =>
      editPost(args.id, args.body),
    onSuccess: (post) => {
      invalidate()
      client.setQueryData(communityKeys.post(post.id), post)
      toast.success("Post updated")
    },
  })
}

export function useDeletePostMutation() {
  const invalidate = useCommunityInvalidation()
  return useMutation({
    mutationFn: (id: string) => deletePost(id),
    onSuccess: () => {
      invalidate()
      toast.success("Post deleted")
    },
  })
}

export function useAddCommentMutation(postId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => addComment(postId, body),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: ["community", "posts", postId, "comments"],
      })
      void client.invalidateQueries({ queryKey: communityKeys.post(postId) })
    },
  })
}

export function useEditCommentMutation(postId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (args: { commentId: string; body: string }) =>
      editComment(args.commentId, args.body),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: ["community", "posts", postId, "comments"],
      })
      toast.success("Comment updated")
    },
  })
}

export function useDeleteCommentMutation(postId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: ["community", "posts", postId, "comments"],
      })
      void client.invalidateQueries({ queryKey: communityKeys.post(postId) })
    },
  })
}

/**
 * Write the reaction summary into every cached copy of this post.
 *
 * The mock (and some live paths) mutate `post.reactions` in place on the same
 * object the feed already holds. Invalidating then refetches those same
 * references, React Query's structural sharing sees no change, and the chips
 * outside the picker stay frozen until a full remount. Spreading a new
 * `reactions` object onto a new post forces every feed/detail/top-posts entry
 * to re-render with the counts the server just returned.
 */
function applyReactionSummary(
  client: QueryClient,
  postId: string,
  summary: ReactionSummary
) {
  const reactions = Object.fromEntries(
    Object.entries(summary.reactions).filter(([, count]) => count > 0)
  )

  useCommunityReactionsStore.getState().setReaction(postId, summary.my_reaction)

  const patchPost = (post: Post): Post =>
    post.id === postId ? { ...post, reactions: { ...reactions } } : post

  client.setQueryData(communityKeys.post(postId), (data: Post | undefined) =>
    data ? patchPost(data) : data
  )

  client.setQueriesData({ queryKey: communityKeys.all }, (data: unknown) => {
    if (!data || typeof data !== "object") return data

    if (
      "pages" in data &&
      Array.isArray((data as InfiniteData<CursorPage<Post>>).pages)
    ) {
      const infinite = data as InfiniteData<CursorPage<Post>>
      let changed = false
      const pages = infinite.pages.map((page) => {
        let pageChanged = false
        const items = page.items.map((post) => {
          if (post.id !== postId) return post
          pageChanged = true
          changed = true
          return patchPost(post)
        })
        return pageChanged ? { ...page, items } : page
      })
      return changed ? { ...infinite, pages } : data
    }

    if ("items" in data && Array.isArray((data as CursorPage<Post>).items)) {
      const page = data as CursorPage<Post>
      let changed = false
      const items = page.items.map((post) => {
        if (post.id !== postId) return post
        changed = true
        return patchPost(post)
      })
      return changed ? { ...page, items } : data
    }

    if (Array.isArray(data)) {
      let changed = false
      const next = data.map((item) => {
        if (
          item &&
          typeof item === "object" &&
          "id" in item &&
          (item as Post).id === postId
        ) {
          changed = true
          return patchPost(item as Post)
        }
        return item
      })
      return changed ? next : data
    }

    if ("id" in data && (data as Post).id === postId && "reactions" in data) {
      return patchPost(data as Post)
    }

    return data
  })
}

/**
 * Toggling a reaction on and off is the same PUT/DELETE pair for every emoji,
 * so the picker calls one mutation with the emoji it was given rather than
 * twelve mutations that differ only in which string they send.
 */
export function useSetReactionMutation(postId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (args: { emoji: string; alreadyActive: boolean }) =>
      args.alreadyActive
        ? clearReaction(postId)
        : setReaction(postId, args.emoji),
    onSuccess: (summary) => {
      applyReactionSummary(client, postId, summary)
    },
  })
}

export function useReportPostMutation() {
  return useMutation({
    mutationFn: (args: { postId: string; reason: string }) =>
      reportPost(args.postId, args.reason),
    onSuccess: () => {
      toast.success("Reported to Support")
    },
  })
}

export function useReportCommentMutation() {
  return useMutation({
    mutationFn: (args: { commentId: string; reason: string }) =>
      reportComment(args.commentId, args.reason),
    onSuccess: () => {
      toast.success("Reported to Support")
    },
  })
}

export function useResolveReportMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (args: {
      reportId: string
      action: ResolutionAction
      note: string
    }) => resolveReport(args.reportId, args.action, args.note),
    onSuccess: (report) => {
      void client.invalidateQueries({ queryKey: ["community", "moderation"] })
      void client.invalidateQueries({ queryKey: communityKeys.all })
      toast.success(
        report.status === "RESOLVED_REMOVED"
          ? "Removed"
          : "Dismissed — nothing changed"
      )
    },
  })
}
