"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { getLedger, getWallet, topUpWallet, walletKeys } from "@/api/wallet"
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

export function useTopUpMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: topUpWallet,
    onSuccess: (wallet) => {
      void client.invalidateQueries({ queryKey: walletKeys.all })
      toast.success("Wallet topped up", {
        description: `New balance: ${formatMoney(wallet.balance)}`,
      })
    },
  })
}
