import type { QueryClient } from "@tanstack/react-query"

const installmentRelatedQueryKeys = [
  ["contract"],
  ["contracts"],
  ["client"],
  ["clients"],
  ["schedules"],
  ["analytics"],
] as const

export async function invalidateInstallmentRelatedQueries(queryClient: QueryClient) {
  await Promise.all(
    installmentRelatedQueryKeys.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  )
}
