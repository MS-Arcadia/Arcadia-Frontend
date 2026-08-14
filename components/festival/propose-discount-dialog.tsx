"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useProposePromotionMutation } from "@/queries/workflow"
import { formatDate } from "@/lib/datetime"

/** Basis points, not a percentage on the wire — 1–100 typed here becomes
 *  1–10000 bps, the same conversion `schemas/game.schema.ts`'s
 *  `promotionSchema` uses. */
const proposeDiscountSchema = z.object({
  percent: z
    .number({ message: "Enter a percentage" })
    .min(1, "At least 1%")
    .max(100, "At most 100%"),
  note: z.string().trim().max(2000, "At most 2000 characters").optional(),
})

type ProposeDiscountForm = z.infer<typeof proposeDiscountSchema>

interface Props {
  gameId: string
  gameTitle: string
  festivalId: string
  festivalStartsAt: string
  festivalEndsAt: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Requirement 1.9's second half, Support's side: a proposal, not a discount.
 * `PromotionDecisions` on the developer's own page is where it actually gets
 * approved — this only creates the PENDING row, tied to this festival's
 * window.
 */
export function ProposeDiscountDialog({
  gameId,
  gameTitle,
  festivalId,
  festivalStartsAt,
  festivalEndsAt,
  open,
  onOpenChange,
}: Props) {
  const propose = useProposePromotionMutation(gameId)
  const form = useForm<ProposeDiscountForm>({
    resolver: zodResolver(proposeDiscountSchema),
    defaultValues: { percent: undefined, note: "" },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) form.reset()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Propose a discount for {gameTitle}</DialogTitle>
          <DialogDescription>
            This runs from {formatDate(festivalStartsAt)} to{" "}
            {formatDate(festivalEndsAt)}, matching the festival. It does not
            start until the developer approves it — the reduced price is still
            split with them, so this is their call.
          </DialogDescription>
        </DialogHeader>

        <form
          id="propose-discount"
          noValidate
          onSubmit={form.handleSubmit((values) =>
            propose.mutate(
              {
                discount_bps: Math.round(values.percent * 100),
                starts_at: festivalStartsAt,
                ends_at: festivalEndsAt,
                festival_id: festivalId,
                note: values.note || undefined,
              },
              {
                onSuccess: () => {
                  form.reset()
                  onOpenChange(false)
                },
              }
            )
          )}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="discount-percent">Percent off</Label>
            <Input
              id="discount-percent"
              type="number"
              min={1}
              max={100}
              inputMode="numeric"
              className="min-h-11 tabular"
              aria-invalid={Boolean(form.formState.errors.percent)}
              {...form.register("percent", { valueAsNumber: true })}
            />
            {form.formState.errors.percent && (
              <p className="text-xs text-destructive">
                {form.formState.errors.percent.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="discount-note">
              Note to the developer{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="discount-note"
              rows={3}
              aria-invalid={Boolean(form.formState.errors.note)}
              {...form.register("note")}
            />
            {form.formState.errors.note && (
              <p className="text-xs text-destructive">
                {form.formState.errors.note.message}
              </p>
            )}
          </div>
        </form>

        <DialogFooter>
          <Button
            variant="ghost"
            className="min-h-11"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="propose-discount"
            className="min-h-11"
            disabled={propose.isPending}
          >
            {propose.isPending && <Loader2 className="size-4 animate-spin" />}
            Propose
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
