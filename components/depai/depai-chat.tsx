"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import {
  BarChart3,
  Bot,
  ClipboardList,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  LoaderCircle,
  Plus,
  Send,
  X,
} from "lucide-react"
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react"
import ReactMarkdown from "react-markdown"
import rehypeSanitize from "rehype-sanitize"
import remarkGfm from "remark-gfm"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts"
import { toast } from "sonner"

import {
  deleteDepAIConversation,
  listDepAIConversations,
  sendDepAIMessage,
  type DepAIArtifact,
  type DepAIConversation,
  type DepAIFile,
  type DepAIMessage,
} from "@/lib/api/depai"
import { getApiErrorMessage } from "@/lib/api/errors"
import { Button } from "@/components/ui/button"
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog"
import { Textarea } from "@/components/ui/textarea"

const initialMessages: DepAIMessage[] = []

const suggestions = [
  "Consultar dados de um cliente",
  "Analisar um documento anexado",
  "Resumir histórico de atendimento",
  "Ajudar com uma dúvida operacional",
]

const chartGreenPalette = ["#84cc16", "#22c55e", "#16a34a", "#65a30d", "#15803d", "#4d7c0f", "#86efac", "#a3e635"]
const emptyChartColor = "#DDE7D5"

function createConversationId() {
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const initialConversations: DepAIConversation[] = [
  {
    id: createConversationId(),
    title: "Nova conversa",
    updatedAt: new Date().toISOString(),
    messages: initialMessages,
  },
]

function getVisibleConversations(conversations: DepAIConversation[], activeConversationId: string) {
  return conversations.filter((conversation) => conversation.messages.length > 0 || conversation.id === activeConversationId)
}

function createInitialConversation(): DepAIConversation {
  return {
    id: createConversationId(),
    title: "Nova conversa",
    updatedAt: new Date().toISOString(),
    messages: [],
  }
}

function createConversation(): DepAIConversation {
  return {
    id: createConversationId(),
    title: "Nova conversa",
    updatedAt: new Date().toISOString(),
    messages: [],
  }
}

function getConversationTitle(message: string) {
  const trimmed = message.trim()
  if (!trimmed) return "Nova conversa"
  return trimmed.length > 44 ? `${trimmed.slice(0, 44)}...` : trimmed
}

type MarkdownSegment =
  | { type: "markdown"; content: string }
  | { type: "mermaid"; content: string }
  | { type: "svg"; content: string }

const MERMAID_START_PATTERN = /^(?:%%\{[\s\S]*?\}%%\s*)?(?:flowchart|graph|sequenceDiagram|classDiagram|classDiagram-v2|stateDiagram|stateDiagram-v2|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram|C4Context|C4Container|C4Component|C4Dynamic|sankey-beta|xychart-beta|block-beta)\b/i
const SVG_START_PATTERN = /^\s*<svg(?:\s|>)/i
const SVG_BLOCK_PATTERN = /<svg\b[\s\S]*?<\/svg>/i

function extractSvgSource(value: string) {
  const match = value.match(SVG_BLOCK_PATTERN)
  return match?.[0]?.trim() ?? null
}

function isXmlLikeSource(value: string) {
  return /^\s*(?:<\?xml|<!doctype|<!--|<svg|<html|<body|<div|<defs|<g|<path|<rect|<text|<line|<circle|<ellipse|<polygon|<polyline)\b/i.test(value)
}

function isMermaidSource(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (extractSvgSource(trimmed) || isXmlLikeSource(trimmed)) return false

  if (trimmed.startsWith("---")) {
    const [, maybeDiagram] = trimmed.split(/^---\s*$/m)
    return MERMAID_START_PATTERN.test((maybeDiagram ?? "").trim())
  }

  return MERMAID_START_PATTERN.test(trimmed)
}

function isMermaidFragment(value: string) {
  if (extractSvgSource(value) || isXmlLikeSource(value)) return false

  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => Boolean(line) && !line.startsWith("<"))

  if (lines.length < 2) return false
  const arrowLines = lines.filter((line) => /(?:-->|---|-.->|==>)/.test(line) && /[A-Za-z0-9_][\w-]*/.test(line))
  return arrowLines.length >= 2
}

function normalizeMermaidSource(value: string) {
  const trimmed = value.trim()
  if (isMermaidSource(trimmed)) return trimmed
  if (isMermaidFragment(trimmed)) return `flowchart TD\n${trimmed}`
  return trimmed
}

function isSvgSource(value: string) {
  const trimmed = value.trim()
  return SVG_START_PATTERN.test(trimmed) || Boolean(extractSvgSource(trimmed))
}

function pushMarkdownWithInlineSvg(segments: MarkdownSegment[], content: string) {
  if (!content) return

  const pattern = /<svg\b[\s\S]*?<\/svg>/gi
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(content)) !== null) {
    const before = content.slice(lastIndex, match.index)
    if (before) segments.push({ type: "markdown", content: before })
    segments.push({ type: "svg", content: match[0].trim() })
    lastIndex = match.index + match[0].length
  }

  const rest = content.slice(lastIndex)
  if (rest) segments.push({ type: "markdown", content: rest })
}

