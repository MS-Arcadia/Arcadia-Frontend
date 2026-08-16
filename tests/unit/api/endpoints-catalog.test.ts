import { describe, expect, it, vi } from "vitest"

vi.mock("@/services/mocks/adapter", () => ({
  installMockAdapter: vi.fn(),
}))

import { API } from "@/lib/api-paths"
import { getGame, getGames, getLibrary } from "@/api/catalog"
import { mediaPublicUrl, uploadMedia } from "@/api/media"
import {
  addVersion,
  approveGame,
  attachCover,
  decidePromotion,
  getMyGames,
  getPromotions,
  getReviewQueue,
  appealRejection,
  proposePromotion,
  publishGame,
  registerGame,
  relistGame,
  rejectGame,
  setFinalPrice,
  startReview,
  submitGame,
  suggestPrice,
  withdrawGame,
} from "@/api/workflow"

import { AS_FORM_DATA, EndpointScripter } from "../../helpers/endpoint"
import { waitForCalls } from "../../helpers/http"
import { makeGame } from "../../helpers/game"

describe("catalog endpoints", () => {
  it("passes filters through as query params", async () => {
    const scripter = new EndpointScripter()

    await scripter.call(
      () => getGames({ q: "neon", genre: "Racing", sort: "price-asc" }),
      {
        method: "get",
        url: API.catalog.games,
        params: { q: "neon", genre: "Racing", sort: "price-asc" },
      },
      { items: [], total: 0, limit: 20, offset: 0 }
    )

    await scripter.call(() => getGame("game-1"), {
      method: "get",
      url: API.catalog.game("game-1"),
    })

    await scripter.call(() => getLibrary(), {
      method: "get",
      url: API.catalog.library,
      params: { limit: 100 },
    })
  })
})

describe("media", () => {
  it("uploads multipart with the file, kind and reference id", async () => {
    const scripter = new EndpointScripter()
    const file = new File(["bytes"], "cover.png", { type: "image/png" })

    await scripter.call(
      () => uploadMedia(file, { kind: "IMAGE", referenceId: "game-1" }),
      { method: "post", url: API.media.upload, body: AS_FORM_DATA },
      {
        id: "med-1",
        kind: "IMAGE",
        url: "http://localhost:9000/arcadia-media/xx/x/med-1",
        content_type: "image/png",
        size_bytes: 5,
        filename: "cover.png",
      }
    )
  })

  it("mediaPublicUrl prefers the stored url and can derive one from the id", () => {
    expect(mediaPublicUrl({ url: "https://cdn.example/x" } as never)).toBe(
      "https://cdn.example/x"
    )
    const derived = mediaPublicUrl({ id: "ab12", url: "" } as never)
    expect(derived.endsWith("/media/v1/media/ab12/content")).toBe(true)
  })
})

const DETAIL = { ...makeGame(), reviews: [], promotions: [] }

describe("workflow endpoints", () => {
  it("lists the developer's games and the review queue", async () => {
    const scripter = new EndpointScripter()

    await scripter.call(() => getMyGames(), {
      method: "get",
      url: API.catalog.mine,
    })

    await scripter.call(() => getReviewQueue(), {
      method: "get",
      url: API.catalog.reviewQueue,
      params: { limit: 50 },
    })
  })

  it("registers without a cover in one call", async () => {
    const scripter = new EndpointScripter()
    const body = {
      title: "Glasshouse",
      description: "",
      min_requirements: "",
      genres: ["Adventure"],
    }

    await scripter.call(() => registerGame(body), {
      method: "post",
      url: API.catalog.games,
      body,
    })
  })

  it("attaching a cover is an upload followed by a TEASER media post", async () => {
    const scripter = new EndpointScripter()
    const pending = attachCover("game-1", new File(["b"], "c.png"))

    await waitForCalls(scripter.calls, 1)
    expect(scripter.calls[0].request.method).toBe("post")
    expect(scripter.calls[0].request.url.endsWith(API.media.upload)).toBe(true)
    scripter.calls[0].respond({
      data: {
        id: "med-2",
        kind: "IMAGE",
        url: "http://minio/arcadia-media/y/y/med-2",
        content_type: "image/png",
        size_bytes: 1,
        filename: "c.png",
      },
    })

    await waitForCalls(scripter.calls, 2)
    expect(
      scripter.calls[1].request.url.endsWith(API.catalog.media("game-1"))
    ).toBe(true)
    expect(JSON.parse(scripter.calls[1].request.data as string)).toEqual({
      kind: "TEASER",
      media_ref: "http://minio/arcadia-media/y/y/med-2",
    })
    scripter.calls[1].respond({ data: DETAIL })

    await expect(pending).resolves.toMatchObject({ id: DETAIL.id })
  })

  it("posts each workflow step to its own route with its own body", async () => {
    const scripter = new EndpointScripter()

    await scripter.call(() => addVersion("game-1", "1.2.0", 2048), {
      method: "post",
      url: API.catalog.versions("game-1"),
      body: { version: "1.2.0", size_bytes: 2048, file_ref: "placeholder" },
    })

    await scripter.call(() => submitGame("game-1"), {
      method: "post",
      url: API.catalog.submit("game-1"),
    })

    await scripter.call(() => startReview("game-1"), {
      method: "post",
      url: API.catalog.reviewStart("game-1"),
    })

    await scripter.call(() => approveGame("game-1", "fine"), {
      method: "post",
      url: API.catalog.reviewApprove("game-1"),
      body: { note: "fine" },
    })

    await scripter.call(() => rejectGame("game-1", "not fine"), {
      method: "post",
      url: API.catalog.reviewReject("game-1"),
      body: { note: "not fine" },
    })

    await scripter.call(() => appealRejection("game-1", "but"), {
      method: "post",
      url: API.catalog.appeal("game-1"),
      body: { note: "but" },
    })

    await scripter.call(() => suggestPrice("game-1", 5500000), {
      method: "post",
      url: API.catalog.suggestPrice("game-1"),
      body: { amount_minor: 5500000 },
    })

    await scripter.call(() => setFinalPrice("game-1", 5500000), {
      method: "post",
      url: API.catalog.price("game-1"),
      body: { amount_minor: 5500000 },
    })

    await scripter.call(() => publishGame("game-1"), {
      method: "post",
      url: API.catalog.publish("game-1"),
    })

    await scripter.call(() => withdrawGame("game-1", "legal"), {
      method: "post",
      url: API.catalog.withdraw("game-1"),
      body: { reason: "legal" },
    })

    await scripter.call(() => relistGame("game-1"), {
      method: "post",
      url: API.catalog.relist("game-1"),
    })
  })
})

