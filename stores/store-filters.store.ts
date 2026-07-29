"use client"

import { create } from "zustand"

import type { GameFilters } from "@/api/catalog"

/**
 * What the storefront is currently filtered by.
 *
 * In a store rather than in the URL, deliberately: the search box lives in the
 * top bar, which is outside the page, and pushing a query string on every
 * keystroke would fill the back button with half-typed words. The trade-off is
 * that a filtered store is not a shareable link — when that becomes something
 * anybody asks for, this moves to `useSearchParams` and the top bar reads it.
 */
interface StoreFiltersState {
  search: string
  genre: string | null
  sort: NonNullable<GameFilters["sort"]>
  onlyDiscounted: boolean
}

const INITIAL: StoreFiltersState = {
  search: "",
  genre: null,
  sort: "newest",
  onlyDiscounted: false,
}

interface StoreFiltersStore extends StoreFiltersState {
  setSearch: (value: string) => void
  setGenre: (value: string | null) => void
  setSort: (value: StoreFiltersState["sort"]) => void
  toggleDiscounted: () => void
  reset: () => void
}

export const useStoreFilters = create<StoreFiltersStore>()((set) => ({
  ...INITIAL,
  setSearch: (search) => set({ search }),
  setGenre: (genre) => set({ genre }),
  setSort: (sort) => set({ sort }),
  toggleDiscounted: () =>
    set((state) => ({ onlyDiscounted: !state.onlyDiscounted })),
  reset: () => set(INITIAL),
}))
