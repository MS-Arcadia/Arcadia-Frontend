"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"

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
import { useRescheduleFestivalMutation } from "@/queries/festivals"
import {
  rescheduleFestivalSchema,
  type RescheduleFestivalForm,
} from "@/schemas/festival.schema"

interface Props {
  festivalId: string
  startsAt: string
  endsAt: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Admin-only, DRAFT-only — the mutation and the mock both refuse it once the
 *  festival has started, so this dialog only ever appears next to a DRAFT
 *  badge. */
export function RescheduleFestivalDialog({
  festivalId,
  startsAt,
  endsAt,
  open,
  onOpenChange,
}: Props) {
  const reschedule = useRescheduleFestivalMutation(festivalId)
  const form = useForm<RescheduleFestivalForm>({
    resolver: zodResolver(rescheduleFestivalSchema),
    values: {
      startsAt: toLocalInput(startsAt),
      endsAt: toLocalInput(endsAt),
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule</DialogTitle>
          <DialogDescription>
            Only possible while the festival is still a draft.
          </DialogDescription>
        </DialogHeader>

        <form
          id="reschedule-festival"
          noValidate
          onSubmit={form.handleSubmit((values) =>
            reschedule.mutate(
              {
                startsAt: new Date(values.startsAt).toISOString(),
                endsAt: new Date(values.endsAt).toISOString(),
              },
              { onSuccess: () => onOpenChange(false) }
            )
          )}
          className="grid gap-4 sm:grid-cols-2"
        >
          <div className="space-y-2">
            <Label htmlFor="reschedule-starts">Starts</Label>
            <Input
              id="reschedule-starts"
              type="datetime-local"
              className="min-h-11"
              aria-invalid={Boolean(form.formState.errors.startsAt)}
              {...form.register("startsAt")}
            />
            {form.formState.errors.startsAt && (
              <p className="text-xs text-destructive">
                {form.formState.errors.startsAt.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="reschedule-ends">Ends</Label>
            <Input
              id="reschedule-ends"
              type="datetime-local"
              className="min-h-11"
              aria-invalid={Boolean(form.formState.errors.endsAt)}
              {...form.register("endsAt")}
            />
            {form.formState.errors.endsAt && (
              <p className="text-xs text-destructive">
                {form.formState.errors.endsAt.message}
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
            Close
          </Button>
          <Button
            type="submit"
            form="reschedule-festival"
            className="min-h-11"
            disabled={reschedule.isPending}
          >
            {reschedule.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Save dates
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** `datetime-local` wants "2026-07-30T14:30" in local time, not the ISO string
 *  the wire uses. */
function toLocalInput(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
