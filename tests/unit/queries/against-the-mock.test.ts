import { configure, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import * as mock from "@/services/mocks/db"
import { resetDb, signIn } from "@/services/mocks/db"
import { PLAYER_ID } from "@/services/mocks/seed"

import { useAuthStore } from "@/stores/auth.store"
import { renderHookWithQuery } from "../../helpers/query"

// Every answer here crosses the mock adapter's ~180ms latency, and a query
// that chains requests stacks it. waitFor's 1s default is comfortable on a
// laptop and tight on a shared CI runner, so this file waits longer. The
// configure call is scoped to this file's isolated module registry.
configure({ asyncUtilTimeout: 5000 })

/**
 * The remaining read hooks, exercised against the real mock backend.
 *
 * The endpoint layer is pinned request-by-request elsewhere; what these add is
 * the hooks' contract end to end — keying, enabling, and the shapes the screens
 * render — with answers coming from the same axios adapter the app ships with,
 * not from a stub. Each test starts from the seeded database, signed in as the
 * role the hook is for.
 */
beforeEach(() => {
  resetDb()
  signIn("player@arcadia.local", "player-password")
})

describe("notifications", () => {
  it("lists a notification the platform sent, and marks the batch read", async () => {
    // Make sure there is something to read.
    mock.buy(mock.db.games.find((game) => game.title === "Paper Kingdoms")!.id)

    const {
      useMarkAllReadMutation,
      useNotificationsQuery,
      useUnreadCountQuery,
    } = await import("@/queries/notifications")

    const list = renderHookWithQuery(() => useNotificationsQuery())
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true))
    expect(list.result.current.data?.items.length).toBeGreaterThan(0)

    const badge = renderHookWithQuery(() => useUnreadCountQuery())
    await waitFor(() => expect(badge.result.current.isSuccess).toBe(true))
    expect(badge.result.current.data?.unread).toBeGreaterThan(0)

    const mutation = renderHookWithQuery(() => useMarkAllReadMutation())
    mutation.result.current.mutate()
    await waitFor(
      () => {
        expect(mutation.result.current.isSuccess).toBe(true)
      },
      { timeout: 3000 }
    )

    const after = renderHookWithQuery(() => useUnreadCountQuery())
    await waitFor(() => expect(after.result.current.isSuccess).toBe(true))
    expect(after.result.current.data?.unread).toBe(0)
  })
})

describe("reviews", () => {
  it("lists a game's reviews with its average rating", async () => {
    const game = mock.db.games.find(
      (g) => g.state === "PUBLISHED" && mock.ownedGameIds(PLAYER_ID).has(g.id)
    )!
    mock.createUserReview({
      game_id: game.id,
      text: "A fantastic journey from start to finish.",
      sentiment: "LIKE",
    })

    const { useAverageRatingQuery, useGameReviewsQuery } =
      await import("@/queries/reviews")

    const reviews = renderHookWithQuery(() => useGameReviewsQuery(game.id, {}))
    await waitFor(() => expect(reviews.result.current.isSuccess).toBe(true))
    expect(reviews.result.current.data?.reviews.length).toBeGreaterThan(0)

    const rating = renderHookWithQuery(() => useAverageRatingQuery(game.id))
    await waitFor(() => expect(rating.result.current.isSuccess).toBe(true))
    expect(rating.result.current.data).toMatchObject({
      game_id: game.id,
    })
  })
})

describe("festivals", () => {
  it("lists the seeded festivals and fetches one by id", async () => {
    const { useFestivalQuery, useFestivalsQuery } =
      await import("@/queries/festivals")

    const list = renderHookWithQuery(() => useFestivalsQuery({}))
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true))
    const festival = list.result.current.data?.items[0]
    expect(festival?.id).toBeTruthy()

    const detail = renderHookWithQuery(() => useFestivalQuery(festival!.id))
    await waitFor(() => expect(detail.result.current.isSuccess).toBe(true))
    expect(detail.result.current.data).toMatchObject({ id: festival!.id })
  })
})

describe("recommendations", () => {
  it("answers the caller's own and a game's neighbours", async () => {
    const game = mock.db.games.find(
      (candidate) => candidate.state === "PUBLISHED"
    )!

    const { useMyRecommendationsQuery, useSimilarGamesQuery } =
      await import("@/queries/recommendations")

    const mine = renderHookWithQuery(() => useMyRecommendationsQuery(5))
    await waitFor(() => expect(mine.result.current.isSuccess).toBe(true))
    expect(Array.isArray(mine.result.current.data?.items)).toBe(true)

    const similar = renderHookWithQuery(() => useSimilarGamesQuery(game.id, 4))
    await waitFor(() => expect(similar.result.current.isSuccess).toBe(true))
  })
})

