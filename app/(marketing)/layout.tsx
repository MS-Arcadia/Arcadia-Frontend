import { MarketingShell } from "@/components/marketing/marketing-shell"

/**
 * The public shell.
 *
 * No `AuthGuard` on the unsigned paths: this is the part of the site a visitor
 * sees before they have an account. Community flips to the signed-in rail when
 * there is a session — see `MarketingShell`.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <MarketingShell>{children}</MarketingShell>
}
