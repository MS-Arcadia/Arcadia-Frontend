/** Transcribed from recommendation-service/src/arcadia_recommendation/application/dto/recommendation_dto.py. */

export type RecommendationSource = "CONTENT" | "COLLAB" | "HYBRID" | "FALLBACK"

export interface RecommendationItem {
  game_id: string
  title: string
  genres: string[]
  score: number
  source: RecommendationSource
  rank: number
  reasons: string[]
}

export interface RecommendationsResponse {
  user_id: string
  source: RecommendationSource
  generated_at: string | null
  items: RecommendationItem[]
}

export interface SimilarGame {
  game_id: string
  title: string
  genres: string[]
  similarity: number
  shared_features: string[]
}

export interface SimilarGamesResponse {
  game_id: string
  items: SimilarGame[]
}
