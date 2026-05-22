"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useQuery } from "@tanstack/react-query"
import {
  getDashboardAnalytics,
  getFinancialAnalytics,
  type DashboardAnalyticsParams,
  type ServicesByTeamPoint,
} from "@/lib/api/analytics"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]
const EMPTY_CHART_COLOR = "#DDE7D5"
type ServicesByTeamChartPoint = ServicesByTeamPoint & { isEmpty?: boolean }

export function ServiceDistribution({
  showDescription = true,
  ...period
}: { showDescription?: boolean } & DashboardAnalyticsParams) {
  const dashboardQuery = useQuery({
    queryKey: ["analytics", "dashboard", period],
    queryFn: () => getDashboardAnalytics(period),
  })
  const isLoading = dashboardQuery.isLoading || (dashboardQuery.isFetching && !dashboardQuery.data)
  const servicesByTeamData = dashboardQuery.data?.data.servicesByTeamData ?? []
  const hasServicesByTeamData = servicesByTeamData.some((item) => item.services > 0)
  const chartData: ServicesByTeamChartPoint[] = hasServicesByTeamData
    ? servicesByTeamData
    : [{ team: "Sem dados", services: 1, isEmpty: true }]
  const total = hasServicesByTeamData ? servicesByTeamData.reduce((acc, curr) => acc + curr.services, 0) : 0

  return (
    <Card className="flex h-full min-h-[360px] flex-col overflow-hidden hover:shadow-xl transition-all duration-500">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Serviços por Equipe</CardTitle>
        {showDescription && (
          <CardDescription>Distribuição de serviços entre as equipes</CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-4">
        {isLoading ? (
          <>
            <div className="relative my-2 h-[180px] w-[180px] animate-pulse rounded-full bg-muted">
              <div className="absolute inset-12 rounded-full bg-card" />
            </div>
            <div className="flex w-full flex-wrap justify-center gap-x-4 gap-y-2">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <Skeleton className="h-2.5 w-2.5 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  dataKey="services"
                  nameKey="team"
                  startAngle={90}
                  endAngle={450}
                  isAnimationActive
                  animationBegin={120}
                  animationDuration={950}
                  animationEasing="ease-out"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.isEmpty ? EMPTY_CHART_COLOR : COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number, _name, item) => [`${item.payload.isEmpty ? 0 : value} serviços`, ""]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 w-full">
              {chartData.map((entry, index) => (
                <div key={entry.team} className="flex items-center gap-1.5 text-xs">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: entry.isEmpty ? EMPTY_CHART_COLOR : COLORS[index % COLORS.length] }}
                  />
                  <span className="text-muted-foreground whitespace-nowrap">
                    {entry.team}: {entry.isEmpty || total === 0 ? 0 : Math.round((entry.services / total) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

const FINANCE_COLORS = ['#22C55E', '#F59E0B', '#EF4444']

export function FinancialOverview() {
  const financialQuery = useQuery({
    queryKey: ["analytics", "financial"],
    queryFn: () => getFinancialAnalytics(),
  })
  const isLoading = financialQuery.isLoading || (financialQuery.isFetching && !financialQuery.data)
  const financeData = financialQuery.data?.data.financeHealthData ?? [
    { name: 'Pagas', value: 0 },
    { name: 'Em atraso', value: 0 },
    { name: 'Vencidas', value: 0 },
  ]
  const total = financeData.reduce((acc, curr) => acc + curr.value, 0)
  const hasFinanceData = total > 0
  const chartData = hasFinanceData ? financeData : [{ name: "Sem dados", value: 1 }]
  const paidPercentage = total > 0 ? Math.round(((financeData[0]?.value ?? 0) / total) * 100) : 0

  return (
    <Card
      className="p-4 transition-all duration-500 hover:shadow-xl overflow-hidden"
    >
      <h2 className="text-lg font-semibold text-foreground mb-4">Saúde Financeira</h2>
      <div className="flex flex-col items-center">
        <div className="relative w-40 h-40 mb-4">
          {isLoading ? (
            <>
              <div className="absolute inset-0 animate-pulse rounded-full bg-muted" />
              <div className="absolute inset-10 rounded-full bg-card" />
            </>
          ) : (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    startAngle={90}
                    endAngle={450}
                    isAnimationActive
                    animationBegin={120}
                    animationDuration={950}
                    animationEasing="ease-out"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={hasFinanceData ? FINANCE_COLORS[index % FINANCE_COLORS.length] : EMPTY_CHART_COLOR} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    formatter={(value: number) => [hasFinanceData ? `${value}%` : "0%", '']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-foreground">{paidPercentage}%</span>
                <span className="text-xs text-muted-foreground mt-1">Adimplência</span>
              </div>
            </>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-3 text-xs">
          {isLoading
            ? Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex items-center gap-1.5">
                <Skeleton className="h-2.5 w-2.5 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))
            : financeData.map((item, index) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <div 
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: FINANCE_COLORS[index] }}
                />
                <span className="text-muted-foreground whitespace-nowrap">{item.name}</span>
              </div>
            ))}
        </div>
      </div>
    </Card>
  )
}
