"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

interface Props {
  children: React.ReactNode
}

export function AppProviders({ children }: Props) {
  // Created in state rather than at module scope: a module-level client is shared
  // by every request during server rendering, which leaks one visitor's cached
  // data into another's response.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Every query here sets its own staleTime deliberately; this is the
            // floor for anything that forgets.
            staleTime: 30 * 1000,
            retry: (failureCount, error) => {
              // Retrying a 4xx just repeats the same refusal. Only server
              // errors and dropped connections are worth a second attempt.
              const status = (error as { response?: { status?: number } })
                ?.response?.status
              if (status && status >= 400 && status < 500) return false
              return failureCount < 2
            },
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={client}>
      <TooltipProvider delay={200}>
        {children}
        <Toaster position="bottom-center" richColors closeButton />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
