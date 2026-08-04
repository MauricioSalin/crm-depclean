"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { MapPin, Clock, ArrowRight } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { listSchedules, type ScheduleRecord } from "@/lib/api/schedules"
import { addCivilDaysKey, formatCivilDate, toCivilDateKey } from "@/lib/date-utils"
import Link from "next/link"

type UpcomingServicesProps = {
  enabled?: boolean
  onScheduleOpen?: (schedule: ScheduleRecord) => void
}

export function UpcomingServices({ enabled = true, onScheduleOpen }: UpcomingServicesProps = {}) {
  const todayKey = toCivilDateKey(new Date())
  const tomorrowKey = addCivilDaysKey(todayKey, 1)
  const schedulesQuery = useQuery({
    queryKey: ["schedules", "dashboard-upcoming-services", todayKey, tomorrowKey],
    queryFn: () => listSchedules({ dateFrom: todayKey, dateTo: tomorrowKey }),
    enabled,
  })
  const isLoading = schedulesQuery.isLoading || (schedulesQuery.isFetching && !schedulesQuery.data)
  const upcomingServices = (schedulesQuery.data?.data ?? [])
    .filter((schedule) => ["scheduled", "rescheduled", "in_progress"].includes(schedule.status))
    .sort((left, right) => `${left.date} ${left.time}`.localeCompare(`${right.date} ${right.time}`))
  const dateGroups = [
    { date: todayKey, label: "Hoje" },
    { date: tomorrowKey, label: "Amanhã" },
  ].map((group) => ({
    ...group,
    services: upcomingServices.filter((service) => service.date === group.date),
  }))

  return (
    <Card
      data-dashboard-widget="upcoming-services"
      className="flex h-full flex-col p-4 transition-all duration-500 hover:shadow-xl lg:min-h-[360px] lg:max-h-[460px]"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Próximos Serviços</h2>
        {enabled ? (
          <Link href="/agenda">
            <Button variant="ghost" size="sm" className="text-xs text-foreground hover:text-foreground/80">
              Ver todos
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {!enabled ? (
          <div className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
            Sem permissão para visualizar agendamentos.
          </div>
        ) : isLoading ? (
          Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="rounded-lg border border-border p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-40 max-w-full" />
                  <Skeleton className="h-3 w-32 max-w-full" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          ))
        ) : dateGroups.map((group) => (
          <section key={group.date} aria-labelledby={`upcoming-services-${group.date}`}>
            <div className="mb-2 flex items-center gap-2">
              <h3 id={`upcoming-services-${group.date}`} className="text-sm font-semibold text-foreground">
                {group.label}
              </h3>
              <span className="text-xs text-muted-foreground">{formatCivilDate(group.date, group.date)}</span>
            </div>

            {group.services.length === 0 ? (
              <div className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                Nenhum serviço agendado.
              </div>
            ) : (
              <div className="space-y-3">
                {group.services.map((service) => (
                  <button
                    type="button"
                    key={service.id}
                    aria-label={`Abrir agendamento de ${service.clientName}`}
                    className="block w-full rounded-lg border border-border p-3 text-left transition-all duration-300 hover:border-primary/40 hover:bg-muted/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    onClick={() => onScheduleOpen?.(service)}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-sm font-medium">{service.serviceTypeName}</h4>
                        <p className="truncate text-xs text-muted-foreground">{service.clientName}</p>
                      </div>
                      <Badge
                        className={`flex-shrink-0 text-[10px] ${
                          service.status === "in_progress"
                            ? "bg-amber-100 text-amber-700 hover:bg-amber-100"
                            : "bg-blue-100 text-blue-700 hover:bg-blue-100"
                        }`}
                      >
                        {service.status === "in_progress"
                          ? "Em andamento"
                          : service.status === "rescheduled"
                            ? "Reagendado"
                            : "Agendado"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{service.time || "08:00"}</span>
                      </div>
                      <div className="flex min-w-0 flex-1 items-center gap-1">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{service.address || service.unitName || "Local não informado"}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </Card>
  )
}
