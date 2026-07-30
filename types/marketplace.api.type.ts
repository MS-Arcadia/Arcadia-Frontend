/** Transcribed from marketplace-service/internal/{adapter/in/restapi,app,domain}. */

import type { Money } from "./common.api.type"

export type OrderSide = "BUY" | "SELL"
export type MarketOrderStatus = "OPEN" | "CANCELLED" | "FILLED"

export interface MarketItem {
  id: string
  game_id: string
  developer_id: string
  title: string
  description: string
  image_url: string
  buy_value: Money
  sell_value: Money
  created_at: string
}

export interface BookDepth {
  price: Money
  orders: number
}

export interface BookView {
  item_id: string
  buys: BookDepth[]
  sells: BookDepth[]
  best?: { bid?: Money; ask?: Money }
}

export interface MarketOrder {
  id: string
  item_id: string
  user_id: string
  side: OrderSide
  price: Money
  status: MarketOrderStatus
  created_at: string
  trade_id?: string
}

export interface Trade {
  id: string
  item_id: string
  buyer_id: string
  seller_id: string
  price: Money
  matched_at: string
}

export interface Holding {
  user_id: string
  item_id: string
  quantity: number
}
