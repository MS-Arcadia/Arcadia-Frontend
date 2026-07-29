import { API } from "@/lib/api-paths"
import { http } from "@/services/http"
import type { Game, GameDetail, Promotion } from "@/types/catalog.api.type"
import type { Page } from "@/types/common.api.type"

/**
 * Requirement 1.3's publishing workflow, as the catalog exposes it.
 *
 * Two roles act on the same game in turn — the developer submits, prices and
 * publishes; Support reviews and suggests a price — so the calls are grouped by
 * the endpoint rather than by who makes them, and the screens decide what to show.
 */

export const workflowKeys = {
  mine: () => ["workflow", "mine"] as const,
  reviewQueue: () => ["workflow", "review-queue"] as const,
  promotions: (gameId: string) => ["workflow", "promotions", gameId] as const,
}

export async function getMyGames(): Promise<Page<Game>> {
  const { data } = await http.get<Page<Game>>(API.catalog.mine)
  return data
}

export async function getReviewQueue(): Promise<Page<Game>> {
  const { data } = await http.get<Page<Game>>(API.catalog.reviewQueue, {
    params: { limit: 50 },
  })
  return data
}

export interface RegisterGameBody {
  title: string
  description: string
  min_requirements: string
  genres: string[]
}

export async function registerGame(
  body: RegisterGameBody
): Promise<GameDetail> {
  const { data } = await http.post<GameDetail>(API.catalog.games, body)
  return data
}

export async function addVersion(
  gameId: string,
  version: string,
  sizeBytes: number
): Promise<GameDetail> {
  const { data } = await http.post<GameDetail>(API.catalog.versions(gameId), {
    version,
    size_bytes: sizeBytes,
    file_ref: "placeholder",
  })
  return data
}

// --- the developer's side --------------------------------------------------

export async function submitGame(gameId: string): Promise<GameDetail> {
  const { data } = await http.post<GameDetail>(API.catalog.submit(gameId))
  return data
}

export async function setFinalPrice(
  gameId: string,
  amountMinor: number
): Promise<GameDetail> {
  const { data } = await http.post<GameDetail>(API.catalog.price(gameId), {
    amount_minor: amountMinor,
  })
  return data
}

export async function publishGame(gameId: string): Promise<GameDetail> {
  const { data } = await http.post<GameDetail>(API.catalog.publish(gameId))
  return data
}

export async function withdrawGame(
  gameId: string,
  reason: string
): Promise<GameDetail> {
  const { data } = await http.post<GameDetail>(API.catalog.withdraw(gameId), {
    reason,
  })
  return data
}

export async function relistGame(gameId: string): Promise<GameDetail> {
  const { data } = await http.post<GameDetail>(API.catalog.relist(gameId))
  return data
}

export async function appealRejection(
  gameId: string,
  note: string
): Promise<GameDetail> {
  const { data } = await http.post<GameDetail>(API.catalog.appeal(gameId), {
    note,
  })
  return data
}

// --- Support's side -------------------------------------------------------

export async function startReview(gameId: string): Promise<GameDetail> {
  const { data } = await http.post<GameDetail>(API.catalog.reviewStart(gameId))
  return data
}

export async function approveGame(
  gameId: string,
  note: string
): Promise<GameDetail> {
  const { data } = await http.post<GameDetail>(
    API.catalog.reviewApprove(gameId),
    { note }
  )
  return data
}

/** The note is required, not optional: a rejection with no reason is
 *  unactionable, and the catalog refuses one. */
export async function rejectGame(
  gameId: string,
  note: string
): Promise<GameDetail> {
  const { data } = await http.post<GameDetail>(
    API.catalog.reviewReject(gameId),
    { note }
  )
  return data
}

export async function suggestPrice(
  gameId: string,
  amountMinor: number
): Promise<GameDetail> {
  const { data } = await http.post<GameDetail>(
    API.catalog.suggestPrice(gameId),
    {
      amount_minor: amountMinor,
    }
  )
  return data
}

// --- promotions: Support proposes, the developer decides -------------------

export async function getPromotions(gameId: string): Promise<Page<Promotion>> {
  const { data } = await http.get<Page<Promotion>>(
    API.catalog.promotions(gameId)
  )
  return data
}

export interface ProposePromotionBody {
  /** Basis points off. 2000 is 20%, 10000 makes the game free. */
  discount_bps: number
  starts_at: string
  ends_at: string
  festival_id?: string
  note?: string
}

export async function proposePromotion(
  gameId: string,
  body: ProposePromotionBody
): Promise<Promotion> {
  const { data } = await http.post<Promotion>(
    API.catalog.promotions(gameId),
    body
  )
  return data
}

export async function decidePromotion(
  gameId: string,
  promotionId: string,
  approve: boolean,
  note = ""
): Promise<Promotion> {
  const path = approve
    ? API.catalog.approvePromotion(gameId, promotionId)
    : API.catalog.rejectPromotion(gameId, promotionId)
  const { data } = await http.post<Promotion>(path, { note })
  return data
}