describe("community", () => {
  it("reads the explore feed and a post with its comments", async () => {
    const post = mock.db.posts[0]

    const { useCommentsQuery, useExploreFeedQuery, usePostQuery } =
      await import("@/queries/community")

    const feed = renderHookWithQuery(() => useExploreFeedQuery({}))
    await waitFor(() => expect(feed.result.current.isSuccess).toBe(true))
    expect(feed.result.current.data?.items.length).toBeGreaterThan(0)

    const single = renderHookWithQuery(() => usePostQuery(post.id))
    await waitFor(() => expect(single.result.current.isSuccess).toBe(true))
    expect(single.result.current.data).toMatchObject({ id: post.id })

    const comments = renderHookWithQuery(() => useCommentsQuery(post.id, null))
    await waitFor(() => expect(comments.result.current.isSuccess).toBe(true))
  })
})

describe("marketplace", () => {
  it("lists items, the caller's orders, trades and holdings", async () => {
    // useHoldingsQuery reads userId from the Zustand auth store;
    // signIn on the mock db alone doesn't populate it.
    useAuthStore.setState({ userId: PLAYER_ID })

    const {
      useHoldingsQuery,
      useItemsQuery,
      useMyOrdersQuery,
      useMyTradesQuery,
    } = await import("@/queries/marketplace")

    const items = renderHookWithQuery(() => useItemsQuery({}))
    await waitFor(() => expect(items.result.current.isSuccess).toBe(true))
    expect(items.result.current.data?.items.length).toBeGreaterThan(0)

    for (const hook of [useMyOrdersQuery, useMyTradesQuery]) {
      const view = renderHookWithQuery(() => hook())
      await waitFor(() => expect(view.result.current.isSuccess).toBe(true))
    }

    const holdings = renderHookWithQuery(() => useHoldingsQuery())
    await waitFor(() => expect(holdings.result.current.isSuccess).toBe(true))
  })
})

describe("profiles", () => {
  it("reads a public profile and resolves its library into games", async () => {
    const { useProfileGamesQuery, usePublicProfileQuery } =
      await import("@/queries/profile")

    const profile = renderHookWithQuery(() => usePublicProfileQuery(PLAYER_ID))
    await waitFor(() => expect(profile.result.current.isSuccess).toBe(true))
    expect(profile.result.current.data?.display_name).toBe("Sam Player")

    const games = renderHookWithQuery(() =>
      useProfileGamesQuery(profile.result.current.data)
    )
    await waitFor(() => expect(games.result.current.isSuccess).toBe(true))
    // The seed puts two published games in the player's library.
    expect(games.result.current.data?.length).toBe(2)
  })
})

describe("workflow", () => {
  it("a developer sees their own catalogue; Support sees the review queue", async () => {
    signIn("dev@arcadia.local", "dev-password")
    const { useMyGamesQuery } = await import("@/queries/workflow")

    const mine = renderHookWithQuery(() => useMyGamesQuery())
    await waitFor(() => expect(mine.result.current.isSuccess).toBe(true))
    expect(mine.result.current.data?.items.length).toBe(5)

    signIn("support@arcadia.local", "support-password")
    const { useReviewQueueQuery } = await import("@/queries/workflow")
    const queue = renderHookWithQuery(() => useReviewQueueQuery())
    await waitFor(() => expect(queue.result.current.isSuccess).toBe(true))
    expect(queue.result.current.data?.items.length).toBeGreaterThan(0)
  })
})

describe("wallet", () => {
  it("reads the wallet and its page-numbered ledger", async () => {
    const { useLedgerQuery, useWalletQuery } = await import("@/queries/wallet")

    const wallet = renderHookWithQuery(() => useWalletQuery())
    await waitFor(() => expect(wallet.result.current.isSuccess).toBe(true))
    expect(wallet.result.current.data?.balance.amount_minor).toBe("350000000")

    const ledger = renderHookWithQuery(() => useLedgerQuery())
    await waitFor(() => expect(ledger.result.current.isSuccess).toBe(true))
  })

  it("Support can list the gift cards", async () => {
    signIn("support@arcadia.local", "support-password")
    const { useGiftCardsQuery } = await import("@/queries/wallet")

    const cards = renderHookWithQuery(() => useGiftCardsQuery())
    await waitFor(() => expect(cards.result.current.isSuccess).toBe(true))
  })
})
