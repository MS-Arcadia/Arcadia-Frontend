"use client"

import { Controller, useForm } from "react-hook-form"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useCreateItemMutation } from "@/queries/marketplace"
import { useMyGamesQuery } from "@/queries/workflow"
import {
  newMarketItemSchema,
  toMinorUnits,
  type NewMarketItemForm,
} from "@/schemas/marketplace.schema"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Only these two states have ever reached the storefront, so they are the only
 *  games worth listing an item against. */
const LISTABLE_STATES = new Set(["PUBLISHED", "PREORDER"])

export function NewItemDialog({ open, onOpenChange }: Props) {
  const { data: myGames } = useMyGamesQuery()
  const create = useCreateItemMutation()
  const games = (myGames?.items ?? []).filter((game) =>
    LISTABLE_STATES.has(game.state)
  )

  const form = useForm<NewMarketItemForm>({
    resolver: zodResolver(newMarketItemSchema),
    defaultValues: {
      gameId: "",
      title: "",
      description: "",
      imageUrl: "",
      buyPrice: "",
      sellPrice: "",
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>List an item</DialogTitle>
          <DialogDescription>
            Users trade it through the order book once it is listed. The buy and
            sell values are a reference price, not a fixed one.
          </DialogDescription>
        </DialogHeader>

        <form
          id="new-item"
          noValidate
          onSubmit={form.handleSubmit((values) =>
            create.mutate(
              {
                game_id: values.gameId,
                title: values.title,
                description: values.description,
                image_url: values.imageUrl,
                buy_value: toMinorUnits(values.buyPrice),
                sell_value: toMinorUnits(values.sellPrice),
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
            <Label htmlFor="item-game">Game</Label>
            <Controller
              control={form.control}
              name="gameId"
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                  disabled={games.length === 0}
                >
                  <SelectTrigger id="item-game" className="min-h-11 w-full">
                    <SelectValue placeholder="Pick a published game" />
                  </SelectTrigger>
                  <SelectContent>
                    {games.map((game) => (
                      <SelectItem key={game.id} value={game.id}>
                        {game.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.gameId ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.gameId.message}
              </p>
            ) : (
              games.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Publish or pre-order a game before listing an item for it.
                </p>
              )
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-title">Title</Label>
            <Input
              id="item-title"
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
            <Label htmlFor="item-description">Description</Label>
            <Textarea
              id="item-description"
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

          <div className="space-y-2">
            <Label htmlFor="item-image">Image URL</Label>
            <Input
              id="item-image"
              placeholder="https://…"
              className="min-h-11"
              aria-invalid={Boolean(form.formState.errors.imageUrl)}
              {...form.register("imageUrl")}
            />
            {form.formState.errors.imageUrl && (
              <p className="text-xs text-destructive">
                {form.formState.errors.imageUrl.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="item-buy">Buy value</Label>
              <Controller
                control={form.control}
                name="buyPrice"
                render={({ field }) => (
                  <Input
                    id="item-buy"
                    inputMode="numeric"
                    placeholder="500000"
                    className="min-h-11 tabular"
                    aria-invalid={Boolean(form.formState.errors.buyPrice)}
                    value={field.value}
                    onChange={(event) =>
                      field.onChange(event.target.value.replace(/[^\d]/g, ""))
                    }
                  />
                )}
              />
              {form.formState.errors.buyPrice && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.buyPrice.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-sell">Sell value</Label>
              <Controller
                control={form.control}
                name="sellPrice"
                render={({ field }) => (
                  <Input
                    id="item-sell"
                    inputMode="numeric"
                    placeholder="450000"
                    className="min-h-11 tabular"
                    aria-invalid={Boolean(form.formState.errors.sellPrice)}
                    value={field.value}
                    onChange={(event) =>
                      field.onChange(event.target.value.replace(/[^\d]/g, ""))
                    }
                  />
                )}
              />
              {form.formState.errors.sellPrice && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.sellPrice.message}
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground/70">
            Both values are major units — the amount before the decimal, same as
            the store&apos;s prices.
          </p>
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
            form="new-item"
            className="min-h-11"
            disabled={create.isPending}
          >
            {create.isPending && <Loader2 className="size-4 animate-spin" />}
            List item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
