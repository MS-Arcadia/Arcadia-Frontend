"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  getLedger,
  getWallet,
  initiateCharge,
  getGiftCards,
  issueGiftCards,
  redeemGiftCard,
  walletKeys,
} from "@/api/wallet"
import { formatMoney } from "@/lib/money"

export function useWalletQuery() {
  return useQuery({
    queryKey: walletKeys.me(),
    queryFn: getWallet,
    staleTime: 15 * 1000,
  })
}

export function useLedgerQuery() {
  return useQuery({
    queryKey: walletKeys.ledger(),
    queryFn: getLedger,
    staleTime: 15 * 1000,
  })
}

/**
 * Starts a bank top-up and hands the browser to the bank.
 *
 * There is deliberately no success toast about a new balance: nothing has been
 * credited yet. The money arrives when the bank confirms and the payment
 * service publishes `BankPaymentConfirmed`, which is after this page is gone.
 * The previous version claimed a balance the platform had not agreed to.
 */
export function useInitiateChargeMutation() {
  return useMutation({
    mutationFn: initiateCharge,
    onSuccess: (charge) => {
      toast.success("Taking you to the bank", {
        description: `Authorise ${formatMoney(charge.amount)} to finish topping up.`,
      })
      window.location.assign(charge.redirect_url)
    },
  })
}

/** Credits immediately, so this one really can report the new balance. */
export function useRedeemGiftCardMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: redeemGiftCard,
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: walletKeys.all })
      toast.success(`${formatMoney(result.credited)} added`, {
        description: `New balance: ${formatMoney(result.wallet.balance)}`,
      })
    },
  })
}

/** Every card issued so far. Staff only — the service refuses anybody else. */
export function useGiftCardsQuery(enabled = true) {
  return useQuery({
    queryKey: walletKeys.giftCards(),
    queryFn: getGiftCards,
    staleTime: 30 * 1000,
    enabled,
  })
}

/**
 * Mint a batch of gift cards.
 *
 * The result is deliberately returned rather than swallowed: the plaintext codes exist
 * only in this response, because wallet-service stores a hash. A caller that discards it
 * has destroyed the cards it just paid to create.
 */
export function useIssueGiftCardsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: issueGiftCards,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: walletKeys.giftCards() })
      toast.success(
        result.gift_cards.length === 1
          ? "One gift card issued"
          : `${result.gift_cards.length} gift cards issued`
      )
    },
  })
}
