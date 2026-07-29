"use client"

import { useQuery } from "@tanstack/react-query"

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

/** Shorter, because a purchase adds to it and the person will look immediately. */
export function useLibraryQuery() {
  return useQuery({
    queryKey: catalogKeys.library(),
    queryFn: getLibrary,
    staleTime: 30 * 1000,
  })
}
