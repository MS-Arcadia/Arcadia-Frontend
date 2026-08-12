"use client"

import { useQuery } from "@tanstack/react-query"

import {
  getMyRecommendations,
  getRecommendationsForUser,
  getSimilarGames,
  recommendationKeys,
} from "@/api/recommendations"

/** The batch that produces these runs every five minutes on the service side, so
 *  refetching more often than that on the client buys nothing. */
export function useMyRecommendationsQuery(limit = 10) {
  return useQuery({
    queryKey: recommendationKeys.mine(limit),
    queryFn: () => getMyRecommendations(limit),
    staleTime: 5 * 60 * 1000,
  })
}

/** Support, or the user themselves — the service is what actually enforces that;
 *  this hook just calls it and lets a 403 surface as a toast like any other. */
export function useRecommendationsForUserQuery(userId: string, limit = 10) {
  return useQuery({
    queryKey: recommendationKeys.forUser(userId, limit),
    queryFn: () => getRecommendationsForUser(userId, limit),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(userId),
  })
}

/** Public, so this is safe to call from a signed-out game page too. */
export function useSimilarGamesQuery(gameId: string, limit = 6) {
  return useQuery({
    queryKey: recommendationKeys.similar(gameId, limit),
    queryFn: () => getSimilarGames(gameId, limit),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(gameId),
  })
}
