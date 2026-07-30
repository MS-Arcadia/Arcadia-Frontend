import { API } from "@/lib/api-paths"
import { http } from "@/services/http"
import type { Page } from "@/types/common.api.type"
import type {
  BookView,
  Holding,
  MarketItem,
  MarketOrder,
  OrderSide,
  Trade,
} from "@/types/marketplace.api.type"

export const marketplaceKeys = {
  all: ["marketplace"] as const,
  items: (filters: ItemFilters) => ["marketplace", "items", filters] as const,
  item: (id: string) => ["marketplace", "items", id] as const,
  book: (id: string) => ["marketplace", "items", id, "book"] as const,
  orders: () => ["marketplace", "orders"] as const,
  trades: () => ["marketplace", "trades"] as const,
  holdings: (userId: string) => ["marketplace", "holdings", userId] as const,
}

export interface ItemFilters {
  game_id?: string
  limit?: number
  offset?: number
}

export async function getItems(filters: ItemFilters): Promise<Page<MarketItem>> {
  const { data } = await http.get<Page<MarketItem>>(API.marketplace.items, {
    params: filters,
  })
  return data
}

export async function getItem(id: string): Promise<MarketItem> {
  const { data } = await http.get<MarketItem>(API.marketplace.item(id))
  return data
}

export async function getBook(itemId: string): Promise<BookView> {
  const { data } = await http.get<BookView>(API.marketplace.book(itemId))
  return data
}

export interface CreateItemBody {
  game_id: string
  title: string
  description: string
  image_url: string
  /** Minor-unit integers, as strings — money is never a JS number on the wire. */
  buy_value: string
  sell_value: string
}

export async function createItem(body: CreateItemBody): Promise<MarketItem> {
  const { data } = await http.post<MarketItem>(API.marketplace.items, body)
  return data
}

export async function distributeItem(
  itemId: string,
  count: number
): Promise<{ granted: number }> {
  const { data } = await http.post<{ granted: number }>(
    API.marketplace.distribute(itemId),
    { count }
  )
  return data
}

export async function getOrders(): Promise<Page<MarketOrder>> {
  const { data } = await http.get<Page<MarketOrder>>(API.marketplace.orders, {
    params: { limit: 50 },
  })
  return data
}

export interface PlaceMarketOrderBody {
  item_id: string
  side: OrderSide
  /** Minor-unit integer, as a string. */
  price: string
}

export async function placeMarketOrder(
  body: PlaceMarketOrderBody
): Promise<MarketOrder> {
  const { data } = await http.post<MarketOrder>(API.marketplace.orders, body)
  return data
}

export async function cancelMarketOrder(id: string): Promise<MarketOrder> {
  const { data } = await http.delete<MarketOrder>(API.marketplace.cancelOrder(id))
  return data
}

export async function getTrades(): Promise<Page<Trade>> {
  const { data } = await http.get<Page<Trade>>(API.marketplace.trades, {
    params: { limit: 50 },
  })
  return data
}

export async function getHoldings(userId: string): Promise<Holding[]> {
  const { data } = await http.get<{ items: Holding[]; total: number }>(
    API.marketplace.holdings(userId)
  )
  return data.items
}

/** Staff only — runs the five-minute matching pass now, so a demo does not wait. */
export async function runMatchingNow(): Promise<{ status: string }> {
  const { data } = await http.post<{ status: string }>(
    API.marketplace.runMatching
  )
  return data
}
