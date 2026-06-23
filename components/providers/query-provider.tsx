"use client"

import { keepPreviousData, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AxiosError } from "axios"
import { ReactNode, useState } from "react"

const DEFAULT_STALE_TIME = 60_000
const DEFAULT_GC_TIME = 10 * 60_000

function shouldRetryRequest(failureCount: number, error: unknown) {
  const status = (error as AxiosError).response?.status
  if (status === 401) return false
  return failureCount < 1
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: shouldRetryRequest,
            staleTime: DEFAULT_STALE_TIME,
            gcTime: DEFAULT_GC_TIME,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            placeholderData: keepPreviousData,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
