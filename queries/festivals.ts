"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { catalogKeys } from "@/api/catalog"
import {
  addFestivalGame,
  cancelFestival,
  createFestival,
  endFestival,
  festivalKeys,
  getFestival,
  getFestivals,
  removeFestivalGame,
  rescheduleFestival,
  startFestival,
  type CreateFestivalBody,
  type FestivalFilters,
} from "@/api/festivals"

export function useFestivalsQuery(filters: FestivalFilters) {
  return useQuery({
    queryKey: festivalKeys.list(filters),
    queryFn: () => getFestivals(filters),
    staleTime: 60 * 1000,
  })
}

export function useFestivalQuery(id: string) {
  return useQuery({
    queryKey: festivalKeys.detail(id),
    queryFn: () => getFestival(id),
    staleTime: 15 * 1000,
    enabled: Boolean(id),
  })
}

function useFestivalInvalidation(id: string) {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: festivalKeys.all })
    void client.invalidateQueries({ queryKey: festivalKeys.detail(id) })
    // A festival starting or a promotion landing changes what the storefront shows.
    void client.invalidateQueries({ queryKey: catalogKeys.all })
  }
}

export function useCreateFestivalMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateFestivalBody) => createFestival(body),
    onSuccess: (festival) => {
      void client.invalidateQueries({ queryKey: festivalKeys.all })
      toast.success(`${festival.name} created as a draft`)
    },
  })
}

export function useRescheduleFestivalMutation(id: string) {
  const invalidate = useFestivalInvalidation(id)
  return useMutation({
    mutationFn: (args: { startsAt: string; endsAt: string }) =>
      rescheduleFestival(id, args.startsAt, args.endsAt),
    onSuccess: () => {
      invalidate()
      toast.success("Dates updated")
    },
  })
}

export function useAddFestivalGameMutation(id: string) {
  const invalidate = useFestivalInvalidation(id)
  return useMutation({
    mutationFn: (gameId: string) => addFestivalGame(id, gameId),
    onSuccess: () => {
      invalidate()
      toast.success("Game added to the festival")
    },
  })
}

export function useRemoveFestivalGameMutation(id: string) {
  const invalidate = useFestivalInvalidation(id)
  return useMutation({
    mutationFn: (gameId: string) => removeFestivalGame(id, gameId),
    onSuccess: () => {
      invalidate()
      toast.success("Game removed")
    },
  })
}

export function useStartFestivalMutation(id: string) {
  const invalidate = useFestivalInvalidation(id)
  return useMutation({
    mutationFn: () => startFestival(id),
    onSuccess: (festival) => {
      invalidate()
      toast.success(`${festival.name} is live`, {
        description: "Everyone on the platform is being notified.",
      })
    },
  })
}

export function useEndFestivalMutation(id: string) {
  const invalidate = useFestivalInvalidation(id)
  return useMutation({
    mutationFn: () => endFestival(id),
    onSuccess: (festival) => {
      invalidate()
      toast.success(`${festival.name} has ended`)
    },
  })
}

export function useCancelFestivalMutation(id: string) {
  const invalidate = useFestivalInvalidation(id)
  return useMutation({
    mutationFn: () => cancelFestival(id),
    onSuccess: (festival) => {
      invalidate()
      toast.success(`${festival.name} was cancelled`)
    },
  })
}
