"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Logo } from "@/components/brand/logo"
import { Badge } from "@/components/ui/badge"
import { useUnreadCountQuery } from "@/queries/notifications"
import { NAV_ITEMS, isCurrent } from "@/lib/navigation"
import { formatNumber } from "@/lib/money"
import { cn } from "@/lib/utils"

/**
 * The desktop rail.
 *
 * Desktop-first means this is the primary navigation, not a drawer that happens
 * to be pinned open: it is always visible from `lg` up, and the mobile bar is
 * the reduction rather than the other way round.
 */
export function AppSidebar() {
  const pathname = usePathname()
  const { data: unread } = useUnreadCountQuery()

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e border-sidebar-border bg-sidebar lg:flex">
      <div className="px-6 py-7">
        <Link href="/" aria-label="Arcadia home" className="block">
          <Logo priority className="max-w-[9.5rem]" />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => {
          const current = isCurrent(pathname, item.href)
          const count =
            item.href === "/notifications" ? (unread?.unread ?? 0) : 0

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={cn(
                "group relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                current
                  ? "bg-sidebar-accent font-medium text-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
              )}
            >
              {/* The active marker is a bar on the inline-start edge, which flips
                  with direction on its own because it is an inset-inline value. */}
              <span
                aria-hidden
                className={cn(
                  "inset-inline-start-0 absolute start-0 h-5 w-0.5 rounded-full bg-primary transition-opacity",
                  current ? "opacity-100" : "opacity-0"
                )}
              />
              <item.icon
                className="size-[1.15rem] shrink-0"
                strokeWidth={1.75}
              />
              <span className="flex-1">{item.label}</span>
              {count > 0 && (
                <Badge
                  variant="default"
                  className="h-5 min-w-5 px-1.5 text-[0.7rem] tabular"
                >
                  {formatNumber(count)}
                </Badge>
              )}
            </Link>
          )
        })}
      </nav>

      <p className="px-6 py-5 text-[0.7rem] leading-relaxed text-muted-foreground/60">
        Arcadia — game distribution platform
      </p>
    </aside>
  )
}
