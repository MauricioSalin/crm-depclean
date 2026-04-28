"use client"

import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useQuery } from "@tanstack/react-query"
import { getDashboardAnalytics } from "@/lib/api/analytics"
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

export function ProjectAnalytics({ days = 30 }: { days?: number }) {
  const dashboardQuery = useQuery({
    queryKey: ["analytics", "dashboard", days],
    queryFn: () => getDashboardAnalytics({ days }),
  })
  const monthlyRevenueData = dashboardQuery.data?.data.monthlyRevenueData ?? []
  const servicesByPeriodData = dashboardQuery.data?.data.servicesByPeriodData ?? []

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
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyRevenueData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
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
                  fill="var(--primary)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        <TabsContent value="servicos" className="mt-0">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={servicesByPeriodData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
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
                  stroke="#228B22" 
                  strokeWidth={2}
                  dot={{ fill: '#228B22' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="scheduled" 
                  name="Agendados"
                  stroke="#32CD32" 
                  strokeWidth={2}
                  dot={{ fill: '#32CD32' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  )
}
