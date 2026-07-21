"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { listSchedules, type ScheduleRecord } from "@/lib/api/schedules"
import { formatCivilDate } from "@/lib/date-utils"

type LiveServiceStatusFilter = "scheduled" | "in_progress" | "emergency" | "cancelled"

const STATUS_OPTIONS: Array<{ value: LiveServiceStatusFilter; label: string }> = [
  { value: "scheduled", label: "Agendados" },
  { value: "in_progress", label: "Em andamento" },
  { value: "emergency", label: "Emergenciais" },
  { value: "cancelled", label: "Cancelados" },
]

function matchesStatusFilter(schedule: ScheduleRecord, filter: LiveServiceStatusFilter) {
  switch (filter) {
    case "scheduled":
      return schedule.status === "scheduled" || schedule.status === "rescheduled"
    case "in_progress":
      return schedule.status === "in_progress"
    case "emergency":
      return schedule.isEmergency
    case "cancelled":
      return schedule.status === "cancelled"
  }
}

function getStatusBadge(
  schedule: Pick<ScheduleRecord, "status" | "isEmergency">,
  filter: LiveServiceStatusFilter,
) {
  if (filter === "emergency" && schedule.isEmergency) {
    return <Badge className="bg-orange-100 text-orange-800">Emergencial</Badge>
  }

  switch (schedule.status) {
    case "in_progress":
      return <Badge className="bg-yellow-100 text-yellow-800">Em andamento</Badge>
    case "rescheduled":
      return <Badge className="bg-purple-100 text-purple-800">Reagendado</Badge>
    case "scheduled":
      return <Badge className="bg-blue-100 text-blue-800">Agendado</Badge>
    case "cancelled":
      return <Badge className="bg-red-100 text-red-800">Cancelado</Badge>
    default:
      return <Badge variant="secondary">{schedule.status}</Badge>
  }
}

type LiveServicesWidgetProps = {
  storageKey?: string
}

export function LiveServicesWidget({ storageKey }: LiveServicesWidgetProps = {}) {
  const [statusFilter, setStatusFilter] = useState<LiveServiceStatusFilter>("in_progress")
  const schedulesQuery = useQuery({
    queryKey: ["schedules", "dashboard-live-services"],
    queryFn: () => listSchedules(),
  })
  useEffect(() => {
    if (!storageKey) return
    const stored = window.localStorage.getItem(storageKey)
    if (stored && STATUS_OPTIONS.some((option) => option.value === stored)) {
      setStatusFilter(stored as LiveServiceStatusFilter)
    }
  }, [storageKey])

  const handleStatusFilterChange = (value: LiveServiceStatusFilter) => {
    setStatusFilter(value)
    if (storageKey) window.localStorage.setItem(storageKey, value)
  }

  const schedules = schedulesQuery.data?.data ?? []
  const filtered = useMemo(() => {
    return schedules
      .filter((schedule) => matchesStatusFilter(schedule, statusFilter))
      .sort((left, right) => `${left.date} ${left.time}`.localeCompare(`${right.date} ${right.time}`))
  }, [schedules, statusFilter])

  return (
    <Card className="flex h-full max-h-[360px] flex-col p-4 transition-all duration-500 hover:shadow-xl sm:max-h-[380px] lg:min-h-[360px] lg:max-h-[460px]">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">Atendimentos em tempo real</h2>
          </div>
        </div>
        <Select value={statusFilter} onValueChange={(value) => handleStatusFilterChange(value as LiveServiceStatusFilter)}>
          <SelectTrigger className="h-9 w-full rounded-full sm:w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
        {schedulesQuery.isLoading ? (
          Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="rounded-xl border p-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-3 w-56 max-w-full" />
            </div>
          ))
        ) : filtered.length > 0 ? (
          filtered.map((schedule) => (
            <div key={schedule.id} className="rounded-xl border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{schedule.clientName}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{schedule.serviceTypeName}</p>
                </div>
                {getStatusBadge(schedule, statusFilter)}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {formatCivilDate(schedule.date, schedule.date)} às {schedule.time || "08:00"}
              </p>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Nenhum atendimento encontrado para este filtro.
          </div>
        )}
      </div>
    </Card>
  )
}
