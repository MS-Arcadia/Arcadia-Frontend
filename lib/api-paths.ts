/**
 * Every path this app calls, written as the gateway will expose them.
 *
 * The platform is seven services on seven ports today and there is no gateway
 * yet. Rather than hard-code seven base URLs and then rewrite every call site
 * when the gateway lands, all paths here are prefixed by service — `/catalog`,
 * `/orders`, `/wallet`, `/auth`, `/notifications` — against a single base URL.
 *
 * That makes the eventual switch a change to one environment variable:
 *
 *   NEXT_PUBLIC_API_MODE=mock     → the adapter in services/mocks answers
 *   NEXT_PUBLIC_API_MODE=live     → the gateway at NEXT_PUBLIC_API_URL answers
 *
 * The prefixes are also what the gateway's own routing table will need, so
 * choosing them now is not wasted work.
 */
export const API = {
  auth: {
    register: "/auth/v1/auth/register",
    login: "/auth/v1/auth/login",
    refresh: "/auth/v1/auth/refresh",
    logout: "/auth/v1/auth/logout",
    me: "/auth/v1/users/me",
    requestRole: "/auth/v1/users/me/role-requests",
  },
  catalog: {
    games: "/catalog/v1/games",
    game: (id: string) => `/catalog/v1/games/${id}`,
    library: "/catalog/v1/library",
    reviewQueue: "/catalog/v1/review-queue",
    submit: (id: string) => `/catalog/v1/games/${id}/submit`,
    publish: (id: string) => `/catalog/v1/games/${id}/publish`,
    price: (id: string) => `/catalog/v1/games/${id}/price`,
    promotions: (id: string) => `/catalog/v1/games/${id}/promotions`,
  },
  orders: {
    list: "/orders/v1/orders",
    detail: (id: string) => `/orders/v1/orders/${id}`,
    place: "/orders/v1/orders",
    gift: "/orders/v1/gifts",
    preorder: "/orders/v1/preorders",
    instalment: "/orders/v1/instalment-orders",
    refund: (id: string) => `/orders/v1/orders/${id}/refund`,
    plan: (id: string) => `/orders/v1/orders/${id}/instalment-plan`,
  },
  wallet: {
    me: "/wallet/v1/wallets/me",
    ledger: "/wallet/v1/wallets/me/ledger",
    holds: "/wallet/v1/wallets/me/holds",
    topUp: "/wallet/v1/wallets/me/top-ups",
  },
  notifications: {
    list: "/notifications/v1/notifications",
    unreadCount: "/notifications/v1/notifications/unread-count",
    readAll: "/notifications/v1/notifications/read-all",
    read: (id: string) => `/notifications/v1/notifications/${id}/read`,
  },
} as const
