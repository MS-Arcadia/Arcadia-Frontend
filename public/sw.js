/**
 * The service worker.
 *
 * Hand-written rather than generated, because what this app needs from one is
 * narrow and a generated config would be mostly rules for cases that do not apply.
 *
 * Two caches with two different strategies, and the split is the whole design:
 *
 *  - **The shell** (documents, the logo, the generated cover art) is
 *    stale-while-revalidate. It changes rarely and being a version behind for one
 *    navigation is invisible.
 *
 *  - **The API** is network-only, deliberately *not* cached. A wallet balance or a
 *    library served from a cache is worse than an error: it tells somebody they
 *    have money they have spent, or a game they refunded. TanStack Query already
 *    keeps the last response in memory for the length of a session, which is the
 *    right place for that decision because it knows what is stale.
 *
 * Public documents are prefetched on install and on `PREFETCH` messages from the
 * page, so the first click on Games / Festivals is a cache hit instead of a wait.
 */

const VERSION = "v3"
const SHELL_CACHE = `arcadia-shell-${VERSION}`
const OFFLINE_URL = "/offline"

const PRECACHE = [OFFLINE_URL, "/logo.png", "/icon-192.png", "/icon-512.png"]

const PUBLIC_PREFETCH = [
  "/",
  "/browse",
  "/festivals",
  "/community",
  "/sign-in",
  "/sign-up",
  OFFLINE_URL,
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // `reload` so installing does not simply re-store whatever the HTTP cache
      // already had, which is how a service worker ships a stale shell on day one.
      .then((cache) =>
        cache.addAll(
          PRECACHE.map((url) => new Request(url, { cache: "reload" }))
        )
      )
      .then(() => prefetchUrls(PUBLIC_PREFETCH))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener("message", (event) => {
  if (event.data?.type !== "PREFETCH") return
  const urls = Array.isArray(event.data.urls) ? event.data.urls : []
  event.waitUntil(prefetchUrls(urls))
})

async function prefetchUrls(urls) {
  const cache = await caches.open(SHELL_CACHE)
  await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, { credentials: "same-origin" })
        if (response.ok) await cache.put(url, response)
      } catch {
        // A prefetch that fails is a slower click, not an error to surface.
      }
    })
  )
}

function isApiRequest(url) {
  return (
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/catalog/") ||
    url.pathname.startsWith("/orders/") ||
    url.pathname.startsWith("/wallet/") ||
    url.pathname.startsWith("/notifications/v1") ||
    url.pathname.startsWith("/reviews/") ||
    url.pathname.startsWith("/festivals/v1") ||
    url.pathname.startsWith("/community/v1") ||
    url.pathname.startsWith("/marketplace/v1") ||
    url.pathname.startsWith("/recommendations/v1") ||
    url.pathname.startsWith("/media/v1")
  )
}

self.addEventListener("fetch", (event) => {
  const { request } = event

  // Only GET is ever served from a cache. A cached POST would replay somebody's
  // purchase, which is not a caching bug so much as a financial one.
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (isApiRequest(url)) return

  // Navigations: network first, then the prefetched copy, then the offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            void caches
              .open(SHELL_CACHE)
              .then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(async () => {
          const cache = await caches.open(SHELL_CACHE)
          return (
            (await cache.match(request)) ??
            (await cache.match(OFFLINE_URL)) ??
            Response.error()
          )
        })
    )
    return
  }

  // Everything else: serve what is cached, then refresh it in the background.
  event.respondWith(
    caches.open(SHELL_CACHE).then(async (cache) => {
      const cached = await cache.match(request)
      const network = fetch(request)
        .then((response) => {
          if (response.ok) void cache.put(request, response.clone())
          return response
        })
        .catch(() => cached ?? Response.error())

      return cached ?? network
    })
  )
})
