import {
  Bell,
  ClipboardCheck,
  Gamepad2,
  LibraryBig,
  Receipt,
  Store,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react"

import type { Role } from "@/types/common.api.type"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Shown in the mobile bar. Everything else is desktop-only, because a
   *  five-item bar on a phone is already one item too many. */
  primary?: boolean
  /** Which roles see it at all. Absent means everybody. */
  roles?: Role[]
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Store", icon: Store, primary: true },
  { href: "/library", label: "Library", icon: LibraryBig, primary: true },
  { href: "/wallet", label: "Wallet", icon: Wallet, primary: true },
  { href: "/notifications", label: "Notifications", icon: Bell, primary: true },
  { href: "/orders", label: "Orders", icon: Receipt },
]

/**
 * The role-gated half of the navigation.
 *
 * Hidden by role for *tidiness*, not for security — each of these pages checks the
 * role itself and every service checks the token, so a hand-typed URL gets an
 * explanation rather than a blank screen.
 */
export const STAFF_NAV: NavItem[] = [
  {
    href: "/developer",
    label: "My games",
    icon: Gamepad2,
    roles: ["DEVELOPER"],
  },
  {
    href: "/review",
    label: "Review queue",
    icon: ClipboardCheck,
    roles: ["SUPPORT", "ADMIN"],
  },
  { href: "/admin", label: "Accounts", icon: UserRound, roles: ["ADMIN"] },
]

export function navFor(role: Role | undefined): NavItem[] {
  if (!role) return []
  return STAFF_NAV.filter((item) => !item.roles || item.roles.includes(role))
}

/**
 * Whether a nav item should read as current.
 *
 * The store lives at "/" so it cannot use a prefix test — every route would match
 * it. Everything else does, so `/orders/abc123` still highlights "Orders".
 */
export function isCurrent(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href)
}
