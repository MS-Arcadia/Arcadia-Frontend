import { MarketingHeader } from "@/components/marketing/marketing-header"

/**
 * The public shell.
 *
 * No `AuthGuard`, no sidebar, no wallet chip: this is the one part of the site a
 * visitor sees before they have an account, and wrapping it in the signed-in
 * furniture would mean either a broken shell or a redirect away from the page that
 * is supposed to convince them to sign up.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border px-6 py-10 lg:px-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground/70">
            Arcadia — a game distribution platform. Seven services, one
            storefront.
          </p>
          <p className="text-xs text-muted-foreground/50">
            Wallet · Payments · Catalogue · Orders · Media · Auth ·
            Notifications
          </p>
        </div>
      </footer>
    </div>
  )
}