function parseMarkdownSegments(content: string): MarkdownSegment[] {
  const codeFencePattern = /```([^\n`]*)\n([\s\S]*?)```/g
  const segments: MarkdownSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = codeFencePattern.exec(content)) !== null) {
    const [fullMatch, languageLine = "", code = ""] = match
    const before = content.slice(lastIndex, match.index)
    pushMarkdownWithInlineSvg(segments, before)

    const language = languageLine.trim().split(/\s+/)[0]?.toLowerCase() ?? ""
    const svgSource = extractSvgSource(code)
    if (language === "svg" || language === "xml" || svgSource || isSvgSource(code)) {
      segments.push({ type: "svg", content: svgSource ?? code.trim() })
    } else if (language === "mermaid" || isMermaidSource(code) || isMermaidFragment(code)) {
      segments.push({ type: "mermaid", content: normalizeMermaidSource(code) })
    } else {
      segments.push({ type: "markdown", content: fullMatch })
    }

    lastIndex = match.index + fullMatch.length
  }

  const rest = content.slice(lastIndex)
  pushMarkdownWithInlineSvg(segments, rest)
  return segments.length > 0 ? segments : [{ type: "markdown", content }]
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function cleanCell(value: string) {
  return value.replace(/<br\s*\/?>/gi, " ").replace(/\*\*/g, "").replace(/`/g, "").trim()
}

function parseMarkdownTables(content: string) {
  const lines = content.split(/\r?\n/)
  const tables: Array<{ headers: string[]; rows: string[][] }> = []

  for (let index = 0; index < lines.length; index += 1) {
    const headerLine = lines[index]?.trim() ?? ""
    const separatorLine = lines[index + 1]?.trim() ?? ""

    if (!headerLine.startsWith("|") || !separatorLine.startsWith("|") || !/^\|?[\s:|-]+\|?$/.test(separatorLine)) {
      continue
    }

    const headers = headerLine.split("|").slice(1, -1).map(cleanCell)
    const rows: string[][] = []
    index += 2

    while (index < lines.length && (lines[index]?.trim() ?? "").startsWith("|")) {
      rows.push((lines[index] ?? "").split("|").slice(1, -1).map(cleanCell))
      index += 1
    }

    index -= 1
    if (headers.length > 0 && rows.length > 0) {
      tables.push({ headers, rows })
    }
  }

  return tables
}

function removeMarkdownTables(content: string) {
  const lines = content.split(/\r?\n/)
  const nextLines: string[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const currentLine = lines[index]?.trim() ?? ""
    const nextLine = lines[index + 1]?.trim() ?? ""
    const startsTable = currentLine.startsWith("|") && nextLine.startsWith("|") && /^\|?[\s:|-]+\|?$/.test(nextLine)

    if (!startsTable) {
      nextLines.push(lines[index] ?? "")
      continue
    }

    index += 2
    while (index < lines.length && (lines[index]?.trim() ?? "").startsWith("|")) {
      index += 1
    }
    index -= 1
  }

  return nextLines.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")
}

function extractDocumentContent(content: string) {
  const trimmed = content.trim()
  const lines = trimmed.split(/\r?\n/)
  const usefulTitleTerms = [
    "relatorio",
    "documento",
    "resumo executivo",
    "analise",
    "parecer",
    "proposta",
    "plano",
    "diagnostico",
    "minuta",
  ]
  const firstUsefulIndex = lines.findIndex((line) => {
    const value = line.trim()
    const normalized = normalizeSearchText(value.replace(/\*/g, ""))
    return value.startsWith("#") || usefulTitleTerms.some((term) => normalized.startsWith(term))
  })

  if (firstUsefulIndex > 0) {
    return lines.slice(firstUsefulIndex).join("\n").trim()
  }

  return trimmed
    .replace(/^claro[^\n]*\n+/i, "")
    .replace(/^consigo sim[^\n]*\n+/i, "")
    .trim()
}

function parseNumericValue(value: string) {
  const match = value.match(/-?\d[\d.,]*/)
  if (!match) return null
  const normalized = match[0].replace(/\./g, "").replace(",", ".")
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseChartData(content: string) {
  const table = parseMarkdownTables(content).find((item) => item.headers.length >= 2)

  if (table) {
    return table.rows
      .map((row) => {
        const value = row.slice(1).map(parseNumericValue).find((item): item is number => typeof item === "number")
        return value === undefined ? null : { name: row[0] || "Item", value }
      })
      .filter((item): item is { name: string; value: number } => Boolean(item))
      .slice(0, 8)
  }

  return content
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^\s*(?:[-*]\s*)?(?:\*\*)?([^:\n]+?)(?:\*\*)?:\s*(?:R\$\s*)?(-?\d[\d.,]*)/)
      if (!match) return null
      const value = parseNumericValue(match[2] ?? "")
      return value === null ? null : { name: cleanCell(match[1] ?? "Item"), value }
    })
    .filter((item): item is { name: string; value: number } => Boolean(item))
    .slice(0, 8)
}

type ChartDataset = {
  data: Array<Record<string, string | number>>
  series: string[]
}

function parseChartDataset(content: string): ChartDataset {
  const table = parseMarkdownTables(content).find((item) => item.headers.length >= 2)

  if (table) {
    const numericIndexes = table.headers
      .map((header, index) => ({ header, index }))
      .filter(({ index }) => index > 0 && table.rows.some((row) => parseNumericValue(row[index] ?? "") !== null))

    if (numericIndexes.length > 0) {
      return {
        series: numericIndexes.map(({ header }) => header || "Valor"),
        data: table.rows.slice(0, 12).map((row) => {
          const datum: Record<string, string | number> = { name: row[0] || "Item" }
          for (const { header, index } of numericIndexes) {
            datum[header || "Valor"] = parseNumericValue(row[index] ?? "") ?? 0
          }
          return datum
        }),
      }
    }
  }

  return {
    series: ["Valor"],
    data: parseChartData(content).map((item) => ({
      name: item.name,
      Valor: item.value,
    })),
  }
}

function inferChartType(content: string) {
  const normalized = normalizeSearchText(content)

  if (normalized.includes("pizza") || normalized.includes("pie") || normalized.includes("rosca") || normalized.includes("donut")) {
    return "pie"
  }

  if (normalized.includes("linha") || normalized.includes("line") || normalized.includes("evolucao") || normalized.includes("tendencia")) {
    return "line"
  }

  return "bar"
}

