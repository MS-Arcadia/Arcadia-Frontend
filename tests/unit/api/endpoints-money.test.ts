import { describe, expect, it, vi } from "vitest"

vi.mock("@/services/mocks/adapter", () => ({
  installMockAdapter: vi.fn(),
}))

import { API } from "@/lib/api-paths"
import {
  banUser,
  decideRegistration,
  decideRoleRequest,
  getPendingRoleRequests,
  getProfile,
  grantRole,
  hideGame,
  lookupRecipient,
  requestRole,
  setAvatar,
  suggestRecipients,
  unbanUser,
  unhideGame,
} from "@/api/auth"
import {
  getGiftCards,
  getLedger,
  getWallet,
  initiateCharge,
  issueGiftCards,
  redeemGiftCard,
} from "@/api/wallet"
import {
  getNotifications,
  getUnreadCount,
  markAllRead,
  markRead,
} from "@/api/notifications"
import {
  getMyRecommendations,
  getRecommendationsForUser,
  getSimilarGames,
} from "@/api/recommendations"
import {
  cancelMarketOrder,
  createItem,
  distributeItem,
  getBook,
  getHoldings,
  getItem,
  getItems,
  getOrders,
  getTrades,
  placeMarketOrder,
  runMatchingNow,
} from "@/api/marketplace"

import { EndpointScripter } from "../../helpers/endpoint"
import { waitForCalls } from "../../helpers/http"

const IRR = { amount_minor: "100000", currency: "IRR" }

describe("auth endpoints", () => {
  it("gift-box lookup and suggest carry the query as `q`", async () => {
    const scripter = new EndpointScripter()

    await scripter.call(() => lookupRecipient("sam@"), {
      method: "get",
      url: API.auth.lookupRecipient,
      params: { q: "sam@" },
    })

    await scripter.call(() => suggestRecipients("sam"), {
      method: "get",
      url: API.auth.suggestRecipients,
      params: { q: "sam" },
    })
  })

  it("profiles and the pending-role queue read by id", async () => {
    const scripter = new EndpointScripter()

    await scripter.call(() => getProfile("user-1"), {
      method: "get",
      url: API.auth.profile("user-1"),
    })

    await scripter.call(() => getPendingRoleRequests(), {
      method: "get",
      url: API.auth.pendingRoleRequests,
    })
  })

  it("hiding and unhiding a library entry posts the game id", async () => {
    const scripter = new EndpointScripter()

    await scripter.call(() => hideGame("game-1"), {
      method: "post",
      url: API.auth.hideGame,
      body: { game_id: "game-1" },
    })

    await scripter.call(() => unhideGame("game-1"), {
      method: "post",
      url: API.auth.unhideGame,
      body: { game_id: "game-1" },
    })
  })

  it("setting an avatar uploads the bytes, then posts the public url", async () => {
    const scripter = new EndpointScripter()
    const pending = setAvatar(
      new File(["b"], "a.png", { type: "image/png" }),
      "user-1"
    )

    await waitForCalls(scripter.calls, 1)
    expect(scripter.calls[0].request.url.endsWith(API.media.upload)).toBe(true)
    scripter.calls[0].respond({
      data: {
        id: "med-1",
        kind: "IMAGE",
        url: "http://minio/arcadia-media/x/x/med-1",
        content_type: "image/png",
        size_bytes: 1,
        filename: "a.png",
      },
    })

    await waitForCalls(scripter.calls, 2)
    expect(scripter.calls[1].request.url.endsWith(API.auth.setAvatar)).toBe(
      true
    )
    expect(JSON.parse(scripter.calls[1].request.data as string)).toEqual({
      avatar_url: "http://minio/arcadia-media/x/x/med-1",
    })
    scripter.calls[1].respond({})

    await pending
  })

  it("role requests are requested, decided, granted and revoked by id", async () => {
    const scripter = new EndpointScripter()

    await scripter.call(() => requestRole("DEVELOPER"), {
      method: "post",
      url: API.auth.requestRole,
      body: { requested_role: "DEVELOPER" },
    })

    await scripter.call(() => decideRoleRequest("req-1", true, "welcome"), {
      method: "post",
      url: API.auth.decideRoleRequest("req-1"),
      body: { approve: true, note: "welcome" },
    })

    await scripter.call(() => grantRole("user-1", "SUPPORT"), {
      method: "post",
      url: API.auth.grantRole("user-1"),
      body: { new_role: "SUPPORT" },
    })

    await scripter.call(() => banUser("user-1", "fraud"), {
      method: "post",
      url: API.auth.ban("user-1"),
      body: { reason: "fraud" },
    })

    await scripter.call(() => unbanUser("user-1"), {
      method: "post",
      url: API.auth.unban("user-1"),
    })

    await scripter.call(() => decideRegistration("user-1", false), {
      method: "post",
      url: API.auth.decideRegistration("user-1"),
      body: { approve: false },
    })
  })
})

