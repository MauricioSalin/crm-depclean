"use client"

import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import {
  Clock,
  AlertTriangle,
  CheckCircle,
} from "lucide-react"
import { FinancialPeriodBarChart } from "@/components/analytics/operational-charts"
import {
  FinancialInstallmentsTable,
  type PaymentStatusFilter,
} from "@/components/financeiro/financial-installments-table"
import { useUrlQueryState } from "@/lib/hooks/use-url-query-state"
import { getFinancialAnalytics } from "@/lib/api/analytics"
import {
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"

interface FinanceiroContentProps {
  viewMode: "table" | "cards"
  viewToggle?: React.ReactNode
  dateFrom?: string
  dateTo?: string
}

const EMPTY_DONUT_DATA = [{ name: "Sem dados", value: 1 }]
const EMPTY_CHART_COLOR = "#DDE7D5"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

export function FinanceiroContent({ viewMode, viewToggle, dateFrom, dateTo }: FinanceiroContentProps) {
  const [searchTerm, setSearchTerm] = useUrlQueryState("q")
  const [tabFilterParam, setTabFilter] = useUrlQueryState("paymentStatus", "all", { debounceMs: 0 })
  const tabFilter = ["pending", "late", "overdue", "paid", "cancelled"].includes(tabFilterParam)
    ? tabFilterParam as PaymentStatusFilter
    : "all"

  const getFinanceColor = (name: string) => {
    switch (name) {
      case "Pagas":
        return "#22C55E"
      case "A receber":
      case "Pendentes":
        return "#EAB308"
      case "Em atraso":
        return "#F97316"
      case "Vencidas":
        return "#EF4444"
      default:
        return "#94A3B8"
    }
  }

  const financialQuery = useQuery({
    queryKey: ["analytics", "financial", dateFrom, dateTo],
    queryFn: () => getFinancialAnalytics({ dateFrom, dateTo }),
  })

  const allInstallments = financialQuery.data?.data.installments ?? []
  const summary = financialQuery.data?.data.summary ?? {
    totalPaid: 0,
    totalReceivable: 0,
    totalPending: 0,
    totalLate: 0,
    totalOverdue: 0,
    paidCount: 0,
    pendingCount: 0,
    lateCount: 0,
    overdueCount: 0,
    totalCount: 0,
    adherenceRate: 0,
  }
  const totalReceivable = summary.totalPending ?? 0
  const monthlyRevenueData = financialQuery.data?.data.monthlyRevenueData ?? []
  const financeHealthData = (financialQuery.data?.data.financeHealthData ?? [
    { name: "Pagas", value: 0 },
    { name: "A receber", value: 0 },
    { name: "Em atraso", value: 0 },
    { name: "Vencidas", value: 0 },
  ]).map((item) => item.name === "Pendentes" ? { ...item, name: "A receber" } : item)
  const revenueChartTitle = dateFrom || dateTo ? "Faturamento por período" : "Faturamento da base"
  const hasFinanceHealthData = financeHealthData.some((item) => item.value > 0)
  const financeHealthChartData = hasFinanceHealthData ? financeHealthData : EMPTY_DONUT_DATA

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Recebido</p>
              <p className="text-xl font-semibold text-green-600/80">{formatCurrency(summary.totalPaid)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">A Receber</p>
              <p className="text-xl font-semibold text-yellow-600/80">{formatCurrency(totalReceivable)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Em atraso</p>
              <p className="text-xl font-semibold text-orange-600/80">{formatCurrency(summary.totalLate)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vencidas</p>
              <p className="text-xl font-semibold text-red-600/80">{formatCurrency(summary.totalOverdue)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Revenue Chart + Financial Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 md:p-5 lg:col-span-2" data-report-chart="faturamento-mensal">
          <h3 className="font-semibold text-base mb-4">{revenueChartTitle}</h3>
          <div className="-mx-1 overflow-x-auto px-1 pb-2">
          <div className="relative h-[280px] min-w-[540px] sm:min-w-0">
            <FinancialPeriodBarChart data={monthlyRevenueData} />
          </div>
          </div>
        </Card>

        <Card className="p-4 md:p-5" data-report-chart="saude-financeira">
          <h3 className="font-semibold text-base mb-4">Saúde Financeira</h3>
          <div className="flex flex-col items-center">
            <div className="relative w-56 h-56 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={financeHealthChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={105}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {financeHealthChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={hasFinanceHealthData ? getFinanceColor(String(entry.name)) : EMPTY_CHART_COLOR}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    formatter={(value: number) => [hasFinanceHealthData ? `${value}%` : "0%", '']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-foreground">{summary.adherenceRate}%</span>
                <span className="text-xs text-muted-foreground mt-1">Adimplência</span>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-3 text-xs">
              {financeHealthData.map((item, index) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getFinanceColor(item.name) }}
                  />
                  <span className="text-muted-foreground whitespace-nowrap">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <FinancialInstallmentsTable
        installments={allInstallments}
        isLoading={financialQuery.isLoading}
        viewMode={viewMode}
        viewToggle={viewToggle}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        statusFilter={tabFilter}
        onStatusFilterChange={setTabFilter}
      />
    </div>
  )
}
