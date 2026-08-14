"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  CalendarClock,
  Gamepad2,
  Loader2,
  Megaphone,
  Plus,
  Tag,
  X,
} from "lucide-react"

import { FestivalStateBadge } from "@/components/festival/festival-state-badge"
import { ProposeDiscountDialog } from "@/components/festival/propose-discount-dialog"
import { PromotionDecisions } from "@/components/developer/promotion-decisions"
import { RescheduleFestivalDialog } from "@/components/festival/reschedule-festival-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useGamesQuery } from "@/queries/catalog"
import {
  useAddFestivalGameMutation,
  useCancelFestivalMutation,
  useEndFestivalMutation,
  useFestivalQuery,
  useRemoveFestivalGameMutation,
  useStartFestivalMutation,
} from "@/queries/festivals"
import { useAuthStore, useHasRole } from "@/stores/auth.store"
import { formatDateTime, formatRelative } from "@/lib/datetime"
import { formatMoney, percentOff } from "@/lib/money"
import { isAwaitingDeveloper } from "@/lib/promotion"
import type {
  FestivalDetailView,
  FestivalGameView,
  PromotionSnapshotView,
} from "@/types/festival.api.type"

interface Props {
  id: string
}

const EDITABLE_STATES = new Set(["DRAFT", "ACTIVE"])

