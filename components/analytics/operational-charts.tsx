"use client"

import type { MonthlyRevenuePoint, ServicesByPeriodPoint } from "@/lib/api/analytics"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

export const EMPTY_CHART_COLOR = "#DDE7D5"

export const SERVICE_STATUS_COLORS = {
  completed: "#65A30D",
  scheduled: "#22C55E",
  cancelled: "#EF4444",
  emergency: "#D97706",
} as const

export const FINANCIAL_CHART_COLORS = {
  paid: "#84CC16",
  pending: "#EAB308",
  late: "#F97316",
  overdue: "#EF4444",
  pendingEmpty: "#FEF3C7",
  lateEmpty: "#FFEDD5",
  overdueEmpty: "#F3E7E7",
} as const

export type FinancialChartStatus = "paid" | "pending" | "late" | "overdue"

type FinancialPeriodBarChartProps = {
  data: MonthlyRevenuePoint[]
  onPeriodSelect?: (period: MonthlyRevenuePoint, status?: FinancialChartStatus) => void
}

type FinancialPeriodTickProps = {
  x?: number
  y?: number
  index?: number
  payload?: { value?: string }
  data: MonthlyRevenuePoint[]
  onPeriodSelect: (period: MonthlyRevenuePoint) => void
}

const EMPTY_MONTHLY_REVENUE_DATA: MonthlyRevenuePoint[] = [
  { month: "Mês 1", value: 0, paidValue: 0, pendingValue: 0, lateValue: 0, overdueValue: 0, lateOverdueValue: 0 },
  { month: "Mês 2", value: 0, paidValue: 0, pendingValue: 0, lateValue: 0, overdueValue: 0, lateOverdueValue: 0 },
  { month: "Mês 3", value: 0, paidValue: 0, pendingValue: 0, lateValue: 0, overdueValue: 0, lateOverdueValue: 0 },
  { month: "Mês 4", value: 0, paidValue: 0, pendingValue: 0, lateValue: 0, overdueValue: 0, lateOverdueValue: 0 },
  { month: "Mês 5", value: 0, paidValue: 0, pendingValue: 0, lateValue: 0, overdueValue: 0, lateOverdueValue: 0 },
  { month: "Mês 6", value: 0, paidValue: 0, pendingValue: 0, lateValue: 0, overdueValue: 0, lateOverdueValue: 0 },
]

const EMPTY_SERVICES_BY_PERIOD_DATA: ServicesByPeriodPoint[] = [
  { period: "Período 1", completed: 0, scheduled: 0, cancelled: 0, emergency: 0 },
  { period: "Período 2", completed: 0, scheduled: 0, cancelled: 0, emergency: 0 },
  { period: "Período 3", completed: 0, scheduled: 0, cancelled: 0, emergency: 0 },
  { period: "Período 4", completed: 0, scheduled: 0, cancelled: 0, emergency: 0 },
]

const INTERACTIVE_FINANCIAL_BAR_CLASS = "cursor-pointer [&_.recharts-bar-rectangle_path]:transition-[filter,opacity] [&_.recharts-bar-rectangle_path:hover]:brightness-110 [&_.recharts-bar-rectangle_path:hover]:drop-shadow-sm"

function financialBarClassName(baseClassName: string, interactive: boolean) {
  return interactive ? `${baseClassName} ${INTERACTIVE_FINANCIAL_BAR_CLASS}` : baseClassName
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function FinancialPeriodTick({
  x = 0,
  y = 0,
  index = 0,
  payload,
  data,
  onPeriodSelect,
}: FinancialPeriodTickProps) {
  const period = data[index]
  if (!period) return <g />

  const selectPeriod = () => onPeriodSelect(period)

  return (
    <g
      transform={`translate(${x},${y})`}
      role="button"
      tabIndex={0}
      aria-label={`Ver parcelas de ${payload?.value ?? period.month}`}
      className="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      onClick={selectPeriod}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          selectPeriod()
        }
      }}
    >
      <text x={0} y={0} dy={16} textAnchor="middle" fill="currentColor" fontSize={12}>
        {payload?.value ?? period.month}
      </text>
    </g>
  )
}

