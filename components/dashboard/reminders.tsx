"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { MapPin, Clock, ArrowRight } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { getDashboardAnalytics, type DashboardAnalyticsParams } from "@/lib/api/analytics"
import Link from "next/link"

export function UpcomingServices(period: DashboardAnalyticsParams = {}) {
  const dashboardQuery = useQuery({
    queryKey: ["analytics", "dashboard", period],
    queryFn: () => getDashboardAnalytics(period),
  })
  const isLoading = dashboardQuery.isLoading || (dashboardQuery.isFetching && !dashboardQuery.data)
  const upcomingServices = dashboardQuery.data?.data.upcomingServices ?? []

  return (
    <Card
      className="flex h-full flex-col p-4 transition-all duration-500 hover:shadow-xl lg:min-h-[360px] lg:max-h-[460px]"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Próximos Serviços</h2>
        <Link href="/agenda">
          <Button variant="ghost" size="sm" className="text-xs text-foreground hover:text-foreground/80">
            Ver todos
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </Link>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {isLoading ? (
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
        ) : upcomingServices.map((service) => {
          return (
            <div 
              key={service.id}
              className="p-3 rounded-lg border border-border transition-all duration-300 hover:shadow-md hover:border-primary/30 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{service.serviceTypeName}</h3>
                  <p className="text-xs text-muted-foreground truncate">{service.clientName}</p>
                </div>
                <Badge 
                  className={`text-[10px] flex-shrink-0 ${
                    service.status === "in_progress" 
                      ? "bg-amber-100 text-amber-700 hover:bg-amber-100" 
                      : "bg-blue-100 text-blue-700 hover:bg-blue-100"
                  }`}
                >
                  {service.status === "in_progress" ? "Em andamento" : "Agendado"}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{service.time || "08:00"}</span>
                </div>
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{service.neighborhood}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
