"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { authKeys, getProfile, hideGame, unhideGame } from "@/api/auth"
import { getGame } from "@/api/catalog"
import { getTopPostsByAuthor } from "@/api/community"
import { getItem } from "@/api/marketplace"
import type { PublicProfile } from "@/types/auth.api.type"
import type { GameDetail } from "@/types/catalog.api.type"
import type { Post } from "@/types/community.api.type"
import type { MarketItem } from "@/types/marketplace.api.type"

export function usePublicProfileQuery(userId: string) {
  return useQuery({
    queryKey: authKeys.profile(userId),
    queryFn: () => getProfile(userId),
    enabled: Boolean(userId),
    staleTime: 30 * 1000,
  })
}

/**
 * Resolve bare game ids on a profile into storefront cards.
 *
 * Callers must read `isLoading`, not `isPending`. With no ids the query is
 * disabled, and TanStack Query v5 keeps `isPending` true forever in that
 * state — which is why Library on a profile with an empty shelf never left
 * its skeleton.
 */
export function useProfileGamesQuery(profile: PublicProfile | undefined) {
  const ids = profile?.owned_games.map((entry) => entry.game_id) ?? []
  return useQuery({
    queryKey: ["profile", "games", ids],
    queryFn: async (): Promise<GameDetail[]> => {
      const games = await Promise.all(
        ids.map(async (id) => {
          try {
            return await getGame(id)
          } catch {
            return null
          }
        })
      )
      return games.filter((game): game is GameDetail => game !== null)
    },
    enabled: ids.length > 0,
    staleTime: 60 * 1000,
  })
}

export function useProfileItemsQuery(profile: PublicProfile | undefined) {
  const ids = profile?.owned_items.map((entry) => entry.item_id) ?? []
  return useQuery({
    queryKey: ["profile", "items", ids],
    queryFn: async (): Promise<MarketItem[]> => {
      const items = await Promise.all(
        ids.map(async (id) => {
          try {
            return await getItem(id)
          } catch {
            return null
          }
        })
      )
      return items.filter((item): item is MarketItem => item !== null)
    },
    enabled: ids.length > 0,
    staleTime: 60 * 1000,
  })
}

export function useProfileTopPostsQuery(userId: string) {
  return useQuery({
    queryKey: ["community", "top-posts", userId],
    queryFn: (): Promise<Post[]> => getTopPostsByAuthor(userId),
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
  })
}

export function useHideGameMutation(userId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (gameId: string) => hideGame(gameId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: authKeys.profile(userId) })
    },
  })
}

export function useUnhideGameMutation(userId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (gameId: string) => unhideGame(gameId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: authKeys.profile(userId) })
    },
  })
}