describe("wallet endpoints", () => {
  it("reads the wallet, and the ledger page-numbered", async () => {
    const scripter = new EndpointScripter()

    await scripter.call(() => getWallet(), {
      method: "get",
      url: API.wallet.me,
    })

    await scripter.call(() => getLedger(), {
      method: "get",
      url: API.wallet.ledger,
      params: { page: 1, page_size: 50 },
    })

    await scripter.call(() => getGiftCards(), {
      method: "get",
      url: API.wallet.giftCards,
      params: { page: 1, page_size: 100 },
    })
  })

  it("a charge posts the amount and an absolute return url", async () => {
    const scripter = new EndpointScripter()

    await scripter.call(() => initiateCharge(IRR), {
      method: "post",
      url: API.wallet.charges,
      body: {
        amount: IRR,
        return_url: `${window.location.origin}/wallet`,
      },
    })
  })

  it("issuing cards sends value/quantity/note; an empty note is omitted", async () => {
    const scripter = new EndpointScripter()

    await scripter.call(
      () =>
        issueGiftCards({
          amountMinor: "500000",
          currency: "IRR",
          quantity: 3,
          note: "  ",
        }),
      {
        method: "post",
        url: API.wallet.issueGiftCard,
        body: {
          value: { amount_minor: "500000", currency: "IRR" },
          quantity: 3,
          note: undefined,
        },
      }
    )
  })

  it("redeeming trims the typed code", async () => {
    const scripter = new EndpointScripter()

    await scripter.call(() => redeemGiftCard("  ARC-123  "), {
      method: "post",
      url: API.wallet.redeemGiftCard,
      body: { code: "ARC-123" },
    })
  })
})

describe("notification endpoints", () => {
  it("lists with limit 50, unread_only only when asked", async () => {
    const scripter = new EndpointScripter()

    await scripter.call(() => getNotifications(), {
      method: "get",
      url: API.notifications.list,
      params: { limit: 50, unread_only: undefined },
    })

    await scripter.call(() => getNotifications(true), {
      method: "get",
      url: API.notifications.list,
      params: { limit: 50, unread_only: "true" },
    })

    await scripter.call(() => getUnreadCount(), {
      method: "get",
      url: API.notifications.unreadCount,
    })

    await scripter.call(() => markRead("notif-1"), {
      method: "post",
      url: API.notifications.read("notif-1"),
    })

    await scripter.call(() => markAllRead(), {
      method: "post",
      url: API.notifications.readAll,
    })
  })
})

describe("recommendation endpoints", () => {
  it("carry the limit only when given", async () => {
    const scripter = new EndpointScripter()

    await scripter.call(() => getMyRecommendations(), {
      method: "get",
      url: API.recommendations.mine,
      params: undefined,
    })

    await scripter.call(() => getMyRecommendations(5), {
      method: "get",
      url: API.recommendations.mine,
      params: { limit: 5 },
    })

    await scripter.call(() => getRecommendationsForUser("user-1", 3), {
      method: "get",
      url: API.recommendations.forUser("user-1"),
      params: { limit: 3 },
    })

    await scripter.call(() => getSimilarGames("game-1", 7), {
      method: "get",
      url: API.recommendations.similar("game-1"),
      params: { limit: 7 },
    })
  })
})

describe("marketplace endpoints", () => {
  it("lists items with filters, one item, and its book", async () => {
    const scripter = new EndpointScripter()

    await scripter.call(() => getItems({ game_id: "game-1", limit: 5 }), {
      method: "get",
      url: API.marketplace.items,
      params: { game_id: "game-1", limit: 5 },
    })

    await scripter.call(() => getItem("item-1"), {
      method: "get",
      url: API.marketplace.item("item-1"),
    })

    await scripter.call(() => getBook("item-1"), {
      method: "get",
      url: API.marketplace.book("item-1"),
    })
  })

  it("creates an item and distributes copies of it", async () => {
    const scripter = new EndpointScripter()

    await scripter.call(
      () =>
        createItem({
          game_id: "game-1",
          title: "Neon Drift key",
          description: "",
          image_url: "/covers/neon-drift.svg",
          buy_value: "30000000",
          sell_value: "32000000",
        }),
      {
        method: "post",
        url: API.marketplace.items,
        body: {
          game_id: "game-1",
          title: "Neon Drift key",
          description: "",
          image_url: "/covers/neon-drift.svg",
          buy_value: "30000000",
          sell_value: "32000000",
        },
      }
    )

    await scripter.call(() => distributeItem("item-1", 10), {
      method: "post",
      url: API.marketplace.distribute("item-1"),
      body: { count: 10 },
    })
  })

  it("orders, trades and holdings; place and cancel; staff matching", async () => {
    const scripter = new EndpointScripter()

    await scripter.call(() => getOrders(), {
      method: "get",
      url: API.marketplace.orders,
      params: { limit: 50 },
    })

    await scripter.call(
      () =>
        placeMarketOrder({
          item_id: "item-1",
          side: "BUY",
          price: "31000000",
        }),
      {
        method: "post",
        url: API.marketplace.orders,
        body: { item_id: "item-1", side: "BUY", price: "31000000" },
      }
    )

    await scripter.call(() => cancelMarketOrder("order-1"), {
      method: "delete",
      url: API.marketplace.cancelOrder("order-1"),
    })

    await scripter.call(() => getTrades(), {
      method: "get",
      url: API.marketplace.trades,
      params: { limit: 50 },
    })

    const holdings = await scripter.call(
      () => getHoldings("user-1"),
      {
        method: "get",
        url: API.marketplace.holdings("user-1"),
      },
      { items: [], total: 0 }
    )
    expect(holdings).toEqual([])
    await scripter.call(() => runMatchingNow(), {
      method: "post",
      url: API.marketplace.runMatching,
    })
  })
})
