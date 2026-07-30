"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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
import type { ResolutionAction } from "@/types/community.api.type"

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
      client.setQueryData(communityKeys.post(postId), (post: unknown) =>
        post && typeof post === "object"
          ? { ...post, reactions: summary.reactions }
          : post
      )
      void client.invalidateQueries({
        queryKey: communityKeys.all,
        exact: false,
      })
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