describe("promotions", () => {
  const promotion = {
    id: "promo-1",
    game_id: "game-1",
    discount_bps: 2000,
    percent_off: 20,
    state: "PENDING",
    starts_at: "2026-08-20T00:00:00Z",
    ends_at: "2026-08-27T00:00:00Z",
    live: false,
    proposed_by: "support",
    festival_id: "",
    note: "",
    decided_by: "",
    decision_note: "",
    created_at: null,
  }

  it("reads promotions off the game detail — there is no promotions GET route", async () => {
    const scripter = new EndpointScripter()

    const page = (await scripter.call(
      () => getPromotions("game-1"),
      { method: "get", url: API.catalog.gameDetail("game-1") },
      { ...DETAIL, promotions: [promotion] }
    )) as { items: unknown[]; total: number }

    expect(page.items).toHaveLength(1)
    expect(page.total).toBe(1)
  })

  it("an absent promotions field reads as an empty page", async () => {
    const scripter = new EndpointScripter()

    const page = (await scripter.call(
      () => getPromotions("game-1"),
      { method: "get", url: API.catalog.gameDetail("game-1") },
      { ...DETAIL, promotions: undefined }
    )) as { items: unknown[] }

    expect(page.items).toEqual([])
  })

  it("proposing pulls the pending promotion out of the detail answer", async () => {
    const scripter = new EndpointScripter()

    const found = await scripter.call(
      () =>
        proposePromotion("game-1", {
          discount_bps: 2000,
          starts_at: "2026-08-20T00:00:00Z",
          ends_at: "2026-08-27T00:00:00Z",
        }),
      {
        method: "post",
        url: API.catalog.promotions("game-1"),
        body: {
          discount_bps: 2000,
          starts_at: "2026-08-20T00:00:00Z",
          ends_at: "2026-08-27T00:00:00Z",
        },
      },
      { ...DETAIL, promotions: [promotion] }
    )

    expect(found).toMatchObject({ id: "promo-1", state: "PENDING" })
  })

  it("deciding posts to the approve or reject route for that promotion", async () => {
    const scripter = new EndpointScripter()

    await scripter.call(
      () => decidePromotion("game-1", "promo-1", true, "go"),
      {
        method: "post",
        url: API.catalog.approvePromotion("game-1", "promo-1"),
        body: { note: "go" },
      },
      { ...DETAIL, promotions: [{ ...promotion, state: "ACTIVE" }] }
    )

    await scripter.call(
      () => decidePromotion("game-1", "promo-1", false),
      {
        method: "post",
        url: API.catalog.rejectPromotion("game-1", "promo-1"),
        body: { note: "" },
      },
      { ...DETAIL, promotions: [{ ...promotion, state: "REJECTED" }] }
    )
  })

  it("an answer missing the promotion just written is an error, not silence", async () => {
    const scripter = new EndpointScripter()

    await expect(
      scripter.call(
        () => decidePromotion("game-1", "promo-9", true),
        {
          method: "post",
          url: API.catalog.approvePromotion("game-1", "promo-9"),
          body: { note: "" },
        },
        { ...DETAIL, promotions: [] }
      )
    ).rejects.toThrow(/without the promotion/)
  })
})
