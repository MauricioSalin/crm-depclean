"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowRight, Users } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { getDashboardAnalytics, type DashboardAnalyticsParams } from "@/lib/api/analytics"
import { getColorFromClass } from "@/lib/utils"
import Link from "next/link"

export function TeamCollaboration(period: DashboardAnalyticsParams = {}) {
  const dashboardQuery = useQuery({
    queryKey: ["analytics", "dashboard", period],
    queryFn: () => getDashboardAnalytics(period),
  })
  const isLoading = dashboardQuery.isLoading || (dashboardQuery.isFetching && !dashboardQuery.data)
  const teamsWithActivity = dashboardQuery.data?.data.teamsWithActivity ?? []

  return (
    <Card
      className="h-full p-4 transition-all duration-500 hover:shadow-xl"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Equipes</h2>
        <Link href="/equipes">
          <Button variant="ghost" size="sm" className="text-xs text-foreground hover:text-foreground/80">
            Ver todas
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </Link>
      </div>
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 p-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-56 max-w-full" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))
        ) : (
          teamsWithActivity.map((team) => (
            <div
              key={team.id}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-all duration-300 cursor-pointer group"
            >
              <div
                className="w-10 h-10 min-w-[2.5rem] rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${getColorFromClass(team.color)}1A` }}
              >
                <Users className="h-5 w-5" style={{ color: getColorFromClass(team.color) }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm truncate">{team.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {team.currentService 
                    ? `Em serviço: ${team.currentService}` 
                    : team.nextService 
                      ? `Próximo: ${team.nextService}`
                      : "Sem serviços agendados"
                  }
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={team.servicesCount > 0 ? "default" : "secondary"}
                  className="text-[10px]"
                >
                  {team.servicesCount} serviços
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}
