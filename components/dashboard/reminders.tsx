"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapPin, Clock, ArrowRight } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { getDashboardAnalytics } from "@/lib/api/analytics"
import Link from "next/link"

export function UpcomingServices({ days = 30 }: { days?: number }) {
  const dashboardQuery = useQuery({
    queryKey: ["analytics", "dashboard", days],
    queryFn: () => getDashboardAnalytics({ days }),
  })
  const upcomingServices = dashboardQuery.data?.data.upcomingServices ?? []

  return (
    <Card
      className="h-full p-4 transition-all duration-500 hover:shadow-xl"
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
      <div className="space-y-3">
        {upcomingServices.map((service) => {
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
