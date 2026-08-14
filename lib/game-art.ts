import type { GameMedia } from "@/types/catalog.api.type"
import { publicAssetUrl } from "@/lib/media-url"

/**
 * A game's cover art.
 *
 * This lived inline in eight components as `find(kind === "COVER") ?? media[0]`, and
 * catalog-service has no COVER kind — so all eight were really just "the first item",
 * and a developer who uploaded three screenshots and then a teaser got a screenshot on
 * their store card.
 *
 * TEASER is the platform's cover: catalog picks a game's art the same way, through its
 * `teaser_ref` property. The fallback stays, because a game may have images and no
 * teaser, and a card with the wrong art still beats a card with none.
 */
export function gameArt(media: GameMedia[]): GameMedia | undefined {
  const art = media.find((item) => item.kind === "TEASER") ?? media[0]
  if (!art) return undefined
  const url = publicAssetUrl(art.media_ref)
  return url && url !== art.media_ref ? { ...art, media_ref: url } : art
}
