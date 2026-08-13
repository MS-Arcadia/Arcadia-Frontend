"use client"

import { useRouter } from "next/navigation"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Landmark, Loader2, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { API } from "@/lib/api-paths"
import { formatMoney } from "@/lib/money"
import { http } from "@/services/http"
import type { Money } from "@/types/common.api.type"

interface Props {
  intentId: string
}

interface PendingCharge {
  payment_intent_id: string
  amount: Money
  settled: boolean
}

/**
 * The sandbox bank's authorisation page, for mock mode only.
 *
 * Against a real platform the wallet's redirect lands on payment-service's own
 * `/mock-bank/pay` and the wallet is credited when its confirmation reaches
 * Kafka. With no backend there is nowhere to land, so this stands in — and it
 * stands in for the *flow*, not just the outcome: the user leaves the app,
 * authorises, comes back, and the balance has moved. A mock that credited
 * instantly is what let a broken top-up look healthy in a demo.
 *
 * Outside the (app) route group on purpose: at this point the user has left the
 * storefront, and rendering the sidebar around a bank page would be a lie about
 * where they are.
 */
export function MockBankPage({ intentId }: Props) {
  const router = useRouter()

  const { data: charge, isPending } = useQuery({
    queryKey: ["mock-bank", intentId],
    queryFn: async () => {
      const { data } = await http.get<PendingCharge>(
        API.mockBank.charge(intentId)
      )
      return data
    },
    staleTime: 30 * 1000,
  })

  const authorise = useMutation({
    mutationFn: async () => {
      await http.post(API.mockBank.confirm(intentId))
    },
    onSuccess: () => {
      toast.success("Payment authorised")
      router.push("/wallet")
    },
  })

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-6">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted">
          <Landmark className="size-6" strokeWidth={1.75} />
        </div>
        <h1 className="text-lg font-semibold">Arcadia Sandbox Bank</h1>
        <p className="text-sm text-muted-foreground">
          This stands in for a real bank while Arcadia runs without a backend.
        </p>
      </div>

      <div className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        {isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : charge?.settled ? (
          <p className="text-sm text-muted-foreground">
            This payment was already authorised.
          </p>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Amount</span>
              <span className="text-xl font-semibold tabular">
                {charge ? formatMoney(charge.amount) : "—"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Authorising sends you back to Arcadia. Your wallet is credited
              when the payment is confirmed.
            </p>
          </>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="min-h-11 flex-1"
            onClick={() => router.push("/wallet")}
          >
            Cancel
          </Button>
          <Button
            className="min-h-11 flex-1"
            disabled={isPending || charge?.settled || authorise.isPending}
            onClick={() => authorise.mutate()}
          >
            {authorise.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            Authorise
          </Button>
        </div>
      </div>
    </main>
  )
}
