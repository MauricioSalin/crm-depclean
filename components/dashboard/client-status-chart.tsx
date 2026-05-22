"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight } from "lucide-react"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getDashboardAnalytics, type DashboardAnalyticsParams } from "@/lib/api/analytics"

const ACTIVE_CLIENT_COLOR = "var(--primary)"
const INACTIVE_CLIENT_COLOR = "#94A3B8"
const EMPTY_CHART_COLOR = "#DDE7D5"

type ClientStatusPoint = {
  name: string
  value: number
  color: string
  isEmpty?: boolean
}

function formatClientCount(value: number) {
  return `${value} cliente${value === 1 ? "" : "s"}`
}

export function ClientStatusChart(period: DashboardAnalyticsParams = {}) {
  const dashboardQuery = useQuery({
    queryKey: ["analytics", "dashboard", period],
    queryFn: () => getDashboardAnalytics(period),
  })
  const isLoading = dashboardQuery.isLoading || (dashboardQuery.isFetching && !dashboardQuery.data)
  const stats = dashboardQuery.data?.data.stats
  const activeClients = stats?.activeClients ?? 0
  const inactiveClients = stats?.inactiveClients ?? 0
  const totalClients = activeClients + inactiveClients
  const hasClientData = totalClients > 0
  const legendData: ClientStatusPoint[] = [
    { name: "Ativos", value: activeClients, color: ACTIVE_CLIENT_COLOR },
    { name: "Inativos", value: inactiveClients, color: INACTIVE_CLIENT_COLOR },
  ]
  const chartData: ClientStatusPoint[] = hasClientData
    ? legendData.filter((item) => item.value > 0)
    : [{ name: "Sem dados", value: 1, color: EMPTY_CHART_COLOR, isEmpty: true }]

  return (
    <Card className="flex h-full flex-col p-4 transition-all duration-500 hover:shadow-xl lg:min-h-[360px] lg:max-h-[460px]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Clientes por status</h2>
          <p className="mt-1 text-xs text-muted-foreground">Ativos e inativos cadastrados</p>
        </div>
        <Link href="/clientes">
          <Button variant="ghost" size="sm" className="text-xs text-foreground hover:text-foreground/80">
            Ver todos
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
        {isLoading ? (
          <>
            <div className="relative my-2 h-[190px] w-[190px] animate-pulse rounded-full bg-muted">
              <div className="absolute inset-12 rounded-full bg-card" />
            </div>
            <div className="grid w-full grid-cols-2 gap-2">
              {Array.from({ length: 2 }, (_, index) => (
                <div key={index} className="rounded-xl border bg-card p-3">
                  <Skeleton className="mb-2 h-3 w-16" />
                  <Skeleton className="h-5 w-10" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="relative h-[220px] w-full max-w-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={64}
                    outerRadius={96}
                    dataKey="value"
                    nameKey="name"
                    startAngle={90}
                    endAngle={450}
                    isAnimationActive
                    animationBegin={120}
                    animationDuration={950}
                    animationEasing="ease-out"
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number, _name, item) => [
                      formatClientCount(item.payload.isEmpty ? 0 : value),
                      item.payload.name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-bold text-foreground">{totalClients}</span>
                <span className="mt-1 text-xs text-muted-foreground">clientes</span>
              </div>
            </div>

            <div className="grid w-full grid-cols-2 gap-2">
              {legendData.map((item) => {
                const percentage = totalClients > 0 ? Math.round((item.value / totalClients) * 100) : 0

                return (
                  <div key={item.name} className="rounded-xl border bg-card p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-muted-foreground">{item.name}</span>
                    </div>
                    <div className="flex items-end justify-between gap-2">
                      <span className="text-xl font-semibold text-foreground">{item.value}</span>
                      <span className="text-xs text-muted-foreground">{percentage}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
