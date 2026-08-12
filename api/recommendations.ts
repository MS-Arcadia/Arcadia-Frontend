import { API } from "@/lib/api-paths"
import { http } from "@/services/http"
import type {
  RecommendationsResponse,
  SimilarGamesResponse,
} from "@/types/recommendation.api.type"

export const recommendationKeys = {
  all: ["recommendations"] as const,
  mine: (limit: number) => ["recommendations", "mine", limit] as const,
  forUser: (userId: string, limit: number) =>
    ["recommendations", "user", userId, limit] as const,
  similar: (gameId: string, limit: number) =>
    ["recommendations", "similar", gameId, limit] as const,
}

export async function getMyRecommendations(
  limit?: number
): Promise<RecommendationsResponse> {
  const { data } = await http.get<RecommendationsResponse>(
    API.recommendations.mine,
    { params: limit ? { limit } : undefined }
  )
  return data
}

/** Support or the user themselves — the service enforces it, this just calls it. */
export async function getRecommendationsForUser(
  userId: string,
  limit?: number
): Promise<RecommendationsResponse> {
  const { data } = await http.get<RecommendationsResponse>(
    API.recommendations.forUser(userId),
    { params: limit ? { limit } : undefined }
  )
  return data
}

/** Public — a property of the catalogue, not of who's asking. */
export async function getSimilarGames(
  gameId: string,
  limit?: number
): Promise<SimilarGamesResponse> {
  const { data } = await http.get<SimilarGamesResponse>(
    API.recommendations.similar(gameId),
    { params: limit ? { limit } : undefined }
  )
  return data
}
