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
import { useRegisterGameMutation } from "@/queries/workflow"
import { newGameSchema, type NewGameForm } from "@/schemas/game.schema"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewGameDialog({ open, onOpenChange }: Props) {
  const create = useRegisterGameMutation()
  const form = useForm<NewGameForm>({
    resolver: zodResolver(newGameSchema),
    defaultValues: {
      title: "",
      description: "",
      minRequirements: "",
      genres: "",
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Register a game</DialogTitle>
          <DialogDescription>
            This creates a draft. Nothing is visible in the store until it has
            been reviewed, priced and published.
          </DialogDescription>
        </DialogHeader>

        <form
          id="new-game"
          noValidate
          onSubmit={form.handleSubmit((values) =>
            create.mutate(
              {
                title: values.title,
                description: values.description,
                min_requirements: values.minRequirements,
                genres: values.genres
                  .split(",")
                  .map((genre) => genre.trim())
                  .filter(Boolean),
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
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              className="min-h-11"
              aria-invalid={Boolean(form.formState.errors.title)}
              {...form.register("title")}
            />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              rows={3}
              aria-invalid={Boolean(form.formState.errors.description)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
              {...form.register("description")}
            />
            {form.formState.errors.description && (
              <p className="text-xs text-destructive">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="minRequirements">What it needs to run</Label>
            <Input
              id="minRequirements"
              placeholder="8 GB RAM, 4 GB graphics card"
              className="min-h-11"
              aria-invalid={Boolean(form.formState.errors.minRequirements)}
              {...form.register("minRequirements")}
            />
            {form.formState.errors.minRequirements && (
              <p className="text-xs text-destructive">
                {form.formState.errors.minRequirements.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="genres">Genres</Label>
            <Input
              id="genres"
              placeholder="Strategy, Indie"
              className="min-h-11"
              aria-invalid={Boolean(form.formState.errors.genres)}
              {...form.register("genres")}
            />
            {form.formState.errors.genres ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.genres.message}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Separate them with commas.
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
            form="new-game"
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
