"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Loader2, Send, Upload } from "lucide-react"

import { GameStateBadge } from "@/components/game/game-state-badge"
import { PromotionDecisions } from "@/components/developer/promotion-decisions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  useAddVersionMutation,
  useAppealMutation,
  usePublishGameMutation,
  useRelistGameMutation,
  useSetPriceMutation,
  useSubmitGameMutation,
  useWithdrawGameMutation,
} from "@/queries/workflow"
import { formatDate } from "@/lib/datetime"
import { formatMoney } from "@/lib/money"
import type { Game } from "@/types/catalog.api.type"

interface Props {
  game: Game
}

/** A build size that is plausible for a game, since there is no real upload here.
 *  The media service owns the actual file; this is the metadata the catalog keeps. */
const PLACEHOLDER_SIZE = 4_200_000_000

/**
 * One game, and only the actions its current state actually allows.
 *
 * The catalog refuses an illegal transition with a 409, so rendering every button
 * always and letting the server say no would be technically correct and horrible
 * to use. What is shown is derived from the state instead, which is why this reads
 * as a switch rather than a row of buttons.
 */
export function DeveloperGameCard({ game }: Props) {
  const art = game.media.find((item) => item.kind === "COVER") ?? game.media[0]

  const addVersion = useAddVersionMutation()
  const submit = useSubmitGameMutation()
  const setPrice = useSetPriceMutation()
  const publish = usePublishGameMutation()
  const withdraw = useWithdrawGameMutation()
  const relist = useRelistGameMutation()
  const appeal = useAppealMutation()

  const [price, setPriceInput] = useState("")
  const [version, setVersion] = useState("")
  const [appealNote, setAppealNote] = useState("")

  const busy =
    addVersion.isPending ||
    submit.isPending ||
    setPrice.isPending ||
    publish.isPending ||
    withdraw.isPending ||
    relist.isPending ||
    appeal.isPending

  const latest = game.versions.at(-1)

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex gap-4 p-4">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
          {art && (
            <Image
              src={art.media_ref}
              alt=""
              fill
              sizes="80px"
              className="object-cover"
            />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{game.title}</h3>
            <GameStateBadge
              state={game.state}
              withdrawn={Boolean(game.withdrawn_at)}
            />
            {game.genres.map((genre) => (
              <span key={genre} className="text-xs text-muted-foreground">
                {genre}
              </span>
            ))}
          </div>

          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {game.description}
          </p>

          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {latest ? (
              <span>
                <dt className="inline">Build </dt>
                <dd className="inline font-mono text-foreground">
                  {latest.version}
                </dd>
              </span>
            ) : (
              <span className="text-warning">No build uploaded</span>
            )}
            {game.final_price && (
              <span>
                <dt className="inline">Price </dt>
                <dd className="inline text-foreground tabular">
                  {formatMoney(game.final_price)}
                </dd>
              </span>
            )}
            {game.published_at && (
              <span>
                <dt className="inline">Published </dt>
                <dd className="inline text-foreground">
                  {formatDate(game.published_at)}
                </dd>
              </span>
            )}
          </dl>
        </div>

        {(game.state === "PUBLISHED" || game.state === "PREORDER") && (
          <Button
            variant="ghost"
            size="sm"
            className="h-fit shrink-0"
            nativeButton={false}
            render={<Link href={`/games/${game.id}`} />}
          >
            View in store
          </Button>
        )}
      </div>

      {/* --- what this state allows ------------------------------------- */}

      <div className="border-t border-border bg-background/40 p-4">
        {game.state === "DRAFT" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              A game needs a build before it can be reviewed — there is nothing
              to look at otherwise, and the catalog refuses the submission.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-32 flex-1 space-y-1.5">
                <Label htmlFor={`version-${game.id}`} className="text-xs">
                  Version
                </Label>
                <Input
                  id={`version-${game.id}`}
                  value={version}
                  onChange={(event) => setVersion(event.target.value)}
                  placeholder="1.0.0"
                  className="min-h-9 font-mono text-xs"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="min-h-9"
                disabled={busy || !version.trim()}
                onClick={() =>
                  addVersion.mutate(
                    {
                      gameId: game.id,
                      version: version.trim(),
                      sizeBytes: PLACEHOLDER_SIZE,
                    },
                    { onSuccess: () => setVersion("") }
                  )
                }
              >
                {addVersion.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                Add build
              </Button>
              <Button
                size="sm"
                className="min-h-9"
                disabled={busy || game.versions.length === 0}
                onClick={() => submit.mutate(game.id)}
              >
                {submit.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                Submit for review
              </Button>
            </div>
          </div>
        )}

        {(game.state === "SUBMITTED" || game.state === "IN_REVIEW") && (
          <p className="text-xs text-muted-foreground">
            {game.state === "SUBMITTED"
              ? "In the queue. Support has not picked it up yet."
              : "Somebody from Support is looking at it now."}
          </p>
        )}

        {game.state === "REJECTED" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Requirement 1.3 gives you a route back: answer the reviewer&apos;s
              note and it returns to the queue.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-48 flex-1 space-y-1.5">
                <Label htmlFor={`appeal-${game.id}`} className="text-xs">
                  What changed
                </Label>
                <Input
                  id={`appeal-${game.id}`}
                  value={appealNote}
                  onChange={(event) => setAppealNote(event.target.value)}
                  placeholder="The placeholder art has been replaced"
                  className="min-h-9"
                />
              </div>
              <Button
                size="sm"
                className="min-h-9"
                disabled={busy || !appealNote.trim()}
                onClick={() =>
                  appeal.mutate(
                    { gameId: game.id, note: appealNote.trim() },
                    { onSuccess: () => setAppealNote("") }
                  )
                }
              >
                Appeal
              </Button>
            </div>
          </div>
        )}

        {game.state === "APPEALED" && (
          <p className="text-xs text-muted-foreground">
            Back in the review queue with your note attached.
          </p>
        )}

        {(game.state === "APPROVED" || game.state === "PRICED") && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Approved. The price is yours to set — Support can suggest one, but
              it does not bind you.
              {game.suggested_price && (
                <>
                  {" "}
                  They suggested{" "}
                  <span className="text-foreground tabular">
                    {formatMoney(game.suggested_price)}
                  </span>
                  .
                </>
              )}
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-32 flex-1 space-y-1.5">
                <Label htmlFor={`price-${game.id}`} className="text-xs">
                  Price
                </Label>
                <Input
                  id={`price-${game.id}`}
                  inputMode="numeric"
                  value={price}
                  onChange={(event) =>
                    setPriceInput(event.target.value.replace(/[^\d]/g, ""))
                  }
                  placeholder={game.final_price ? "" : "550000"}
                  className="min-h-9 tabular"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="min-h-9"
                disabled={busy || !price}
                onClick={() =>
                  setPrice.mutate(
                    { gameId: game.id, amountMinor: Number(price) * 100 },
                    { onSuccess: () => setPriceInput("") }
                  )
                }
              >
                Set price
              </Button>
              <Button
                size="sm"
                className="min-h-9"
                disabled={busy || game.final_price === null}
                onClick={() => publish.mutate(game.id)}
              >
                {publish.isPending && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                Publish
              </Button>
            </div>
            {game.final_price === null && (
              <p className="text-xs text-muted-foreground/70">
                Publishing needs a price first — the catalog refuses otherwise.
              </p>
            )}
          </div>
        )}

        {(game.state === "PUBLISHED" || game.state === "PREORDER") && (
          <div className="space-y-3">
            <PromotionDecisions gameId={game.id} />

            <div className="flex flex-wrap items-center gap-2">
              {game.withdrawn_at ? (
                <>
                  <Badge className="border-destructive/25 bg-destructive/15 text-destructive">
                    Withdrawn {formatDate(game.withdrawn_at)}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-9"
                    disabled={busy}
                    onClick={() => relist.mutate(game.id)}
                  >
                    Put back on sale
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-9 text-muted-foreground"
                  disabled={busy}
                  onClick={() =>
                    withdraw.mutate({
                      gameId: game.id,
                      reason: "Withdrawn by the developer",
                    })
                  }
                >
                  Withdraw from sale
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
