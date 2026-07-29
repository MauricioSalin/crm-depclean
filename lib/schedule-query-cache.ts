import type { QueryClient } from "@tanstack/react-query"
import type { ScheduleRecord } from "@/lib/api/schedules"

type ScheduleListResponse = {
  success: true
  data: ScheduleRecord[]
}

export function cacheSavedSchedule(queryClient: QueryClient, savedSchedule: ScheduleRecord) {
  queryClient.setQueriesData<ScheduleListResponse>(
    { queryKey: ["schedules"] },
    (current) => {
      if (!current || !Array.isArray(current.data)) return current

      const alreadyCached = current.data.some((schedule) => schedule.id === savedSchedule.id)
      return {
        ...current,
        data: alreadyCached
          ? current.data.map((schedule) => schedule.id === savedSchedule.id ? savedSchedule : schedule)
          : [savedSchedule, ...current.data],
      }
    },
  )

  queryClient.setQueryData(["schedule", savedSchedule.id], {
    success: true,
    data: savedSchedule,
  })
}
