"use client"

import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"

import { catalogKeys } from "@/api/catalog"
import { festivalKeys } from "@/api/festivals"
import { notificationKeys } from "@/api/notifications"
import { isAwaitingDeveloper } from "@/lib/promotion"
import {
  addVersion,
  acceptPrice,
  appealRejection,
  approveGame,
  attachCover,
  decidePromotion,
  getMyGames,
  getPromotions,
  getReviewQueue,
  proposePromotion,
  publishGame,
  registerGame,
  rejectGame,
  rejectPrice,
  relistGame,
  setFinalPrice,
  startReview,
  submitGame,
  suggestPrice,
  withdrawGame,
  workflowKeys,
  type ProposePromotionBody,
  type RegisterGameBody,
} from "@/api/workflow"

export function useMyGamesQuery() {
  return useQuery({
    queryKey: workflowKeys.mine(),
    queryFn: getMyGames,
    staleTime: 15 * 1000,
  })
}

export function useReviewQueueQuery() {
  return useQuery({
    queryKey: workflowKeys.reviewQueue(),
    queryFn: getReviewQueue,
    staleTime: 15 * 1000,
  })
}

export function usePromotionsQuery(gameId: string) {
  return useQuery({
    queryKey: workflowKeys.promotions(gameId),
    queryFn: () => getPromotions(gameId),
    staleTime: 30 * 1000,
    enabled: Boolean(gameId),
  })
}

/**
 * Which of these games have a discount waiting on the developer.
 *
 * `/games/mine` is `GameView` — no promotions — so the "Needs you" grouping
 * has to ask for each published title. Same cache key as `PromotionDecisions`,
 * so the panel on the card does not refetch.
 */
export function usePendingPromotionIds(gameIds: string[]) {
  return useQueries({
    queries: gameIds.map((id) => ({
      queryKey: workflowKeys.promotions(id),
      queryFn: () => getPromotions(id),
      staleTime: 30 * 1000,
      enabled: Boolean(id),
    })),
    combine: (results) => ({
      ids: new Set(
        gameIds.filter((id, index) =>
          results[index]?.data?.items.some((promotion) =>
            isAwaitingDeveloper(promotion.state)
          )
        )
      ),
      isPending: results.some((result) => result.isPending),
    }),
  })
}

/**
 * Everything a workflow step can change, invalidated together.
 *
 * A single transition can touch four caches: the developer's own list, the review
 * queue, the storefront (a publish adds a game to it) and the notifications the
 * step raises. Listing them once here is what stops each of the twelve mutations
 * below remembering a different subset.
 */
function useWorkflowInvalidation() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: workflowKeys.mine() })
    void client.invalidateQueries({ queryKey: workflowKeys.reviewQueue() })
    void client.invalidateQueries({ queryKey: catalogKeys.all })
    void client.invalidateQueries({ queryKey: festivalKeys.all })
    void client.invalidateQueries({ queryKey: notificationKeys.all })
  }
}

function useWorkflowMutation<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  message: (result: TResult) => string
) {
  const invalidate = useWorkflowInvalidation()
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      invalidate()
      toast.success(message(result))
    },
  })
}

// --- the developer's side --------------------------------------------------

export function useRegisterGameMutation() {
  return useWorkflowMutation(
    ({ cover, ...body }: RegisterGameBody & { cover?: File }) =>
      registerGame(body, cover),
    (game) => `${game.title} created as a draft`
  )
}

export function useAttachCoverMutation() {
  return useWorkflowMutation(
    (args: { gameId: string; file: File }) =>
      attachCover(args.gameId, args.file),
    (game) => `Cover added to ${game.title}`
  )
}

export function useAddVersionMutation() {
  return useWorkflowMutation(
    (args: { gameId: string; version: string; sizeBytes: number }) =>
      addVersion(args.gameId, args.version, args.sizeBytes),
    (game) => `Build added to ${game.title}`
  )
}

export function useSubmitGameMutation() {
  return useWorkflowMutation(
    (gameId: string) => submitGame(gameId),
    (game) => `${game.title} submitted for review`
  )
}

export function useAcceptPriceMutation() {
  return useWorkflowMutation(
    (gameId: string) => acceptPrice(gameId),
    (game) => `Accepted the suggested price for ${game.title}`
  )
}

export function useRejectPriceMutation() {
  return useWorkflowMutation(
    (args: { gameId: string; amountMinor: number }) =>
      rejectPrice(args.gameId, args.amountMinor),
    (game) => `Proposed a new price for ${game.title}`
  )
}

export function useSetPriceMutation() {
  return useWorkflowMutation(
    (args: { gameId: string; amountMinor: number }) =>
      setFinalPrice(args.gameId, args.amountMinor),
    (game) => `Price updated for ${game.title}`
  )
}

export function usePublishGameMutation() {
  return useWorkflowMutation(
    (gameId: string) => publishGame(gameId),
    (game) => `${game.title} is on sale`
  )
}

export function useWithdrawGameMutation() {
  return useWorkflowMutation(
    (args: { gameId: string; reason: string }) =>
      withdrawGame(args.gameId, args.reason),
    (game) => `${game.title} withdrawn from sale`
  )
}

export function useRelistGameMutation() {
  return useWorkflowMutation(
    (gameId: string) => relistGame(gameId),
    (game) => `${game.title} is back on sale`
  )
}

export function useAppealMutation() {
  return useWorkflowMutation(
    (args: { gameId: string; note: string }) =>
      appealRejection(args.gameId, args.note),
    (game) => `Appeal sent for ${game.title}`
  )
}

export function useDecidePromotionMutation(gameId: string) {
  const client = useQueryClient()
  const invalidate = useWorkflowInvalidation()
  return useMutation({
    mutationFn: (args: { promotionId: string; approve: boolean }) =>
      decidePromotion(gameId, args.promotionId, args.approve),
    onSuccess: (promotion) => {
      invalidate()
      void client.invalidateQueries({
        queryKey: workflowKeys.promotions(gameId),
      })
      toast.success(
        promotion.state === "ACTIVE"
          ? promotion.live
            ? `${promotion.percent_off}% discount is live`
            : `${promotion.percent_off}% discount approved`
          : "Discount declined"
      )
    },
  })
}

// --- Support's side -------------------------------------------------------

export function useStartReviewMutation() {
  return useWorkflowMutation(
    (gameId: string) => startReview(gameId),
    (game) => `Reviewing ${game.title}`
  )
}

export function useApproveGameMutation() {
  return useWorkflowMutation(
    (args: { gameId: string; note: string }) =>
      approveGame(args.gameId, args.note),
    (game) => `${game.title} approved`
  )
}

export function useRejectGameMutation() {
  return useWorkflowMutation(
    (args: { gameId: string; note: string }) =>
      rejectGame(args.gameId, args.note),
    (game) => `${game.title} rejected`
  )
}

export function useSuggestPriceMutation() {
  return useWorkflowMutation(
    (args: { gameId: string; amountMinor: number }) =>
      suggestPrice(args.gameId, args.amountMinor),
    (game) => `Price suggested for ${game.title}`
  )
}

export function useProposePromotionMutation(gameId: string) {
  const client = useQueryClient()
  const invalidate = useWorkflowInvalidation()
  return useMutation({
    mutationFn: (body: ProposePromotionBody) => proposePromotion(gameId, body),
    onSuccess: (promotion) => {
      invalidate()
      void client.invalidateQueries({
        queryKey: workflowKeys.promotions(gameId),
      })
      toast.success(`${promotion.percent_off}% discount proposed`, {
        description: "It does not start until the developer approves it.",
      })
    },
  })
}
