"use client"

import { keepPreviousData, MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AxiosError } from "axios"
import { ReactNode, useState } from "react"

const DEFAULT_STALE_TIME = 60_000
const DEFAULT_GC_TIME = 10 * 60_000

function shouldRetryRequest(failureCount: number, error: unknown) {
  const status = (error as AxiosError).response?.status
  if (status === 401) return false
  return failureCount < 1
}

export function createAppQueryClient() {
  const mutationCache = new MutationCache({
    onSettled: (_data, error, _variables, _context, mutation, mutationContext) => {
      if (error || mutation.meta?.skipGlobalInvalidation === true) return

      void mutationContext.client.invalidateQueries()
    },
  })

  return new QueryClient({
    mutationCache,
    defaultOptions: {
      queries: {
        retry: shouldRetryRequest,
        staleTime: DEFAULT_STALE_TIME,
        gcTime: DEFAULT_GC_TIME,
        refetchOnMount: "always",
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        placeholderData: keepPreviousData,
      },
      mutations: {
        retry: 0,
      },
    },
  })
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createAppQueryClient)

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
