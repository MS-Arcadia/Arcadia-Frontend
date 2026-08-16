import { describe, it, vi } from "vitest"

vi.mock("@/services/mocks/adapter", () => ({
  installMockAdapter: vi.fn(),
}))

import { API } from "@/lib/api-paths"
import {
  addComment,
  clearReaction,
  createPost,
  deleteComment,
  deletePost,
  editComment,
  editPost,
  getComments,
  getExploreFeed,
  getGameFeed,
  getModerationQueue,
  getPost,
  getTopPostsByAuthor,
  reportComment,
  reportPost,
  resolveReport,
  searchPosts,
  setReaction,
} from "@/api/community"
import {
  createReview,
  deleteReview,
  editReview,
  getAverageRating,
  getGameReviews,
  reactToReview,
  reportReview,
  resolveReviewReport,
} from "@/api/reviews"
import {
  addFestivalGame,
  cancelFestival,
  createFestival,
  endFestival,
  getFestival,
  getFestivals,
  removeFestivalGame,
  rescheduleFestival,
  startFestival,
} from "@/api/festivals"

import { AS_FORM_DATA, EndpointScripter } from "../../helpers/endpoint"

describe("community endpoints", () => {
  it("reads the feeds with their filters as params", async () => {
    const scripter = new EndpointScripter()

    await scripter.call(
      () => getGameFeed("game-1", { sort: "newest", limit: 10 }),
      {
        method: "get",
        url: API.community.gameFeed("game-1"),
        params: { sort: "newest", limit: 10 },
      }
    )

    await scripter.call(() => getExploreFeed({ cursor: "abc" }), {
      method: "get",
      url: API.community.exploreFeed,
      params: { cursor: "abc" },
    })

    await scripter.call(() => searchPosts("neon", { limit: 5, cursor: null }), {
      method: "get",
      url: API.community.search,
      params: { q: "neon", limit: 5, cursor: null },
    })

    await scripter.call(() => getPost("post-1"), {
      method: "get",
      url: API.community.post("post-1"),
    })

    await scripter.call(() => getTopPostsByAuthor("author-1"), {
      method: "get",
      url: API.community.topPosts("author-1"),
    })
  })

  it("creates posts multipart, even with no files attached", async () => {
    const scripter = new EndpointScripter()

    await scripter.call(
      () =>
        createPost({
          game_id: "game-1",
          body: "first!",
          spoiler: true,
          tags: ["alpha"],
        }),
      {
        method: "post",
        url: API.community.createPostMultipart,
        body: AS_FORM_DATA,
      }
    )

    await scripter.call(() => createPost({ game_id: "game-1" }), {
      method: "post",
      url: API.community.createPostMultipart,
      body: AS_FORM_DATA,
    })
  })

  it("edits and deletes posts and comments on their own routes", async () => {
    const scripter = new EndpointScripter()

    await scripter.call(
      () => editPost("post-1", { body: "edited", spoiler: false }),
      {
        method: "patch",
        url: API.community.editPost("post-1"),
        body: { body: "edited", spoiler: false },
      }
    )

    await scripter.call(() => deletePost("post-1"), {
      method: "delete",
      url: API.community.deletePost("post-1"),
    })

    await scripter.call(() => getComments("post-1", null), {
      method: "get",
      url: API.community.comments("post-1"),
      params: { limit: 20 },
    })

    await scripter.call(() => getComments("post-1", "cur", 5), {
      method: "get",
      url: API.community.comments("post-1"),
      params: { cursor: "cur", limit: 5 },
    })

    await scripter.call(() => addComment("post-1", "nice"), {
      method: "post",
      url: API.community.comments("post-1"),
      body: { body: "nice" },
    })

    await scripter.call(() => editComment("comment-1", "nicer"), {
      method: "patch",
      url: API.community.editComment("comment-1"),
      body: { body: "nicer" },
    })

    await scripter.call(() => deleteComment("comment-1"), {
      method: "delete",
      url: API.community.deleteComment("comment-1"),
    })
  })

  it("reactions use idempotent PUT to set and DELETE to clear", async () => {
    const scripter = new EndpointScripter()

    await scripter.call(() => setReaction("post-1", "🔥"), {
      method: "put",
      url: API.community.reaction("post-1"),
      body: { emoji: "🔥" },
    })

    await scripter.call(() => clearReaction("post-1"), {
      method: "delete",
      url: API.community.reaction("post-1"),
    })
  })

  it("reports and the moderation queue round out the routes", async () => {
    const scripter = new EndpointScripter()

    await scripter.call(() => reportPost("post-1", "spam"), {
      method: "post",
      url: API.community.reportPost("post-1"),
      body: { reason: "spam" },
    })

    await scripter.call(() => reportComment("comment-1", "spam"), {
      method: "post",
      url: API.community.reportComment("comment-1"),
      body: { reason: "spam" },
    })

    await scripter.call(() => getModerationQueue(null), {
      method: "get",
      url: API.community.moderationQueue,
      params: { status: "open", limit: 20 },
    })

    await scripter.call(() => resolveReport("report-1", "DISMISS", "checked"), {
      method: "post",
      url: API.community.resolveReport("report-1"),
      body: { action: "DISMISS", note: "checked" },
    })
  })
})