export function FinancialPeriodBarChart({ data, onPeriodSelect }: FinancialPeriodBarChartProps) {
  const hasData = data.some((item) =>
    item.paidValue > 0 ||
    item.pendingValue > 0 ||
    item.lateValue > 0 ||
    item.overdueValue > 0,
  )
  const chartData = data.length > 0 ? data : EMPTY_MONTHLY_REVENUE_DATA
  const interactive = Boolean(onPeriodSelect)

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{ top: 5, right: 8, left: 0, bottom: 5 }}
        className={interactive
          ? "cursor-pointer [&_.recharts-surface]:cursor-pointer [&_.recharts-tooltip-cursor]:!cursor-pointer [&_.recharts-tooltip-cursor]:pointer-events-auto"
          : undefined}
        onClick={onPeriodSelect
          ? (chartState, event) => {
              const target = event.target
              if (target instanceof Element && target.closest(".recharts-bar-rectangle")) return

              const period = chartState?.activePayload?.[0]?.payload as MonthlyRevenuePoint | undefined
              if (period) onPeriodSelect(period)
            }
          : undefined}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="month"
          tick={onPeriodSelect
            ? (props) => (
                <FinancialPeriodTick
                  {...props}
                  data={chartData}
                  onPeriodSelect={onPeriodSelect}
                />
              )
            : { fontSize: 12 }}
          className="text-muted-foreground"
          axisLine={{ stroke: "var(--border)" }}
          interval={0}
        />
        <YAxis
          width={34}
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
          axisLine={{ stroke: "var(--border)" }}
          domain={[0, (dataMax: number) => Math.max(Number(dataMax) || 0, 1)]}
        />
        <Tooltip
          cursor={interactive
            ? { fill: "#D1D5DB", fillOpacity: 0.55, cursor: "pointer", style: { cursor: "pointer" } }
            : undefined}
          contentStyle={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          formatter={(value: number, name: string) => [formatCurrency(value), name]}
        />
        <Legend />
        <Bar
          className={financialBarClassName("financial-bar-paid", interactive)}
          dataKey="paidValue"
          name="Pagas"
          fill={hasData ? FINANCIAL_CHART_COLORS.paid : EMPTY_CHART_COLOR}
          minPointSize={hasData ? 0 : 3}
          radius={[4, 4, 0, 0]}
          isAnimationActive
          animationBegin={120}
          animationDuration={900}
          animationEasing="ease-out"
          cursor={onPeriodSelect ? "pointer" : undefined}
          onClick={onPeriodSelect ? (period) => onPeriodSelect(period, "paid") : undefined}
        />
        <Bar
          className={financialBarClassName("financial-bar-pending", interactive)}
          dataKey="pendingValue"
          name="A receber"
          fill={hasData ? FINANCIAL_CHART_COLORS.pending : FINANCIAL_CHART_COLORS.pendingEmpty}
          minPointSize={hasData ? 0 : 3}
          radius={[4, 4, 0, 0]}
          isAnimationActive
          animationBegin={170}
          animationDuration={900}
          animationEasing="ease-out"
          cursor={onPeriodSelect ? "pointer" : undefined}
          onClick={onPeriodSelect ? (period) => onPeriodSelect(period, "pending") : undefined}
        />
        <Bar
          className={financialBarClassName("financial-bar-late", interactive)}
          dataKey="lateValue"
          name="Em atraso"
          fill={hasData ? FINANCIAL_CHART_COLORS.late : FINANCIAL_CHART_COLORS.lateEmpty}
          minPointSize={hasData ? 0 : 3}
          radius={[4, 4, 0, 0]}
          isAnimationActive
          animationBegin={220}
          animationDuration={900}
          animationEasing="ease-out"
          cursor={onPeriodSelect ? "pointer" : undefined}
          onClick={onPeriodSelect ? (period) => onPeriodSelect(period, "late") : undefined}
        />
        <Bar
          className={financialBarClassName("financial-bar-overdue", interactive)}
          dataKey="overdueValue"
          name="Vencidas"
          fill={hasData ? FINANCIAL_CHART_COLORS.overdue : FINANCIAL_CHART_COLORS.overdueEmpty}
          minPointSize={hasData ? 0 : 3}
          radius={[4, 4, 0, 0]}
          isAnimationActive
          animationBegin={320}
          animationDuration={900}
          animationEasing="ease-out"
          cursor={onPeriodSelect ? "pointer" : undefined}
          onClick={onPeriodSelect ? (period) => onPeriodSelect(period, "overdue") : undefined}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function ServicesPeriodLineChart({ data }: { data: ServicesByPeriodPoint[] }) {
  const hasData = data.some(
    (item) => item.completed > 0 || item.scheduled > 0 || item.cancelled > 0 || item.emergency > 0,
  )
  const chartData = data.length > 0 ? data : EMPTY_SERVICES_BY_PERIOD_DATA

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 5, right: 40, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="period"
          tick={{ fontSize: 11 }}
          className="text-muted-foreground"
          axisLine={{ stroke: "var(--border)" }}
          interval={0}
        />
        <YAxis
          width={34}
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          axisLine={{ stroke: "var(--border)" }}
          allowDecimals={false}
          domain={[0, (dataMax: number) => Math.max(Number(dataMax) || 0, 1)]}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          formatter={(value: number, name: string) => [`${value} atendimentos`, name]}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="completed"
          name="Realizados"
          stroke={hasData ? SERVICE_STATUS_COLORS.completed : EMPTY_CHART_COLOR}
          strokeWidth={2}
          dot={{ fill: hasData ? SERVICE_STATUS_COLORS.completed : EMPTY_CHART_COLOR }}
          activeDot={{ r: 6 }}
          isAnimationActive
          animationBegin={120}
          animationDuration={900}
          animationEasing="ease-out"
        />
        <Line
          type="monotone"
          dataKey="scheduled"
          name="Agendados"
          stroke={hasData ? SERVICE_STATUS_COLORS.scheduled : "#EEF3E7"}
          strokeWidth={2}
          dot={{ fill: hasData ? SERVICE_STATUS_COLORS.scheduled : "#EEF3E7" }}
          activeDot={{ r: 6 }}
          isAnimationActive
          animationBegin={220}
          animationDuration={950}
          animationEasing="ease-out"
        />
        <Line
          type="monotone"
          dataKey="cancelled"
          name="Cancelados"
          stroke={hasData ? SERVICE_STATUS_COLORS.cancelled : "#F3E7E7"}
          strokeWidth={2}
          dot={{ fill: hasData ? SERVICE_STATUS_COLORS.cancelled : "#F3E7E7" }}
          activeDot={{ r: 6 }}
          isAnimationActive
          animationBegin={320}
          animationDuration={950}
          animationEasing="ease-out"
        />
        <Line
          type="monotone"
          dataKey="emergency"
          name="Emergências"
          stroke={hasData ? SERVICE_STATUS_COLORS.emergency : "#FCE8C4"}
          strokeWidth={2}
          dot={{ fill: hasData ? SERVICE_STATUS_COLORS.emergency : "#FCE8C4" }}
          activeDot={{ r: 6 }}
          isAnimationActive
          animationBegin={370}
          animationDuration={950}
          animationEasing="ease-out"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
