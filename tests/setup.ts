import "@testing-library/jest-dom/vitest"

import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

afterEach(() => {
  cleanup()
  // The mock backend and the auth session both persist through localStorage;
  // a test that left either behind changes what the next one sees.
  window.localStorage.clear()
  vi.useRealTimers()
})

// jsdom has no matchMedia, and next-themes (mounted in the root layout and in
// component tests through providers) reaches for it on first render.
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
}

// IntersectionObserver and ResizeObserver are used lazily by Base UI
// primitives (scroll areas, sheets, dropdowns); jsdom ships neither.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
if (!("IntersectionObserver" in globalThis)) {
  Object.defineProperty(globalThis, "IntersectionObserver", {
    writable: true,
    value: NoopObserver,
  })
}
if (!("ResizeObserver" in globalThis)) {
  Object.defineProperty(globalThis, "ResizeObserver", {
    writable: true,
    value: NoopObserver,
  })
}

// Tests that need URLs pointing at a "real" platform change these with
// `vi.stubEnv`; the defaults keep every other import on the mock, which is
// what most of the suite exercises.
process.env.NEXT_PUBLIC_API_MODE ??= "mock"
process.env.NEXT_PUBLIC_API_URL ??= "http://localhost:8090"
