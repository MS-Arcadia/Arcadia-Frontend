"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { Skeleton } from "@/components/ui/skeleton"
import { useAuthStore } from "@/stores/auth.store"

/** `/profile` always means "me" — the shelf itself is addressed by id. */
export default function MyProfileRedirect() {
  const router = useRouter()
  const userId = useAuthStore((state) => state.userId)

  useEffect(() => {
    if (userId) router.replace(`/profile/${userId}`)
  }, [router, userId])

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <Skeleton className="h-44 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  )
}
