"use client"

import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useQuery } from "@tanstack/react-query"
import { getDashboardAnalytics, type DashboardAnalyticsParams } from "@/lib/api/analytics"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

const EMPTY_MONTHLY_REVENUE_DATA = [
  { month: "Mês 1", value: 0 },
  { month: "Mês 2", value: 0 },
  { month: "Mês 3", value: 0 },
  { month: "Mês 4", value: 0 },
  { month: "Mês 5", value: 0 },
  { month: "Mês 6", value: 0 },
]

const EMPTY_SERVICES_BY_PERIOD_DATA = [
  { period: "Semana 1", completed: 0, scheduled: 0 },
  { period: "Semana 2", completed: 0, scheduled: 0 },
  { period: "Semana 3", completed: 0, scheduled: 0 },
  { period: "Semana 4", completed: 0, scheduled: 0 },
]

const EMPTY_CHART_COLOR = "#DDE7D5"

export function ProjectAnalytics(period: DashboardAnalyticsParams = {}) {
  const dashboardQuery = useQuery({
    queryKey: ["analytics", "dashboard", period],
    queryFn: () => getDashboardAnalytics(period),
  })
  const isLoading = dashboardQuery.isLoading || (dashboardQuery.isFetching && !dashboardQuery.data)
  const monthlyRevenueData = dashboardQuery.data?.data.monthlyRevenueData ?? []
  const servicesByPeriodData = dashboardQuery.data?.data.servicesByPeriodData ?? []
  const hasMonthlyRevenueData = monthlyRevenueData.some((item) => item.value > 0)
  const monthlyRevenueChartData = monthlyRevenueData.length > 0 ? monthlyRevenueData : EMPTY_MONTHLY_REVENUE_DATA
  const hasServicesByPeriodData = servicesByPeriodData.some((item) => item.completed > 0 || item.scheduled > 0)
  const servicesByPeriodChartData = servicesByPeriodData.length > 0 ? servicesByPeriodData : EMPTY_SERVICES_BY_PERIOD_DATA

  return (
    <Card className="h-full p-4 md:p-5">
      <Tabs defaultValue="faturamento" className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="font-semibold text-base">Análise Operacional</h3>
          <TabsList className="grid w-full sm:w-auto grid-cols-2">
            <TabsTrigger value="faturamento" className="text-xs">Faturamento</TabsTrigger>
            <TabsTrigger value="servicos" className="text-xs">Serviços</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="faturamento" className="mt-0">
          <div className="h-[280px] w-full">
            {isLoading ? (
              <div className="flex h-full items-end gap-3 px-4 pb-6 pt-10">
                {[58, 82, 46, 72, 64, 88].map((height, index) => (
                  <Skeleton key={index} className="flex-1 rounded-t-md" style={{ height: `${height}%` }} />
                ))}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenueChartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }} 
                    className="text-muted-foreground"
                    axisLine={{ stroke: 'var(--border)' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }} 
                    className="text-muted-foreground"
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    axisLine={{ stroke: 'var(--border)' }}
                    domain={[0, (dataMax: number) => Math.max(Number(dataMax) || 0, 1)]}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                  />
                  <Bar 
                    dataKey="value" 
                    fill={hasMonthlyRevenueData ? "var(--primary)" : EMPTY_CHART_COLOR}
                    minPointSize={hasMonthlyRevenueData ? 0 : 3}
                    radius={[4, 4, 0, 0]}
                    isAnimationActive
                    animationBegin={120}
                    animationDuration={900}
                    animationEasing="ease-out"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </TabsContent>

        <TabsContent value="servicos" className="mt-0">
          <div className="h-[280px] w-full">
            {isLoading ? (
              <div className="flex h-full flex-col justify-end gap-5 px-4 pb-8 pt-10">
                <Skeleton className="h-3 w-11/12 rotate-[-6deg] rounded-full" />
                <Skeleton className="h-3 w-10/12 translate-x-4 rotate-[4deg] rounded-full" />
                <div className="grid grid-cols-4 gap-3">
                  {Array.from({ length: 4 }, (_, index) => (
                    <Skeleton key={index} className="h-3 rounded-full" />
                  ))}
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={servicesByPeriodChartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="period" 
                    tick={{ fontSize: 12 }} 
                    className="text-muted-foreground"
                    axisLine={{ stroke: 'var(--border)' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }} 
                    className="text-muted-foreground"
                    axisLine={{ stroke: 'var(--border)' }}
                    allowDecimals={false}
                    domain={[0, (dataMax: number) => Math.max(Number(dataMax) || 0, 1)]}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="completed" 
                    name="Realizados"
                    stroke={hasServicesByPeriodData ? "#228B22" : EMPTY_CHART_COLOR}
                    strokeWidth={2}
                    dot={{ fill: hasServicesByPeriodData ? '#228B22' : EMPTY_CHART_COLOR }}
                    isAnimationActive
                    animationBegin={120}
                    animationDuration={900}
                    animationEasing="ease-out"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="scheduled" 
                    name="Agendados"
                    stroke={hasServicesByPeriodData ? "#32CD32" : "#EEF3E7"}
                    strokeWidth={2}
                    dot={{ fill: hasServicesByPeriodData ? '#32CD32' : "#EEF3E7" }}
                    isAnimationActive
                    animationBegin={220}
                    animationDuration={950}
                    animationEasing="ease-out"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  )
}
