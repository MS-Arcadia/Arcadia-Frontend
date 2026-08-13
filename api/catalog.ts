import { API } from "@/lib/api-paths"
import { http } from "@/services/http"
import type { Game, GameDetail, Ownership } from "@/types/catalog.api.type"
import type { Page } from "@/types/common.api.type"

export const catalogKeys = {
  all: ["catalog"] as const,
  games: (filters: GameFilters) => ["catalog", "games", filters] as const,
  game: (id: string) => ["catalog", "games", id] as const,
  library: () => ["catalog", "library"] as const,
}

export interface GameFilters {
  q?: string
  genre?: string
  state?: string
  sort?: "newest" | "price-asc" | "discount"
  limit?: number
  offset?: number
}

/**
 * What `/catalog/v1/library` actually answers: `Page[OwnershipView]`.
 *
 * It used to be declared here as `{ ownership, game }`, a shape the service has never
 * produced — it returns flat ownership records carrying `game_id` and nothing else. The
 * library page destructured the game out of it and crashed on the real platform, while the
 * mock, which invented the pair, made the page look correct.
 *
 * A screen that needs the game reads it with `useGameQuery(entry.game_id)`. That is one
 * request per owned title, and the alternative — joining against the public catalogue — is
 * wrong for exactly the games a library must still show: a withdrawn or unpublished one is
 * not in that list, and it does not stop being owned.
 */
export type LibraryEntry = Ownership

export async function getGames(filters: GameFilters): Promise<Page<Game>> {
  const { data } = await http.get<Page<Game>>(API.catalog.games, {
    params: filters,
  })
  return data
}

export async function getGame(id: string): Promise<GameDetail> {
  const { data } = await http.get<GameDetail>(API.catalog.game(id))
  return data
}

export async function getLibrary(): Promise<Page<LibraryEntry>> {
  const { data } = await http.get<Page<LibraryEntry>>(API.catalog.library, {
    params: { limit: 100 },
  })
  return data
}
