import { Suspense } from "react"

import { CommunityPage } from "@/components/community/community-page"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = {
  title: "Community",
  description:
    "Public posts about Arcadia games. Read without an account; writing needs one.",
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-2xl space-y-4 px-6 py-10 lg:px-10">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      }
    >
      <CommunityPage />
    </Suspense>
  )
}
