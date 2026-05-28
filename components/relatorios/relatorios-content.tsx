"use client"

import { useState } from "react"
import type { Worksheet } from "exceljs"
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

const EMPTY_MONTHLY_REVENUE_DATA = [
  { month: "Mês 1", value: 0, paidValue: 0, lateValue: 0, overdueValue: 0, lateOverdueValue: 0 },
  { month: "Mês 2", value: 0, paidValue: 0, lateValue: 0, overdueValue: 0, lateOverdueValue: 0 },
  { month: "Mês 3", value: 0, paidValue: 0, lateValue: 0, overdueValue: 0, lateOverdueValue: 0 },
  { month: "Mês 4", value: 0, paidValue: 0, lateValue: 0, overdueValue: 0, lateOverdueValue: 0 },
  { month: "Mês 5", value: 0, paidValue: 0, lateValue: 0, overdueValue: 0, lateOverdueValue: 0 },
  { month: "Mês 6", value: 0, paidValue: 0, lateValue: 0, overdueValue: 0, lateOverdueValue: 0 },
]

type ExcelCell = string | number | boolean | null | undefined
type ChartPoint = Record<string, string | number | boolean | null | undefined>
type ChartSeries<T extends ChartPoint> = {
  key: keyof T
  label: string
  color: string
}
type DonutEntry = {
  label: string
  value: number
  color: string
}
type ReportChartImage = {
  title: string
  svg: string
  width: number
  height: number
}

const EXCEL_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
const CHART_WIDTH = 820
const CHART_HEIGHT = 420
const DONUT_CHART_HEIGHT = 380
const EXCEL_HEADER_FILL = "FFEBF5E5"
const EXCEL_BORDER_COLOR = "FFDDE7D5"

function downloadBlob(fileName: string, blob: Blob) {
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
  return `depclean-${reportId}-${from}-${to}.xlsx`
}

function slugifyFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function escapeXml(value: string | number | null | undefined) {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  }

  return String(value ?? "").replace(/[&<>"']/g, (char) => entities[char])
}

function truncateChartLabel(value: string, maxLength = 18) {
  return value.length > maxLength ? `${value.slice(0, Math.max(1, maxLength - 3))}...` : value
}

function getNumber<T extends ChartPoint>(item: T, key: keyof T) {
  const value = item[key]
  if (typeof value === "number" && Number.isFinite(value)) return value

  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

function getNiceMax(value: number) {
  if (value <= 0) return 1

  const magnitude = Math.pow(10, Math.floor(Math.log10(value)))
  const normalized = value / magnitude
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10

  return niceNormalized * magnitude
}

function formatCurrencyValue(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function formatCompactCurrency(value: number) {
  if (Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`
  }

  return formatCurrencyValue(value)
}

function formatInteger(value: number) {
  return Math.round(value).toLocaleString("pt-BR")
}

function makeChartFrame(title: string, width: number, height: number, content: string) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" rx="16" fill="#ffffff"/>
      <text x="24" y="34" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#111827">${escapeXml(title)}</text>
      ${content}
    </svg>
  `
}

function makeGroupedBarChartSvg<T extends ChartPoint>({
  title,
  data,
  labelKey,
  series,
  width = CHART_WIDTH,
  height = CHART_HEIGHT,
  valueFormatter = formatInteger,
}: {
  title: string
  data: T[]
  labelKey: keyof T
  series: ChartSeries<T>[]
  width?: number
  height?: number
  valueFormatter?: (value: number) => string
}) {
  const plotX = 76
  const plotY = 84
  const plotWidth = width - 112
  const plotHeight = height - 174
  const maxValue = getNiceMax(Math.max(1, ...data.flatMap((item) => series.map((itemSeries) => getNumber(item, itemSeries.key)))))
  const tickCount = 5
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => (maxValue / tickCount) * index)
  const groupWidth = plotWidth / Math.max(data.length, 1)
  const barWidth = Math.max(7, Math.min(28, (groupWidth - 18) / Math.max(series.length, 1)))
  const groupGap = Math.max(6, (groupWidth - barWidth * series.length) / 2)

  const grid = ticks
    .map((tick) => {
      const y = plotY + plotHeight - (tick / maxValue) * plotHeight
      return `
        <line x1="${plotX}" y1="${y}" x2="${plotX + plotWidth}" y2="${y}" stroke="#E5E7EB" stroke-width="1"/>
        <text x="${plotX - 12}" y="${y + 4}" text-anchor="end" font-family="Arial, sans-serif" font-size="11" fill="#6B7280">${escapeXml(valueFormatter(tick))}</text>
      `
    })
    .join("")

  const bars = data
    .map((item, itemIndex) => {
      const baseX = plotX + itemIndex * groupWidth + groupGap
      const label = truncateChartLabel(String(item[labelKey] ?? ""))
      const labelX = plotX + itemIndex * groupWidth + groupWidth / 2
      const columns = series
        .map((itemSeries, seriesIndex) => {
          const value = getNumber(item, itemSeries.key)
          const barHeight = value > 0 ? Math.max(2, (value / maxValue) * plotHeight) : 0
          const x = baseX + seriesIndex * barWidth
          const y = plotY + plotHeight - barHeight

          return `<rect x="${x}" y="${y}" width="${barWidth - 1}" height="${barHeight}" rx="4" fill="${itemSeries.color}"/>`
        })
        .join("")

      return `
        ${columns}
        <text x="${labelX}" y="${plotY + plotHeight + 24}" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#4B5563">${escapeXml(label)}</text>
      `
    })
    .join("")

  const legend = series
    .map((itemSeries, index) => {
      const x = 24 + index * 150
      return `
        <rect x="${x}" y="${height - 36}" width="12" height="12" rx="3" fill="${itemSeries.color}"/>
        <text x="${x + 18}" y="${height - 26}" font-family="Arial, sans-serif" font-size="12" fill="#374151">${escapeXml(itemSeries.label)}</text>
      `
    })
    .join("")

  return makeChartFrame(
    title,
    width,
    height,
    `
      ${grid}
      <line x1="${plotX}" y1="${plotY}" x2="${plotX}" y2="${plotY + plotHeight}" stroke="#CBD5E1" stroke-width="1"/>
      <line x1="${plotX}" y1="${plotY + plotHeight}" x2="${plotX + plotWidth}" y2="${plotY + plotHeight}" stroke="#CBD5E1" stroke-width="1"/>
      ${bars}
      ${legend}
    `,
  )
}

function makeLineChartSvg<T extends ChartPoint>({
  title,
  data,
  labelKey,
  series,
  width = CHART_WIDTH,
  height = CHART_HEIGHT,
  valueFormatter = formatInteger,
}: {
  title: string
  data: T[]
  labelKey: keyof T
  series: ChartSeries<T>[]
  width?: number
  height?: number
  valueFormatter?: (value: number) => string
}) {
  const plotX = 76
  const plotY = 84
  const plotWidth = width - 112
  const plotHeight = height - 174
  const maxValue = getNiceMax(Math.max(1, ...data.flatMap((item) => series.map((itemSeries) => getNumber(item, itemSeries.key)))))
  const ticks = Array.from({ length: 6 }, (_, index) => (maxValue / 5) * index)

  const grid = ticks
    .map((tick) => {
      const y = plotY + plotHeight - (tick / maxValue) * plotHeight
      return `
        <line x1="${plotX}" y1="${y}" x2="${plotX + plotWidth}" y2="${y}" stroke="#E5E7EB" stroke-width="1"/>
        <text x="${plotX - 12}" y="${y + 4}" text-anchor="end" font-family="Arial, sans-serif" font-size="11" fill="#6B7280">${escapeXml(valueFormatter(tick))}</text>
      `
    })
    .join("")

  const labels = data
    .map((item, index) => {
      const x = data.length === 1 ? plotX + plotWidth / 2 : plotX + (index / (data.length - 1)) * plotWidth
      const label = truncateChartLabel(String(item[labelKey] ?? ""))
      return `<text x="${x}" y="${plotY + plotHeight + 24}" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#4B5563">${escapeXml(label)}</text>`
    })
    .join("")

  const lines = series
    .map((itemSeries) => {
      const points = data.map((item, index) => {
        const x = data.length === 1 ? plotX + plotWidth / 2 : plotX + (index / (data.length - 1)) * plotWidth
        const value = getNumber(item, itemSeries.key)
        const y = plotY + plotHeight - (value / maxValue) * plotHeight
        return { x, y }
      })
      const polylinePoints = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ")
      const dots = points
        .map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="#ffffff" stroke="${itemSeries.color}" stroke-width="2"/>`)
        .join("")

      return `
        <polyline fill="none" stroke="${itemSeries.color}" stroke-width="3" points="${polylinePoints}"/>
        ${dots}
      `
    })
    .join("")

  const legend = series
    .map((itemSeries, index) => {
      const x = 24 + index * 150
      return `
        <line x1="${x}" y1="${height - 30}" x2="${x + 16}" y2="${height - 30}" stroke="${itemSeries.color}" stroke-width="3"/>
        <text x="${x + 22}" y="${height - 26}" font-family="Arial, sans-serif" font-size="12" fill="#374151">${escapeXml(itemSeries.label)}</text>
      `
    })
    .join("")

  return makeChartFrame(
    title,
    width,
    height,
    `
      ${grid}
      <line x1="${plotX}" y1="${plotY}" x2="${plotX}" y2="${plotY + plotHeight}" stroke="#CBD5E1" stroke-width="1"/>
      <line x1="${plotX}" y1="${plotY + plotHeight}" x2="${plotX + plotWidth}" y2="${plotY + plotHeight}" stroke="#CBD5E1" stroke-width="1"/>
      ${lines}
      ${labels}
      ${legend}
    `,
  )
}

function makeDonutChartSvg({
  title,
  entries,
  centerValue,
  centerLabel,
  width = CHART_WIDTH,
  height = DONUT_CHART_HEIGHT,
  valueFormatter = formatInteger,
}: {
  title: string
  entries: DonutEntry[]
  centerValue: string
  centerLabel: string
  width?: number
  height?: number
  valueFormatter?: (value: number) => string
}) {
  const total = entries.reduce((sum, entry) => sum + entry.value, 0)
  const safeEntries = total > 0 ? entries.filter((entry) => entry.value > 0) : [{ label: "Sem dados", value: 1, color: EMPTY_CHART_COLOR }]
  const cx = 210
  const cy = 205
  const radius = 92
  const strokeWidth = 44
  const circumference = 2 * Math.PI * radius
  let offset = 0

  const slices = safeEntries
    .map((entry) => {
      const value = total > 0 ? entry.value : 1
      const fraction = value / safeEntries.reduce((sum, item) => sum + item.value, 0)
      const dash = fraction * circumference
      const slice = `
        <circle
          cx="${cx}"
          cy="${cy}"
          r="${radius}"
          fill="none"
          stroke="${entry.color}"
          stroke-width="${strokeWidth}"
          stroke-dasharray="${dash} ${circumference - dash}"
          stroke-dashoffset="${-offset}"
          transform="rotate(-90 ${cx} ${cy})"
        />
      `
      offset += dash
      return slice
    })
    .join("")

  const legend = safeEntries
    .map((entry, index) => {
      const y = 118 + index * 34
      const percentage = total > 0 ? Math.round((entry.value / total) * 100) : 0
      const detail = total > 0 ? `${percentage}% (${valueFormatter(entry.value)})` : "0%"

      return `
        <rect x="480" y="${y - 12}" width="12" height="12" rx="3" fill="${entry.color}"/>
        <text x="500" y="${y - 3}" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#111827">${escapeXml(entry.label)}</text>
        <text x="500" y="${y + 15}" font-family="Arial, sans-serif" font-size="12" fill="#6B7280">${escapeXml(detail)}</text>
      `
    })
    .join("")

  return makeChartFrame(
    title,
    width,
    height,
    `
      ${slices}
      <circle cx="${cx}" cy="${cy}" r="${radius - strokeWidth / 2}" fill="#ffffff"/>
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#111827">${escapeXml(centerValue)}</text>
      <text x="${cx}" y="${cy + 22}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#6B7280">${escapeXml(centerLabel)}</text>
      ${legend}
    `,
  )
}

async function svgToPngBase64(svg: string, width: number, height: number) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
  const url = URL.createObjectURL(blob)

  try {
    return await new Promise<string>((resolve, reject) => {
      const image = new Image()

      image.onload = () => {
        const canvas = document.createElement("canvas")
        const scale = 2
        canvas.width = width * scale
        canvas.height = height * scale
        const context = canvas.getContext("2d")

        if (!context) {
          reject(new Error("Não foi possível preparar o gráfico para o Excel."))
          return
        }

        context.fillStyle = "#ffffff"
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.scale(scale, scale)
        context.drawImage(image, 0, 0, width, height)
        resolve(canvas.toDataURL("image/png"))
      }

      image.onerror = () => reject(new Error("Não foi possível carregar o gráfico para o Excel."))
      image.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function columnLetter(columnIndex: number) {
  let column = ""
  let current = columnIndex

  while (current > 0) {
    const remainder = (current - 1) % 26
    column = String.fromCharCode(65 + remainder) + column
    current = Math.floor((current - remainder) / 26)
  }

  return column
}

function styleDataSheet(sheet: Worksheet, rows: ExcelCell[][]) {
  const columnCount = Math.max(1, ...rows.map((row) => row.length))

  sheet.columns = Array.from({ length: columnCount }, (_, index) => {
    const maxLength = Math.max(12, ...rows.map((row) => String(row[index] ?? "").length + 2))
    return { width: Math.min(maxLength, 42) }
  })
  sheet.views = [{ state: "frozen", ySplit: 1 }]
  sheet.autoFilter = `A1:${columnLetter(columnCount)}1`

  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.alignment = { vertical: "middle", wrapText: true }
      cell.border = { bottom: { style: "thin", color: { argb: EXCEL_BORDER_COLOR } } }
    })

    if (rowNumber === 1) {
      row.font = { bold: true, color: { argb: "FF111827" } }
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_HEADER_FILL } }
    }
  })
}

function buildReportCharts(reportId: ReportId, data: ReportsAnalyticsRecord): ReportChartImage[] {
  if (reportId === "financial") {
    const monthlyData = data.monthlyRevenueData.length > 0 ? data.monthlyRevenueData : EMPTY_MONTHLY_REVENUE_DATA
    const hasMonthlyData = data.monthlyRevenueData.some((item) => item.paidValue > 0 || item.lateValue > 0 || item.overdueValue > 0)
    const receivable = data.financialSummary.totalReceivable ??
      data.financialSummary.totalPending + data.financialSummary.totalLate + data.financialSummary.totalOverdue

    return [
      {
        title: "Faturamento Mensal",
        width: CHART_WIDTH,
        height: CHART_HEIGHT,
        svg: makeGroupedBarChartSvg({
          title: "Faturamento Mensal",
          data: monthlyData,
          labelKey: "month",
          valueFormatter: formatCompactCurrency,
          series: [
            { key: "paidValue", label: "Pagas", color: hasMonthlyData ? "#84CC16" : EMPTY_CHART_COLOR },
            { key: "lateValue", label: "Em atraso", color: hasMonthlyData ? "#F59E0B" : "#F6EFE4" },
            { key: "overdueValue", label: "Vencidas", color: hasMonthlyData ? "#EF4444" : "#F3E7E7" },
          ],
        }),
      },
      {
        title: "Saúde Financeira",
        width: CHART_WIDTH,
        height: DONUT_CHART_HEIGHT,
        svg: makeDonutChartSvg({
          title: "Saúde Financeira",
          centerValue: `${data.financialSummary.adherenceRate}%`,
          centerLabel: "Adimplência",
          valueFormatter: formatCompactCurrency,
          entries: [
            { label: "Recebido", value: data.financialSummary.totalPaid, color: "#22C55E" },
            { label: "A receber", value: receivable, color: "#2563EB" },
            { label: "Em atraso", value: data.financialSummary.totalLate, color: "#F59E0B" },
            { label: "Vencidas", value: data.financialSummary.totalOverdue, color: "#EF4444" },
          ],
        }),
      },
    ]
  }

  if (reportId === "services") {
    const periodData = data.servicesByPeriodData.length > 0 ? data.servicesByPeriodData : EMPTY_SERVICES_BY_PERIOD_DATA
    const hasPeriodData = data.servicesByPeriodData.some(
      (item) => item.completed > 0 || item.scheduled > 0 || item.cancelled > 0 || item.emergency > 0,
    )
    const summaryData: ServicesSummaryChartPoint[] = data.servicesSummaryData.length > 0
      ? data.servicesSummaryData
      : EMPTY_SERVICES_SUMMARY_DATA
    const totalServices = data.servicesSummaryData.reduce((sum, item) => sum + item.total, 0)

    return [
      {
        title: "Serviços por Período",
        width: CHART_WIDTH,
        height: CHART_HEIGHT,
        svg: makeGroupedBarChartSvg({
          title: "Serviços por Período",
          data: periodData,
          labelKey: "period",
          series: [
            { key: "completed", label: "Concluídos", color: hasPeriodData ? STATUS_COLORS.completed : EMPTY_CHART_COLOR },
            { key: "scheduled", label: "Agendados", color: hasPeriodData ? STATUS_COLORS.scheduled : "#C9D6BF" },
            { key: "cancelled", label: "Cancelados", color: hasPeriodData ? STATUS_COLORS.cancelled : "#E5E7EB" },
            { key: "emergency", label: "Emergências", color: hasPeriodData ? STATUS_COLORS.emergency : "#FDE68A" },
          ],
        }),
      },
      {
        title: "Participação por Serviço",
        width: CHART_WIDTH,
        height: DONUT_CHART_HEIGHT,
        svg: makeDonutChartSvg({
          title: "Participação por Serviço",
          centerValue: formatInteger(totalServices),
          centerLabel: "serviços",
          entries: summaryData.map((item, index) => ({
            label: item.serviceName,
            value: item.isEmpty ? 0 : item.total,
            color: item.isEmpty ? EMPTY_CHART_COLOR : COLORS[index % COLORS.length],
          })),
        }),
      },
      {
        title: "Volume por Semana",
        width: CHART_WIDTH,
        height: CHART_HEIGHT,
        svg: makeLineChartSvg({
          title: "Volume por Semana",
          data: periodData,
          labelKey: "period",
          series: [
            { key: "completed", label: "Concluídos", color: hasPeriodData ? STATUS_COLORS.completed : EMPTY_CHART_COLOR },
            { key: "scheduled", label: "Agendados", color: hasPeriodData ? STATUS_COLORS.scheduled : "#C9D6BF" },
            { key: "cancelled", label: "Cancelados", color: hasPeriodData ? "#EF4444" : "#E5E7EB" },
            { key: "emergency", label: "Emergências", color: hasPeriodData ? STATUS_COLORS.emergency : "#FDE68A" },
          ],
        }),
      },
    ]
  }

  const teams = data.dashboardStats.teamProductivity.length > 0 ? data.dashboardStats.teamProductivity : EMPTY_TEAM_PRODUCTIVITY
  const hasTeamsData = data.dashboardStats.teamProductivity.some(
    (team) => team.completedServices > 0 || team.scheduledServices > 0 || team.cancelledServices > 0,
  )

  return [
    {
      title: "Produtividade por Equipe",
      width: CHART_WIDTH,
      height: CHART_HEIGHT,
      svg: makeGroupedBarChartSvg({
        title: "Produtividade por Equipe",
        data: teams,
        labelKey: "teamName",
        series: [
          { key: "completedServices", label: "Realizados", color: hasTeamsData ? "#84CC16" : EMPTY_CHART_COLOR },
          { key: "scheduledServices", label: "Agendados", color: hasTeamsData ? "#2563EB" : "#C9D6BF" },
          { key: "cancelledServices", label: "Cancelados", color: hasTeamsData ? "#EF4444" : "#E5E7EB" },
        ],
      }),
    },
    ...teams.map((team) => {
      const total = team.completedServices + team.scheduledServices + team.cancelledServices

      return {
        title: `Status da equipe ${team.teamName}`,
        width: CHART_WIDTH,
        height: DONUT_CHART_HEIGHT,
        svg: makeDonutChartSvg({
          title: `Status da equipe ${team.teamName}`,
          centerValue: formatInteger(total),
          centerLabel: "serviços",
          entries: [
            { label: "Realizados", value: team.completedServices, color: "#84CC16" },
            { label: "Agendados", value: team.scheduledServices, color: "#2563EB" },
            { label: "Cancelados", value: team.cancelledServices, color: "#EF4444" },
          ],
        }),
      }
    }),
  ]
}

async function downloadExcelReport(fileName: string, rows: ExcelCell[][], charts: ReportChartImage[]) {
  type ExcelJSImportType = typeof import("exceljs")
  const ExcelJSImport = await import("exceljs")
  const ExcelJS = ((ExcelJSImport as unknown as { default?: ExcelJSImportType }).default ?? ExcelJSImport) as ExcelJSImportType
  const workbook = new ExcelJS.Workbook()

  workbook.creator = "Depclean"
  workbook.created = new Date()
  workbook.modified = new Date()

  const dataSheet = workbook.addWorksheet("Dados")
  dataSheet.addRows(rows.length > 0 ? rows : [["Sem dados"]])
  styleDataSheet(dataSheet, rows.length > 0 ? rows : [["Sem dados"]])

  const chartsSheet = workbook.addWorksheet("Gráficos")
  chartsSheet.views = [{ showGridLines: false }]
  chartsSheet.properties.defaultRowHeight = 18
  chartsSheet.getColumn(1).width = 3
  chartsSheet.getColumn(2).width = 18

  if (charts.length === 0) {
    chartsSheet.getCell("B2").value = "Nenhum gráfico disponível."
  }

  let rowCursor = 1
  for (const chart of charts) {
    chartsSheet.mergeCells(rowCursor, 2, rowCursor, 8)
    const titleCell = chartsSheet.getCell(rowCursor, 2)
    titleCell.value = chart.title
    titleCell.font = { bold: true, size: 14, color: { argb: "FF111827" } }
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_HEADER_FILL } }
    titleCell.alignment = { vertical: "middle" }

    const image = await svgToPngBase64(chart.svg, chart.width, chart.height)
    const imageId = workbook.addImage({ base64: image, extension: "png" })
    chartsSheet.addImage(imageId, {
      tl: { col: 1, row: rowCursor },
      ext: { width: chart.width, height: chart.height },
    })

    rowCursor += Math.ceil(chart.height / 18) + 4
  }

  const buffer = await workbook.xlsx.writeBuffer()
  downloadBlob(fileName, new Blob([buffer as BlobPart], { type: EXCEL_MIME_TYPE }))
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

  const buildReportRows = (data: ReportsAnalyticsRecord): ExcelCell[][] => {
    if (selectedReport === "services") {
      return [
        ["Relatório", "Período/Serviço", "Concluídos", "Agendados", "Cancelados", "Emergências", "Total", "Taxa de conclusão", "Duração média"],
        ...data.servicesByPeriodData.map((item) => [
          "Serviços por período",
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
          "Serviços por tipo",
          item.serviceName,
          item.completed,
          item.scheduled,
          item.cancelled,
          item.emergency,
          item.total,
          `${item.completionRate}%`,
          item.averageDurationMinutes,
        ]),
        ["Resumo", "Serviços concluídos", data.dashboardStats.completedServices, "", "", "", "", "", ""],
        ["Resumo", "Serviços agendados", "", data.dashboardStats.scheduledServices, "", "", "", "", ""],
        ["Resumo", "Emergências", "", "", "", data.dashboardStats.emergencyServices, "", "", ""],
        ["Resumo", "Taxa de conclusão", "", "", "", "", "", `${data.dashboardStats.completionRate}%`, ""],
      ]
    }

    if (selectedReport === "financial") {
      return [
        ["Relatório", "Item", "Valor", "Pagas", "Em atraso", "Vencidas"],
        ["Resumo financeiro", "Faturamento do mês", data.dashboardStats.monthlyRevenue, "", "", ""],
        ["Resumo financeiro", "Recebido", data.financialSummary.totalPaid, "", "", ""],
        [
          "Resumo financeiro",
          "A receber",
          data.financialSummary.totalReceivable ??
            data.financialSummary.totalPending + data.financialSummary.totalLate + data.financialSummary.totalOverdue,
          "",
          "",
          "",
        ],
        ["Resumo financeiro", "Em atraso", data.financialSummary.totalLate ?? 0, "", "", ""],
        ["Resumo financeiro", "Vencidas", data.financialSummary.totalOverdue, "", "", ""],
        ["Indicadores", "Taxa de adimplência", `${data.financialSummary.adherenceRate}%`, "", "", ""],
        ["Indicadores", "Ticket médio", data.dashboardStats.activeClients > 0 ? data.dashboardStats.monthlyRevenue / data.dashboardStats.activeClients : 0, "", "", ""],
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
        ["Equipe", "Serviços realizados", "Serviços agendados", "Serviços cancelados", "Taxa de conclusão"],
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
      await downloadExcelReport(reportFileName(selectedReport, dateRange), buildReportRows(data), buildReportCharts(selectedReport, data))
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
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
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
              <div className="flex w-full flex-col gap-2 sm:w-[340px] xl:w-[380px]">
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
                {selectedServiceOptions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
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
              </div>
            )}

            {selectedReport === "teams" && (
              <div className="flex w-full flex-col gap-2 sm:w-[340px] xl:w-[380px]">
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
                {selectedTeamOptions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
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
            )}

            <Button className="h-10 w-full shrink-0 bg-primary px-4 text-primary-foreground hover:bg-primary/90 sm:mt-[1.625rem] sm:w-[170px]" onClick={handleGenerateReport} disabled={reportsQuery.isFetching || isExporting}>
              {isExporting ? "Gerando Excel..." : "Gerar relatório"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      <div className="space-y-4">
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
