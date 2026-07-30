/** Transcribed from review-service/src/{application/dto.py,domain/value_objects.py}. */

export type ReviewSentiment = "LIKE" | "DISLIKE"
export type ReviewStatus = "ACTIVE" | "EDITED" | "DELETED"

/** The maximum length of a review's text, in words — requirement 1.7. */
export const MAX_REVIEW_WORDS = 1000

export interface Review {
  id: string
  author_id: string
  game_id: string
  text: string
  sentiment: ReviewSentiment
  status: ReviewStatus
  like_count: number
  dislike_count: number
  created_at: string
  edited_at: string | null
}

/**
 * `total` is the count on this page, not across every page — the service's own
 * bug (routes.py sets it to `len(reviews)`), reproduced here rather than
 * papered over, so the mock disagrees with the live service in exactly the way
 * the live service disagrees with itself.
 */
export interface ReviewListResponse {
  reviews: Review[]
  total: number
  page: number
  page_size: number
}

export interface AverageRating {
  game_id: string
  average_rating: number | null
  total_reviews: number
  likes: number
  dislikes: number
}

export type ReviewSortBy = "created_at" | "like_count" | "dislike_count"
export type SortOrder = "asc" | "desc"
