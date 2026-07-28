"use client"

import { useQuery } from "@tanstack/react-query"
import { ArrowRight, CalendarClock } from "lucide-react"
import Link from "next/link"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  getDashboardAnalytics,
  type ContractExpirationPoint,
  type DashboardAnalyticsParams,
} from "@/lib/api/analytics"

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
})

const compactCurrencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
})

type RenewalChartMode = "contracts" | "value"

function RenewalBarChart({
  data,
  mode,
}: {
  data: ContractExpirationPoint[]
  mode: RenewalChartMode
}) {
  const dataKey = mode === "contracts" ? "contracts" : "totalValue"

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 12, right: 6, left: mode === "value" ? 8 : -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
        />
        <YAxis
          allowDecimals={false}
          axisLine={false}
          tickLine={false}
          width={mode === "value" ? 58 : 34}
          tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
          tickFormatter={(value: number) => mode === "value" ? compactCurrencyFormatter.format(value) : String(value)}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.45 }}
          contentStyle={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          formatter={(value: number) => [
            mode === "value"
              ? currencyFormatter.format(value)
              : `${value} contrato${value === 1 ? "" : "s"}`,
            mode === "value" ? "Valor a renovar" : "Contratos",
          ]}
        />
        <Bar
          dataKey={dataKey}
          fill="var(--primary)"
          radius={[6, 6, 0, 0]}
          maxBarSize={48}
          isAnimationActive
          animationBegin={120}
          animationDuration={850}
          animationEasing="ease-out"
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function ContractRenewalChart(period: DashboardAnalyticsParams = {}) {
  const dashboardQuery = useQuery({
    queryKey: ["analytics", "dashboard", period],
    queryFn: () => getDashboardAnalytics(period),
  })
  const isLoading = dashboardQuery.isLoading || (dashboardQuery.isFetching && !dashboardQuery.data)
  const data = dashboardQuery.data?.data.contractExpirationsData ?? []
  const totalContracts = data.reduce((total, item) => total + item.contracts, 0)
  const totalValue = data.reduce((total, item) => total + item.totalValue, 0)
  const hasData = totalContracts > 0

  return (
    <Card className="flex h-full flex-col p-4 transition-all duration-500 hover:shadow-xl lg:min-h-[360px] lg:max-h-[460px]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Renovações de Contratos</h2>
          <p className="text-xs text-muted-foreground">Vencimentos nos próximos seis meses</p>
        </div>
        <Link href="/contratos">
          <Button variant="ghost" size="sm" className="text-xs text-foreground hover:text-foreground/80">
            Ver contratos
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
          <Skeleton className="min-h-[220px] flex-1 rounded-xl" />
        </div>
      ) : (
        <Tabs defaultValue="contracts" className="flex min-h-0 flex-1 flex-col">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid flex-1 grid-cols-2 gap-2">
              <div className="rounded-xl border bg-card px-3 py-2">
                <p className="text-[11px] text-muted-foreground">A vencer</p>
                <p className="text-lg font-semibold">{totalContracts} contrato{totalContracts === 1 ? "" : "s"}</p>
              </div>
              <div className="rounded-xl border bg-card px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Valor a renovar</p>
                <p className="text-lg font-semibold">{currencyFormatter.format(totalValue)}</p>
              </div>
            </div>
            <TabsList className="grid grid-cols-2 sm:w-[190px]">
              <TabsTrigger value="contracts" className="text-xs">Quantidade</TabsTrigger>
              <TabsTrigger value="value" className="text-xs">Valor</TabsTrigger>
            </TabsList>
          </div>

          {hasData ? (
            <>
              <TabsContent value="contracts" className="mt-0 min-h-[220px] flex-1">
                <RenewalBarChart data={data} mode="contracts" />
              </TabsContent>
              <TabsContent value="value" className="mt-0 min-h-[220px] flex-1">
                <RenewalBarChart data={data} mode="value" />
              </TabsContent>
            </>
          ) : (
            <div className="flex min-h-[220px] flex-1 flex-col items-center justify-center rounded-xl border border-dashed text-center">
              <CalendarClock className="mb-2 h-8 w-8 text-primary/70" />
              <p className="text-sm font-medium">Nenhum vencimento próximo</p>
              <p className="mt-1 text-xs text-muted-foreground">Não há contratos assinados vencendo nos próximos seis meses.</p>
            </div>
          )}
        </Tabs>
      )}
    </Card>
  )
}
