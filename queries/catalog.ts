"use client"

import { useQueries, useQuery } from "@tanstack/react-query"

import {
  catalogKeys,
  getGame,
  getGames,
  getLibrary,
  type GameFilters,
} from "@/api/catalog"

/** The storefront. Five minutes: a price or a promotion changing mid-browse is
 *  not worth a refetch on every keystroke, and the order service re-checks the
 *  price at the moment of sale anyway. */
export function useGamesQuery(filters: GameFilters) {
  return useQuery({
    queryKey: catalogKeys.games(filters),
    queryFn: () => getGames(filters),
    staleTime: 5 * 60 * 1000,
  })
}

export function useGameQuery(id: string) {
  return useQuery({
    queryKey: catalogKeys.game(id),
    queryFn: () => getGame(id),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(id),
  })
}

/**
 * The games behind a set of ownership records.
 *
 * `/catalog/v1/library` returns ownerships carrying `game_id` and no title, so a screen that
 * shows what you own has to ask for each one. One query per game rather than a single joined
 * call, because they cache and invalidate individually — opening a game you own then costs
 * nothing, and the store's copy of it is the same cache entry.
 */
export function useOwnedGamesQuery(gameIds: string[]) {
  return useQueries({
    queries: gameIds.map((id) => ({
      queryKey: catalogKeys.game(id),
      queryFn: () => getGame(id),
      staleTime: 5 * 60 * 1000,
    })),
    combine: (results) => ({
      games: new Map(
        results.flatMap((result) =>
          result.data ? [[result.data.id, result.data]] : []
        )
      ),
      isPending: results.some((result) => result.isPending),
    }),
  })
}

/** Shorter, because a purchase adds to it and the person will look immediately. */
export function useLibraryQuery() {
  return useQuery({
    queryKey: catalogKeys.library(),
    queryFn: getLibrary,
    staleTime: 30 * 1000,
  })
}