function downloadBlob(content: BlobPart, fileName: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function normalizeExcelFileName(fileName?: string) {
  const baseName = (fileName || "dados-depai.xlsx").replace(/\.(csv|xls|xlsx)$/i, "")
  return `${baseName}.xlsx`
}

function chartDatasetToRows(chartDataset: ChartDataset) {
  if (chartDataset.data.length === 0 || chartDataset.series.length === 0) return []
  const maxValue = Math.max(
    1,
    ...chartDataset.data.flatMap((item) => chartDataset.series.map((series) => Math.abs(Number(item[series]) || 0))),
  )

  return chartDataset.data.flatMap((item) =>
    chartDataset.series.map((series) => {
      const value = Number(item[series]) || 0
      const barSize = Math.max(0, Math.round((Math.abs(value) / maxValue) * 32))
      return [series, String(item.name ?? "Item"), value, "|".repeat(barSize)]
    }),
  )
}

async function downloadExcelWorkbook(
  table: { headers: string[]; rows: string[][] },
  chartDataset: ChartDataset,
  fileName?: string,
) {
  const XLSX = await import("xlsx")
  const workbook = XLSX.utils.book_new()
  const dataSheet = XLSX.utils.aoa_to_sheet([table.headers, ...table.rows])

  XLSX.utils.book_append_sheet(workbook, dataSheet, "Dados")

  const chartRows = chartDatasetToRows(chartDataset)
  if (chartRows.length > 0) {
    const chartSheet = XLSX.utils.aoa_to_sheet([["Série", "Item", "Valor", "Barra visual"], ...chartRows])
    XLSX.utils.book_append_sheet(workbook, chartSheet, "Gráficos")
  }

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ["Arquivo", normalizeExcelFileName(fileName)],
    ["Gerado em", new Date().toLocaleString("pt-BR")],
    ["Origem", "DepAI"],
    ["Observação", "A aba Dados contém a tabela principal. A aba Gráficos contém os dados prontos para visualização e conferência."],
  ])
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo")

  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
  downloadBlob(output, normalizeExcelFileName(fileName), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
}

async function downloadMarkdownPdf(content: string, fileName: string) {
  const { jsPDF } = await import("jspdf")
  const pdf = new jsPDF({ format: "a4", orientation: "portrait", unit: "pt" })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 42
  const lines = pdf.splitTextToSize(content.replace(/[#*_`>|]/g, "").trim(), pageWidth - margin * 2)
  let y = margin

  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(11)
  for (const line of lines) {
    if (y > pageHeight - margin) {
      pdf.addPage()
      y = margin
    }
    pdf.text(line, margin, y)
    y += 16
  }

  pdf.save(fileName)
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

async function downloadChartSvgPng(element: HTMLElement, fileName: string) {
  const svg = element.querySelector("svg")

  if (!svg) {
    throw new Error("Prévia do gráfico não encontrada.")
  }

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
  if (!blob) throw new Error("Não foi possível preparar o PNG.")

  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(reader.error ?? new Error("Não foi possível ler o arquivo."))
    reader.readAsDataURL(file)
  })
}

function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(reader.error ?? new Error("Não foi possível ler o arquivo."))
    reader.readAsText(file)
  })
}

