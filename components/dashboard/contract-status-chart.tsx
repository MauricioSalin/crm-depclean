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
    canceled: 0,
  }
  const legendData: ContractStatusPoint[] = [
    { name: "Aguardando envio", value: statusCounts.awaitingSend, color: "#F59E0B" },
    { name: "Aguardando assinatura", value: statusCounts.awaitingSignature, color: "#3B82F6" },
    { name: "Assinados", value: statusCounts.signed, color: "#14B8A6" },
    { name: "Vigentes", value: statusCounts.current, color: "var(--primary)" },
    { name: "Vencidos", value: statusCounts.expired, color: "#EF4444" },
    { name: "Renovados", value: statusCounts.renewed ?? 0, color: "#6366F1" },
    { name: "Cancelados", value: statusCounts.canceled, color: "#94A3B8" },
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

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
        {isLoading ? (
          <>
            <div className="relative my-2 aspect-square w-full max-w-[190px] shrink-0 animate-pulse rounded-full bg-muted">
              <div className="absolute inset-12 rounded-full bg-card" />
            </div>
            <div className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2">
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
            <div className="relative aspect-square w-full max-w-[220px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius="58%"
                    outerRadius="86%"
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

            <div className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2">
              {legendData.map((item) => {
                const percentage = totalContracts > 0 ? Math.round((item.value / totalContracts) * 100) : 0

                return (
                  <div key={item.name} className="rounded-xl border bg-card p-3">
                    <div className="mb-2 flex min-w-0 items-start gap-2">
                      <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="min-w-0 text-xs leading-tight text-muted-foreground">{item.name}</span>
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
