import { afterEach, describe, expect, it } from "vitest"

import { gameArt } from "@/lib/game-art"
import {
  minioPublicOrigin,
  objectKeyFor,
  publicAssetUrl,
} from "@/lib/media-url"
import type { GameMedia } from "@/types/catalog.api.type"

afterEach(() => {
  delete process.env.NEXT_PUBLIC_API_URL
})

describe("objectKeyFor", () => {
  it("shards the way media-service writes: first four characters as two path segments", () => {
    expect(objectKeyFor("ab1f2e3d-rest")).toBe("ab/1f/ab1f2e3d-rest")
  })

  it("pads ids shorter than four characters", () => {
    expect(objectKeyFor("a")).toBe("a0/00/a")
    expect(objectKeyFor("")).toBe("00/00/0000")
  })

  it("drops characters that cannot appear in an object key", () => {
    expect(objectKeyFor("ab/cd ef")).toBe("ab/cd/abcdef")
  })
})

describe("minioPublicOrigin", () => {
  it("maps a localhost gateway to MinIO's own port", () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8090"
    expect(minioPublicOrigin()).toBe("http://localhost:9000")
  })

  it("maps an api.* host to minio.*", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.arcadia.example"
    expect(minioPublicOrigin()).toBe("https://minio.arcadia.example")
  })

  it("gives up on a host with no known MinIO sibling", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://gateway.example"
    expect(minioPublicOrigin()).toBeNull()
  })

  it("gives up on junk and on a missing setting", () => {
    process.env.NEXT_PUBLIC_API_URL = "not a url"
    expect(minioPublicOrigin()).toBeNull()
    delete process.env.NEXT_PUBLIC_API_URL
    expect(minioPublicOrigin()).toBeNull()
  })
})

describe("publicAssetUrl", () => {
  const DOWNLOAD =
    "https://api.arcadia.example/media/v1/media/ab1f2e3d-rest/content"

  it("rewrites a media-service download URL to the public bucket path", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.arcadia.example"
    expect(publicAssetUrl(DOWNLOAD)).toBe(
      "https://minio.arcadia.example/arcadia-media/ab/1f/ab1f2e3d-rest"
    )
  })

  it("leaves local paths, blob and data URLs alone", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.arcadia.example"
    expect(publicAssetUrl("/covers/neon-drift.svg")).toBe(
      "/covers/neon-drift.svg"
    )
    expect(publicAssetUrl("blob:https://localhost/xyz")).toBe(
      "blob:https://localhost/xyz"
    )
    expect(publicAssetUrl("data:image/png;base64,xxx")).toBe(
      "data:image/png;base64,xxx"
    )
  })

  it("without a MinIO origin, or already on it, a ref passes through", () => {
    delete process.env.NEXT_PUBLIC_API_URL
    expect(publicAssetUrl(DOWNLOAD)).toBe(DOWNLOAD)

    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8090"
    const alreadyPublic =
      "http://localhost:9000/arcadia-media/ab/1f/ab1f2e3d-rest"
    expect(publicAssetUrl(alreadyPublic)).toBe(alreadyPublic)
  })

  it("a ref that is not a media download URL passes through untouched", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.arcadia.example"
    expect(publicAssetUrl("https://cdn.example/cover.jpg")).toBe(
      "https://cdn.example/cover.jpg"
    )
  })

  it("returns null for a missing ref", () => {
    expect(publicAssetUrl(null)).toBeNull()
    expect(publicAssetUrl(undefined)).toBeNull()
  })
})

describe("gameArt", () => {
  const teaser: GameMedia = {
    // The GameMedia shape's exact optional fields do not matter to the picker;
    // cast a minimal stand-in rather than transcribing the whole DTO.
    media_ref: "/covers/teaser.svg",
    kind: "TEASER",
  } as GameMedia
  const screenshot: GameMedia = {
    media_ref: "https://api.arcadia.example/media/v1/media/zz9/content",
    kind: "SCREENSHOT",
  } as GameMedia

  it("prefers the TEASER — catalog's own definition of a game's cover", () => {
    expect(gameArt([screenshot, teaser])).toMatchObject({ kind: "TEASER" })
  })

  it("falls back to the first item when there is no teaser, rather than none", () => {
    expect(gameArt([screenshot])).toMatchObject({ kind: "SCREENSHOT" })
  })

  it("returns undefined for empty media", () => {
    expect(gameArt([])).toBeUndefined()
  })

  it("rewrites the chosen item's ref to its public URL when there is one", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.arcadia.example"
    const art = gameArt([screenshot])
    expect(art?.media_ref).toBe(
      "https://minio.arcadia.example/arcadia-media/zz/90/zz9"
    )
  })
})
