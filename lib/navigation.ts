import {
  Bell,
  ClipboardCheck,
  Flag,
  Gamepad2,
  Gift,
  LibraryBig,
  MessagesSquare,
  PartyPopper,
  Receipt,
  ShoppingBag,
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
  /** Prefer earlier placement in the mobile scroll bar. Desktop shows everything. */
  primary?: boolean
  /** Which roles see it at all. Absent means everybody. */
  roles?: Role[]
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/store", label: "Store", icon: Store, primary: true },
  { href: "/library", label: "Library", icon: LibraryBig, primary: true },
  { href: "/wallet", label: "Wallet", icon: Wallet, primary: true },
  { href: "/notifications", label: "Notifications", icon: Bell, primary: true },
  { href: "/market", label: "Market", icon: ShoppingBag },
  { href: "/community", label: "Community", icon: MessagesSquare },
  { href: "/orders", label: "Orders", icon: Receipt },
  { href: "/festivals", label: "Festivals", icon: PartyPopper },
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
  {
    href: "/community-reports",
    label: "Community reports",
    icon: MessagesSquare,
    roles: ["SUPPORT", "ADMIN"],
  },
  {
    href: "/review-reports",
    label: "Review reports",
    icon: Flag,
    roles: ["SUPPORT", "ADMIN"],
  },
  {
    // Support and Admin both, because the wallet allows both to issue them. Gating this
    // to Admin would hide it from half the people entitled to use it.
    href: "/gift-cards",
    label: "Gift cards",
    icon: Gift,
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
 * A prefix test throughout, so `/orders/abc123` still highlights "Orders". This was
 * a special case while the store lived at "/" — every route matched it — and stopped
 * needing one when the landing page took that path.
 */
export function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}
