import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"

/**
 * A fresh QueryClient per render, with retry off, so a rejected queryFn fails in
 * one tick instead of three with backoff — tests assert outcomes, not patience.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

export function renderWithQuery(ui: ReactNode) {
  const client = createQueryClient()
  const view = render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  )
  return { client, ...view }
}

export function renderHookWithQuery<T>(callback: () => T) {
  const client = createQueryClient()
  const view = renderHook(callback, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
  return { client, ...view }
}
