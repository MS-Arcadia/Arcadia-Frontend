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

export interface LibraryEntry {
  ownership: Ownership
  game: Game
}

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
