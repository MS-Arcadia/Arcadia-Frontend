"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  getNotifications,
  getUnreadCount,
  markAllRead,
  markRead,
  notificationKeys,
} from "@/api/notifications"

export function useNotificationsQuery(unreadOnly = false) {
  return useQuery({
    queryKey: notificationKeys.list(unreadOnly),
    queryFn: () => getNotifications(unreadOnly),
    staleTime: 20 * 1000,
  })
}

/**
 * The badge. Polled, because notifications arrive from Kafka rather than from
 * anything this client did — there is no mutation to invalidate on. A minute is
 * the compromise: often enough that a gift feels live, rare enough that a tab
 * left open overnight is not a thousand requests.
 */
export function useUnreadCountQuery() {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: getUnreadCount,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
  })
}

export function useMarkReadMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: markRead,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

export function useMarkAllReadMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: markAllRead,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}
