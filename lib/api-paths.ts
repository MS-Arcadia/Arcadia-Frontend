/**
 * Every path this app calls, written as the gateway will expose them.
 *
 * The platform is seven services on seven ports and there is no gateway yet.
 * Rather than hard-code seven base URLs and rewrite every call site when the
 * gateway lands, all paths here are prefixed by service — `/catalog`, `/orders`,
 * `/wallet`, `/auth`, `/notifications` — against a single base URL.
 *
 *   NEXT_PUBLIC_API_MODE=mock     → the adapter in services/mocks answers
 *   NEXT_PUBLIC_API_MODE=live     → the gateway at NEXT_PUBLIC_API_URL answers
 *
 * **Everything after the service prefix is transcribed from the owning service's
 * router, not guessed.** Two that are easy to get wrong: the auth service has no
 * `/users/me` — a profile is fetched by id from `/v1/profile/{id}` — and the
 * catalog mounts its game routes under `/v1/games` while the workflow and library
 * routes sit at `/v1` directly.
 */
export const API = {
  auth: {
    register: "/auth/v1/auth/register",
    login: "/auth/v1/auth/login",
    refresh: "/auth/v1/auth/refresh",
    logout: "/auth/v1/auth/logout",
    /** By id. There is no "me" route; the id comes from the token's `sub`. */
    profile: (userId: string) => `/auth/v1/profile/${userId}`,
    requestRole: "/auth/v1/roles/request",
    decideRoleRequest: (requestId: string) =>
      `/auth/v1/roles/${requestId}/decide`,
    decideRegistration: (userId: string) =>
      `/auth/v1/registrations/${userId}/decide`,
    grantRole: (userId: string) => `/auth/v1/admin/users/${userId}/grant-role`,
    ban: (userId: string) => `/auth/v1/admin/users/${userId}/ban`,
    unban: (userId: string) => `/auth/v1/admin/users/${userId}/unban`,
    /** Not a real endpoint on the auth service — the admin screens need a list of
     *  people and there is no query API for it yet. Mock-only, and the developer
     *  note in the admin page says so. */
    users: "/auth/v1/admin/users",
  },
  catalog: {
    games: "/catalog/v1/games",
    game: (id: string) => `/catalog/v1/games/${id}`,
    gameDetail: (id: string) => `/catalog/v1/games/${id}/detail`,
    mine: "/catalog/v1/games/mine",
    versions: (id: string) => `/catalog/v1/games/${id}/versions`,
    library: "/catalog/v1/library",
    reviewQueue: "/catalog/v1/review-queue",

    // The publishing workflow, in the order it actually runs.
    submit: (id: string) => `/catalog/v1/games/${id}/submit`,
    reviewStart: (id: string) => `/catalog/v1/games/${id}/review/start`,
    reviewApprove: (id: string) => `/catalog/v1/games/${id}/review/approve`,
    reviewReject: (id: string) => `/catalog/v1/games/${id}/review/reject`,
    appeal: (id: string) => `/catalog/v1/games/${id}/appeal`,
    suggestPrice: (id: string) => `/catalog/v1/games/${id}/suggest-price`,
    price: (id: string) => `/catalog/v1/games/${id}/price`,
    publish: (id: string) => `/catalog/v1/games/${id}/publish`,
    withdraw: (id: string) => `/catalog/v1/games/${id}/withdraw`,
    relist: (id: string) => `/catalog/v1/games/${id}/relist`,
    openPreorders: (id: string) => `/catalog/v1/games/${id}/preorders`,

    promotions: (id: string) => `/catalog/v1/games/${id}/promotions`,
    approvePromotion: (id: string, promotionId: string) =>
      `/catalog/v1/games/${id}/promotions/${promotionId}/approve`,
    rejectPromotion: (id: string, promotionId: string) =>
      `/catalog/v1/games/${id}/promotions/${promotionId}/reject`,
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
