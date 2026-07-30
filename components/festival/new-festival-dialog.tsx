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
import { Textarea } from "@/components/ui/textarea"
import { useCreateFestivalMutation } from "@/queries/festivals"
import {
  newFestivalSchema,
  type NewFestivalForm,
} from "@/schemas/festival.schema"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Admin-only. Creates a festival as a DRAFT — it has no games and is not
 * visible to anyone else until an admin adds games and starts it.
 */
export function NewFestivalDialog({ open, onOpenChange }: Props) {
  const create = useCreateFestivalMutation()
  const form = useForm<NewFestivalForm>({
    resolver: zodResolver(newFestivalSchema),
    defaultValues: { name: "", description: "", startsAt: "", endsAt: "" },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) form.reset()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New festival</DialogTitle>
          <DialogDescription>
            This creates a draft. It stays invisible to shoppers until you add
            games and start it.
          </DialogDescription>
        </DialogHeader>

        <form
          id="new-festival"
          noValidate
          onSubmit={form.handleSubmit((values) =>
            create.mutate(
              {
                name: values.name,
                description: values.description || undefined,
                starts_at: new Date(values.startsAt).toISOString(),
                ends_at: new Date(values.endsAt).toISOString(),
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
            <Label htmlFor="festival-name">Name</Label>
            <Input
              id="festival-name"
              className="min-h-11"
              aria-invalid={Boolean(form.formState.errors.name)}
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="festival-description">
              Description{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="festival-description"
              rows={3}
              aria-invalid={Boolean(form.formState.errors.description)}
              {...form.register("description")}
            />
            {form.formState.errors.description && (
              <p className="text-xs text-destructive">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="festival-starts">Starts</Label>
              <Input
                id="festival-starts"
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
              <Label htmlFor="festival-ends">Ends</Label>
              <Input
                id="festival-ends"
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
            form="new-festival"
            className="min-h-11"
            disabled={create.isPending}
          >
            {create.isPending && <Loader2 className="size-4 animate-spin" />}
            Create draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
