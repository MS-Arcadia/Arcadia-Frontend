"use client"

import { useEffect } from "react"
import { useRouter } from "nextjs-toploader/app"

/** Public routes the service worker and the App Router both warm ahead of a click. */
export const PUBLIC_PREFETCH_PATHS = [
  "/",
  "/browse",
  "/festivals",
  "/community",
  "/sign-in",
  "/sign-up",
] as const

/** Warm a list, not the whole catalogue — too many RSC payloads contend with the page. */
const PREFETCH_CAP = 24

function tellServiceWorker(urls: readonly string[]) {
  const worker = navigator.serviceWorker?.controller
  if (!worker || urls.length === 0) return
  worker.postMessage({ type: "PREFETCH", urls: [...urls] })
}

export function usePrefetchHrefs(hrefs: readonly string[]) {
  const router = useRouter()
  const key = hrefs.join("\0")

  useEffect(() => {
    const urls = (key.length === 0 ? [] : key.split("\0")).slice(
      0,
      PREFETCH_CAP
    )
    if (urls.length === 0) return
    for (const href of urls) router.prefetch(href)
    tellServiceWorker(urls)
  }, [router, key])
}

/**
 * Warms the next navigation two ways: Next.js RSC prefetch, and a message to
 * the service worker so a later full load (or a return visit) hits cache.
 */
export function PrefetchPublicRoutes() {
  usePrefetchHrefs(PUBLIC_PREFETCH_PATHS)
  return null
}
