"use client"

import { useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MultiSelect } from "@/components/ui/multi-select"
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
  X,
} from "lucide-react"
import { getReportsAnalytics, type ReportsAnalyticsRecord } from "@/lib/api/analytics"
import { useUrlQueryState } from "@/lib/hooks/use-url-query-state"
import { cn } from "@/lib/utils"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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

const COLORS = ["#84CC16", "#65A30D", "#A3E635", "#4D7C0F", "#BEF264", "#3F6212"]
const STATUS_COLORS = {
  completed: "#65A30D",
  scheduled: "#2F7D9A",
  cancelled: "#D9E6C8",
  emergency: "#F59E0B",
}
const EMPTY_CHART_COLOR = "#DDE7D5"

type TeamStatusSlice = {
  name: string
  services: number
  color: string
  isEmpty?: boolean
}

type ServicesByTeamChartPoint = ReportsAnalyticsRecord["servicesByTeamData"][number] & { isEmpty?: boolean }
type ServicesSummaryChartPoint = ReportsAnalyticsRecord["servicesSummaryData"][number] & { isEmpty?: boolean }

const emptyReports: ReportsAnalyticsRecord = {
  dashboardStats: {
    activeClients: 0,
    activeClientsChange: 0,
    inactiveClients: 0,
    activeContracts: 0,
    inactiveContracts: 0,
    activeContractsGlobalValue: 0,
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
    totalLate: 0,
    totalOverdue: 0,
    paidCount: 0,
    pendingCount: 0,
    lateCount: 0,
    overdueCount: 0,
    totalCount: 0,
    adherenceRate: 0,
  },
  monthlyRevenueData: [],
  servicesByPeriodData: [],
  servicesByTeamData: [],
  servicesSummaryData: [],
  services: [],
  clients: [],
  contracts: [],
  teams: [],
}

const EMPTY_SERVICES_BY_PERIOD_DATA = [
  { period: "Semana 1", completed: 0, scheduled: 0, cancelled: 0, emergency: 0 },
  { period: "Semana 2", completed: 0, scheduled: 0, cancelled: 0, emergency: 0 },
  { period: "Semana 3", completed: 0, scheduled: 0, cancelled: 0, emergency: 0 },
  { period: "Semana 4", completed: 0, scheduled: 0, cancelled: 0, emergency: 0 },
]

const EMPTY_SERVICES_BY_TEAM_DATA: ServicesByTeamChartPoint[] = [
  { team: "Sem dados", services: 1, isEmpty: true },
]

const EMPTY_SERVICES_SUMMARY_DATA: ServicesSummaryChartPoint[] = [
  {
    serviceId: "sem-servico",
    serviceName: "Sem dados",
    completed: 0,
    scheduled: 0,
    cancelled: 0,
    emergency: 0,
    total: 1,
    completionRate: 0,
    averageDurationMinutes: 0,
    isEmpty: true,
  },
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

function getCurrentMonthRange(): DateRange {
  const now = new Date()
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0),
  }
}

