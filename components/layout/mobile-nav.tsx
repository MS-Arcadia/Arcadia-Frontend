"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { useUnreadCountQuery } from "@/queries/notifications"
import { useAuthStore } from "@/stores/auth.store"
import { NAV_ITEMS, isCurrent, navFor } from "@/lib/navigation"
import { formatNumber } from "@/lib/money"
import { cn } from "@/lib/utils"

/**
 * The phone bar.
 *
 * Same destinations as the desktop rail, including the role-gated Manage group —
 * a four-item cut left Market, Community, Orders, Festivals and every staff
 * screen reachable only by guessing a URL. Horizontal scroll keeps the targets
 * large enough to hit once the list grows past four.
 *
 * Padded for the home-indicator inset so the last row of a list is not sitting
 * under it when the app is installed.
 */
export function MobileNav() {
  const pathname = usePathname()
  const { data: unread } = useUnreadCountQuery()
  const role = useAuthStore((state) => state.user?.role)
  const items = [...NAV_ITEMS, ...navFor(role)]

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <ul className="flex [scrollbar-width:none] gap-0.5 overflow-x-auto px-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const current = isCurrent(pathname, item.href)
          const count =
            item.href === "/notifications" ? (unread?.unread ?? 0) : 0

          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "relative flex min-h-14 min-w-[4.25rem] flex-col items-center justify-center gap-1 px-2 text-[0.7rem] select-none",
                  current ? "text-primary" : "text-muted-foreground"
                )}
              >
                <span className="relative">
                  <item.icon
                    className="size-5"
                    strokeWidth={current ? 2.25 : 1.75}
                  />
                  {count > 0 && (
                    <Badge className="absolute -end-2 -top-1.5 h-4 min-w-4 justify-center p-0 text-[0.6rem]">
                      {count > 9 ? "9+" : formatNumber(count)}
                    </Badge>
                  )}
                </span>
                <span className="max-w-[4.5rem] truncate">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
