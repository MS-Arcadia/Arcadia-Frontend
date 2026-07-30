import { API } from "@/lib/api-paths"
import { http } from "@/services/http"
import type { Page } from "@/types/common.api.type"
import type {
  FestivalDetailView,
  FestivalView,
} from "@/types/festival.api.type"

export const festivalKeys = {
  all: ["festivals"] as const,
  list: (filters: FestivalFilters) => ["festivals", "list", filters] as const,
  detail: (id: string) => ["festivals", id] as const,
}

export interface FestivalFilters {
  limit?: number
  offset?: number
}

export async function getFestivals(
  filters: FestivalFilters
): Promise<Page<FestivalView>> {
  const { data } = await http.get<Page<FestivalView>>(API.festivals.list, {
    params: filters,
  })
  return data
}

export async function getFestival(id: string): Promise<FestivalDetailView> {
  const { data } = await http.get<FestivalDetailView>(API.festivals.detail(id))
  return data
}

export interface CreateFestivalBody {
  name: string
  description?: string
  starts_at: string
  ends_at: string
}

/** Admin only. */
export async function createFestival(
  body: CreateFestivalBody
): Promise<FestivalDetailView> {
  const { data } = await http.post<FestivalDetailView>(
    API.festivals.create,
    body
  )
  return data
}

/** Admin only. DRAFT only. */
export async function rescheduleFestival(
  id: string,
  startsAt: string,
  endsAt: string
): Promise<FestivalDetailView> {
  const { data } = await http.patch<FestivalDetailView>(
    API.festivals.reschedule(id),
    { starts_at: startsAt, ends_at: endsAt }
  )
  return data
}

/** Admin only. */
export async function addFestivalGame(
  id: string,
  gameId: string
): Promise<FestivalDetailView> {
  const { data } = await http.post<FestivalDetailView>(
    API.festivals.addGame(id),
    { game_id: gameId }
  )
  return data
}

/** Admin only. */
export async function removeFestivalGame(
  id: string,
  gameId: string
): Promise<FestivalDetailView> {
  const { data } = await http.delete<FestivalDetailView>(
    API.festivals.removeGame(id, gameId)
  )
  return data
}

/** Admin only. Requires at least one selected game. */
export async function startFestival(id: string): Promise<FestivalDetailView> {
  const { data } = await http.post<FestivalDetailView>(API.festivals.start(id))
  return data
}

/** Admin only. */
export async function endFestival(id: string): Promise<FestivalDetailView> {
  const { data } = await http.post<FestivalDetailView>(API.festivals.end(id))
  return data
}

/** Admin only. */
export async function cancelFestival(id: string): Promise<FestivalDetailView> {
  const { data } = await http.post<FestivalDetailView>(API.festivals.cancel(id))
  return data
}