describe("review endpoints", () => {
  it("keeps the load-bearing trailing slash on create", async () => {
    const scripter = new EndpointScripter()

    await scripter.call(
      () =>
        createReview({
          game_id: "game-1",
          text: "loved it",
          sentiment: "LIKE",
        }),
      {
        method: "post",
        url: "/reviews/api/reviews/",
        body: { game_id: "game-1", text: "loved it", sentiment: "LIKE" },
      }
    )
  })

  it("lists, rates, edits, deletes, reports and reacts", async () => {
    const scripter = new EndpointScripter()

    await scripter.call(
      () =>
        getGameReviews("game-1", { sort_by: "created_at", sort_order: "desc" }),
      {
        method: "get",
        url: API.reviews.forGame("game-1"),
        params: { sort_by: "created_at", sort_order: "desc" },
      }
    )

    await scripter.call(() => getAverageRating("game-1"), {
      method: "get",
      url: API.reviews.rating("game-1"),
    })

    await scripter.call(
      () => editReview("review-1", { text: "edited", sentiment: "DISLIKE" }),
      {
        method: "put",
        url: API.reviews.edit("review-1"),
        body: { text: "edited", sentiment: "DISLIKE" },
      }
    )

    await scripter.call(() => deleteReview("review-1"), {
      method: "delete",
      url: API.reviews.remove("review-1"),
    })

    await scripter.call(() => reportReview("review-1", "rude"), {
      method: "post",
      url: API.reviews.report("review-1"),
      body: { reason: "rude" },
    })

    await scripter.call(() => reactToReview("review-1", "LIKE"), {
      method: "post",
      url: API.reviews.react("review-1"),
      body: { reaction_type: "LIKE" },
    })

    await scripter.call(
      () => resolveReviewReport("review-1", "report-1", true),
      {
        method: "post",
        url: API.reviews.resolveReport("review-1", "report-1"),
        params: { delete_review: true },
        body: null,
      }
    )
  })
})

describe("festival endpoints", () => {
  it("lists and fetches with pagination params", async () => {
    const scripter = new EndpointScripter()

    await scripter.call(() => getFestivals({ limit: 5, offset: 10 }), {
      method: "get",
      url: API.festivals.list,
      params: { limit: 5, offset: 10 },
    })

    await scripter.call(() => getFestival("fest-1"), {
      method: "get",
      url: API.festivals.detail("fest-1"),
    })
  })

  it("create, reschedule, the game list, and the lifecycle posts", async () => {
    const scripter = new EndpointScripter()
    const window = {
      name: "Summer Fest",
      starts_at: "2026-08-20T10:00:00Z",
      ends_at: "2026-08-27T22:00:00Z",
    }

    await scripter.call(() => createFestival(window), {
      method: "post",
      url: API.festivals.create,
      body: window,
    })

    await scripter.call(
      () => rescheduleFestival("fest-1", window.starts_at, window.ends_at),
      {
        method: "patch",
        url: API.festivals.reschedule("fest-1"),
        body: { starts_at: window.starts_at, ends_at: window.ends_at },
      }
    )

    await scripter.call(() => addFestivalGame("fest-1", "game-1"), {
      method: "post",
      url: API.festivals.addGame("fest-1"),
      body: { game_id: "game-1" },
    })

    await scripter.call(() => removeFestivalGame("fest-1", "game-1"), {
      method: "delete",
      url: API.festivals.removeGame("fest-1", "game-1"),
    })

    await scripter.call(() => startFestival("fest-1"), {
      method: "post",
      url: API.festivals.start("fest-1"),
    })

    await scripter.call(() => endFestival("fest-1"), {
      method: "post",
      url: API.festivals.end("fest-1"),
    })

    await scripter.call(() => cancelFestival("fest-1"), {
      method: "post",
      url: API.festivals.cancel("fest-1"),
    })
  })
})
