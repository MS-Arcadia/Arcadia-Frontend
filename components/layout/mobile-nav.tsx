"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { useUnreadCountQuery } from "@/queries/notifications"
import { NAV_ITEMS, isCurrent } from "@/lib/navigation"
import { formatNumber } from "@/lib/money"
import { cn } from "@/lib/utils"

/**
 * The phone bar. Four destinations, not five — the fifth would make every target
 * too narrow to hit reliably, and Orders is reachable from the wallet.
 *
 * Padded for the home-indicator inset so the last row of a list is not sitting
 * under it when the app is installed.
 */
export function MobileNav() {
  const pathname = usePathname()
  const { data: unread } = useUnreadCountQuery()
  const items = NAV_ITEMS.filter((item) => item.primary)

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const current = isCurrent(pathname, item.href)
          const count =
            item.href === "/notifications" ? (unread?.unread ?? 0) : 0

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-1 text-[0.7rem] select-none",
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
                      {count > 9 ? "۹+" : formatNumber(count)}
                    </Badge>
                  )}
                </span>
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
