"use client"

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  DollarSign,
  FileCheck2,
  FileX2,
  Users,
  WalletCards,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getDashboardAnalytics, type DashboardAnalyticsParams, type DashboardStatsRecord } from "@/lib/api/analytics"
import Link from "next/link"
import { getColorFromClass } from "@/lib/utils"

const emptyStats: DashboardStatsRecord = {
  activeClients: 0,
  activeClientsChange: 0,
  inactiveClients: 0,
  activeContracts: 0,
  inactiveContracts: 0,
  activeContractsGlobalValue: 0,
  monthlyRevenue: 0,
  monthlyRevenueChange: 0,
  scheduledServices: 0,
  scheduledServicesChange: 0,
  completedServices: 0,
  completedServicesChange: 0,
  emergencyServices: 0,
  completionRate: 0,
  overdueInstallments: 0,
  overdueInstallmentsValue: 0,
  teamProductivity: [],
}

type DashboardPeriodProps = DashboardAnalyticsParams

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

export function StatsCards(period: DashboardPeriodProps = {}) {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)
  const dashboardQuery = useQuery({
    queryKey: ["analytics", "dashboard", period],
    queryFn: () => getDashboardAnalytics(period),
  })
  const isLoading = dashboardQuery.isLoading || (dashboardQuery.isFetching && !dashboardQuery.data)
  const dashboardStats = dashboardQuery.data?.data.stats ?? emptyStats

  const stats = [
    {
      title: "Faturamento Mensal",
      value: formatCurrency(dashboardStats.monthlyRevenue),
      change: `+${dashboardStats.monthlyRevenueChange}%`,
      isPositive: true,
      icon: DollarSign,
      bgColor: "bg-card",
      textColor: "text-foreground",
      delay: "100ms",
    },
    {
      title: "Valor Global Ativo",
      value: formatCurrency(dashboardStats.activeContractsGlobalValue),
      icon: WalletCards,
      bgColor: "bg-card",
      textColor: "text-foreground",
      delay: "120ms",
    },
    {
      title: "Contratos Ativos",
      value: dashboardStats.activeContracts.toString(),
      icon: FileCheck2,
      bgColor: "bg-card",
      textColor: "text-foreground",
      delay: "150ms",
    },
    {
      title: "Contratos Inativos",
      value: dashboardStats.inactiveContracts.toString(),
      icon: FileX2,
      bgColor: "bg-card",
      textColor: "text-foreground",
      delay: "180ms",
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat, index) => {
        const Icon = stat.icon
        return (
          <Card
            key={stat.title}
            aria-busy={isLoading}
            onMouseEnter={() => setHoveredCard(index)}
            onMouseLeave={() => setHoveredCard(null)}
            className={`${stat.bgColor} ${stat.textColor} p-4 transition-all duration-500 ease-out cursor-pointer ${hoveredCard === index ? "scale-105 shadow-2xl" : "shadow-lg"
              }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium opacity-90">{stat.title}</h3>
              <div
                className={`w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center transition-transform duration-300 ${hoveredCard === index ? "scale-110" : ""
                  }`}
              >
                <Icon className="w-3.5 h-3.5 text-primary" />
              </div>
            </div>
            {isLoading ? (
              <>
                <Skeleton className="mb-2 h-7 w-24" />
                <Skeleton className="h-3 w-14" />
              </>
            ) : (
              <>
                <p className="text-2xl font-bold mb-2">{stat.value}</p>
                <div className="flex items-center gap-1.5 text-xs opacity-80">
                  {stat.change && (
                    <>
                      {stat.isPositive ? (
                        <ArrowUpRight className="w-3 h-3 text-green-500" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3 text-red-500" />
                      )}
                      <span className={stat.isPositive ? "text-green-500" : "text-red-500"}>{stat.change}</span>
                    </>
                  )}
                </div>
              </>
            )}
          </Card>
        )
      })}
    </div>
  )
}

export function ProductivityCards(period: DashboardPeriodProps = {}) {
  const dashboardQuery = useQuery({
    queryKey: ["analytics", "dashboard", period],
    queryFn: () => getDashboardAnalytics(period),
  })
  const isLoading = dashboardQuery.isLoading || (dashboardQuery.isFetching && !dashboardQuery.data)
  const dashboardData = dashboardQuery.data?.data
  const dashboardStats = dashboardData?.stats ?? emptyStats
  const teamColors = new Map((dashboardData?.teamsWithActivity ?? []).map((team) => [team.id, team.color] as const))

  return (
    <Card className="flex h-full flex-col p-4 transition-all duration-500 hover:shadow-xl lg:min-h-[360px] lg:max-h-[460px]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Produtividade das Equipes</h2>
        <Link href="/equipes">
          <Button variant="ghost" size="sm" className="text-xs text-foreground hover:text-foreground/80">
            Ver todas
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </Link>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {isLoading ? (
          Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48 max-w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-10" />
                </div>
              </div>
              <Skeleton className="mt-3 h-2 w-full rounded-full" />
            </div>
          ))
        ) : (
          [...dashboardStats.teamProductivity]
          .sort((left, right) =>
            right.completedServices - left.completedServices ||
            right.scheduledServices - left.scheduledServices ||
            left.teamName.localeCompare(right.teamName),
          )
          .map((team) => {
          const teamColorClass = teamColors.get(team.teamId)
          const color = getColorFromClass(teamColorClass || "bg-lime-500")
          const total = team.completedServices + team.scheduledServices
          const completedPct = total > 0 ? Math.round((team.completedServices / total) * 100) : 0
          return (
            <div
              key={team.teamId}
              className="rounded-xl border bg-card p-4 hover:shadow-md transition-all duration-300"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 min-w-[2.5rem] rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${color}1A` }}
                >
                  <Users className="h-5 w-5" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{team.teamName}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs font-medium text-foreground">{team.completedServices} realizados</span>
                    <span className="text-xs text-muted-foreground">{team.scheduledServices} agendados</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Conclusão</p>
                  <p className="text-sm font-semibold">{completedPct}%</p>
                </div>
              </div>
              <div className="mt-3 w-full bg-muted rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{ width: `${completedPct}%`, backgroundColor: color }}
                />
              </div>
            </div>
          )
        }))}
      </div>
    </Card>
  )
}
