"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight } from "lucide-react"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getDashboardAnalytics } from "@/lib/api/analytics"

const EMPTY_CHART_COLOR = "#DDE7D5"

type ContractStatusPoint = {
  name: string
  value: number
  color: string
  isEmpty?: boolean
}

function formatContractCount(value: number) {
  return `${value} contrato${value === 1 ? "" : "s"}`
}

export function ContractStatusChart() {
  const dashboardQuery = useQuery({
    queryKey: ["analytics", "dashboard", "contract-widgets"],
    queryFn: () => getDashboardAnalytics(),
  })
  const isLoading = dashboardQuery.isLoading || (dashboardQuery.isFetching && !dashboardQuery.data)
  const stats = dashboardQuery.data?.data.stats
  const statusCounts = stats?.contractStatusCounts ?? {
    awaitingSend: 0,
    awaitingSignature: 0,
    signed: 0,
    current: 0,
    expired: 0,
    renewed: 0,
    canceled: 0,
  }
  const legendData: ContractStatusPoint[] = [
    { name: "Aguardando envio", value: statusCounts.awaitingSend, color: "#F59E0B" },
    { name: "Aguardando assinatura", value: statusCounts.awaitingSignature, color: "#3B82F6" },
    { name: "Assinados", value: statusCounts.signed, color: "#14B8A6" },
    { name: "Vigentes", value: statusCounts.current, color: "var(--primary)" },
    { name: "Vencidos", value: statusCounts.expired, color: "#EF4444" },
    { name: "Renovados", value: statusCounts.renewed ?? 0, color: "#6366F1" },
  ]
  const totalContracts = legendData.reduce((total, item) => total + item.value, 0)
  const hasContractData = totalContracts > 0
  const chartData: ContractStatusPoint[] = hasContractData
    ? legendData.filter((item) => item.value > 0)
    : [{ name: "Sem dados", value: 1, color: EMPTY_CHART_COLOR, isEmpty: true }]

  return (
    <Card className="flex h-full min-w-0 flex-col p-4 transition-all duration-500 hover:shadow-xl lg:min-h-[360px]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Contratos por status</h2>
        </div>
        <Link href="/contratos">
          <Button variant="ghost" size="sm" className="text-xs text-foreground hover:text-foreground/80">
            Ver todos
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>

      <div className="min-h-0 flex-1">
        {isLoading ? (
          <div className="flex min-h-full w-full flex-col items-center justify-center gap-5 py-2">
            <div className="relative aspect-square w-full max-w-[240px] animate-pulse rounded-full bg-muted">
              <div className="absolute inset-[28%] rounded-full bg-card" />
            </div>
            <div className="flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-2">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-3 w-24" />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex min-h-full w-full flex-col items-center justify-center gap-5 py-2">
            <div className="relative aspect-square w-full max-w-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius="54%"
                    outerRadius="82%"
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
                    wrapperStyle={{ zIndex: 10 }}
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number, _name, item) => [
                      formatContractCount(item.payload.isEmpty ? 0 : value),
                      item.payload.name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-bold text-foreground">{totalContracts}</span>
                <span className="mt-1 text-xs text-muted-foreground">contratos</span>
              </div>
            </div>

            <div className="flex w-full flex-col items-center gap-2 px-2">
              {[legendData.slice(0, 3), legendData.slice(3)].map((row, rowIndex) => (
                <div key={rowIndex} className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                  {row.map((item) => {
                    const percentage = totalContracts > 0 ? Math.round((item.value / totalContracts) * 100) : 0

                    return (
                      <div key={item.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                        <span>{item.name}: {percentage}%</span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
