import { API } from "@/lib/api-paths"
import { http } from "@/services/http"
import type {
  AverageRating,
  Review,
  ReviewListResponse,
  ReviewSentiment,
  ReviewSortBy,
  SortOrder,
} from "@/types/review.api.type"

export const reviewKeys = {
  all: ["reviews"] as const,
  forGame: (gameId: string, filters: ReviewFilters) =>
    ["reviews", gameId, filters] as const,
  rating: (gameId: string) => ["reviews", gameId, "rating"] as const,
}

export interface ReviewFilters {
  limit?: number
  offset?: number
  sort_by?: ReviewSortBy
  sort_order?: SortOrder
}

export async function getGameReviews(
  gameId: string,
  filters: ReviewFilters
): Promise<ReviewListResponse> {
  const { data } = await http.get<ReviewListResponse>(
    API.reviews.forGame(gameId),
    { params: filters }
  )
  return data
}

export async function getAverageRating(gameId: string): Promise<AverageRating> {
  const { data } = await http.get<AverageRating>(API.reviews.rating(gameId))
  return data
}

export interface CreateReviewBody {
  game_id: string
  text: string
  sentiment: ReviewSentiment
}

export async function createReview(body: CreateReviewBody): Promise<Review> {
  const { data } = await http.post<Review>(API.reviews.create, body)
  return data
}

export interface EditReviewBody {
  text: string
  sentiment?: ReviewSentiment
}

export async function editReview(
  id: string,
  body: EditReviewBody
): Promise<Review> {
  const { data } = await http.put<Review>(API.reviews.edit(id), body)
  return data
}

export async function deleteReview(id: string): Promise<void> {
  await http.delete(API.reviews.remove(id))
}

export async function reportReview(
  id: string,
  reason: string
): Promise<{ message: string }> {
  const { data } = await http.post<{ message: string }>(
    API.reviews.report(id),
    { reason }
  )
  return data
}

export async function reactToReview(
  id: string,
  reactionType: ReviewSentiment
): Promise<{ message: string }> {
  const { data } = await http.post<{ message: string }>(API.reviews.react(id), {
    reaction_type: reactionType,
  })
  return data
}

/** Support/Admin only. */
export async function resolveReviewReport(
  reviewId: string,
  reportId: string,
  deleteReviewToo: boolean
): Promise<Review> {
  const { data } = await http.post<Review>(
    API.reviews.resolveReport(reviewId, reportId),
    null,
    { params: { delete_review: deleteReviewToo } }
  )
  return data
}
