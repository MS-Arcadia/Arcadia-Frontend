"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  cancelMarketOrder,
  createItem,
  distributeItem,
  getBook,
  getHoldings,
  getItem,
  getItems,
  getOrders,
  getTrades,
  marketplaceKeys,
  placeMarketOrder,
  runMatchingNow,
  type CreateItemBody,
  type ItemFilters,
  type PlaceMarketOrderBody,
} from "@/api/marketplace"
import { useAuthStore } from "@/stores/auth.store"

export function useItemsQuery(filters: ItemFilters) {
  return useQuery({
    queryKey: marketplaceKeys.items(filters),
    queryFn: () => getItems(filters),
    staleTime: 30 * 1000,
  })
}

export function useItemQuery(id: string) {
  return useQuery({
    queryKey: marketplaceKeys.item(id),
    queryFn: () => getItem(id),
    staleTime: 30 * 1000,
    enabled: Boolean(id),
  })
}

/** Shorter than most reads here: the order book changes as often as anyone
 *  places or cancels an order, and the whole point of the page is to see that. */
export function useBookQuery(itemId: string) {
  return useQuery({
    queryKey: marketplaceKeys.book(itemId),
    queryFn: () => getBook(itemId),
    staleTime: 10 * 1000,
    enabled: Boolean(itemId),
  })
}

export function useMyOrdersQuery() {
  return useQuery({
    queryKey: marketplaceKeys.orders(),
    queryFn: getOrders,
    staleTime: 15 * 1000,
  })
}

export function useMyTradesQuery() {
  return useQuery({
    queryKey: marketplaceKeys.trades(),
    queryFn: getTrades,
    staleTime: 30 * 1000,
  })
}

export function useHoldingsQuery() {
  const userId = useAuthStore((state) => state.userId)
  return useQuery({
    queryKey: marketplaceKeys.holdings(userId ?? ""),
    queryFn: () => getHoldings(userId ?? ""),
    staleTime: 15 * 1000,
    enabled: Boolean(userId),
  })
}

function useMarketInvalidation() {
  const client = useQueryClient()
  return (itemId?: string) => {
    void client.invalidateQueries({ queryKey: marketplaceKeys.orders() })
    void client.invalidateQueries({ queryKey: marketplaceKeys.trades() })
    void client.invalidateQueries({ queryKey: marketplaceKeys.all })
    if (itemId) {
      void client.invalidateQueries({ queryKey: marketplaceKeys.book(itemId) })
    }
  }
}

export function useCreateItemMutation() {
  const invalidate = useMarketInvalidation()
  return useMutation({
    mutationFn: (body: CreateItemBody) => createItem(body),
    onSuccess: (item) => {
      invalidate()
      toast.success(`${item.title} listed on the market`)
    },
  })
}

export function useDistributeItemMutation() {
  return useMutation({
    mutationFn: (args: { itemId: string; count: number }) =>
      distributeItem(args.itemId, args.count),
    onSuccess: (result) => {
      toast.success(`Handed out to ${result.granted} people`)
    },
  })
}

export function usePlaceMarketOrderMutation() {
  const invalidate = useMarketInvalidation()
  return useMutation({
    mutationFn: (body: PlaceMarketOrderBody) => placeMarketOrder(body),
    onSuccess: (order) => {
      invalidate(order.item_id)
      toast.success(
        order.side === "BUY" ? "Buy order placed" : "Sell order placed"
      )
    },
  })
}

export function useCancelMarketOrderMutation() {
  const invalidate = useMarketInvalidation()
  return useMutation({
    mutationFn: (id: string) => cancelMarketOrder(id),
    onSuccess: (order) => {
      invalidate(order.item_id)
      toast.success("Order cancelled")
    },
  })
}

export function useRunMatchingMutation() {
  const invalidate = useMarketInvalidation()
  return useMutation({
    mutationFn: runMatchingNow,
    onSuccess: () => {
      invalidate()
      toast.success("Matching pass complete")
    },
  })
}