export function FestivalDetail({ id }: Props) {
  const isAdmin = useHasRole("ADMIN")
  const isStaff = useHasRole("SUPPORT", "ADMIN")
  const { data: festival, isPending, isError } = useFestivalQuery(id)

  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const start = useStartFestivalMutation(id)
  const end = useEndFestivalMutation(id)
  const cancel = useCancelFestivalMutation(id)

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !festival) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h1 className="text-lg font-semibold">No such festival</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been removed.
        </p>
        <Button
          variant="outline"
          className="mt-5 min-h-11"
          nativeButton={false}
          render={<Link href="/festivals" />}
        >
          Back to festivals
        </Button>
      </div>
    )
  }

  const editable = EDITABLE_STATES.has(festival.state)
  const busy = start.isPending || end.isPending || cancel.isPending

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <Button
        variant="ghost"
        size="sm"
        className="-ms-2 gap-1.5"
        nativeButton={false}
        render={<Link href="/festivals" />}
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        Festivals
      </Button>

      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold sm:text-3xl">
                {festival.name}
              </h1>
              <FestivalStateBadge state={festival.state} />
            </div>
            {festival.description && (
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {festival.description}
              </p>
            )}
          </div>

          {isAdmin && festival.state === "DRAFT" && (
            <Button
              variant="outline"
              size="sm"
              className="min-h-9 gap-1.5"
              onClick={() => setRescheduleOpen(true)}
            >
              <CalendarClock className="size-3.5" />
              Reschedule
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarClock className="size-3.5" strokeWidth={1.75} />
            {formatDateTime(festival.starts_at)} –{" "}
            {formatDateTime(festival.ends_at)}
          </span>
          {festival.started_at && (
            <span>Started {formatRelative(festival.started_at)}</span>
          )}
          {festival.ended_at && (
            <span>Ended {formatRelative(festival.ended_at)}</span>
          )}
        </div>
      </div>

      {isAdmin && (
        <RescheduleFestivalDialog
          festivalId={festival.id}
          startsAt={festival.starts_at}
          endsAt={festival.ends_at}
          open={rescheduleOpen}
          onOpenChange={setRescheduleOpen}
        />
      )}

      {isAdmin &&
        (festival.state === "DRAFT" || festival.state === "ACTIVE") && (
          <section className="space-y-2 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Lifecycle</h2>
            <div className="flex flex-wrap items-center gap-2">
              {festival.state === "DRAFT" && (
                <Button
                  className="min-h-9 gap-1.5"
                  disabled={busy || festival.games.length === 0}
                  onClick={() => start.mutate()}
                >
                  {start.isPending && (
                    <Loader2 className="size-3.5 animate-spin" />
                  )}
                  Start festival
                </Button>
              )}
              {festival.state === "ACTIVE" && (
                <Button
                  className="min-h-9 gap-1.5"
                  disabled={busy}
                  onClick={() => end.mutate()}
                >
                  {end.isPending && (
                    <Loader2 className="size-3.5 animate-spin" />
                  )}
                  End festival
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                className="min-h-9 gap-1.5"
                disabled={busy}
                onClick={() => setCancelOpen(true)}
              >
                <X className="size-3.5" />
                Cancel festival
              </Button>
            </div>
            {festival.state === "DRAFT" && festival.games.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Add at least one game first.
              </p>
            )}
          </section>
        )}

      <CancelFestivalDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        pending={cancel.isPending}
        onConfirm={() =>
          cancel.mutate(undefined, { onSuccess: () => setCancelOpen(false) })
        }
      />

      <Separator />

      <FestivalGamesSection
        festival={festival}
        isAdmin={isAdmin}
        isStaff={isStaff}
        editable={editable}
      />
    </div>
  )
}

function CancelFestivalDialog({
  open,
  onOpenChange,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pending: boolean
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cancel this festival?</DialogTitle>
          <DialogDescription>
            Shoppers lose any discount tied to it and it stops being shown as
            live. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            className="min-h-11"
            onClick={() => onOpenChange(false)}
          >
            Keep it
          </Button>
          <Button
            variant="destructive"
            className="min-h-11"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Cancel festival
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FestivalGamesSection({
  festival,
  isAdmin,
  isStaff,
  editable,
}: {
  festival: FestivalDetailView
  isAdmin: boolean
  isStaff: boolean
  editable: boolean
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Gamepad2 className="size-4" strokeWidth={1.75} />
          Games in this festival
          <span className="text-muted-foreground">
            ({festival.games.length})
          </span>
        </h2>
        {isAdmin && editable && (
          <AddGameControl festivalId={festival.id} games={festival.games} />
        )}
      </div>

      {festival.games.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Gamepad2
            className="mx-auto size-8 text-muted-foreground/40"
            strokeWidth={1.5}
            aria-hidden
          />
          <p className="mt-4 text-sm font-medium">No games yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "Add a published game above to get this festival ready."
              : "An admin has not added any games to this festival yet."}
          </p>
        </div>
      )}

      {festival.games.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {festival.games.map((game) => (
            <FestivalGameRow
              key={game.game_id}
              festival={festival}
              game={game}
              isAdmin={isAdmin}
              isStaff={isStaff}
              editable={editable}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function FestivalGameRow({
  festival,
  game,
  isAdmin,
  isStaff,
  editable,
}: {
  festival: FestivalDetailView
  game: FestivalGameView
  isAdmin: boolean
  isStaff: boolean
  editable: boolean
}) {
  const isOwner = useAuthStore((state) => state.userId) === game.developer_id
  const remove = useRemoveFestivalGameMutation(festival.id)
  const [proposeOpen, setProposeOpen] = useState(false)

  const promotions = festival.promotions.filter(
    (promotion) => promotion.game_id === game.game_id
  )
  const activePromotion = promotions.find((p) => p.state === "ACTIVE")
  const blocking = promotions.find(
    (p) => isAwaitingDeveloper(p.state) || p.state === "ACTIVE"
  )

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/games/${game.game_id}`}
          className="text-sm font-semibold hover:text-primary hover:underline"
        >
          {game.title}
        </Link>
        {isAdmin && editable && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${game.title}`}
            disabled={remove.isPending}
            onClick={() => remove.mutate(game.game_id)}
          >
            {remove.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <X className="size-3.5" />
            )}
          </Button>
        )}
      </div>

      {game.discounted_price && game.discount_bps !== null && (
        <div className="flex items-center gap-2 text-sm">
          {activePromotion?.list_price && (
            <span className="text-muted-foreground tabular line-through">
              {formatMoney(activePromotion.list_price)}
            </span>
          )}
          <span className="font-semibold text-primary tabular">
            {formatMoney(game.discounted_price)}
          </span>
          <Badge className="gap-1 border-primary/25 bg-primary/15 text-primary">
            <Tag className="size-3" />
            {percentOff(game.discount_bps)}% off
          </Badge>
        </div>
      )}

      {!game.discounted_price &&
        blocking &&
        isAwaitingDeveloper(blocking.state) && (
          <p className="text-xs text-muted-foreground">
            {percentOff(blocking.discount_bps)}% off — waiting on the developer
          </p>
        )}

      {isOwner && <PromotionDecisions gameId={game.game_id} />}

      {isStaff && (!isOwner || !blocking) && (
        <div className="border-t border-border pt-3">
          {blocking ? (
            <PromotionStatus promotion={blocking} />
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="min-h-9 gap-1.5"
              onClick={() => setProposeOpen(true)}
            >
              <Megaphone className="size-3.5" />
              Propose a discount
            </Button>
          )}
        </div>
      )}

      {isStaff && (
        <ProposeDiscountDialog
          gameId={game.game_id}
          gameTitle={game.title}
          festivalId={festival.id}
          festivalStartsAt={festival.starts_at}
          festivalEndsAt={festival.ends_at}
          open={proposeOpen}
          onOpenChange={setProposeOpen}
        />
      )}
    </div>
  )
}

function PromotionStatus({ promotion }: { promotion: PromotionSnapshotView }) {
  if (isAwaitingDeveloper(promotion.state)) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-warning">
        <Tag className="size-3.5" />
        {percentOff(promotion.discount_bps)}% proposed — waiting on the
        developer
      </p>
    )
  }
  return (
    <p className="flex items-center gap-1.5 text-xs text-primary">
      <Tag className="size-3.5" />
      {percentOff(promotion.discount_bps)}% off, approved
    </p>
  )
}

function AddGameControl({
  festivalId,
  games,
}: {
  festivalId: string
  games: FestivalGameView[]
}) {
  // Catalog caps `limit` at 100 — anything higher is a 422.
  const { data, isPending } = useGamesQuery({ state: "PUBLISHED", limit: 100 })
  const add = useAddFestivalGameMutation(festivalId)
  const [selected, setSelected] = useState<string | null>(null)

  const inFestival = new Set(games.map((game) => game.game_id))
  const options = (data?.items ?? []).filter((game) => !inFestival.has(game.id))

  return (
    <div className="flex items-center gap-2">
      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger className="min-h-9 min-w-56" size="sm">
          <SelectValue
            placeholder={isPending ? "Loading games…" : "Add a published game"}
          />
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 && !isPending && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              No eligible games left
            </div>
          )}
          {options.map((game) => (
            <SelectItem key={game.id} value={game.id}>
              {game.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        className="min-h-9 gap-1.5"
        disabled={!selected || add.isPending}
        onClick={() =>
          selected &&
          add.mutate(selected, { onSuccess: () => setSelected(null) })
        }
      >
        {add.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Plus className="size-3.5" />
        )}
        Add
      </Button>
    </div>
  )
}
