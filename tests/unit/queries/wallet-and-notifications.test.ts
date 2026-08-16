import { act, waitFor } from "@testing-library/react"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { getGame } from "@/api/catalog"
import { walletKeys } from "@/api/wallet"
import type { Money } from "@/types/common.api.type"

vi.mock("@/api/catalog", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getGames: vi.fn(),
  getGame: vi.fn(),
}))

vi.mock("@/api/wallet", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getWallet: vi.fn(),
  getLedger: vi.fn(),
  getGiftCards: vi.fn(),
  initiateCharge: vi.fn(),
  redeemGiftCard: vi.fn(),
}))

vi.mock("@/api/notifications", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
}))

import { getGames as getGamesMock } from "@/api/catalog"
import { initiateCharge, redeemGiftCard } from "@/api/wallet"
import { useGamesQuery, useOwnedGamesQuery } from "@/queries/catalog"
import {
  useInitiateChargeMutation,
  useRedeemGiftCardMutation,
} from "@/queries/wallet"

import { makeGame, makeGameDetail } from "../../helpers/game"
import { renderHookWithQuery } from "../../helpers/query"

const IRR: Money = { amount_minor: "500000", currency: "IRR" }

beforeEach(() => {
  vi.clearAllMocks()
})

describe("useGamesQuery", () => {
  it("keys by the filters, so two filterings are two cache entries", async () => {
    vi.mocked(getGamesMock).mockResolvedValue({
      items: [makeGame()],
      total: 1,
      limit: 20,
      offset: 0,
    })

    const first = renderHookWithQuery(() =>
      useGamesQuery({ q: "neon", sort: "newest" })
    )
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))

    const second = renderHookWithQuery(() => useGamesQuery({ q: "hollow" }))
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true))

    expect(getGamesMock).toHaveBeenCalledTimes(2)
    expect(getGamesMock).toHaveBeenNthCalledWith(1, {
      q: "neon",
      sort: "newest",
    })
    expect(getGamesMock).toHaveBeenNthCalledWith(2, { q: "hollow" })
  })
})

describe("useOwnedGamesQuery", () => {
  it("combines per-game queries into a map, pending until all answer", async () => {
    vi.mocked(getGame).mockImplementation(async (id: string) =>
      makeGameDetail({ id, title: `Game ${id}` })
    )

    const { result } = renderHookWithQuery(() =>
      useOwnedGamesQuery(["game-1", "game-2"])
    )

    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.games.get("game-1")).toMatchObject({
      id: "game-1",
      title: "Game game-1",
    })
    expect(result.current.games.size).toBe(2)
  })

  it("an empty ownership list is an empty map, not a firestorm of queries", () => {
    const { result } = renderHookWithQuery(() => useOwnedGamesQuery([]))

    expect(result.current.games.size).toBe(0)
    expect(result.current.isPending).toBe(false)
    expect(getGame).not.toHaveBeenCalled()
  })
})

describe("useInitiateChargeMutation", () => {
  it("redirects to the bank and toasts the amount being authorised, not a balance", async () => {
    // jsdom makes `location` read-only; swapping the whole object out is the
    // standard way to observe a navigation.
    const assign = vi.fn()
    const originalLocation = window.location
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, assign },
      configurable: true,
      writable: true,
    })

    try {
      vi.mocked(initiateCharge).mockResolvedValue({
        intent_id: "intent-1",
        amount: IRR,
        redirect_url: "https://bank.example/pay?intent=intent-1",
      } as never)
      const success = vi.spyOn(toast, "success")

      const { result } = renderHookWithQuery(() => useInitiateChargeMutation())
      await act(async () => {
        await result.current.mutateAsync(IRR)
      })

      expect(assign).toHaveBeenCalledWith(
        "https://bank.example/pay?intent=intent-1"
      )
      expect(success.mock.calls[0][0]).toBe("Taking you to the bank")
    } finally {
      Object.defineProperty(window, "location", {
        value: originalLocation,
        configurable: true,
        writable: true,
      })
    }
  })
})

describe("useRedeemGiftCardMutation", () => {
  it("credits, invalidates the wallet and reports the new balance", async () => {
    vi.mocked(redeemGiftCard).mockResolvedValue({
      credited: IRR,
      wallet: { balance: { amount_minor: "4000000", currency: "IRR" } },
    } as never)
    const success = vi.spyOn(toast, "success")

    const { client, result } = renderHookWithQuery(() =>
      useRedeemGiftCardMutation()
    )
    const invalidate = vi.spyOn(client, "invalidateQueries")

    await act(async () => {
      await result.current.mutateAsync("ARC-123")
    })

    expect(invalidate).toHaveBeenCalledWith({ queryKey: walletKeys.all })
    expect(success.mock.calls[0][0]).toBe("5,000 IRR added")
    expect(success.mock.calls[0][1]?.description).toContain("40,000 IRR")
  })
})