function parseUrlIds(value: string) {
  if (!value || value === "all") return []

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatUrlIds(ids: string[]) {
  return ids.length > 0 ? ids.join(",") : "all"
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

const UNSUPPORTED_CANVAS_COLOR_FUNCTION = /\b(?:lab|lch|oklab|oklch|color-mix)\(/i
const CANVAS_COLOR_PROPERTIES = [
  "color",
  "backgroundColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "outlineColor",
  "textDecorationColor",
  "columnRuleColor",
  "caretColor",
  "fill",
  "stroke",
] as const

function sanitizeUnsupportedCanvasColors(root: HTMLElement) {
  const document = root.ownerDocument
  const view = document.defaultView
  if (!view) return

  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement | SVGElement>("*"))]
  for (const element of elements) {
    const computed = view.getComputedStyle(element)

    for (const property of CANVAS_COLOR_PROPERTIES) {
      const value = computed[property]
      if (!value || !UNSUPPORTED_CANVAS_COLOR_FUNCTION.test(value)) continue

      const fallback = property === "backgroundColor" || property.includes("border") || property === "outlineColor"
        ? "transparent"
        : "#0f172a"
      element.style.setProperty(property.replace(/[A-Z]/g, "-$&").toLowerCase(), fallback, "important")
    }

    if (UNSUPPORTED_CANVAS_COLOR_FUNCTION.test(computed.boxShadow)) {
      element.style.setProperty("box-shadow", "none", "important")
    }

    if (UNSUPPORTED_CANVAS_COLOR_FUNCTION.test(computed.textShadow)) {
      element.style.setProperty("text-shadow", "none", "important")
    }
  }
}

async function downloadChartPng(element: HTMLElement, fileName: string) {
  const { default: html2canvas } = await import("html2canvas")
  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    onclone: (clonedDocument, clonedElement) => {
      sanitizeUnsupportedCanvasColors(clonedDocument.body)
      sanitizeUnsupportedCanvasColors(clonedElement as HTMLElement)
    },
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
  const [selectedServiceIdsQuery, setSelectedServiceIdsQuery] = useUrlQueryState("services", "all")
  const [selectedTeamIdsQuery, setSelectedTeamIdsQuery] = useUrlQueryState("teams", "all")
  const selectedReport: ReportId = REPORT_IDS.includes(selectedReportQuery as ReportId)
    ? selectedReportQuery as ReportId
    : "financial"
  const setSelectedReport = (value: string) => setSelectedReportQuery(value)
  const selectedServiceIds = parseUrlIds(selectedServiceIdsQuery)
  const selectedTeamIds = parseUrlIds(selectedTeamIdsQuery)
  const [financialViewMode, setFinancialViewMode] = useState<"table" | "cards">("table")
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => getCurrentMonthRange())
  const [isExporting, setIsExporting] = useState(false)
  const reportContentRef = useRef<HTMLDivElement>(null)
  const reportsQuery = useQuery({
    queryKey: ["analytics", "reports", selectedReport, selectedServiceIdsQuery, selectedTeamIdsQuery, formatDateParam(dateRange?.from), formatDateParam(dateRange?.to)],
    queryFn: () =>
      getReportsAnalytics({
        dateFrom: formatDateParam(dateRange?.from),
        dateTo: formatDateParam(dateRange?.to),
        serviceIds: selectedReport === "services" ? formatUrlIds(selectedServiceIds) : undefined,
        teamIds: selectedReport === "teams" ? formatUrlIds(selectedTeamIds) : undefined,
      }),
  })
  const reports = reportsQuery.data?.data ?? emptyReports
  const {
    dashboardStats,
    servicesByPeriodData,
    servicesByTeamData,
    servicesSummaryData,
  } = reports
  const hasServicesByPeriodData = servicesByPeriodData.some(
    (item) => item.completed > 0 || item.scheduled > 0 || (item.cancelled ?? 0) > 0 || (item.emergency ?? 0) > 0,
  )
  const servicesByPeriodChartData = servicesByPeriodData.length > 0 ? servicesByPeriodData : EMPTY_SERVICES_BY_PERIOD_DATA
  const hasServicesByTeamData = servicesByTeamData.some((item) => item.services > 0)
  const servicesByTeamChartData: ServicesByTeamChartPoint[] = hasServicesByTeamData ? servicesByTeamData : EMPTY_SERVICES_BY_TEAM_DATA
  const servicesByTeamTotal = hasServicesByTeamData ? servicesByTeamData.reduce((acc, curr) => acc + curr.services, 0) : 0
  const serviceOptions = reports.services.filter((service) => service.isActive)
  const teamOptions = reports.teams
  const selectedServiceOptions = serviceOptions.filter((service) => selectedServiceIds.includes(service.id))
  const selectedTeamOptions = teamOptions.filter((team) => selectedTeamIds.includes(team.id))
  const hasServicesSummaryData = servicesSummaryData.some((item) => item.total > 0)
  const servicesSummaryChartData: ServicesSummaryChartPoint[] = hasServicesSummaryData ? servicesSummaryData : EMPTY_SERVICES_SUMMARY_DATA
  const servicesSummaryTotal = hasServicesSummaryData ? servicesSummaryData.reduce((acc, curr) => acc + curr.total, 0) : 0
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
        ["Relatorio", "Periodo/Servico", "Concluidos", "Agendados", "Cancelados", "Emergencias", "Total", "Taxa de conclusao", "Duracao media"],
        ...data.servicesByPeriodData.map((item) => [
          "Servicos por periodo",
          item.period,
          item.completed,
          item.scheduled,
          item.cancelled ?? 0,
          item.emergency ?? 0,
          "",
          "",
          "",
        ]),
        ...data.servicesSummaryData.map((item) => [
          "Servicos por tipo",
          item.serviceName,
          item.completed,
          item.scheduled,
          item.cancelled,
          item.emergency,
          item.total,
          `${item.completionRate}%`,
          item.averageDurationMinutes,
        ]),
        ["Resumo", "Servicos concluidos", data.dashboardStats.completedServices, "", "", "", "", "", ""],
        ["Resumo", "Servicos agendados", "", data.dashboardStats.scheduledServices, "", "", "", "", ""],
        ["Resumo", "Emergencias", "", "", "", data.dashboardStats.emergencyServices, "", "", ""],
        ["Resumo", "Taxa de conclusao", "", "", "", "", "", `${data.dashboardStats.completionRate}%`, ""],
      ]
    }

    if (selectedReport === "financial") {
      return [
        ["Relatorio", "Item", "Valor", "Pagas", "Em atraso", "Vencidas"],
        ["Resumo financeiro", "Faturamento do mes", data.dashboardStats.monthlyRevenue, "", "", ""],
        ["Resumo financeiro", "Recebido", data.financialSummary.totalPaid, "", "", ""],
        ["Resumo financeiro", "A receber", data.financialSummary.totalPending, "", "", ""],
        ["Resumo financeiro", "Em atraso", data.financialSummary.totalLate ?? 0, "", "", ""],
        ["Resumo financeiro", "Vencidas", data.financialSummary.totalOverdue, "", "", ""],
        ["Indicadores", "Taxa de adimplencia", `${data.financialSummary.adherenceRate}%`, "", "", ""],
        ["Indicadores", "Ticket medio", data.dashboardStats.activeClients > 0 ? data.dashboardStats.monthlyRevenue / data.dashboardStats.activeClients : 0, "", "", ""],
        ["Indicadores", "Contratos ativos", data.contracts.filter((contract) => ["signed", "active"].includes(contract.status)).length, "", "", ""],
        ["Faturamento mensal", "Período", "Total", "Pagas", "Em atraso", "Vencidas"],
        ...data.monthlyRevenueData.map((item) => [
          "Faturamento mensal",
          item.month,
          item.value,
          item.paidValue,
          item.lateValue,
          item.overdueValue,
        ]),
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

  const removeSelectedFilterOption = (optionId: string) => {
    if (selectedReport === "services") {
      setSelectedServiceIdsQuery(formatUrlIds(selectedServiceIds.filter((id) => id !== optionId)))
      return
    }

    if (selectedReport === "teams") {
      setSelectedTeamIdsQuery(formatUrlIds(selectedTeamIds.filter((id) => id !== optionId)))
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
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex flex-col gap-2 w-full sm:w-auto shrink-0">
              <Label>Período</Label>
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
                placeholder="Selecionar período"
                className="w-full sm:w-[218px]"
              />
            </div>

            {selectedReport === "services" && (
              <div className="flex w-full flex-col gap-2 sm:w-[420px] xl:w-[520px]">
                <Label>Serviço</Label>
                <MultiSelect
                  options={serviceOptions}
                  selected={selectedServiceIds}
                  onChange={(selected) => setSelectedServiceIdsQuery(formatUrlIds(selected))}
                  placeholder="Todos os serviços"
                  searchPlaceholder="Buscar serviço..."
                  emptyMessage="Nenhum serviço encontrado."
                  showSelectedTags={false}
                />
              </div>
            )}

            {selectedReport === "teams" && (
              <div className="flex w-full flex-col gap-2 sm:w-[420px] xl:w-[520px]">
                <Label>Equipe</Label>
                <MultiSelect
                  options={teamOptions}
                  selected={selectedTeamIds}
                  onChange={(selected) => setSelectedTeamIdsQuery(formatUrlIds(selected))}
                  placeholder="Todas as equipes"
                  searchPlaceholder="Buscar equipe..."
                  emptyMessage="Nenhuma equipe encontrada."
                  showSelectedTags={false}
                />
              </div>
            )}

            <Button className="h-10 w-full shrink-0 bg-primary px-4 text-primary-foreground hover:bg-primary/90 sm:w-[170px]" onClick={handleGenerateReport} disabled={reportsQuery.isFetching || isExporting}>
              Gerar relatório
            </Button>

            {selectedReport === "services" && selectedServiceOptions.length > 0 && (
              <div className="flex w-full flex-wrap gap-2">
                {selectedServiceOptions.map((option) => (
                  <Badge
                    key={option.id}
                    variant="outline"
                    className="flex items-center gap-2 px-3 py-1 text-foreground/80"
                  >
                    <span>{option.name}</span>
                    <button
                      type="button"
                      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                      onClick={() => removeSelectedFilterOption(option.id)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {selectedReport === "teams" && selectedTeamOptions.length > 0 && (
              <div className="flex w-full flex-wrap gap-2">
                {selectedTeamOptions.map((option) => (
                  <Badge
                    key={option.id}
                    variant="outline"
                    className="flex items-center gap-2 px-3 py-1 text-foreground/80"
                  >
                    <span>{option.name}</span>
                    <button
                      type="button"
                      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                      onClick={() => removeSelectedFilterOption(option.id)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
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
                <CardDescription>Comparativo entre agenda prevista e serviços concluídos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="-mx-1 overflow-x-auto px-1 pb-2">
                <div className="h-[300px] min-w-[560px] sm:min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={servicesByPeriodChartData} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="period" className="text-xs" />
                    <YAxis
                      width={34}
                      className="text-xs"
                      allowDecimals={false}
                      domain={[0, (dataMax: number) => Math.max(Number(dataMax) || 0, 1)]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="completed"
                      fill={hasServicesByPeriodData ? STATUS_COLORS.completed : EMPTY_CHART_COLOR}
                      minPointSize={hasServicesByPeriodData ? 0 : 3}
                      name="Concluídos"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="scheduled"
                      fill={hasServicesByPeriodData ? STATUS_COLORS.scheduled : "#C9D6BF"}
                      minPointSize={hasServicesByPeriodData ? 0 : 3}
                      name="Agendados"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
                </div>
                </div>
              </CardContent>
            </Card>

            <Card data-report-chart="participacao-servicos">
              <CardHeader>
                <CardTitle>Participação por Serviço</CardTitle>
                <CardDescription>Quais serviços concentram mais demanda no período</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={servicesSummaryChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={105}
                      dataKey="total"
                      nameKey="serviceName"
                    >
                      {servicesSummaryChartData.map((entry, index) => (
                        <Cell key={entry.serviceId} fill={entry.isEmpty ? EMPTY_CHART_COLOR : COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number, _name, item) => [
                        `${item.payload.isEmpty ? 0 : value} serviços`,
                        item.payload.serviceName,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex w-full flex-wrap justify-center gap-x-4 gap-y-2">
                  {servicesSummaryChartData.map((entry, index) => (
                    <div key={entry.serviceId} className="flex items-center gap-1.5 text-xs">
                      <div
                        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: entry.isEmpty ? EMPTY_CHART_COLOR : COLORS[index % COLORS.length] }}
                      />
                      <span className="whitespace-nowrap text-muted-foreground">
                        {entry.serviceName}: {entry.isEmpty || servicesSummaryTotal === 0 ? 0 : Math.round((entry.total / servicesSummaryTotal) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card data-report-chart="volume-semanal-servicos">
            <CardHeader>
              <CardTitle>Volume por Semana</CardTitle>
              <CardDescription>Curvas semanais por status operacional</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="-mx-1 overflow-x-auto px-1 pb-2">
              <div className="h-[320px] min-w-[560px] sm:min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={servicesByPeriodChartData} margin={{ top: 12, right: 16, left: 0, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="period" className="text-xs" />
                  <YAxis
                    width={34}
                    allowDecimals={false}
                    domain={[0, (dataMax: number) => Math.max(Number(dataMax) || 0, 1)]}
                    className="text-xs"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number, name) => [`${value} serviços`, name]}
                  />
                  <Legend />
                  <Line
                    dataKey="completed"
                    type="monotone"
                    stroke={hasServicesByPeriodData ? STATUS_COLORS.completed : EMPTY_CHART_COLOR}
                    strokeWidth={2}
                    name="Concluídos"
                    dot={{ r: 4, fill: hasServicesByPeriodData ? STATUS_COLORS.completed : EMPTY_CHART_COLOR }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    dataKey="scheduled"
                    type="monotone"
                    stroke={hasServicesByPeriodData ? STATUS_COLORS.scheduled : "#C9D6BF"}
                    strokeWidth={2}
                    name="Agendados"
                    dot={{ r: 4, fill: hasServicesByPeriodData ? STATUS_COLORS.scheduled : "#C9D6BF" }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    dataKey="cancelled"
                    type="monotone"
                    stroke={hasServicesByPeriodData ? STATUS_COLORS.cancelled : "#E5E7EB"}
                    strokeWidth={2}
                    name="Cancelados"
                    dot={{ r: 4, fill: hasServicesByPeriodData ? STATUS_COLORS.cancelled : "#E5E7EB" }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    dataKey="emergency"
                    type="monotone"
                    stroke={hasServicesByPeriodData ? STATUS_COLORS.emergency : "#FDE68A"}
                    strokeWidth={2}
                    name="Emergências"
                    dot={{ r: 4, fill: hasServicesByPeriodData ? STATUS_COLORS.emergency : "#FDE68A" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              </div>
              </div>
            </CardContent>
          </Card>
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
