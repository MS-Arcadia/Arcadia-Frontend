"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Bell, Search, Wallet } from "lucide-react"

import { AccountMenu } from "@/components/layout/account-menu"
import { Logo } from "@/components/brand/logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useUnreadCountQuery } from "@/queries/notifications"
import { useWalletQuery } from "@/queries/wallet"
import { formatMoney, formatNumber } from "@/lib/money"
import { useStoreFilters } from "@/stores/store-filters.store"

/**
 * The bar carries the two things a storefront is always asked for — what can I
 * search, and what can I spend — and nothing else. The balance is a link rather
 * than a figure because the question behind "how much do I have" is usually
 * "can I add more".
 */
export function TopBar() {
  const router = useRouter()
  const pathname = usePathname()
  const { search, setSearch } = useStoreFilters()
  const { data: wallet } = useWalletQuery()
  const { data: unread } = useUnreadCountQuery()
  const count = unread?.unread ?? 0

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 lg:px-8">
        <Link href="/store" aria-label="Arcadia store" className="lg:hidden">
          <Logo priority className="max-w-[6.5rem]" />
        </Link>

        <div className="relative ms-auto w-full max-w-md lg:ms-0">
          <Search
            aria-hidden
            className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              // The search box is global chrome but only the store renders results,
              // so typing anywhere else used to do nothing visible. Going there on
              // the first keystroke is the only reading of "search" that is true.
              if (event.target.value && pathname !== "/store")
                router.push("/store")
            }}
            placeholder="Search games"
            aria-label="Search games"
            className="ps-9"
          />
        </div>

        <div className="ms-auto flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 tabular"
                  nativeButton={false}
                  render={<Link href="/wallet" />}
                >
                  <Wallet className="size-4" strokeWidth={1.75} />
                  <span className="hidden sm:inline">
                    {formatMoney(wallet?.available)}
                  </span>
                </Button>
              }
            />
            <TooltipContent>Available to spend</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative"
                  aria-label={
                    count > 0
                      ? `${count} unread notifications`
                      : "Notifications"
                  }
                  nativeButton={false}
                  render={<Link href="/notifications" />}
                >
                  <Bell className="size-4" strokeWidth={1.75} />
                  {count > 0 && (
                    <Badge className="absolute -end-0.5 -top-0.5 h-4 min-w-4 justify-center p-0 text-[0.6rem] tabular">
                      {count > 9 ? "۹+" : formatNumber(count)}
                    </Badge>
                  )}
                </Button>
              }
            />
            <TooltipContent>Notifications</TooltipContent>
          </Tooltip>

          <AccountMenu />
        </div>
      </div>
    </header>
  )
}
