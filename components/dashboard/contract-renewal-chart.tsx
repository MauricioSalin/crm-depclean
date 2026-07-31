"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CalendarClock, ChevronDown } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  getDashboardAnalytics,
  type ContractExpirationPoint,
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
const RENEWAL_PERIOD_OPTIONS = [1, 3, 6] as const
type RenewalPeriod = (typeof RENEWAL_PERIOD_OPTIONS)[number]

function formatRenewalPeriod(months: RenewalPeriod) {
  return `${months} ${months === 1 ? "mês" : "meses"}`
}

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

export function ContractRenewalChart() {
  const [renewalPeriod, setRenewalPeriod] = useState<RenewalPeriod>(6)
  const dashboardQuery = useQuery({
    queryKey: ["analytics", "dashboard", "contract-widgets"],
    queryFn: () => getDashboardAnalytics(),
  })
  const isLoading = dashboardQuery.isLoading || (dashboardQuery.isFetching && !dashboardQuery.data)
  const allData = dashboardQuery.data?.data.contractExpirationsData ?? []
  const data = allData.slice(0, renewalPeriod)
  const totalContracts = data.reduce((total, item) => total + item.contracts, 0)
  const totalValue = data.reduce((total, item) => total + item.totalValue, 0)
  const hasData = totalContracts > 0
  const renewalPeriodPicker = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-primary/10 px-2 text-[10px] font-semibold leading-none text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Selecionar período das renovações"
        >
          <span>{formatRenewalPeriod(renewalPeriod)}</span>
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-32">
        <DropdownMenuRadioGroup
          value={String(renewalPeriod)}
          onValueChange={(value) => setRenewalPeriod(Number(value) as RenewalPeriod)}
        >
          {RENEWAL_PERIOD_OPTIONS.map((months) => (
            <DropdownMenuRadioItem
              key={months}
              value={String(months)}
              className="pl-2 data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground [&>span]:hidden"
            >
              {formatRenewalPeriod(months)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <Card className="flex h-full min-w-0 flex-col p-4 transition-all duration-500 hover:shadow-xl lg:min-h-[360px]">
      <Tabs defaultValue="contracts" className="@container flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex flex-col gap-3 @min-[600px]:flex-row @min-[600px]:items-center @min-[600px]:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="min-w-0 truncate text-lg font-semibold text-foreground">Renovações de Contratos</h2>
            {renewalPeriodPicker}
          </div>
          <TabsList className="grid w-full shrink-0 grid-cols-2 @min-[600px]:w-[190px]">
            <TabsTrigger value="contracts" className="text-xs">Quantidade</TabsTrigger>
            <TabsTrigger value="value" className="text-xs">Valor</TabsTrigger>
          </TabsList>
        </div>

        {isLoading ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-3 grid w-full grid-cols-2 gap-2">
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
            </div>
            <Skeleton className="min-h-[220px] flex-1 rounded-xl" />
          </div>
        ) : (
          <>
            <div className="mb-3 grid w-full grid-cols-2 gap-2">
              <div className="rounded-xl border bg-card px-3 py-2">
                <p className="text-[11px] text-muted-foreground">A vencer</p>
                <p className="text-lg font-semibold">{totalContracts} contrato{totalContracts === 1 ? "" : "s"}</p>
              </div>
              <div className="rounded-xl border bg-card px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Valor a renovar</p>
                <p className="text-lg font-semibold">{currencyFormatter.format(totalValue)}</p>
              </div>
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
                <p className="mt-1 text-xs text-muted-foreground">
                  Não há contratos assinados vencendo nesse período.
                </p>
              </div>
            )}
          </>
        )}
      </Tabs>
    </Card>
  )
}