function inferFileType(file: File) {
  if (file.type) return file.type
  const lowerName = file.name.toLowerCase()

  if (lowerName.endsWith(".png")) return "image/png"
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg"
  if (lowerName.endsWith(".webp")) return "image/webp"
  if (lowerName.endsWith(".pdf")) return "application/pdf"
  if (lowerName.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  if (lowerName.endsWith(".xls")) return "application/vnd.ms-excel"
  if (lowerName.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  if (lowerName.endsWith(".doc")) return "application/msword"
  if (lowerName.endsWith(".csv")) return "text/csv"
  if (lowerName.endsWith(".txt") || lowerName.endsWith(".md")) return "text/plain"
  if (lowerName.endsWith(".json")) return "application/json"

  return "application/octet-stream"
}

async function mapFile(file: File): Promise<DepAIFile> {
  const type = inferFileType(file)
  const lowerName = file.name.toLowerCase()
  const shouldReadText =
    type.startsWith("text/") ||
    lowerName.endsWith(".csv") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".json")
  const shouldAttachDataUrl =
    file.size <= 8 * 1024 * 1024 &&
    (type.startsWith("image/") ||
      type.includes("pdf") ||
      type.includes("spreadsheet") ||
      type.includes("excel") ||
      type.includes("wordprocessingml") ||
      lowerName.endsWith(".pdf") ||
      lowerName.endsWith(".xlsx") ||
      lowerName.endsWith(".xls") ||
      lowerName.endsWith(".docx") ||
      lowerName.endsWith(".doc"))

  return {
    id: `${file.name}-${file.lastModified}-${file.size}`,
    name: file.name,
    size: file.size,
    type,
    content: shouldReadText ? await readFileAsText(file) : undefined,
    dataUrl: shouldAttachDataUrl ? await readFileAsDataUrl(file) : undefined,
  }
}

function FileIcon({ type }: { type: string }) {
  if (type.startsWith("image/")) return <ImageIcon className="h-4 w-4" />
  return <FileText className="h-4 w-4" />
}

function ArtifactIcon({ kind }: { kind: DepAIArtifact["kind"] }) {
  if (kind === "xlsx") return <FileSpreadsheet className="h-4 w-4" />
  if (kind === "chart") return <BarChart3 className="h-4 w-4" />
  if (kind === "report") return <ClipboardList className="h-4 w-4" />
  return <FileText className="h-4 w-4" />
}

function ArtifactPreview({ artifact, sourceContent, chartRef }: { artifact: DepAIArtifact; sourceContent: string; chartRef: RefObject<HTMLDivElement | null> }) {
  const tables = useMemo(() => parseMarkdownTables(sourceContent), [sourceContent])
  const chartDataset = useMemo(() => parseChartDataset(sourceContent), [sourceContent])
  const chartType = useMemo(() => inferChartType(sourceContent), [sourceContent])
  const documentContent = useMemo(() => extractDocumentContent(sourceContent), [sourceContent])
  const table = tables[0]
  const chartHasValues = chartDataset.data.some((item) =>
    chartDataset.series.some((series) => Math.abs(Number(item[series]) || 0) > 0),
  )
  const pieChartData = chartHasValues
    ? chartDataset.data
    : [{ name: "Sem dados", [chartDataset.series[0] ?? "Valor"]: 1 }]

  if (artifact.kind === "chart") {
    if (chartDataset.data.length === 0 || chartDataset.series.length === 0) {
      return <p className="mt-3 rounded-2xl bg-muted/50 p-3 text-xs text-muted-foreground">Não encontrei uma tabela ou pares de valores na resposta para montar o gráfico.</p>
    }

    return (
      <div ref={chartRef} className="mt-3 rounded-2xl bg-background p-3">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "pie" ? (
              <PieChart>
                <Pie
                  data={pieChartData}
                  dataKey={chartDataset.series[0]}
                  nameKey="name"
                  innerRadius={sourceContent.toLowerCase().includes("rosca") || sourceContent.toLowerCase().includes("donut") ? 48 : 0}
                  outerRadius={88}
                  paddingAngle={2}
                >
                  {pieChartData.map((entry, index) => (
                    <Cell
                      key={`slice-${String(entry.name)}-${index}`}
                      fill={chartHasValues ? chartGreenPalette[index % chartGreenPalette.length] : emptyChartColor}
                    />
                  ))}
                </Pie>
                <ChartTooltip formatter={(value) => chartHasValues ? Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0,00"} />
                <Legend />
              </PieChart>
            ) : chartType === "line" ? (
              <LineChart data={chartDataset.data} margin={{ top: 10, right: 16, left: 0, bottom: 42 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dfe6d7" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#4b5563" }} interval={0} angle={-18} textAnchor="end" height={58} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#4b5563" }}
                  width={72}
                  domain={[0, (dataMax: number) => Math.max(Number(dataMax) || 0, 1)]}
                />
                <ChartTooltip formatter={(value) => Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
                <Legend />
                {chartDataset.series.map((series, index) => (
                  <Line
                    key={series}
                    type="monotone"
                    dataKey={series}
                    stroke={chartHasValues ? chartGreenPalette[index % chartGreenPalette.length] : emptyChartColor}
                    strokeWidth={3}
                    dot={{ r: 4, fill: chartHasValues ? chartGreenPalette[index % chartGreenPalette.length] : emptyChartColor }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            ) : (
              <BarChart data={chartDataset.data} margin={{ top: 10, right: 12, left: 0, bottom: 42 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dfe6d7" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#4b5563" }} interval={0} angle={-18} textAnchor="end" height={58} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#4b5563" }}
                  width={72}
                  domain={[0, (dataMax: number) => Math.max(Number(dataMax) || 0, 1)]}
                />
                <ChartTooltip formatter={(value) => Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
                <Legend />
                {chartDataset.series.map((series, seriesIndex) => (
                  <Bar
                    key={series}
                    dataKey={series}
                    fill={chartHasValues ? chartGreenPalette[seriesIndex % chartGreenPalette.length] : emptyChartColor}
                    minPointSize={chartHasValues ? 0 : 3}
                    radius={[8, 8, 0, 0]}
                  >
                    {chartDataset.series.length === 1 && chartDataset.data.map((entry, index) => (
                      <Cell
                        key={`bar-${String(entry.name)}-${index}`}
                        fill={chartHasValues ? chartGreenPalette[index % chartGreenPalette.length] : emptyChartColor}
                      />
                    ))}
                  </Bar>
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  if (artifact.kind === "xlsx") {
    if (!table) {
      return <p className="mt-3 rounded-2xl bg-muted/50 p-3 text-xs text-muted-foreground">Peça a resposta em formato de tabela para visualizar e baixar como planilha.</p>
    }

    return (
      <div className="mt-3 max-h-72 max-w-full overflow-auto rounded-2xl bg-background">
        <table className="min-w-max border-collapse text-left text-xs">
          <thead>
            <tr>
              {table.headers.map((header) => (
                <th key={header} className="whitespace-nowrap bg-muted px-3 py-2 font-semibold text-foreground">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => (
              <tr key={`${row.join("-")}-${index}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${cell}-${cellIndex}`} className="max-w-[260px] whitespace-nowrap px-3 py-2 text-foreground">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="mt-3 max-h-80 overflow-auto rounded-2xl border border-border bg-background p-4 text-xs leading-6">
      <MarkdownMessage content={documentContent} />
    </div>
  )
}

function ArtifactCard({ artifact, sourceContent }: { artifact: DepAIArtifact; sourceContent: string }) {
  const [expanded, setExpanded] = useState(artifact.kind === "chart" || artifact.kind === "xlsx")
  const chartRef = useRef<HTMLDivElement | null>(null)

  const downloadArtifact = async () => {
    try {
      if (artifact.kind === "chart") {
        if (!chartRef.current) {
          toast.error("Abra a prévia do gráfico antes de baixar.")
          return
        }
        await downloadChartSvgPng(chartRef.current, artifact.fileName || "grafico-depai.png")
        return
      }

      if (artifact.kind === "xlsx") {
        const table = parseMarkdownTables(sourceContent)[0]
        if (!table) {
          toast.error("Não encontrei uma tabela na resposta para exportar.")
          return
        }
        await downloadExcelWorkbook(table, parseChartDataset(sourceContent), artifact.fileName)
        return
      }

      await downloadMarkdownPdf(extractDocumentContent(sourceContent), artifact.fileName || "documento-depai.pdf")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível baixar o arquivo.")
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ArtifactIcon kind={artifact.kind} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{artifact.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{artifact.description}</p>
            {artifact.fileName && (
              <p className="mt-1 truncate text-[11px] text-muted-foreground">{artifact.fileName}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setExpanded((current) => !current)} title={expanded ? "Ocultar prévia" : "Ver prévia"}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={downloadArtifact} title="Baixar">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <ArtifactPreview artifact={artifact} sourceContent={sourceContent} chartRef={chartRef} />
        </div>
      </div>
    </div>
  )
}

function sanitizeSvgSource(source: string) {
  const parser = new DOMParser()
  const document = parser.parseFromString(source, "image/svg+xml")
  const parserError = document.querySelector("parsererror")
  const svg = document.documentElement

  if (parserError || !svg || svg.nodeName.toLowerCase() !== "svg") return ""

  svg.querySelectorAll("script, foreignObject, iframe, object, embed, link, meta").forEach((element) => element.remove())
  svg.querySelectorAll("*").forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.trim()
      if (name.startsWith("on")) {
        element.removeAttribute(attribute.name)
        return
      }

      if ((name === "href" || name === "xlink:href") && /^javascript:/i.test(value)) {
        element.removeAttribute(attribute.name)
      }
    })
  })

  return new XMLSerializer().serializeToString(svg)
}

function SvgDiagram({ source }: { source: string }) {
  const svgRef = useRef<HTMLDivElement | null>(null)
  const [svg, setSvg] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    const sanitized = sanitizeSvgSource(source)
    setSvg(sanitized)
    setErrorMessage(sanitized ? "" : "Não foi possível renderizar esta imagem.")
  }, [source])

  const handleDownload = async () => {
    if (!svgRef.current) return

    setIsDownloading(true)
    try {
      await downloadChartSvgPng(svgRef.current, "imagem-depai.png")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível baixar a imagem.")
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="my-4 rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ImageIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">Imagem</p>
            <p className="text-xs text-muted-foreground">Renderizada pela DepAI</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 rounded-full"
          disabled={!svg || isDownloading}
          onClick={() => void handleDownload()}
        >
          {isDownloading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Baixar imagem
        </Button>
      </div>

      <div ref={svgRef} className="max-h-[70vh] overflow-auto rounded-xl bg-white p-4">
        {svg ? (
          <div
            className="[&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  )
}

function MermaidDiagram({ chart }: { chart: string }) {
  const diagramRef = useRef<HTMLDivElement | null>(null)
  const [svg, setSvg] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function renderDiagram() {
      setSvg("")
      setErrorMessage("")

      try {
        const mermaid = (await import("mermaid")).default
        mermaid.initialize({
          startOnLoad: false,
          suppressErrorRendering: true,
          securityLevel: "strict",
          theme: "base",
          themeVariables: {
            fontFamily: "Inter, Arial, sans-serif",
            primaryColor: "#eef7e6",
            primaryTextColor: "#0f172a",
            primaryBorderColor: "#84cc16",
            lineColor: "#64748b",
            secondaryColor: "#ffffff",
            secondaryBorderColor: "#dce6d4",
            tertiaryColor: "#f8fafc",
            tertiaryBorderColor: "#dce6d4",
            noteBkgColor: "#f7fee7",
            noteBorderColor: "#84cc16",
          },
        })
        const canRender = await mermaid.parse(chart, { suppressErrors: true })
        if (!canRender) {
          if (!cancelled) setErrorMessage("Não foi possível renderizar este fluxograma.")
          return
        }
        const renderId = `depai-mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
        const result = await mermaid.render(renderId, chart)
        if (!cancelled) setSvg(result.svg)
      } catch {
        if (!cancelled) setErrorMessage("Não foi possível renderizar este fluxograma.")
      }
    }

    void renderDiagram()
    return () => {
      cancelled = true
    }
  }, [chart])

  const handleDownload = async () => {
    if (!diagramRef.current) return

    setIsDownloading(true)
    try {
      await downloadChartSvgPng(diagramRef.current, "fluxograma-depai.png")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível baixar o fluxograma.")
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="my-4 rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ImageIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">Fluxograma</p>
            <p className="text-xs text-muted-foreground">Renderizado pela DepAI</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 rounded-full"
          disabled={!svg || isDownloading}
          onClick={() => void handleDownload()}
        >
          {isDownloading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Baixar imagem
        </Button>
      </div>

      <div ref={diagramRef} className="max-h-[70vh] overflow-auto rounded-xl bg-white p-4">
        {svg ? (
          <div
            className="[&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : errorMessage ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            {errorMessage}
          </div>
        ) : (
          <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            Gerando fluxograma...
          </div>
        )}
      </div>
    </div>
  )
}

function MarkdownMessage({ content }: { content: string }) {
  const segments = useMemo(() => parseMarkdownSegments(content), [content])

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === "mermaid") {
          return <MermaidDiagram key={`mermaid-${index}-${segment.content.slice(0, 16)}`} chart={segment.content} />
        }

        if (segment.type === "svg") {
          return <SvgDiagram key={`svg-${index}-${segment.content.slice(0, 16)}`} source={segment.content} />
        }

        if (!segment.content.trim()) return null
        return <MarkdownText key={`markdown-${index}`} content={segment.content} />
      })}
    </>
  )
}

function MarkdownText({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      components={{
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noreferrer" className="font-medium text-primary underline-offset-4 hover:underline">
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-3 border-l-4 border-primary/40 pl-4 text-muted-foreground">{children}</blockquote>
        ),
        code: ({ children, className }) => {
          const isBlock = typeof className === "string" && className.includes("language-")

          if (isBlock) {
            return <code className={className}>{children}</code>
          }

          return <code className="rounded bg-muted px-1.5 py-0.5 text-[0.92em] text-foreground">{children}</code>
        },
        h1: ({ children }) => <h1 className="mb-3 text-xl font-semibold leading-tight text-foreground">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-2 mt-4 text-lg font-semibold leading-tight text-foreground">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-2 mt-3 text-base font-semibold leading-tight text-foreground">{children}</h3>,
        hr: () => <hr className="my-4 border-border" />,
        li: ({ children }) => <li className="pl-1">{children}</li>,
        ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-5">{children}</ol>,
        p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
        pre: ({ children }) => (
          <pre className="my-3 overflow-x-auto rounded-2xl bg-muted p-4 text-xs leading-relaxed text-foreground">{children}</pre>
        ),
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
        table: ({ children }) => (
          <div className="my-3 overflow-x-auto rounded-2xl border border-border">
            <table className="min-w-full border-collapse text-left text-sm">{children}</table>
          </div>
        ),
        tbody: ({ children }) => <tbody className="divide-y divide-border">{children}</tbody>,
        td: ({ children }) => <td className="px-3 py-2 align-top text-foreground">{children}</td>,
        th: ({ children }) => <th className="bg-muted px-3 py-2 align-top font-semibold text-foreground">{children}</th>,
        thead: ({ children }) => <thead>{children}</thead>,
        tr: ({ children }) => <tr>{children}</tr>,
        ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-5">{children}</ul>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

function Avatar({ role }: { role: DepAIMessage["role"] }) {
  if (role === "user") {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
        VC
      </div>
    )
  }

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm shadow-primary/20">
      <Bot className="h-4 w-4" />
    </div>
  )
}

function ThinkingMessage() {
  return (
    <div className="group mx-auto flex w-full max-w-3xl gap-4 px-4 py-5">
      <Avatar role="assistant" />
      <div className="flex min-h-8 items-center">
        <span className="flex gap-1.5" aria-label="DepAI está pensando">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
        </span>
      </div>
    </div>
  )
}

function MessageRow({ message }: { message: DepAIMessage }) {
  const artifacts = message.artifacts ?? []
  const hasSheetArtifact = artifacts.some((artifact) => artifact.kind === "xlsx")
  const displayContent = hasSheetArtifact ? removeMarkdownTables(message.content) : message.content

  if (message.role === "user") {
    return (
      <div className="mx-auto flex w-full max-w-3xl justify-end px-4 py-5">
        <div className="max-w-[78%] rounded-3xl bg-muted px-5 py-3 text-sm leading-7 text-foreground md:text-[15px]">
          <p className="whitespace-pre-line">{message.content}</p>
          {message.files && message.files.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.files.map((file) => (
                <span key={file.id} className="inline-flex max-w-full items-center gap-2 rounded-2xl bg-background/80 px-3 py-2 text-xs text-muted-foreground">
                  <FileIcon type={file.type} />
                  <span className="max-w-[220px] truncate text-foreground">{file.name}</span>
                  <span>{formatFileSize(file.size)}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="group mx-auto flex w-full max-w-3xl gap-4 px-4 py-5 transition-colors hover:bg-muted/20">
      <Avatar role={message.role} />
      <div className="min-w-0 flex-1 pt-1 text-sm leading-7 text-foreground md:text-[15px]">
        <MarkdownMessage content={displayContent || "Planilha pronta para visualização e download abaixo."} />
        {message.files && message.files.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {message.files.map((file) => (
              <span key={file.id} className="inline-flex max-w-full items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-sm">
                <FileIcon type={file.type} />
                <span className="max-w-[220px] truncate text-foreground">{file.name}</span>
                <span>{formatFileSize(file.size)}</span>
              </span>
            ))}
          </div>
        )}
        {artifacts.length > 0 && (
          <div className="mt-4 space-y-2">
            {artifacts.map((artifact) => (
              <ArtifactCard key={artifact.id} artifact={artifact} sourceContent={message.content} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function DepAIChat({ compact = false }: { compact?: boolean }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const hydratedConversationsRef = useRef(false)
  const processedInitialAskRef = useRef(false)
  const [conversations, setConversations] = useState<DepAIConversation[]>(initialConversations)
  const [activeConversationId, setActiveConversationId] = useState(initialConversations[0].id)
  const [input, setInput] = useState("")
  const [files, setFiles] = useState<DepAIFile[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [conversationToDelete, setConversationToDelete] = useState<DepAIConversation | null>(null)
  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? conversations[0]
  const messages = activeConversation.messages ?? []

  const conversationsQuery = useQuery({
    queryKey: ["depai", "conversations"],
    queryFn: listDepAIConversations,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  })

  const sendMutation = useMutation({
    mutationFn: sendDepAIMessage,
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Não foi possível consultar a DepAI."))
    },
  })

  const deleteConversationMutation = useMutation({
    mutationFn: deleteDepAIConversation,
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Não foi possível remover a conversa."))
    },
  })

  useEffect(() => {
    if (!conversationsQuery.data || hydratedConversationsRef.current) return

    hydratedConversationsRef.current = true
    setConversations((current) => {
      if (current.some((conversation) => conversation.messages.length > 0)) return current

      const activeConversation = current.find((conversation) => conversation.id === activeConversationId) ?? current[0] ?? createInitialConversation()
      const loadedHistory = conversationsQuery.data.filter(
        (conversation) => conversation.messages.length > 0 && conversation.id !== activeConversation.id,
      )

      return [activeConversation, ...loadedHistory]
    })
  }, [activeConversationId, conversationsQuery.data, conversationsQuery.dataUpdatedAt])

  useEffect(() => {
    if (conversationsQuery.error) {
      toast.error(getApiErrorMessage(conversationsQuery.error, "Não foi possível carregar o histórico da DepAI."))
    }
  }, [conversationsQuery.error])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages.length, sendMutation.isPending, activeConversationId])

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("depai:history-state", { detail: { open: historyOpen } }))
  }, [historyOpen])

  const sendMessage = useCallback((
    message: string,
    options?: {
      conversationId?: string
      files?: DepAIFile[]
      history?: DepAIMessage[]
    },
  ) => {
    const trimmed = message.trim()
    if (!trimmed || sendMutation.isPending) return false

    const conversationId = options?.conversationId ?? activeConversationId
    const messageFiles = options?.files ?? files
    const historyMessages = options?.history ?? messages
    const now = new Date().toISOString()

    const userMessage: DepAIMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      createdAt: now,
      files: messageFiles,
    }

    setConversations((current) => {
      const targetConversation = current.find((conversation) => conversation.id === conversationId) ?? {
        id: conversationId,
        title: "Nova conversa",
        updatedAt: now,
        messages: [],
      }
      const remainingConversations = current.filter((conversation) => conversation.id !== conversationId)

      return [
        {
          ...targetConversation,
          title: targetConversation.messages.length === 0 ? getConversationTitle(trimmed) : targetConversation.title,
          messages: [...targetConversation.messages, userMessage],
          updatedAt: now,
        },
        ...remainingConversations,
      ]
    })

    setActiveConversationId(conversationId)
    setInput("")
    setFiles([])
    setHistoryOpen(false)

    sendMutation.mutate({
      conversationId,
      message: trimmed,
      files: messageFiles,
      history: historyMessages.slice(-10).map((message) => ({
        role: message.role,
        content: message.content,
      })),
    }, {
      onSuccess: (response) => {
        setConversations((current) => {
          const remainingConversations = current.filter(
            (conversation) =>
              conversation.id !== conversationId &&
              conversation.id !== response.conversation.id &&
              conversation.messages.length > 0,
          )

          return [response.conversation, ...remainingConversations]
        })
        setActiveConversationId(response.conversation.id)
      },
    })

    return true
  }, [activeConversationId, files, messages, sendMutation])

  const submit = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    sendMessage(input)
  }

  const addFiles = async (selectedFiles: FileList | null) => {
    if (!selectedFiles) return
    try {
      const nextFiles = await Promise.all(Array.from(selectedFiles).map(mapFile))
      setFiles((current) => {
        const unique = new Map([...current, ...nextFiles].map((file) => [file.id, file]))
        return Array.from(unique.values()).slice(0, 6)
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível ler um dos arquivos anexados.")
    }
  }

  const removeFile = (id: string) => setFiles((current) => current.filter((item) => item.id !== id))

  const startNewConversation = () => {
    if (activeConversation.messages.length === 0) {
      setHistoryOpen(false)
      return
    }

    const conversation = createConversation()
    setConversations((current) => [conversation, ...current])
    setActiveConversationId(conversation.id)
    setInput("")
    setFiles([])
    setHistoryOpen(false)
  }

  const openConversation = (id: string) => {
    setActiveConversationId(id)
    setInput("")
    setFiles([])
    setHistoryOpen(false)
  }

  const confirmDeleteConversation = () => {
    if (!conversationToDelete || deleteConversationMutation.isPending) return
    const deletedConversation = conversationToDelete

    deleteConversationMutation.mutate(deletedConversation.id, {
      onSuccess: () => {
        const fallbackConversation = createInitialConversation()

        setConversations((current) => {
          const remaining = current.filter((conversation) => conversation.id !== deletedConversation.id)

          if (deletedConversation.id !== activeConversationId) {
            return remaining.length > 0 ? remaining : [fallbackConversation]
          }

          setActiveConversationId(fallbackConversation.id)
          return [fallbackConversation, ...remaining]
        })

        if (deletedConversation.id === activeConversationId) {
          setInput("")
          setFiles([])
        }

        setConversationToDelete(null)
        toast.success("Conversa removida.")
      },
    })
  }

  useEffect(() => {
    if (compact || processedInitialAskRef.current || typeof window === "undefined") return

    const ask = new URLSearchParams(window.location.search).get("ask")?.trim()
    if (!ask) return

    processedInitialAskRef.current = true
    const conversation = createConversation()
    sendMessage(ask, { conversationId: conversation.id, files: [], history: [] })
    window.history.replaceState(null, "", window.location.pathname)
  }, [compact, sendMessage])

  useEffect(() => {
    const handleNewConversation = () => startNewConversation()
    const handleToggleHistory = () => setHistoryOpen((current) => !current)
    const handleAsk = (event: Event) => {
      if (compact) return
      const message = (event as CustomEvent<{ message?: string }>).detail?.message?.trim()
      if (!message) return

      const conversation = createConversation()
      sendMessage(message, { conversationId: conversation.id, files: [], history: [] })
    }

    window.addEventListener("depai:new-conversation", handleNewConversation)
    window.addEventListener("depai:toggle-history", handleToggleHistory)
    window.addEventListener("depai:ask", handleAsk)

    return () => {
      window.removeEventListener("depai:new-conversation", handleNewConversation)
      window.removeEventListener("depai:toggle-history", handleToggleHistory)
      window.removeEventListener("depai:ask", handleAsk)
    }
  })
  if (compact) {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="h-[330px] overflow-y-auto">
          {messages.map((message) => <MessageRow key={message.id} message={message} />)}
          {sendMutation.isPending && <ThinkingMessage />}
          <div ref={messagesEndRef} />
        </div>
        <ChatComposer input={input} files={files} isPending={sendMutation.isPending} fileInputRef={fileInputRef} onInputChange={setInput} onSubmit={submit} onAddFiles={addFiles} onRemoveFile={removeFile} />
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden bg-background">
      <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden">

        <div className="flex-1 overflow-y-auto pb-36 pt-4">
          {messages.length === 0 && (
            <div className="mx-auto flex max-w-3xl flex-col items-center px-4 pb-4 pt-12 text-center">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <Bot className="h-7 w-7" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Como posso te ajudar hoje?</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                {"Pergunte algo para a DepAI ou envie um arquivo para preparar a análise com os dados do sistema."}
              </p>
              <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                {suggestions.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => setInput(suggestion)} className="rounded-2xl border border-border bg-card px-4 py-3 text-left text-sm text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground hover:shadow-sm">
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            {messages.map((message) => <MessageRow key={message.id} message={message} />)}
            {sendMutation.isPending && <ThinkingMessage />}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background to-background/0 px-4 pb-4 pt-10">
          <div className="mx-auto max-w-3xl">
            <ChatComposer input={input} files={files} isPending={sendMutation.isPending} fileInputRef={fileInputRef} onInputChange={setInput} onSubmit={submit} onAddFiles={addFiles} onRemoveFile={removeFile} />
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              {"A DepAI pode cometer erros. Confirme informações importantes antes de usar operacionalmente."}
            </p>
          </div>
        </div>
      </section>

      {historyOpen && (
        <button
          type="button"
          className="absolute inset-0 z-30 bg-background/65 backdrop-blur-[1px] md:hidden"
          onClick={() => setHistoryOpen(false)}
          aria-label="Fechar histórico"
        />
      )}

      <aside
        className={`absolute inset-y-0 right-0 z-40 h-full w-[min(calc(100vw-1.5rem),340px)] overflow-hidden bg-background/95 shadow-2xl shadow-black/10 backdrop-blur-sm transition-[opacity,transform] duration-300 ease-out md:relative md:inset-auto md:z-auto md:shrink-0 md:transition-[width,opacity,transform] md:shadow-none md:backdrop-blur-0 ${
          historyOpen
            ? "translate-x-0 opacity-100 md:w-[340px]"
            : "pointer-events-none translate-x-full opacity-0 md:pointer-events-auto md:w-0 md:translate-x-0 md:opacity-100"
        }`}
      >
        <div className="flex h-full w-[min(calc(100vw-1.5rem),340px)] flex-col p-4 md:w-[340px]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{"Histórico"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Continue uma conversa ou comece outra.</p>
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setHistoryOpen(false)} aria-label={"Fechar histórico"}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Button type="button" className="mb-4 w-full gap-2 rounded-2xl" onClick={startNewConversation}>
            <Plus className="h-4 w-4" />
            Nova conversa
          </Button>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {getVisibleConversations(conversations, activeConversationId).map((conversation) => {
              const isActive = conversation.id === activeConversationId
              const canDelete = conversation.messages.length > 0
              return (
                <div key={conversation.id} className="group relative">
                  <button type="button" onClick={() => openConversation(conversation.id)} className={`w-full rounded-2xl border px-3 py-3 pr-10 text-left transition-colors ${isActive ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted/60"}`}>
                    <p className="truncate text-sm font-medium text-foreground">{conversation.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{conversation.messages.length} mensagem(ns)</p>
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                      onClick={(event) => {
                        event.stopPropagation()
                        setConversationToDelete(conversation)
                      }}
                      aria-label="Remover conversa"
                      title="Remover conversa"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </aside>

      <ConfirmActionDialog
        open={Boolean(conversationToDelete)}
        title="Remover conversa"
        description="Esta conversa será removida do histórico da DepAI. Essa ação não pode ser desfeita."
        confirmLabel="Remover"
        busy={deleteConversationMutation.isPending}
        onOpenChange={(open) => {
          if (!open && !deleteConversationMutation.isPending) setConversationToDelete(null)
        }}
        onConfirm={confirmDeleteConversation}
      />
    </div>
  )
}

function ChatComposer({
  input,
  files,
  isPending,
  fileInputRef,
  onInputChange,
  onSubmit,
  onAddFiles,
  onRemoveFile,
}: {
  input: string
  files: DepAIFile[]
  isPending: boolean
  fileInputRef: RefObject<HTMLInputElement | null>
  onInputChange: (value: string) => void
  onSubmit: (event?: FormEvent<HTMLFormElement>) => void
  onAddFiles: (files: FileList | null) => void | Promise<void>
  onRemoveFile: (id: string) => void
}) {
  return (
    <form autoComplete="off" onSubmit={onSubmit} className="rounded-3xl border border-border bg-card p-2 shadow-xl shadow-black/5">
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 px-2 pt-1">
          {files.map((file) => (
            <span key={file.id} className="inline-flex items-center gap-2 rounded-2xl bg-muted px-3 py-1.5 text-xs text-muted-foreground">
              <FileIcon type={file.type} />
              <span className="max-w-[180px] truncate text-foreground">{file.name}</span>
              <span>{formatFileSize(file.size)}</span>
              <button type="button" onClick={() => onRemoveFile(file.id)} className="rounded-full p-0.5 transition-colors hover:bg-background" aria-label={`Remover ${file.name}`}>
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <input ref={fileInputRef} type="file" className="hidden" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" onChange={(event) => onAddFiles(event.target.files)} />
        <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full" onClick={() => fileInputRef.current?.click()}>
          <Plus className="h-5 w-5" />
        </Button>
        <Textarea value={input} onChange={(event) => onInputChange(event.target.value)} placeholder="Pergunte alguma coisa" className="max-h-40 min-h-10 flex-1 resize-none border-0 bg-transparent px-0 py-2 shadow-none focus-visible:ring-0" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSubmit() } }} />
        <Button type="submit" size="icon" className="h-10 w-10 shrink-0 rounded-full" disabled={!input.trim() || isPending}>
          {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </form>
  )
}
