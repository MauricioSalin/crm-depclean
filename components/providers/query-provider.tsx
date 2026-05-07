"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AxiosError } from "axios"
import { ReactNode, useState } from "react"

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
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
