"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { catalogKeys } from "@/api/catalog"
import { notificationKeys } from "@/api/notifications"
import {
  getInstalmentPlan,
  getOrder,
  getOrders,
  orderKeys,
  placeGift,
  placeInstalmentOrder,
  placeOrder,
  placePreorder,
  refundOrder,
} from "@/api/orders"
import { walletKeys } from "@/api/wallet"

export function useOrdersQuery() {
  return useQuery({
    queryKey: orderKeys.list(),
    queryFn: getOrders,
    staleTime: 30 * 1000,
  })
}

export function useOrderQuery(id: string) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => getOrder(id),
    staleTime: 10 * 1000,
    enabled: Boolean(id),
  })
}

export function useInstalmentPlanQuery(orderId: string) {
  return useQuery({
    queryKey: orderKeys.plan(orderId),
    queryFn: () => getInstalmentPlan(orderId),
    staleTime: 60 * 1000,
    enabled: Boolean(orderId),
  })
}

/**
 * Everything a sale touches, invalidated together.
 *
 * A purchase moves money, grants a library entry and raises a notification, so
 * leaving any of the three stale shows a person a wallet that still holds money
 * they have spent. Listing them here once is what stops each call site
 * remembering a different subset.
 */
function useSaleInvalidation() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: walletKeys.all })
    void client.invalidateQueries({ queryKey: orderKeys.all })
    void client.invalidateQueries({ queryKey: catalogKeys.library() })
    void client.invalidateQueries({ queryKey: notificationKeys.all })
  }
}

export function useBuyGameMutation() {
  const invalidate = useSaleInvalidation()
  return useMutation({
    mutationFn: placeOrder,
    onSuccess: (order) => {
      invalidate()
      toast.success(`${order.game_title} is yours`)
    },
  })
}

export function useGiftGameMutation() {
  const invalidate = useSaleInvalidation()
  return useMutation({
    mutationFn: placeGift,
    onSuccess: (order) => {
      invalidate()
      toast.success(`Gift of ${order.game_title} sent`)
    },
  })
}

export function usePreorderMutation() {
  const invalidate = useSaleInvalidation()
  return useMutation({
    mutationFn: placePreorder,
    onSuccess: (order) => {
      invalidate()
      toast.success(`${order.game_title} pre-ordered`, {
        description: "Your money is reserved and will be taken at release.",
      })
    },
  })
}

export function useInstalmentOrderMutation() {
  const invalidate = useSaleInvalidation()
  return useMutation({
    mutationFn: placeInstalmentOrder,
    onSuccess: (order) => {
      invalidate()
      toast.success(`Payment plan started for ${order.game_title}`, {
        description: "The game is already in your library.",
      })
    },
  })
}

export function useRefundMutation() {
  const invalidate = useSaleInvalidation()
  return useMutation({
    mutationFn: refundOrder,
    onSuccess: (order) => {
      invalidate()
      toast.success(`${order.game_title} refunded`)
    },
  })
}
