import { API } from "@/lib/api-paths"
import { http } from "@/services/http"
import type { Page } from "@/types/common.api.type"
import type {
  MarkedRead,
  Notification,
  UnreadCount,
} from "@/types/notification.api.type"

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (unreadOnly: boolean) =>
    ["notifications", "list", { unreadOnly }] as const,
  unreadCount: () => ["notifications", "unread-count"] as const,
}

export async function getNotifications(
  unreadOnly = false
): Promise<Page<Notification>> {
  const { data } = await http.get<Page<Notification>>(API.notifications.list, {
    params: { limit: 50, unread_only: unreadOnly ? "true" : undefined },
  })
  return data
}

/** Its own endpoint because a badge wants the number without the rows, and it is
 *  answered from a partial index on unread rows. */
export async function getUnreadCount(): Promise<UnreadCount> {
  const { data } = await http.get<UnreadCount>(API.notifications.unreadCount)
  return data
}

/** Idempotent: marking an already-read notification returns it unchanged rather
 *  than conflicting. */
export async function markRead(id: string): Promise<Notification> {
  const { data } = await http.post<Notification>(API.notifications.read(id))
  return data
}

export async function markAllRead(): Promise<MarkedRead> {
  const { data } = await http.post<MarkedRead>(API.notifications.readAll)
  return data
}
