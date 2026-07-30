"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  createReview,
  deleteReview,
  editReview,
  getAverageRating,
  getGameReviews,
  reactToReview,
  reportReview,
  reviewKeys,
  type CreateReviewBody,
  type EditReviewBody,
  type ReviewFilters,
} from "@/api/reviews"
import type { ReviewSentiment } from "@/types/review.api.type"

export function useGameReviewsQuery(gameId: string, filters: ReviewFilters) {
  return useQuery({
    queryKey: reviewKeys.forGame(gameId, filters),
    queryFn: () => getGameReviews(gameId, filters),
    staleTime: 30 * 1000,
    enabled: Boolean(gameId),
  })
}

export function useAverageRatingQuery(gameId: string) {
  return useQuery({
    queryKey: reviewKeys.rating(gameId),
    queryFn: () => getAverageRating(gameId),
    staleTime: 30 * 1000,
    enabled: Boolean(gameId),
  })
}

function useReviewInvalidation(gameId: string) {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: reviewKeys.all })
    void client.invalidateQueries({ queryKey: reviewKeys.rating(gameId) })
  }
}

export function useCreateReviewMutation(gameId: string) {
  const invalidate = useReviewInvalidation(gameId)
  return useMutation({
    mutationFn: (args: { text: string; sentiment: ReviewSentiment }) =>
      createReview({ game_id: gameId, ...args } satisfies CreateReviewBody),
    onSuccess: () => {
      invalidate()
      toast.success("Review posted")
    },
  })
}

export function useEditReviewMutation(gameId: string) {
  const invalidate = useReviewInvalidation(gameId)
  return useMutation({
    mutationFn: (args: { reviewId: string; body: EditReviewBody }) =>
      editReview(args.reviewId, args.body),
    onSuccess: () => {
      invalidate()
      toast.success("Review updated")
    },
  })
}

export function useDeleteReviewMutation(gameId: string) {
  const invalidate = useReviewInvalidation(gameId)
  return useMutation({
    mutationFn: (reviewId: string) => deleteReview(reviewId),
    onSuccess: () => {
      invalidate()
      toast.success("Review deleted")
    },
  })
}

export function useReactToReviewMutation(gameId: string) {
  const invalidate = useReviewInvalidation(gameId)
  return useMutation({
    mutationFn: (args: { reviewId: string; reactionType: ReviewSentiment }) =>
      reactToReview(args.reviewId, args.reactionType),
    onSuccess: () => {
      invalidate()
    },
  })
}

export function useReportReviewMutation() {
  return useMutation({
    mutationFn: (args: { reviewId: string; reason: string }) =>
      reportReview(args.reviewId, args.reason),
    onSuccess: () => {
      toast.success("Reported to Support", {
        description:
          "They will look at it and remove it if it breaks the rules.",
      })
    },
  })
}
