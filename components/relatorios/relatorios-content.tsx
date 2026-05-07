"use client"

import { useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FinanceiroContent } from "@/components/financeiro/financeiro-content"
import type { DateRange } from "react-day-picker"
import {
  BarChart3,
  Users,
  DollarSign,
  Wrench,
  List,
  LayoutGrid,
  CheckCircle,
  Calendar,
  AlertTriangle,
  TrendingUp,
} from "lucide-react"
import { getReportsAnalytics, type ReportsAnalyticsRecord } from "@/lib/api/analytics"
import { useUrlQueryState } from "@/lib/hooks/use-url-query-state"
import { cn } from "@/lib/utils"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"

const REPORT_TYPES = [
  { id: "financial", label: "Financeiro", icon: DollarSign, description: "Faturamento, recebimentos e inadimplência" },
  { id: "services", label: "Serviços Realizados", icon: Wrench, description: "Relatório de serviços executados por período" },
  { id: "teams", label: "Equipes", icon: Users, description: "Produtividade e desempenho das equipes" },
] as const

const REPORT_IDS = REPORT_TYPES.map((type) => type.id)
type ReportId = (typeof REPORT_IDS)[number]

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]
const EMPTY_CHART_COLOR = "#DDE7D5"

type TeamStatusSlice = {
  name: string
  services: number
  color: string
  isEmpty?: boolean
}

type ServicesByTeamChartPoint = ReportsAnalyticsRecord["servicesByTeamData"][number] & { isEmpty?: boolean }

const emptyReports: ReportsAnalyticsRecord = {
  dashboardStats: {
    activeClients: 0,
    activeClientsChange: 0,
    monthlyRevenue: 0,
    monthlyRevenueChange: 0,
    scheduledServices: 0,
    scheduledServicesChange: 0,
    completedServices: 0,
    completedServicesChange: 0,
    emergencyServices: 0,
    completionRate: 0,
    overdueInstallments: 0,
    overdueInstallmentsValue: 0,
    teamProductivity: [],
  },
  financialSummary: {
    totalPaid: 0,
    totalPending: 0,
    totalOverdue: 0,
    paidCount: 0,
    pendingCount: 0,
    overdueCount: 0,
    totalCount: 0,
    adherenceRate: 0,
  },
  monthlyRevenueData: [],
  servicesByPeriodData: [],
  servicesByTeamData: [],
  clients: [],
  contracts: [],
  teams: [],
}

const EMPTY_SERVICES_BY_PERIOD_DATA = [
  { period: "Semana 1", completed: 0, scheduled: 0 },
  { period: "Semana 2", completed: 0, scheduled: 0 },
  { period: "Semana 3", completed: 0, scheduled: 0 },
  { period: "Semana 4", completed: 0, scheduled: 0 },
]

const EMPTY_SERVICES_BY_TEAM_DATA: ServicesByTeamChartPoint[] = [
  { team: "Sem dados", services: 1, isEmpty: true },
]

const EMPTY_TEAM_PRODUCTIVITY: ReportsAnalyticsRecord["dashboardStats"]["teamProductivity"] = [
  {
    teamId: "sem-equipe",
    teamName: "Sem equipe",
    completedServices: 0,
    scheduledServices: 0,
    cancelledServices: 0,
  },
]

function formatDateParam(value?: Date) {
  return value ? value.toISOString().split("T")[0] : undefined
}

type CsvCell = string | number | boolean | null | undefined

