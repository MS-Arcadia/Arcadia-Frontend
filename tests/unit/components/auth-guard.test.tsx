import { render, screen, waitFor } from "@testing-library/react"
import { AxiosError } from "axios"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useAuthStore } from "@/stores/auth.store"

const routerReplace = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplace }),
}))

vi.mock("@/queries/auth", () => ({
  useMeQuery: vi.fn(),
}))

vi.mock("@/hooks/use-presence", () => ({
  usePresence: vi.fn(),
}))

import { useMeQuery } from "@/queries/auth"
import { AuthGuard } from "@/components/auth/auth-guard"

const CONTENT = <p data-testid="children">The signed-in shell</p>

/** Only the fields AuthGuard reads; the rest of TanStack's result object is
 *  noise the component never touches, so it is filled in by the cast. */
function queryResult(
  overrides: Partial<{
    isLoading: boolean
    isError: boolean
    error: Error | null
  }> = {}
) {
  return {
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useMeQuery>
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  useAuthStore.setState(useAuthStore.getInitialState())
  // The session's store hydrates from localStorage before the guard decides
  // anything; zustand's persist with a real (jsdom) storage settles within a
  // microtask, which waitFor below covers.
})

describe("AuthGuard", () => {
  it("shows the loader while persistence has not answered yet", () => {
    vi.mocked(useMeQuery).mockReturnValue(queryResult({ isLoading: true }))

    render(
      <AuthGuard>
        <p>children</p>
      </AuthGuard>
    )

    expect(screen.getByLabelText("Loading")).toBeInTheDocument()
  })

  it("sends a signed-out visitor to the sign-in form, without the children", async () => {
    vi.mocked(useMeQuery).mockReturnValue(queryResult())

    render(<AuthGuard>{CONTENT}</AuthGuard>)

    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith("/sign-in"))
    expect(screen.queryByTestId("children")).not.toBeInTheDocument()
  })

  it("renders the children once the session and profile are there", async () => {
    useAuthStore.setState({
      userId: "11111111-1111-4111-8111-111111111111",
      user: {
        user_id: "11111111-1111-4111-8111-111111111111",
        display_name: "Sam Player",
        email: "player@arcadia.local",
        role: "BASIC_USER",
        state: "ACTIVE",
      },
    })
    vi.mocked(useMeQuery).mockReturnValue(queryResult())

    render(<AuthGuard>{CONTENT}</AuthGuard>)

    expect(await screen.findByTestId("children")).toBeInTheDocument()
    expect(routerReplace).not.toHaveBeenCalled()
  })

  it("holds the loader while the profile loads for a signed-in session", () => {
    useAuthStore.setState({ userId: "11111111-1111-4111-8111-111111111111" })
    vi.mocked(useMeQuery).mockReturnValue(queryResult({ isLoading: true }))

    render(<AuthGuard>{CONTENT}</AuthGuard>)

    expect(screen.getByLabelText("Loading")).toBeInTheDocument()
    expect(screen.queryByTestId("children")).not.toBeInTheDocument()
  })

  it("a stored token the server refuses ends the session and redirects", async () => {
    useAuthStore.setState({
      userId: "11111111-1111-4111-8111-111111111111",
      accessToken: "mock.stale.access",
    })
    vi.mocked(useMeQuery).mockReturnValue(
      queryResult({
        isError: true,
        error: new AxiosError("401", undefined, undefined, undefined, {
          status: 401,
          statusText: "401",
          data: { reason: "TOKEN_EXPIRED" },
          headers: {},
          config: {} as never,
        }),
      })
    )

    render(<AuthGuard>{CONTENT}</AuthGuard>)

    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith("/sign-in"))
    expect(useAuthStore.getState().userId).toBeNull()
    expect(screen.queryByTestId("children")).not.toBeInTheDocument()
  })

  it("a network failure is not treated as a signed-out session", async () => {
    useAuthStore.setState({ userId: "11111111-1111-4111-8111-111111111111" })
    vi.mocked(useMeQuery).mockReturnValue(
      queryResult({
        isError: true,
        error: new AxiosError("Network Error", undefined),
      })
    )

    render(<AuthGuard>{CONTENT}</AuthGuard>)

    // No redirect — the session survives a blip.
    await waitFor(() =>
      expect(screen.getByTestId("children")).toBeInTheDocument()
    )
    expect(routerReplace).not.toHaveBeenCalled()
  })
})
