"use client"

import { useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  BellOff,
  CalendarClock,
  CheckCheck,
  Gift,
  Handshake,
  PartyPopper,
  Receipt,
  ShieldAlert,
  Sparkles,
  UserCheck,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useMarkAllReadMutation,
  useMarkReadMutation,
  useNotificationsQuery,
} from "@/queries/notifications"
import { formatRelative } from "@/lib/datetime"
import { cn } from "@/lib/utils"
import type {
  Notification,
  NotificationKind,
} from "@/types/notification.api.type"

/**
 * An icon per kind, and a tone for the three that are bad news.
 *
 * `kind` is the contract the notification service designed for exactly this — it
 * is named for the reader's experience rather than the publishing service's event,
 * so it maps cleanly onto an icon without the UI having to know which service
 * produced what.
 */
const ICON: Record<NotificationKind, LucideIcon> = {
  GAME_APPROVED: Sparkles,
  GAME_REJECTED: AlertTriangle,
  GIFT_RECEIVED: Gift,
  TRADE_MATCHED: Handshake,
  FESTIVAL_STARTED: PartyPopper,
  ACCOUNT_BANNED: ShieldAlert,
  ACCOUNT_UNBANNED: UserCheck,
  REGISTRATION_APPROVED: UserCheck,
  REGISTRATION_REJECTED: AlertTriangle,
  ROLE_GRANTED: UserCheck,
  PURCHASE_COMPLETED: Receipt,
  PURCHASE_FAILED: AlertTriangle,
  ORDER_REFUNDED: Receipt,
  PREORDER_RELEASED: CalendarClock,
  INSTALMENT_PLAN_STARTED: CalendarClock,
  INSTALMENT_PAID: Receipt,
  INSTALMENT_PLAN_COMPLETED: CheckCheck,
  INSTALMENT_PLAN_DEFAULTED: ShieldAlert,
  PROMOTION_PROPOSED: Sparkles,
}

const BAD_NEWS = new Set<NotificationKind>([
  "GAME_REJECTED",
  "PURCHASE_FAILED",
  "ACCOUNT_BANNED",
  "REGISTRATION_REJECTED",
  "INSTALMENT_PLAN_DEFAULTED",
])

/** Where a notification's subject lives, so the row is a link to the thing that
 *  happened rather than a dead end. */
function hrefFor(note: Notification): string | null {
  switch (note.subject_type) {
    case "GAME":
      return `/games/${note.subject_id}`
    case "ORDER":
      return `/orders/${note.subject_id}`
    // A plan's subject id is the plan, not the order, and the detail page is keyed
    // by order — so this goes to the list, where the plan is one row away.
    case "INSTALMENT_PLAN":
      return "/orders"
    default:
      return null
  }
}

export default function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false)
  const { data, isPending } = useNotificationsQuery(unreadOnly)
  const markRead = useMarkReadMutation()
  const markAll = useMarkAllReadMutation()

  const notes = data?.items ?? []
  const unread = notes.filter((note) => !note.read).length

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Notifications</h1>

        <div className="ms-auto flex items-center gap-2">
          <Button
            variant={unreadOnly ? "default" : "outline"}
            size="sm"
            className="min-h-9"
            onClick={() => setUnreadOnly((value) => !value)}
          >
            Unread only
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="min-h-9 gap-1.5"
            disabled={unread === 0 || markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            <CheckCheck className="size-4" />
            Mark all read
          </Button>
        </div>
      </div>

      {isPending && (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!isPending && notes.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-16 text-center">
          <BellOff
            className="mx-auto size-8 text-muted-foreground/40"
            strokeWidth={1.5}
            aria-hidden
          />
          <p className="mt-4 text-sm font-medium">
            {unreadOnly ? "Nothing unread" : "Nothing yet"}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            This is where the platform tells you things: a gift arriving, a
            review decision, a payment taken. Nothing is written here by hand —
            every row came from something that happened.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {notes.map((note) => {
          const Icon = ICON[note.kind] ?? Receipt
          const bad = BAD_NEWS.has(note.kind)
          const href = hrefFor(note)

          const body = (
            <>
              <span
                aria-hidden
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full",
                  bad
                    ? "bg-destructive/15 text-destructive"
                    : "bg-primary/15 text-primary"
                )}
              >
                <Icon className="size-4" strokeWidth={1.75} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-start gap-2">
                  <span className="flex-1 text-sm font-medium">
                    {note.title}
                  </span>
                  {!note.read && (
                    <Badge className="shrink-0 border-primary/25 bg-primary/15 text-primary">
                      New
                    </Badge>
                  )}
                </span>
                {note.body && (
                  <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                    {note.body}
                  </span>
                )}
                <span className="mt-1.5 block text-xs text-muted-foreground/70">
                  {formatRelative(note.created_at)}
                </span>
              </span>
            </>
          )

          const shared = cn(
            "flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-start transition-colors",
            !note.read && "border-primary/25"
          )

          return (
            <li key={note.id}>
              {href ? (
                <Link
                  href={href}
                  className={cn(shared, "hover:border-primary/40")}
                  onClick={() => {
                    if (!note.read) markRead.mutate(note.id)
                  }}
                >
                  {body}
                </Link>
              ) : (
                <button
                  type="button"
                  className={cn(
                    shared,
                    !note.read && "hover:border-primary/40"
                  )}
                  disabled={note.read}
                  onClick={() => markRead.mutate(note.id)}
                >
                  {body}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
