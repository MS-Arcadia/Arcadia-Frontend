"use client"

import { useEffect } from "react"

/**
 * Registers the service worker, once, after the page has settled.
 *
 * Deliberately not in development: an installed worker caches the shell and then
 * competes with Turbopack's hot reload, which shows up as edits that appear to do
 * nothing until a hard refresh. It is a real cost for no benefit while building.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return

    const register = () => {
      void navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          const worker =
            registration.active ?? navigator.serviceWorker.controller
          worker?.postMessage({
            type: "PREFETCH",
            urls: [
              "/",
              "/browse",
              "/festivals",
              "/community",
              "/sign-in",
              "/sign-up",
              "/offline",
            ],
          })
        })
        .catch(() => {
          // A failed registration costs offline support and nothing else. There is
          // nothing useful to tell the person about it.
        })
    }

    // After `load`, so registration never competes with the first paint.
    if (document.readyState === "complete") register()
    else window.addEventListener("load", register, { once: true })
  }, [])

  return null
}