function csvCell(value: CsvCell) {
  const text = value === null || value === undefined ? "" : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function downloadCsv(fileName: string, rows: CsvCell[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(";")).join("\n")
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function reportFileName(reportId: string, dateRange?: DateRange) {
  const from = formatDateParam(dateRange?.from) ?? "inicio"
  const to = formatDateParam(dateRange?.to) ?? new Date().toISOString().split("T")[0]
  return `depclean-${reportId}-${from}-${to}.csv`
}

function reportImageFileName(reportId: string, chartId: string, dateRange?: DateRange) {
  const from = formatDateParam(dateRange?.from) ?? "inicio"
  const to = formatDateParam(dateRange?.to) ?? new Date().toISOString().split("T")[0]
  return `depclean-${reportId}-${chartId}-${from}-${to}.png`
}

function slugifyFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

async function downloadChartPng(element: HTMLElement, fileName: string) {
  const { default: html2canvas } = await import("html2canvas")
  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
  })
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
  if (!blob) return

  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

async function exportVisibleCharts(reportId: string, dateRange: DateRange | undefined, root: HTMLElement | null) {
  if (!root) return

  const charts = Array.from(root.querySelectorAll<HTMLElement>("[data-report-chart]"))
  for (const [index, chart] of charts.entries()) {
    const chartId = slugifyFilePart(chart.dataset.reportChart || `grafico-${index + 1}`)
    await downloadChartPng(chart, reportImageFileName(reportId, chartId, dateRange))
  }
}

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

export function RelatoriosContent() {
  const [selectedReportQuery, setSelectedReportQuery] = useUrlQueryState("tab", "financial")
  const selectedReport: ReportId = REPORT_IDS.includes(selectedReportQuery as ReportId)
    ? selectedReportQuery as ReportId
    : "financial"
  const setSelectedReport = (value: string) => setSelectedReportQuery(value)
  const [financialViewMode, setFinancialViewMode] = useState<"table" | "cards">("table")
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: undefined, to: undefined })
  const [isExporting, setIsExporting] = useState(false)
  const reportContentRef = useRef<HTMLDivElement>(null)
  const reportsQuery = useQuery({
    queryKey: ["analytics", "reports", formatDateParam(dateRange?.from), formatDateParam(dateRange?.to)],
    queryFn: () =>
      getReportsAnalytics({
        dateFrom: formatDateParam(dateRange?.from),
        dateTo: formatDateParam(dateRange?.to),
      }),
  })
  const reports = reportsQuery.data?.data ?? emptyReports
  const {
    dashboardStats,
    servicesByPeriodData,
    servicesByTeamData,
  } = reports
  const hasServicesByPeriodData = servicesByPeriodData.some((item) => item.completed > 0 || item.scheduled > 0)
  const servicesByPeriodChartData = servicesByPeriodData.length > 0 ? servicesByPeriodData : EMPTY_SERVICES_BY_PERIOD_DATA
  const hasServicesByTeamData = servicesByTeamData.some((item) => item.services > 0)
  const servicesByTeamChartData: ServicesByTeamChartPoint[] = hasServicesByTeamData ? servicesByTeamData : EMPTY_SERVICES_BY_TEAM_DATA
  const servicesByTeamTotal = hasServicesByTeamData ? servicesByTeamData.reduce((acc, curr) => acc + curr.services, 0) : 0
  const teamsForChart = dashboardStats.teamProductivity.length > 0 ? dashboardStats.teamProductivity : EMPTY_TEAM_PRODUCTIVITY

  const financialViewToggle = (
    <Tabs value={financialViewMode} onValueChange={(value) => setFinancialViewMode(value as "table" | "cards")}>
      <TabsList>
        <TabsTrigger value="table"><List className="h-4 w-4" /></TabsTrigger>
        <TabsTrigger value="cards"><LayoutGrid className="h-4 w-4" /></TabsTrigger>
      </TabsList>
    </Tabs>
  )

  const buildTeamStatusPieData = (team: (typeof dashboardStats.teamProductivity)[number]): TeamStatusSlice[] => {
    const slices: TeamStatusSlice[] = [
      { name: "Realizados", services: team.completedServices, color: "var(--primary)" },
      { name: "Agendados", services: team.scheduledServices, color: "#2563EB" },
      { name: "Cancelados", services: team.cancelledServices ?? 0, color: "#EF4444" },
    ]
    const total = slices.reduce((sum, item) => sum + item.services, 0)
    return total > 0 ? slices : [{ name: "Sem serviços", services: 1, color: "#E5E7EB", isEmpty: true }]
  }

  const buildReportRows = (data: ReportsAnalyticsRecord): CsvCell[][] => {
    if (selectedReport === "services") {
      return [
        ["Relatorio", "Periodo/Equipe", "Concluidos", "Agendados", "Servicos"],
        ...data.servicesByPeriodData.map((item) => ["Servicos por periodo", item.period, item.completed, item.scheduled, ""]),
        ...data.servicesByTeamData.map((item) => ["Servicos por equipe", item.team, "", "", item.services]),
        ["Resumo", "Servicos concluidos", data.dashboardStats.completedServices, "", ""],
        ["Resumo", "Servicos agendados", "", data.dashboardStats.scheduledServices, ""],
        ["Resumo", "Emergencias", data.dashboardStats.emergencyServices, "", ""],
        ["Resumo", "Taxa de conclusao", `${data.dashboardStats.completionRate}%`, "", ""],
      ]
    }

    if (selectedReport === "financial") {
      return [
        ["Relatorio", "Item", "Valor"],
        ["Resumo financeiro", "Faturamento do mes", data.dashboardStats.monthlyRevenue],
        ["Resumo financeiro", "Recebido", data.financialSummary.totalPaid],
        ["Resumo financeiro", "A receber", data.financialSummary.totalPending],
        ["Resumo financeiro", "Inadimplencia", data.financialSummary.totalOverdue],
        ["Indicadores", "Taxa de adimplencia", `${data.financialSummary.adherenceRate}%`],
        ["Indicadores", "Ticket medio", data.dashboardStats.activeClients > 0 ? data.dashboardStats.monthlyRevenue / data.dashboardStats.activeClients : 0],
        ["Indicadores", "Contratos ativos", data.contracts.filter((contract) => ["signed", "active"].includes(contract.status)).length],
        ...data.monthlyRevenueData.map((item) => ["Faturamento mensal", item.month, item.value]),
      ]
    }

    if (selectedReport === "teams") {
      return [
        ["Equipe", "Servicos realizados", "Servicos agendados", "Servicos cancelados", "Taxa de conclusao"],
        ...data.dashboardStats.teamProductivity.map((team) => {
          const total = team.completedServices + team.scheduledServices + (team.cancelledServices ?? 0)
          return [
            team.teamName,
            team.completedServices,
            team.scheduledServices,
            team.cancelledServices ?? 0,
            total > 0 ? `${Math.round((team.completedServices / total) * 100)}%` : "0%",
          ]
        }),
      ]
    }

    return []
  }

  const handleGenerateReport = async () => {
    try {
      setIsExporting(true)
      const result = await reportsQuery.refetch()
      const data = result.data?.data ?? reports
      downloadCsv(reportFileName(selectedReport, dateRange), buildReportRows(data))
      await waitForNextPaint()
      await exportVisibleCharts(selectedReport, dateRange, reportContentRef.current)
    } finally {
      setIsExporting(false)
    }
  }


  return (
    <div className="space-y-6">
      {/* Report Type Selection - tabs on mobile, cards on sm+ */}
      <div className="flex gap-2 overflow-x-auto pb-2 sm:hidden">
        {REPORT_TYPES.map((type) => (
          <button
            key={type.id}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors",
              selectedReport === type.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
            onClick={() => setSelectedReport(type.id)}
          >
            <type.icon className="h-4 w-4" />
            {type.label}
          </button>
        ))}
      </div>

      <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_TYPES.map((type) => (
          <Card
            key={type.id}
            className={cn("min-h-[132px] cursor-pointer gap-2 py-4 transition-all hover:shadow-md", selectedReport === type.id && "ring-2 ring-primary bg-primary/5")}
            onClick={() => setSelectedReport(type.id)}
          >
            <CardHeader className="px-4 pb-1">
              <div className="flex items-center gap-3">
                <div className={cn("rounded-lg p-2", selectedReport === type.id ? "bg-primary/20" : "bg-primary/10")}>
                  <type.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base">{type.label}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4">
              <p className="text-xs leading-relaxed text-muted-foreground">{type.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap sm:flex-nowrap items-end gap-3">
            <div className="flex flex-col gap-2 w-full sm:w-[260px] shrink-0">
              <Label>Período</Label>
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
                placeholder="Selecionar período"
                className="w-full"
              />
            </div>

            <Button className="w-full sm:w-auto h-10 px-4 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleGenerateReport} disabled={reportsQuery.isFetching || isExporting}>
              Gerar relatório
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      <div ref={reportContentRef} className="space-y-4">
      {selectedReport === "services" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-primary/80" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Serviços Concluídos</p>
                  <p className="text-xl font-semibold text-primary/80">{dashboardStats.completedServices}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Serviços Agendados</p>
                  <p className="text-xl font-semibold text-blue-600/80">{dashboardStats.scheduledServices}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Emergências</p>
                  <p className="text-xl font-semibold text-amber-600/80">{dashboardStats.emergencyServices}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Taxa de Conclusão</p>
                  <p className="text-xl font-semibold text-green-600/80">{dashboardStats.completionRate}%</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
          <Card data-report-chart="servicos-periodo">
            <CardHeader>
              <CardTitle>Serviços por Período</CardTitle>
              <CardDescription>Comparativo de serviços agendados vs realizados</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={servicesByPeriodChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="period" className="text-xs" />
                  <YAxis
                    className="text-xs"
                    allowDecimals={false}
                    domain={[0, (dataMax: number) => Math.max(Number(dataMax) || 0, 1)]}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "var(--card)", 
                      border: "1px solid var(--border)",
                      borderRadius: "8px"
                    }} 
                  />
                  <Legend />
                  <Bar
                    dataKey="completed"
                    fill={hasServicesByPeriodData ? "var(--primary)" : EMPTY_CHART_COLOR}
                    minPointSize={hasServicesByPeriodData ? 0 : 3}
                    name="Concluídos"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="scheduled"
                    fill={hasServicesByPeriodData ? "#C9CCD1" : "#EEF3E7"}
                    minPointSize={hasServicesByPeriodData ? 0 : 3}
                    name="Agendados"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card data-report-chart="servicos-equipe">
            <CardHeader>
              <CardTitle>Serviços por Equipe</CardTitle>
              <CardDescription>Distribuição de serviços entre as equipes</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={servicesByTeamChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    dataKey="services"
                    nameKey="team"
                  >
                    {servicesByTeamChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.isEmpty ? EMPTY_CHART_COLOR : COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px"
                    }}
                    formatter={(value: number, _name, item) => [`${item.payload.isEmpty ? 0 : value} serviços`, ""]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 w-full">
                {servicesByTeamChartData.map((entry, index) => {
                  return (
                    <div key={entry.team} className="flex items-center gap-1.5 text-xs">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: entry.isEmpty ? EMPTY_CHART_COLOR : COLORS[index % COLORS.length] }}
                      />
                      <span className="text-muted-foreground whitespace-nowrap">
                        {entry.team}: {entry.isEmpty || servicesByTeamTotal === 0 ? 0 : Math.round((entry.services / servicesByTeamTotal) * 100)}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
          </div>
        </div>
      )}

      {selectedReport === "financial" && (
        <FinanceiroContent
          viewMode={financialViewMode}
          viewToggle={financialViewToggle}
          dateFrom={formatDateParam(dateRange?.from)}
          dateTo={formatDateParam(dateRange?.to)}
        />
      )}

      {selectedReport === "teams" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {teamsForChart.map((team) => {
            const statusData = buildTeamStatusPieData(team)
            const total = statusData.reduce((sum, item) => sum + (item.isEmpty ? 0 : item.services), 0)

            return (
              <Card key={team.teamId} data-report-chart={`equipe-${slugifyFilePart(team.teamName)}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    {team.teamName}
                  </CardTitle>
                  <CardDescription>Realizados, agendados e cancelados</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        dataKey="services"
                        nameKey="name"
                      >
                        {statusData.map((entry) => (
                          <Cell key={`${team.teamId}-${entry.name}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px"
                        }}
                        formatter={(value: number, _name, item) => [`${item.payload.isEmpty ? 0 : value} serviços`, item.payload.name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 w-full">
                    {statusData.map((entry) => (
                      <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-muted-foreground whitespace-nowrap">
                          {entry.name}: {entry.isEmpty || total === 0 ? 0 : Math.round((entry.services / total) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      </div>
    </div>
  )
}
