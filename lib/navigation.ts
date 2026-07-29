import {
  Bell,
  LibraryBig,
  Receipt,
  Store,
  Wallet,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Shown in the mobile bar. Everything else is desktop-only, because a
   *  five-item bar on a phone is already one item too many. */
  primary?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Store", icon: Store, primary: true },
  { href: "/library", label: "Library", icon: LibraryBig, primary: true },
  { href: "/wallet", label: "Wallet", icon: Wallet, primary: true },
  { href: "/notifications", label: "Notifications", icon: Bell, primary: true },
  { href: "/orders", label: "Orders", icon: Receipt },
]

/**
 * Whether a nav item should read as current.
 *
 * The store lives at "/" so it cannot use a prefix test — every route would
 * match it. Everything else does, so that `/orders/abc123` still highlights
 * "Orders".
 */
export function isCurrent(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href)
}
