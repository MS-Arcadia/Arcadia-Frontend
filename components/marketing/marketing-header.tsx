"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth.store"

/**
 * Only what a signed-out visitor can actually open.
 *
 * Catalogue, festivals and community are public reads, so they live here
 * rather than only behind the signed-in shell.
 */
const PUBLIC_LINKS = [
  { href: "/browse", label: "Games" },
  { href: "/festivals", label: "Festivals" },
  { href: "/community", label: "Community" },
] as const

/**
 * The public header.
 *
 * The call to action depends on whether there is already a session: somebody who is
 * signed in and lands here from a bookmark wants the store, not an invitation to
 * create the account they already have.
 */
export function MarketingHeader() {
  const userId = useAuthStore((state) => state.userId)
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-6 lg:px-10">
        <Link href="/" aria-label="Arcadia">
          <Logo priority className="w-32" />
        </Link>

        <PublicNav
          pathname={pathname}
          className="hidden items-center gap-1 md:flex"
        />

        <nav className="ms-auto flex items-center gap-2">
          {userId ? (
            <Button
              className="min-h-11"
              nativeButton={false}
              render={<Link href="/store" prefetch />}
            >
              Open the store
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                className="min-h-11"
                nativeButton={false}
                render={<Link href="/sign-in" prefetch />}
              >
                Sign in
              </Button>
              <Button
                className="min-h-11"
                nativeButton={false}
                render={<Link href="/sign-up" prefetch />}
              >
                Create an account
              </Button>
            </>
          )}
        </nav>
      </div>

      <PublicNav
        pathname={pathname}
        className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-6 pb-3 md:hidden lg:px-10"
      />
    </header>
  )
}

function PublicNav({
  pathname,
  className,
}: {
  pathname: string
  className?: string
}) {
  return (
    <nav className={className}>
      {PUBLIC_LINKS.map((link) => {
        const current =
          pathname === link.href || pathname.startsWith(`${link.href}/`)
        return (
          <Link
            key={link.href}
            href={link.href}
            prefetch
            aria-current={current ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors",
              current
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
