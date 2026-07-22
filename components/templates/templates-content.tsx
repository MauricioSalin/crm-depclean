"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Braces, Copy, Download, Edit, Eye, FileText, ImageIcon, MoreHorizontal, PenTool, Search, Trash2, Upload, X } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast as sonnerToast } from "sonner"

import { DocxTemplateEditor, type DocxTemplateEditorRef } from "@/components/templates/docx-template-editor"
import {
  getTemplateVariableGroups,
} from "@/components/templates/template-variables"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog"
import { DataPagination } from "@/components/ui/data-pagination"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TableEmptyState } from "@/components/ui/empty-state"
import { TableSkeletonRows } from "@/components/ui/table-skeleton"
import { Input } from "@/components/ui/input"
import { FilterSearchInput } from "@/components/ui/filter-search-input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { listClients, type ClientRecord, type ClientUnitRecord } from "@/lib/api/clients"
import { listContracts, type ContractRecord } from "@/lib/api/contracts"
import { listEmployees } from "@/lib/api/employees"
import { listSchedules, type ScheduleRecord } from "@/lib/api/schedules"
import { listServices, type ServiceRecord } from "@/lib/api/services"
import { getOrganizationSettings, listClientTypes, type ClientTypeRecord, type OrganizationSettingsRecord } from "@/lib/api/settings"
import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  generateScheduleTemplatePreviewPdf,
  getTemplateById,
  listTemplates,
  type TemplateFormat,
  type TemplateKind,
  type TemplateRecord,
  updateTemplate,
  uploadTemplateBaseFile,
  uploadTemplateWatermarkFile,
} from "@/lib/api/templates"
import { buildApiFileUrl } from "@/lib/api/client"
import { getApiErrorMessage } from "@/lib/api/errors"
import { useHasAnyPermission } from "@/hooks/use-permissions"
import { BRASILIA_TIME_ZONE, formatCivilDate, formatCivilLongDate, parseCivilDate } from "@/lib/date-utils"
import { useMobileFiltersOpen } from "@/lib/hooks/use-mobile-filters"
import { useUrlQueryState } from "@/lib/hooks/use-url-query-state"
import { cn, formatContractNumber } from "@/lib/utils"

export type ContractTemplate = TemplateRecord

const TEMPLATE_CONFIG = {
  contract: {
    label: "Contrato",
    pluralLabel: "contratos",
    searchKey: "q",
    requiresSigner: true,
    signerLabel: "Assinante",
  },
  informative: {
    label: "Informativo",
    pluralLabel: "informativos",
    searchKey: "q-informativos",
    requiresSigner: false,
    signerLabel: "",
  },
  certificate: {
    label: "Certificado",
    pluralLabel: "certificados",
    searchKey: "q-certificados",
    requiresSigner: false,
    signerLabel: "",
  },
} as const satisfies Record<
  TemplateKind,
  {
    label: string
    pluralLabel: string
    searchKey: string
    requiresSigner: boolean
    signerLabel: string
  }
>

const FORM_SELECT_TRIGGER_CLASS_NAME = "w-full max-w-full min-w-0 [&>span]:min-w-0 [&>span]:truncate"
const FORM_SELECT_CONTENT_CLASS_NAME = "max-w-[var(--radix-select-trigger-width)]"

export interface EditorState {
  isOpen: boolean
  isEditing: boolean
  name: string
  canSave: boolean
  isSaving: boolean
  onSave: () => void
  onCancel: () => void
}

type TemplateFormState = {
  name: string
  description: string
  baseFileName: string
  format: TemplateFormat
  html: string
  signerId: string
  witnessSignerId: string
  isActive: boolean
  watermarkFileName: string
  watermarkFileUrl: string
  informativeSendDaysBefore: number
  certificateValidityMonths: number
}

function createEmptyTemplateFormState(): TemplateFormState {
  return {
    name: "",
    description: "",
    baseFileName: "",
    format: "docx",
    html: "",
    signerId: "",
    witnessSignerId: "",
    isActive: true,
    watermarkFileName: "",
    watermarkFileUrl: "",
    informativeSendDaysBefore: 1,
    certificateValidityMonths: 6,
  }
}

function createTemplateFormState(template: TemplateRecord): TemplateFormState {
  return {
    name: template.name,
    description: template.description,
    baseFileName: template.baseFileName || "",
    format: template.format || "docx",
    html: template.html || "",
    signerId: template.signerId,
    witnessSignerId: template.witnessSignerId || "",
    isActive: template.isActive,
    watermarkFileName: template.watermarkFileName || "",
    watermarkFileUrl: template.watermarkFileUrl || "",
    informativeSendDaysBefore: template.informativeSendDaysBefore ?? 1,
    certificateValidityMonths: template.certificateValidityMonths ?? 6,
  }
}

function serializeTemplateFormState(state: TemplateFormState) {
  return JSON.stringify(state)
}

type TemplateEditorTab = "editor" | "preview"

function getTemplateEditorTab(value: string | null): TemplateEditorTab {
  return value === "preview" ? "preview" : "editor"
}

interface TemplatesContentProps {
  kind: TemplateKind
  openImport?: boolean
  onImportChange?: (open: boolean) => void
  onEditorStateChange?: (state: EditorState) => void
  mobileTabs?: ReactNode
}

function getErrorMessage(error: unknown) {
  return getApiErrorMessage(error, "Não foi possível concluir a operação.")
}

function notify({
  title,
  description,
  variant,
}: {
  title: string
  description?: string
  variant?: "destructive"
}) {
  if (variant === "destructive") {
    sonnerToast.error(title, { description })
    return
  }

  sonnerToast.success(title, { description })
}

function formatDate(value?: string | Date | null) {
  return formatCivilDate(value, "")
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return ""
  const parsed = parseTemplateDate(value)
  if (Number.isNaN(parsed.getTime())) return ""
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRASILIA_TIME_ZONE,
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed)
}

function capitalizeFirstLetter(value: string) {
  return value ? value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1) : value
}

function formatRelativeUpdatedAt(value?: string | Date | null) {
  if (!value) return ""
  const parsed = parseTemplateDate(value)
  if (Number.isNaN(parsed.getTime())) return ""

  const diffMs = Math.max(0, Date.now() - parsed.getTime())
  const minutes = Math.floor(diffMs / 60_000)

  if (minutes < 1) return "Agora"
  if (minutes < 60) return capitalizeFirstLetter(`${minutes} ${minutes === 1 ? "minuto" : "minutos"} atrás`)

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return capitalizeFirstLetter(`${hours} ${hours === 1 ? "hora" : "horas"} atrás`)

  const days = Math.floor(hours / 24)
  if (days < 7) return capitalizeFirstLetter(`${days} ${days === 1 ? "dia" : "dias"} atrás`)

  if (days < 30) {
    const weeks = Math.floor(days / 7)
    return capitalizeFirstLetter(`${weeks} ${weeks === 1 ? "semana" : "semanas"} atrás`)
  }

  const months = Math.floor(days / 30)
  return capitalizeFirstLetter(`${months} ${months === 1 ? "mês" : "meses"} atrás`)
}

function formatLongDate(value: string | Date | null | undefined = new Date()) {
  return formatCivilLongDate(value, "").replace(/ de ([a-zà-ú])/i, (_match, letter: string) => ` de ${letter.toLocaleUpperCase("pt-BR")}`)
}

function parseTemplateDate(value: string | Date) {
  if (value instanceof Date) return value
  const parsedCivilDate = /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseCivilDate(value) : null
  return parsedCivilDate ?? new Date(value)
}

function formatValidityText(value?: number | null) {
  const months = Math.max(1, Math.trunc(Number(value ?? 6) || 6))
  return `${String(months).padStart(2, "0")} ${months === 1 ? "mês" : "meses"}`
}

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(Number(value ?? 0))
}

function formatCnpj(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "").slice(0, 14)
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
}

function formatCpf(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "").slice(0, 11)
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2")
}

function getUnitAddress(unit?: ClientUnitRecord | null) {
  if (!unit?.address) return ""

  const { street, number, complement, neighborhood, city, state, zipCode } = unit.address
  return `${street}, ${number}${complement ? ` - ${complement}` : ""} - ${neighborhood} - ${city}/${state}${zipCode ? `, CEP ${zipCode}` : ""}`
}

function getUnitAddressFull(unit?: ClientUnitRecord | null) {
  if (!unit?.address) return ""

  const { street, number, neighborhood, city, state } = unit.address
  return `${street}, ${number}, Bairro ${neighborhood}, ${city}/${state}`
}

function getOrganizationAddress(settings?: OrganizationSettingsRecord | null) {
  const address = settings?.address
  if (!address) return ""

  const streetLine = [address.street, address.number].filter(Boolean).join(", ")
  return [
    streetLine,
    address.complement,
    address.neighborhood ? `Bairro ${address.neighborhood}` : "",
    [address.city, address.state].filter(Boolean).join("/"),
    address.zipCode ? `CEP ${address.zipCode}` : "",
  ]
    .filter(Boolean)
    .join(" - ")
}

function getPrimaryUnit(client?: ClientRecord | null, unitIds: string[] = []) {
  if (!client) return null
  return (
    client.units.find((unit) => unitIds.includes(unit.id)) ??
    client.units.find((unit) => unit.isPrimary) ??
    client.units[0] ??
    null
  )
}

function recurrenceLabel(value?: string | null) {
  const labels: Record<string, string> = {
    annual: "Anual",
    biweekly: "Quinzenal",
    bimonthly: "Bimestral",
    monthly: "Mensal",
    quarterly: "Trimestral",
    semiannual: "Semestral",
    weekly: "Semanal",
  }

  return labels[value ?? ""] ?? value ?? ""
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function capitalizeFirst(value?: string | null) {
  const normalized = (value ?? "").trim()
  if (!normalized) return "Cliente"
  return normalized.charAt(0).toLocaleUpperCase("pt-BR") + normalized.slice(1)
}

function buildRecurrenceConditionLabel(
  clientTypeName: string,
  rule: ContractRecord["recurrenceRules"][number],
  previousMaxUnits?: number,
) {
  const typeName = capitalizeFirst(clientTypeName)

  if (rule.type === "above") {
    return `${typeName} acima de ${rule.minUnits} unidades`
  }

  if (rule.minUnits <= 1) {
    return `${typeName} com até ${rule.maxUnits} unidades`
  }

  const startUnits = previousMaxUnits && previousMaxUnits > 0 ? previousMaxUnits : rule.minUnits
  return `${typeName} de ${startUnits} a ${rule.maxUnits} unidades`
}

function buildRecurrenceTableHtml(clientTypeName: string, rules: ContractRecord["recurrenceRules"] = []) {
  const sortedRules = [...rules].sort((current, next) => {
    if (current.minUnits !== next.minUnits) return current.minUnits - next.minUnits
    return current.maxUnits - next.maxUnits
  })

  const rows = sortedRules.length
    ? sortedRules
    : [
        { type: "range" as const, minUnits: 1, maxUnits: 200, recurrence: "semiannual" },
        { type: "range" as const, minUnits: 200, maxUnits: 300, recurrence: "quarterly" },
        { type: "above" as const, minUnits: 300, maxUnits: 999999, recurrence: "monthly" },
      ]

  let previousRangeMax = 0
  const tableRows = rows
    .map((rule) => {
      const condition = buildRecurrenceConditionLabel(clientTypeName, rule, previousRangeMax)
      if (rule.type === "range") previousRangeMax = rule.maxUnits
      const visitLabel = `Visita ${recurrenceLabel(rule.recurrence).toLocaleLowerCase("pt-BR")}`

      return `<tr><td style="border:1px solid #000;padding:4px 8px;font-weight:700;">${escapeHtml(condition)}</td><td style="border:1px solid #000;padding:4px 8px;font-weight:700;">${escapeHtml(visitLabel)}</td></tr>`
    })
    .join("")

  return `<table style="border-collapse:collapse;width:100%;max-width:520px;"><tbody>${tableRows}</tbody></table>`
}

function buildServiceSectionsText(contract: ContractRecord, services: ServiceRecord[]) {
  return contract.services
    .map((item, index) => {
      const service = services.find((candidate) => candidate.id === item.serviceTypeId)
      const serviceName = service?.name ?? "Serviço"
      const clauses = item.clauses?.length
        ? item.clauses.map((clause, clauseIndex) => `${index + 1}.${clauseIndex + 1}. ${clause}`).join("\n")
        : `${index + 1}.1. Cláusulas específicas não informadas para este serviço.`

      return `${index + 1}. ${serviceName}\n${clauses}`
    })
    .join("\n\n")
}

function buildServiceSectionsHtml(contract: ContractRecord, services: ServiceRecord[]) {
  return contract.services
    .map((item, index) => {
      const service = services.find((candidate) => candidate.id === item.serviceTypeId)
      const serviceName = service?.name ?? "Serviço"
      const clauses = item.clauses?.length
        ? item.clauses.map((clause, clauseIndex) => `<p><strong>${index + 1}.${clauseIndex + 1}.</strong> ${escapeHtml(clause)}</p>`).join("")
        : `<p><strong>${index + 1}.1.</strong> Cláusulas específicas não informadas para este serviço.</p>`

      return `<p><strong>${index + 1}. ${escapeHtml(serviceName)}</strong></p>${clauses}`
    })
    .join("")
}

function buildReservoirRows(unit?: ClientUnitRecord | null) {
  const entries = unit?.reservoirProfile?.entries ?? []
  return Array.from({ length: 5 }, (_, index) => entries[index] ?? { label: "", capacityLiters: "" })
}

function buildPreviewVariables(params: {
  client?: ClientRecord
  clientTypes: ClientTypeRecord[]
  contract?: ContractRecord
  employeeCpf?: string
  employeeName?: string
  employeeRole?: string
  kind: TemplateKind
  organizationSettings?: OrganizationSettingsRecord | null
  certificateValidityMonths?: number
  schedule?: ScheduleRecord
  services: ServiceRecord[]
}) {
  const { client, clientTypes, contract, employeeCpf, employeeName, employeeRole, kind, organizationSettings, certificateValidityMonths, schedule, services } = params
  if (!client) return null

  const unit = contract
    ? getPrimaryUnit(client, contract.unitIds)
    : getPrimaryUnit(client, schedule?.unitId ? [schedule.unitId] : [])
  const service = schedule ? services.find((item) => item.id === schedule.serviceTypeId) : null
  const scheduleDate = formatDate(schedule?.date)
  const scheduleTime = (schedule?.time || "08:00").replace(":00", "h")
  const reservoirRows = buildReservoirRows(unit)
  const unitValidityMonths = Math.max(1, Math.trunc(Number(unit?.reservoirProfile?.validityMonths ?? 6) || 6))
  const templateValidityMonths = Math.max(1, Math.trunc(Number(certificateValidityMonths ?? 6) || 6))
  const downPaymentValue = contract?.downPaymentValue ?? 0
  const hasDownPayment = Boolean(contract && downPaymentValue > 0 && contract.installmentsCount > 1)
  const remainingInstallmentsCount = contract
    ? hasDownPayment
      ? contract.installmentsCount - 1
      : contract.installmentsCount
    : 0
  const installmentValue = contract
    ? hasDownPayment
      ? contract.installments.find((item) => item.number === 2)?.value ?? (contract.totalValue - downPaymentValue) / remainingInstallmentsCount
      : contract.installmentsCount > 0
        ? contract.totalValue / contract.installmentsCount
        : contract.totalValue
    : 0
  const firstInstallmentValue = hasDownPayment ? downPaymentValue : installmentValue
  const contractServiceNames =
    contract?.services
      .map((item) => services.find((serviceItem) => serviceItem.id === item.serviceTypeId)?.name)
      .filter(Boolean)
      .join(", ") || ""
  const serviceSectionsText = contract ? buildServiceSectionsText(contract, services) : ""
  const serviceSectionsHtml = contract ? buildServiceSectionsHtml(contract, services) : ""
  const clientTypeName = clientTypes.find((item) => item.id === client.clientTypeId)?.name ?? "Cliente"

  const base = {
    client: {
      address: getUnitAddress(unit),
      assessor: {
        cpf: formatCpf(client.assessor?.cpf ?? ""),
        email: client.assessor?.email ?? "",
        name: client.assessor?.name ?? "",
        phone: client.assessor?.phone ?? "",
      },
      cnpj: formatCnpj(client.cnpj),
      companyName: client.companyName,
      email: client.email,
      phone: client.phone,
      responsibleCpf: formatCpf(client.responsibleCpf),
      responsibleName: client.responsibleName,
      syndic: {
        cpf: formatCpf(client.syndic?.cpf ?? ""),
        email: client.syndic?.email ?? "",
        name: client.syndic?.name ?? "",
        phone: client.syndic?.phone ?? "",
      },
    },
    contractor: {
      address: getOrganizationAddress(organizationSettings),
      cnpj: formatCnpj(organizationSettings?.cnpj),
      email: organizationSettings?.email ?? "",
      legalName: organizationSettings?.legalName ?? "",
      phone: organizationSettings?.phone ?? "",
      signerCpf: formatCpf(employeeCpf),
      signerName: employeeName || "",
      signerRole: employeeRole || "",
    },
    document: {
      generatedDate: formatDate(new Date()),
      generatedDateLong: formatLongDate(),
    },
    service: {
      name: service?.name ?? contractServiceNames,
      description: service?.description ?? "",
    },
    unit: {
      address: {
        city: unit?.address.city ?? "",
        cityState: unit ? `${unit.address.city}/${unit.address.state}` : "",
        full: getUnitAddressFull(unit),
        neighborhood: unit?.address.neighborhood ?? "",
        number: unit?.address.number ?? "",
        state: unit?.address.state ?? "",
        street: unit?.address.street ?? "",
        zipCode: unit?.address.zipCode ?? "",
      },
      name: unit?.name ?? "",
      reservoirProfile: {
        observations: unit?.reservoirProfile?.observations ?? "",
        validityMonths: String(unitValidityMonths),
      },
    },
  }

  if (kind === "contract" && contract) {
    return {
      ...base,
      contract: {
        createdAt: formatDate(contract.createdAt),
        createdAtLong: formatLongDate(contract.createdAt),
        durationMonths: String(contract.duration),
        endDate: formatDate(contract.endDate),
        endDateLong: formatLongDate(contract.endDate),
        firstDueDate: formatDate(contract.installments[0]?.dueDate),
        firstDueDateLong: formatLongDate(contract.installments[0]?.dueDate),
        downPaymentValue: formatCurrency(downPaymentValue),
        firstInstallmentValue: formatCurrency(firstInstallmentValue),
        installmentValue: formatCurrency(installmentValue),
        installmentsCount: String(contract.installmentsCount),
        remainingInstallmentsCount: String(hasDownPayment ? remainingInstallmentsCount : 0),
        number: formatContractNumber(contract.contractNumber),
        paymentDay: String(contract.paymentDay).padStart(2, "0"),
        recurrence: recurrenceLabel(contract.recurrence),
        recurrenceTable: buildRecurrenceTableHtml(clientTypeName, contract.recurrenceRules),
        startDate: formatDate(contract.startDate),
        startDateLong: formatLongDate(contract.startDate),
        totalValue: formatCurrency(contract.totalValue),
      },
      services: {
        names: contractServiceNames,
        sectionsHtml: serviceSectionsHtml,
        sectionsText: serviceSectionsText,
        summary: contractServiceNames.toLowerCase(),
      },
    }
  }

  return {
    ...base,
    certificate: {
      executionDatesText: scheduleDate,
      observations: unit?.reservoirProfile?.observations || schedule?.notes || "",
      reservoirRow1Capacity: reservoirRows[0]?.capacityLiters ?? "",
      reservoirRow1Label: reservoirRows[0]?.label ?? "",
      reservoirRow2Capacity: reservoirRows[1]?.capacityLiters ?? "",
      reservoirRow2Label: reservoirRows[1]?.label ?? "",
      reservoirRow3Capacity: reservoirRows[2]?.capacityLiters ?? "",
      reservoirRow3Label: reservoirRows[2]?.label ?? "",
      reservoirRow4Capacity: reservoirRows[3]?.capacityLiters ?? "",
      reservoirRow4Label: reservoirRows[3]?.label ?? "",
      reservoirRow5Capacity: reservoirRows[4]?.capacityLiters ?? "",
      reservoirRow5Label: reservoirRows[4]?.label ?? "",
      validityText: formatValidityText(templateValidityMonths),
    },
    schedule: {
      date: scheduleDate,
      duration: schedule ? `${schedule.duration} min` : "",
      time: scheduleTime,
    },
  }
}

export function TemplatesContent({ kind, openImport, onImportChange, onEditorStateChange, mobileTabs }: TemplatesContentProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const mobileFiltersOpen = useMobileFiltersOpen()
  const config = TEMPLATE_CONFIG[kind]
  const canManageTemplates = useHasAnyPermission(["templates_manage"])
  const docxEditorRef = useRef<DocxTemplateEditorRef | null>(null)
  const closingEditorRef = useRef(false)
  const initialFormSnapshotRef = useRef(serializeTemplateFormState(createEmptyTemplateFormState()))
  const routeTemplateId = searchParams.get("template")
  const routeTemplateMode = searchParams.get("templateMode")
  const routeEditorTab = getTemplateEditorTab(searchParams.get("view"))
  const [searchTerm, setSearchTerm] = useUrlQueryState(config.searchKey)
  const [editingTemplate, setEditingTemplate] = useState<TemplateRecord | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [editorTab, setEditorTab] = useState<TemplateEditorTab>("editor")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null)
  const [previewClientId, setPreviewClientId] = useState("")
  const [previewDocumentId, setPreviewDocumentId] = useState("")
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [selectedWatermarkFile, setSelectedWatermarkFile] = useState<File | null>(null)
  const [selectedWatermarkPreviewUrl, setSelectedWatermarkPreviewUrl] = useState("")
  const [isDocumentDirty, setIsDocumentDirty] = useState(false)
  const [discardChangesOpen, setDiscardChangesOpen] = useState(false)

  const [formData, setFormData] = useState<TemplateFormState>(() => createEmptyTemplateFormState())

  const templatesQuery = useQuery({
    queryKey: ["templates", kind, searchTerm],
    queryFn: () => listTemplates(searchTerm, kind),
  })

  const employeesQuery = useQuery({
    queryKey: ["employees", "catalog"],
    queryFn: () => listEmployees(""),
  })

  const clientsQuery = useQuery({
    enabled: isEditorOpen,
    queryKey: ["clients", "templates-preview"],
    queryFn: () => listClients(""),
  })

  const contractsQuery = useQuery({
    enabled: isEditorOpen,
    queryKey: ["contracts", "templates-preview"],
    queryFn: () => listContracts(""),
  })

  const schedulesQuery = useQuery({
    enabled: isEditorOpen,
    queryKey: ["schedules", "templates-preview"],
    queryFn: () => listSchedules({}),
  })

  const servicesQuery = useQuery({
    enabled: isEditorOpen,
    queryKey: ["services", "templates-preview"],
    queryFn: () => listServices(""),
  })

  const clientTypesQuery = useQuery({
    enabled: isEditorOpen,
    queryKey: ["client-types", "templates-preview"],
    queryFn: () => listClientTypes(""),
  })

  const organizationSettingsQuery = useQuery({
    enabled: isEditorOpen,
    queryKey: ["organization-settings", "templates-preview"],
    queryFn: () => getOrganizationSettings(),
  })

  const templates = templatesQuery.data?.data ?? []
  const tableColumnCount = (config.requiresSigner ? 5 : 3) + (canManageTemplates ? 1 : 0)
  const totalPages = Math.max(1, Math.ceil(templates.length / pageSize))
  const paginatedTemplates = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return templates.slice(start, start + pageSize)
  }, [currentPage, pageSize, templates])
  const routeTemplateFromList = routeTemplateId ? templates.find((template) => template.id === routeTemplateId) : null

  const routeTemplateQuery = useQuery({
    enabled: Boolean(routeTemplateId && !routeTemplateFromList),
    queryKey: ["template", routeTemplateId],
    queryFn: () => getTemplateById(routeTemplateId ?? ""),
  })

  const routeTemplate = routeTemplateFromList ?? routeTemplateQuery.data?.data ?? null
  const employees = employeesQuery.data?.data ?? []
  const clients = clientsQuery.data?.data ?? []
  const contracts = contractsQuery.data?.data ?? []
  const schedules = schedulesQuery.data?.data ?? []
  const services = servicesQuery.data?.data ?? []
  const clientTypes = clientTypesQuery.data?.data.items ?? []
  const organizationSettings = organizationSettingsQuery.data?.data ?? null
  const variableGroups = useMemo(() => getTemplateVariableGroups(kind), [kind])
  const watermarkImageUrl = selectedWatermarkPreviewUrl || (formData.watermarkFileUrl ? buildApiFileUrl(formData.watermarkFileUrl) : "")

  const previewClient = clients.find((client) => client.id === previewClientId)
  const previewContracts = contracts.filter((contract) => contract.clientId === previewClientId)
  const previewSchedules = schedules.filter((schedule) => schedule.clientId === previewClientId)
  const activeEmployeeOptions = employees
    .filter((employee) => employee.status === "active")
    .map((employee) => ({ value: employee.id, label: employee.name }))
  const selectedPreviewContract = contracts.find((contract) => contract.id === previewDocumentId)
  const selectedPreviewSchedule = schedules.find((schedule) => schedule.id === previewDocumentId)
  const templateSigner = employees.find((employee) => employee.id === formData.signerId)
  const previewVariables = useMemo(
    () =>
      buildPreviewVariables({
        client: previewClient,
        clientTypes,
        contract: kind === "contract" ? selectedPreviewContract : undefined,
        employeeCpf: templateSigner?.cpf,
        employeeName: templateSigner?.name,
        employeeRole: templateSigner?.role,
        kind,
        organizationSettings,
        certificateValidityMonths: formData.certificateValidityMonths,
        schedule: kind === "contract" ? undefined : selectedPreviewSchedule,
        services,
      }),
    [clientTypes, formData.certificateValidityMonths, kind, organizationSettings, previewClient, selectedPreviewContract, selectedPreviewSchedule, services, templateSigner],
  )
  const previewDataKey = [
    kind,
    previewClientId,
    previewDocumentId,
    formData.certificateValidityMonths,
    clientsQuery.dataUpdatedAt,
    contractsQuery.dataUpdatedAt,
    clientTypesQuery.dataUpdatedAt,
    organizationSettingsQuery.dataUpdatedAt,
    schedulesQuery.dataUpdatedAt,
    servicesQuery.dataUpdatedAt,
  ].join(":")
  const currentFormSnapshot = useMemo(() => serializeTemplateFormState(formData), [formData])
  const hasUnsavedTemplateChanges =
    isEditorOpen &&
    (currentFormSnapshot !== initialFormSnapshotRef.current || Boolean(selectedWatermarkFile) || isDocumentDirty)

  const replaceRouteParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())

      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          params.set(key, value)
        } else {
          params.delete(key)
        }
      })

      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  useEffect(() => {
    return () => {
      if (selectedWatermarkPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(selectedWatermarkPreviewUrl)
      }
    }
  }, [selectedWatermarkPreviewUrl])

  useEffect(() => {
    setEditingTemplate(null)
    setIsEditorOpen(false)
    setIsImportOpen(false)
    setEditorTab("editor")
    setCurrentPage(1)
    setPreviewClientId("")
    setPreviewDocumentId("")
    setSelectedWatermarkFile(null)
    setSelectedWatermarkPreviewUrl("")
    setIsDocumentDirty(false)
    setDiscardChangesOpen(false)
    const emptyForm = createEmptyTemplateFormState()
    initialFormSnapshotRef.current = serializeTemplateFormState(emptyForm)
    setFormData(emptyForm)
  }, [kind])

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  useEffect(() => {
    if (closingEditorRef.current) {
      if (!routeTemplateId && routeTemplateMode !== "new") {
        closingEditorRef.current = false
      }

      return
    }

    if (routeTemplateId) {
      if (!canManageTemplates) {
        replaceRouteParams({ template: null, templateMode: null, view: null })
        return
      }

      if (!routeTemplate || routeTemplate.kind !== kind) return

      if (isEditorOpen && editingTemplate?.id === routeTemplate.id) {
        setEditorTab((current) => (current === routeEditorTab ? current : routeEditorTab))
        return
      }

      openTemplateEditor(routeTemplate, routeEditorTab)
      return
    }

    if (routeTemplateMode === "new") {
      if (!canManageTemplates) {
        replaceRouteParams({ template: null, templateMode: null, view: null })
        return
      }

      if (isEditorOpen && !editingTemplate) {
        setEditorTab((current) => (current === routeEditorTab ? current : routeEditorTab))
        return
      }

      openNewTemplateEditor(routeEditorTab)
    }
  }, [canManageTemplates, editingTemplate, isEditorOpen, kind, replaceRouteParams, routeEditorTab, routeTemplate, routeTemplateId, routeTemplateMode])

  useEffect(() => {
    setPreviewDocumentId("")
  }, [kind, previewClientId])

  function prepareNewTemplateForm() {
    const emptyForm = createEmptyTemplateFormState()
    setEditingTemplate(null)
    setSelectedWatermarkFile(null)
    setSelectedWatermarkPreviewUrl("")
    setIsDocumentDirty(false)
    setDiscardChangesOpen(false)
    initialFormSnapshotRef.current = serializeTemplateFormState(emptyForm)
    setFormData(emptyForm)
  }

  useEffect(() => {
    if (!openImport) return

    if (!canManageTemplates) {
      onImportChange?.(false)
      return
    }

    prepareNewTemplateForm()
    setIsImportOpen(true)
    onImportChange?.(false)
  }, [canManageTemplates, onImportChange, openImport])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!canManageTemplates) {
        throw new Error("Sem permissao para gerenciar templates.")
      }

      const docxFile = await docxEditorRef.current?.saveToFile()

      if (!docxFile) {
        throw new Error("O editor DOCX ainda não carregou o documento para salvar.")
      }

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        kind,
        format: "docx" as const,
        html: formData.html,
        signerId: config.requiresSigner ? formData.signerId : "",
        witnessSignerId: config.requiresSigner ? formData.witnessSignerId : "",
        baseFileName: docxFile.name,
        isActive: formData.isActive,
        watermarkFileName: formData.watermarkFileName,
        informativeSendDaysBefore: kind === "informative" ? formData.informativeSendDaysBefore : 0,
        certificateValidityMonths: kind === "certificate" ? formData.certificateValidityMonths : 6,
      }

      let template = editingTemplate
        ? (await updateTemplate(editingTemplate.id, payload)).data
        : (await createTemplate(payload)).data

      if (selectedWatermarkFile) {
        template = (await uploadTemplateWatermarkFile(template.id, selectedWatermarkFile)).data
      }

      const uploadResponse = await uploadTemplateBaseFile(template.id, docxFile)
      return uploadResponse.data
    },
    onSuccess: (savedTemplate) => {
      notify({
        title: editingTemplate ? "Template atualizado" : "Template criado",
        description: "O template foi salvo com sucesso.",
      })
      queryClient.invalidateQueries({ queryKey: ["templates"] })
      setEditingTemplate(savedTemplate)
      setFormData((current) => {
        const nextFormData = {
          ...createTemplateFormState(savedTemplate),
          baseFileName: savedTemplate.baseFileName || current.baseFileName,
          informativeSendDaysBefore: savedTemplate.informativeSendDaysBefore ?? current.informativeSendDaysBefore,
          certificateValidityMonths: savedTemplate.certificateValidityMonths ?? current.certificateValidityMonths,
        }
        initialFormSnapshotRef.current = serializeTemplateFormState(nextFormData)
        return nextFormData
      })
      setSelectedWatermarkFile(null)
      setSelectedWatermarkPreviewUrl("")
      setIsDocumentDirty(false)
      setDiscardChangesOpen(false)
      replaceRouteParams({
        template: savedTemplate.id,
        templateMode: null,
        view: editorTab,
      })
    },
    onError: (error) => {
      notify({
        title: "Erro ao salvar template",
        description: getErrorMessage(error),
        variant: "destructive",
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!canManageTemplates) {
        throw new Error("Sem permissao para gerenciar templates.")
      }

      return deleteTemplate(id)
    },
    onSuccess: () => {
      notify({
        title: "Template excluído",
        description: "O template foi removido com sucesso.",
      })
      queryClient.invalidateQueries({ queryKey: ["templates"] })
      setPendingDelete(null)
    },
    onError: (error) => {
      notify({
        title: "Não foi possível excluir o template",
        description: getErrorMessage(error),
        variant: "destructive",
      })
    },
  })

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!canManageTemplates) {
        throw new Error("Sem permissao para gerenciar templates.")
      }

      return duplicateTemplate(id)
    },
    onSuccess: (response) => {
      notify({
        title: "Template duplicado",
        description: `Novo template criado como "${response.data.name}".`,
      })
      queryClient.invalidateQueries({ queryKey: ["templates"] })
      setCurrentPage(1)
    },
    onError: (error) => {
      notify({
        title: "Não foi possível duplicar o template",
        description: getErrorMessage(error),
        variant: "destructive",
      })
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => {
      if (!canManageTemplates) {
        throw new Error("Sem permissao para gerenciar templates.")
      }

      return updateTemplate(id, { isActive })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] })
    },
    onError: (error) => {
      notify({
        title: "Não foi possível atualizar o status",
        description: getErrorMessage(error),
        variant: "destructive",
      })
    },
  })

  useEffect(() => {
    onEditorStateChange?.({
      isOpen: isEditorOpen,
      isEditing: Boolean(editingTemplate),
      name: formData.name,
      canSave: canManageTemplates && Boolean(formData.name.trim() && (!config.requiresSigner || formData.signerId)) && !saveMutation.isPending,
      isSaving: saveMutation.isPending,
      onSave: handleSave,
      onCancel: handleCancel,
    })
  })

  function openTemplateEditor(template: TemplateRecord, nextTab: TemplateEditorTab = "editor") {
    const nextFormData = createTemplateFormState(template)
    closingEditorRef.current = false
    setEditingTemplate(template)
    setSelectedWatermarkFile(null)
    setSelectedWatermarkPreviewUrl("")
    setIsDocumentDirty(false)
    setDiscardChangesOpen(false)
    initialFormSnapshotRef.current = serializeTemplateFormState(nextFormData)
    setFormData(nextFormData)
    setEditorTab(nextTab)
    setPreviewClientId("")
    setPreviewDocumentId("")
    setIsEditorOpen(true)
  }

  function openNewTemplateEditor(nextTab: TemplateEditorTab = "editor") {
    const emptyForm = createEmptyTemplateFormState()
    closingEditorRef.current = false
    setEditingTemplate(null)
    setSelectedWatermarkFile(null)
    setSelectedWatermarkPreviewUrl("")
    setIsDocumentDirty(false)
    setDiscardChangesOpen(false)
    initialFormSnapshotRef.current = serializeTemplateFormState(emptyForm)
    setFormData(emptyForm)
    setEditorTab(nextTab)
    setPreviewClientId("")
    setPreviewDocumentId("")
    setIsEditorOpen(true)
  }

  function handleEdit(template: TemplateRecord) {
    if (!canManageTemplates) return

    openTemplateEditor(template, "editor")
    replaceRouteParams({
      template: template.id,
      templateMode: null,
      view: "editor",
    })
  }

  function handleImportSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canManageTemplates) return

    if (!formData.name.trim()) {
      notify({
        title: "Informe o nome do template",
        description: "O nome é obrigatório para identificar este template no sistema.",
        variant: "destructive",
      })
      return
    }

    if (config.requiresSigner && !formData.signerId) {
      notify({
        title: `Selecione ${config.signerLabel.toLowerCase()}`,
        description: "Este template exige um funcionário responsável pela assinatura.",
        variant: "destructive",
      })
      return
    }

    if (kind === "informative" && (!Number.isInteger(formData.informativeSendDaysBefore) || formData.informativeSendDaysBefore < 0)) {
      notify({
        title: "Prazo de envio inválido",
        description: "Informe uma quantidade inteira de dias, igual ou maior que zero.",
        variant: "destructive",
      })
      return
    }

    if (kind === "certificate" && (!Number.isInteger(formData.certificateValidityMonths) || formData.certificateValidityMonths < 1)) {
      notify({
        title: "Validade inválida",
        description: "Informe uma validade inteira de pelo menos 1 mês.",
        variant: "destructive",
      })
      return
    }

    setIsImportOpen(false)
    closingEditorRef.current = false
    setEditingTemplate(null)
    setIsDocumentDirty(false)
    setDiscardChangesOpen(false)
    initialFormSnapshotRef.current = serializeTemplateFormState(formData)
    setEditorTab("editor")
    setPreviewClientId("")
    setPreviewDocumentId("")
    setIsEditorOpen(true)
    replaceRouteParams({
      template: null,
      templateMode: "new",
      view: "editor",
    })
  }

  function handleSave() {
    if (saveMutation.isPending) return

    if (!canManageTemplates) {
      notify({
        title: "Sem permissao",
        description: "Seu perfil nao permite gerenciar templates.",
      })
      return
    }

    if (!formData.name.trim()) {
      notify({
        title: "Nome obrigatório",
        description: "Preencha o nome do template antes de salvar.",
      })
      return
    }

    if (config.requiresSigner && !formData.signerId) {
      notify({
        title: "Assinante obrigatório",
        description: "Selecione o assinante do template antes de salvar.",
      })
      return
    }

    const loadingToast = sonnerToast.loading("Salvando template...", {
      description: "Gerando o DOCX atual e enviando para a API.",
    })

    saveMutation.mutate(undefined, {
      onSettled: () => sonnerToast.dismiss(loadingToast),
    })
  }

  function closeTemplateEditor() {
    closingEditorRef.current = true
    setIsEditorOpen(false)
    setEditingTemplate(null)
    setIsDocumentDirty(false)
    setDiscardChangesOpen(false)
    replaceRouteParams({
      tab: kind,
      template: null,
      templateMode: null,
      view: null,
    })
  }

  function handleCancel() {
    if (saveMutation.isPending) return

    if (hasUnsavedTemplateChanges) {
      setDiscardChangesOpen(true)
      return
    }

    closeTemplateEditor()
  }

  function handleConfirmDiscardChanges() {
    closeTemplateEditor()
  }

  function handleEditorTabChange(nextTab: TemplateEditorTab) {
    if (nextTab !== "preview" || editorTab === "preview") {
      setEditorTab(nextTab)
      replaceRouteParams({ view: nextTab })
      return
    }

    const previewPromise = docxEditorRef.current?.refreshPreview()
    if (!previewPromise) {
      setEditorTab("preview")
      replaceRouteParams({ view: "preview" })
      return
    }

    void previewPromise
      .then(() => {
        setEditorTab("preview")
        replaceRouteParams({ view: "preview" })
      })
      .catch((error) => {
        notify({
          title: "Não foi possível atualizar a prévia",
          description: getErrorMessage(error),
          variant: "destructive",
        })
      })
  }

  function handleInsertVariable(path: string) {
    try {
      docxEditorRef.current?.insertVariable(path)
      notify({
        title: "Variável inserida",
        description: path,
      })
    } catch (error) {
      notify({
        title: "Não foi possível inserir a variável",
        description: getErrorMessage(error),
        variant: "destructive",
      })
    }
  }

  function handleSelectVariable(path: string) {
    handleInsertVariable(path)
  }

  function handleSelectVariablePath(_path: string) {}

  function handleWatermarkFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file) return

    if (!file.type.startsWith("image/")) {
      notify({
        title: "Imagem inválida",
        description: "Selecione uma imagem PNG, JPG ou WEBP.",
        variant: "destructive",
      })
      return
    }

    setSelectedWatermarkFile(file)
    setSelectedWatermarkPreviewUrl(URL.createObjectURL(file))
    setFormData((current) => ({
      ...current,
      watermarkFileName: file.name,
    }))
  }

  function handleRemoveWatermark() {
    setSelectedWatermarkFile(null)
    setSelectedWatermarkPreviewUrl("")
    setFormData((current) => ({
      ...current,
      watermarkFileName: "",
      watermarkFileUrl: "",
    }))
  }

  async function handleGeneratePreviewPdf() {
    try {
      setIsGeneratingPdf(true)
      let file: File | undefined

      if (kind === "contract") {
        file = await docxEditorRef.current?.generatePreviewPdf({ previewWatermark: true })
      } else {
        if (!previewDocumentId) {
          throw new Error("Selecione um cliente e um agendamento para gerar o PDF exatamente como ele será enviado.")
        }

        const docxFile = await docxEditorRef.current?.saveToFile()
        if (!docxFile) {
          throw new Error("O documento ainda não está pronto para gerar a prévia.")
        }

        file = await generateScheduleTemplatePreviewPdf({
          scheduleId: previewDocumentId,
          kind,
          templateId: editingTemplate?.id,
          certificateValidityMonths: formData.certificateValidityMonths,
          file: docxFile,
          watermarkFile: selectedWatermarkFile,
        })

        const objectUrl = window.URL.createObjectURL(file)
        const anchor = document.createElement("a")
        anchor.href = objectUrl
        anchor.download = file.name
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        window.URL.revokeObjectURL(objectUrl)
      }

      notify({
        title: "PDF gerado para teste",
        description: file
          ? kind === "contract"
            ? `Arquivo ${file.name} baixado com a prévia atual.`
            : `Arquivo ${file.name} baixado com o mesmo motor usado no envio.`
          : "A prévia ainda não carregou.",
      })
    } catch (error) {
      notify({
        title: "Erro ao gerar PDF",
        description: getErrorMessage(error),
        variant: "destructive",
      })
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const getSignerName = (id?: string, fallback?: string | null) => fallback || employees.find((employee) => employee.id === id)?.name || "-"

  if (isEditorOpen) {
    return (
      <>
      <ConfirmActionDialog
        open={discardChangesOpen}
        onOpenChange={setDiscardChangesOpen}
        title="Descartar alterações?"
        description="Você tem alterações não salvas neste template. Ao descartar, elas serão perdidas."
        confirmLabel="Descartar"
        cancelLabel="Continuar editando"
        onConfirm={handleConfirmDiscardChanges}
        confirmVariant="destructive"
      />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
        <Tabs
          value={editorTab}
          onValueChange={(value) => handleEditorTabChange(value as TemplateEditorTab)}
          className="flex h-[calc(100dvh-140px)] min-h-[820px] min-w-0 flex-col"
        >
          <TabsList className="mb-3 shrink-0">
            <TabsTrigger value="editor" className="gap-1.5">
              <Edit className="h-3.5 w-3.5" />
              Editar
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              Prévia
            </TabsTrigger>
          </TabsList>

          <DocxTemplateEditor
            ref={docxEditorRef}
            activeTab={editorTab}
            baseFileName={formData.baseFileName}
            kind={kind}
            onBaseFileNameChange={(fileName) =>
              setFormData((current) => ({
                ...current,
                baseFileName: fileName,
                format: "docx",
              }))
            }
            onDirtyChange={setIsDocumentDirty}
            onVariableTokenClick={handleSelectVariablePath}
            previewDataKey={previewDataKey}
            previewVariables={previewVariables}
            templateFormat={formData.format}
            templateId={editingTemplate?.id}
            templateName={formData.name || config.label}
            watermarkImageUrl={watermarkImageUrl}
          />

        </Tabs>

        <Card className="h-[calc(100dvh-140px)] min-h-[820px] min-w-0 overflow-hidden xl:sticky xl:top-4 xl:mt-[55px]">
          <CardContent className="flex h-full min-h-0 min-w-0 flex-col gap-4 overflow-hidden px-0 pt-4">
            {editorTab === "preview" ? (
              <>
                <div className="min-h-0 min-w-0 flex-1 space-y-5 overflow-y-auto px-6 pr-8 pb-3">
                <div>
                  <h3 className="text-base font-semibold">Dados da prévia</h3>
                  <p className="text-sm text-muted-foreground">
                    Escolha um cliente e um {kind === "contract" ? "contrato" : config.label.toLowerCase()} para
                    preencher os campos do DOCX.
                  </p>
                </div>

                <div className="min-w-0 space-y-2">
                  <Label htmlFor="preview-client">Cliente</Label>
                  <SearchableSelect
                    id="preview-client"
                    value={previewClientId}
                    onValueChange={(value) => {
                      setPreviewClientId(value)
                      setPreviewDocumentId("")
                    }}
                    options={clients.map((client) => ({ value: client.id, label: client.companyName }))}
                    placeholder="Selecione o cliente"
                    searchPlaceholder="Buscar cliente..."
                    emptyMessage="Nenhum cliente encontrado."
                    includeAll={false}
                    className={FORM_SELECT_TRIGGER_CLASS_NAME}
                  />
                </div>

                {previewClientId ? (
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="preview-document">
                      {kind === "contract" ? "Contrato" : config.label}
                    </Label>
                    <SearchableSelect
                      id="preview-document"
                      value={previewDocumentId}
                      onValueChange={setPreviewDocumentId}
                      options={
                        kind === "contract"
                          ? previewContracts.map((contract) => ({
                              value: contract.id,
                              label: `${formatContractNumber(contract.contractNumber)} - ${contract.templateName || contract.status}`,
                            }))
                          : previewSchedules.map((schedule) => ({
                              value: schedule.id,
                              label: `${formatDate(schedule.date)} - ${schedule.serviceTypeName} - ${schedule.unitName}`,
                            }))
                      }
                      placeholder={
                        kind === "contract"
                          ? "Selecione o contrato"
                          : `Selecione o ${config.label.toLowerCase()}`
                      }
                      searchPlaceholder={kind === "contract" ? "Buscar contrato..." : "Buscar agendamento..."}
                      emptyMessage={`Nenhum ${kind === "contract" ? "contrato" : "agendamento"} encontrado.`}
                      includeAll={false}
                      disabled={kind === "contract" ? previewContracts.length === 0 : previewSchedules.length === 0}
                      className={FORM_SELECT_TRIGGER_CLASS_NAME}
                    />
                    {(kind === "contract" ? previewContracts.length === 0 : previewSchedules.length === 0) ? (
                      <p className="text-xs text-muted-foreground">
                        Nenhum {kind === "contract" ? "contrato" : "agendamento"} encontrado para este cliente.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {previewVariables ? (
                  <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                    A prévia está usando os dados selecionados. Campos sem valor ficam preservados para você enxergar
                    o placeholder.
                  </div>
                ) : (
                  <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                    Sem seleção completa, a prévia mostra o template com os placeholders.
                  </div>
                )}

                <Button
                  type="button"
                  className="w-full gap-2"
                  onClick={handleGeneratePreviewPdf}
                  disabled={isGeneratingPdf}
                >
                  <Download className="h-4 w-4" />
                  {isGeneratingPdf ? "Gerando PDF..." : "Testar PDF"}
                </Button>
                </div>
              </>
            ) : (
              <>
              <div className="min-h-0 min-w-0 flex-1 space-y-5 overflow-y-auto px-6 pr-8 pb-3">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="tpl-watermark" className="flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  Marca d'água
                </Label>
                <div className="space-y-3">
                  {watermarkImageUrl ? (
                    <div className="overflow-hidden rounded-lg border bg-muted/40">
                      <img
                        src={watermarkImageUrl}
                        alt="Prévia da marca d'água"
                        className="h-32 w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex h-32 items-center justify-center rounded-lg border border-dashed bg-muted/30 px-4 text-center text-sm text-muted-foreground">
                      Nenhuma imagem selecionada.
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" asChild>
                      <label htmlFor="tpl-watermark">
                        <Upload className="h-4 w-4" />
                        Escolher imagem
                      </label>
                    </Button>
                    {watermarkImageUrl ? (
                      <Button type="button" variant="ghost" size="sm" onClick={handleRemoveWatermark}>
                        <X className="h-4 w-4" />
                        Remover
                      </Button>
                    ) : null}
                  </div>

                  <Input
                    id="tpl-watermark"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleWatermarkFileChange}
                  />
                  <p className="text-xs text-muted-foreground">
                    Resolução recomendada: 1414px x 2000px.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tpl-name">Nome do Template</Label>
                <Input
                  id="tpl-name"
                  value={formData.name}
                  onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                  placeholder={`Nome do template de ${config.label.toLowerCase()}`}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tpl-desc">Descrição</Label>
                <Input
                  id="tpl-desc"
                  value={formData.description}
                  onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Breve descrição"
                />
              </div>

              {kind === "informative" ? (
                <div className="space-y-2">
                  <Label htmlFor="tpl-informative-days">Enviar informativo quantos dias antes?</Label>
                  <Input
                    id="tpl-informative-days"
                    type="number"
                    min={0}
                    value={formData.informativeSendDaysBefore}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        informativeSendDaysBefore: Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                      }))
                    }
                  />
                </div>
              ) : null}

              {kind === "certificate" ? (
                <div className="space-y-2">
                  <Label htmlFor="tpl-certificate-validity">Validade do certificado (meses)</Label>
                  <Input
                    id="tpl-certificate-validity"
                    type="number"
                    min={1}
                    value={formData.certificateValidityMonths}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        certificateValidityMonths: Math.max(1, Number.parseInt(event.target.value, 10) || 1),
                      }))
                    }
                  />
                </div>
              ) : null}

              {config.requiresSigner ? (
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="tpl-signer" className="flex items-center gap-1.5">
                    <PenTool className="h-3.5 w-3.5 text-muted-foreground" />
                    {config.signerLabel}
                  </Label>
                  <SearchableSelect
                    id="tpl-signer"
                    value={formData.signerId}
                    onValueChange={(value) => setFormData((current) => ({ ...current, signerId: value }))}
                    options={activeEmployeeOptions}
                    placeholder="Selecione o funcionário"
                    searchPlaceholder="Buscar funcionário..."
                    emptyMessage="Nenhum funcionário encontrado."
                    includeAll={false}
                    className={FORM_SELECT_TRIGGER_CLASS_NAME}
                  />
                </div>
              ) : null}

              {config.requiresSigner ? (
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="tpl-witness-signer" className="flex items-center gap-1.5">
                    <PenTool className="h-3.5 w-3.5 text-muted-foreground" />
                    Testemunha
                  </Label>
                  <SearchableSelect
                    id="tpl-witness-signer"
                    value={formData.witnessSignerId || "none"}
                    onValueChange={(value) =>
                      setFormData((current) => ({ ...current, witnessSignerId: value === "none" ? "" : value }))
                    }
                    options={[{ value: "none", label: "Sem testemunha" }, ...activeEmployeeOptions]}
                    placeholder="Opcional"
                    searchPlaceholder="Buscar testemunha..."
                    emptyMessage="Nenhum funcionário encontrado."
                    includeAll={false}
                    className={FORM_SELECT_TRIGGER_CLASS_NAME}
                  />
                </div>
              ) : null}

              <div className="min-w-0 space-y-2">
                <Label htmlFor="tpl-status">Status</Label>
                <Select
                  value={formData.isActive ? "active" : "inactive"}
                  onValueChange={(value) => setFormData((current) => ({ ...current, isActive: value === "active" }))}
                >
                  <SelectTrigger className={FORM_SELECT_TRIGGER_CLASS_NAME}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={FORM_SELECT_CONTENT_CLASS_NAME}>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Braces className="h-4 w-4 text-primary" />
                  Variáveis do template
                </Label>
                <Accordion type="single" collapsible className="rounded-xl border bg-background px-3">
                  {variableGroups.map((group) => (
                    <AccordionItem key={group.id} value={group.id}>
                      <AccordionTrigger className="cursor-pointer items-center px-1 py-3 hover:no-underline">
                        <span className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="truncate">{group.label}</span>
                          <span className="ml-auto min-w-7 rounded-full bg-muted px-2 py-0.5 text-center text-xs text-muted-foreground">
                            {group.variables.length}
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        {group.variables.map((variable) => (
                          <button
                            key={variable.path}
                            type="button"
                            className="w-full cursor-pointer rounded-xl border bg-card px-3 py-2 text-left transition hover:border-primary/50 hover:bg-primary/5"
                            onClick={() => handleSelectVariable(variable.path)}
                          >
                            <span className="block text-sm font-medium">{variable.label}</span>
                            <span className="mt-1 block truncate font-mono text-[11px] text-muted-foreground">{`{{${variable.path}}}`}</span>
                          </button>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>

                <p className="text-xs text-muted-foreground">
                  Clique no ponto do documento e escolha uma variável para inserir automaticamente.
                </p>
              </div>
              </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      </>
    )
  }

  return (
    <>
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Novo Template
            </DialogTitle>
          </DialogHeader>

          <form autoComplete="off" noValidate onSubmit={handleImportSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="import-watermark" className="flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                Marca d'água
              </Label>
              <div className="space-y-3">
                {watermarkImageUrl ? (
                  <div className="overflow-hidden rounded-lg border bg-muted/40">
                    <img
                      src={watermarkImageUrl}
                      alt="Prévia da marca d'água"
                      className="h-28 w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex h-28 items-center justify-center rounded-lg border border-dashed bg-muted/30 px-4 text-center text-sm text-muted-foreground">
                    Nenhuma imagem selecionada.
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <label htmlFor="import-watermark">
                      <Upload className="h-4 w-4" />
                      Escolher imagem
                    </label>
                  </Button>
                  {watermarkImageUrl ? (
                    <Button type="button" variant="ghost" size="sm" onClick={handleRemoveWatermark}>
                      <X className="h-4 w-4" />
                      Remover
                    </Button>
                  ) : null}
                </div>

                <Input
                  id="import-watermark"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleWatermarkFileChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="import-name">Nome do Template</Label>
              <Input
                id="import-name"
                value={formData.name}
                onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                placeholder="Nome do template"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="import-desc">Descrição</Label>
              <Input
                id="import-desc"
                value={formData.description}
                onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                placeholder="Breve descrição do template"
              />
            </div>

            {kind === "informative" ? (
              <div className="space-y-2">
                <Label htmlFor="import-informative-days">Enviar informativo quantos dias antes?</Label>
                <Input
                  id="import-informative-days"
                  type="number"
                  min={0}
                  value={formData.informativeSendDaysBefore}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      informativeSendDaysBefore: Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                    }))
                  }
                />
              </div>
            ) : null}

            {kind === "certificate" ? (
              <div className="space-y-2">
                <Label htmlFor="import-certificate-validity">Validade do certificado (meses)</Label>
                <Input
                  id="import-certificate-validity"
                  type="number"
                  min={1}
                  value={formData.certificateValidityMonths}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      certificateValidityMonths: Math.max(1, Number.parseInt(event.target.value, 10) || 1),
                    }))
                  }
                />
              </div>
            ) : null}

            {config.requiresSigner ? (
              <div className="space-y-2">
                <Label htmlFor="import-signer" className="flex items-center gap-1.5">
                  <PenTool className="h-3.5 w-3.5 text-muted-foreground" />
                  {config.signerLabel}
                </Label>
                <SearchableSelect
                  id="import-signer"
                  value={formData.signerId}
                  onValueChange={(value) => setFormData((current) => ({ ...current, signerId: value }))}
                  options={activeEmployeeOptions}
                  placeholder="Selecione o funcionário"
                  searchPlaceholder="Buscar funcionário..."
                  emptyMessage="Nenhum funcionário encontrado."
                  includeAll={false}
                  className={FORM_SELECT_TRIGGER_CLASS_NAME}
                />
              </div>
            ) : null}

            {config.requiresSigner ? (
              <div className="space-y-2">
                <Label htmlFor="import-witness-signer" className="flex items-center gap-1.5">
                  <PenTool className="h-3.5 w-3.5 text-muted-foreground" />
                  Testemunha
                </Label>
                <SearchableSelect
                  id="import-witness-signer"
                  value={formData.witnessSignerId || "none"}
                  onValueChange={(value) =>
                    setFormData((current) => ({ ...current, witnessSignerId: value === "none" ? "" : value }))
                  }
                  options={[{ value: "none", label: "Sem testemunha" }, ...activeEmployeeOptions]}
                  placeholder="Opcional"
                  searchPlaceholder="Buscar testemunha..."
                  emptyMessage="Nenhum funcionário encontrado."
                  includeAll={false}
                  className={FORM_SELECT_TRIGGER_CLASS_NAME}
                />
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setIsImportOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                Criar e Editar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title="Excluir template"
        description={`Esta ação vai excluir o template "${pendingDelete?.label}".`}
        confirmLabel="Excluir"
        onConfirm={() => {
          if (!canManageTemplates) return
          if (!pendingDelete) return
          deleteMutation.mutate(pendingDelete.id)
        }}
        busy={deleteMutation.isPending}
      />

      <div className="flex flex-col gap-4 md:min-h-0 md:flex-1 md:overflow-hidden [@media(max-height:719px)]:overflow-visible">
        <div className={`${mobileFiltersOpen ? "flex" : "hidden"} -m-1 flex-col gap-3 overflow-visible p-1 sm:flex sm:flex-row sm:items-center`}>
          <FilterSearchInput
            wrapperClassName="w-full sm:max-w-md"
            placeholder={`Buscar ${config.pluralLabel}...`}
            value={searchTerm}
            onValueChange={(value) => {
              setSearchTerm(value)
              setCurrentPage(1)
            }}
          />
        </div>

        {mobileTabs ? <div className="sm:hidden [@media(max-height:719px)]:block">{mobileTabs}</div> : null}

        <div className="rounded-md md:min-h-0 md:flex-1 md:overflow-hidden [@media(max-height:719px)]:overflow-visible">
          <Table containerClassName="md:h-full [@media(max-height:719px)]:h-auto" onSortChange={() => setCurrentPage(1)}>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                {config.requiresSigner ? <TableHead className="hidden md:table-cell">Assinante</TableHead> : null}
                {config.requiresSigner ? <TableHead className="hidden md:table-cell">Testemunha</TableHead> : null}
                <TableHead className="hidden lg:table-cell">Atualizado</TableHead>
                <TableHead>Status</TableHead>
                {canManageTemplates ? <TableHead className="text-right">Ações</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody page={!templatesQuery.isLoading && templates.length > 0 ? currentPage : undefined} pageSize={!templatesQuery.isLoading && templates.length > 0 ? pageSize : undefined}>
              {templatesQuery.isLoading ? (
                <TableSkeletonRows
                  rows={5}
                  columns={[
                    { withIcon: true, width: "w-44" },
                    ...(config.requiresSigner ? [{ className: "hidden md:table-cell", width: "w-32" }] : []),
                    ...(config.requiresSigner ? [{ className: "hidden md:table-cell", width: "w-32" }] : []),
                    { className: "hidden lg:table-cell", width: "w-24" },
                    { width: "w-20" },
                    ...(canManageTemplates ? [{ align: "right" as const, width: "w-16" }] : []),
                  ]}
                />
              ) : templates.length === 0 ? (
                <TableEmptyState colSpan={tableColumnCount} icon={FileText} title="Nenhum template encontrado." />
              ) : (
                templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 min-w-[2.5rem] shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <span className="font-medium">{template.name}</span>
                          <p className="text-xs text-muted-foreground">{template.description}</p>
                        </div>
                      </div>
                    </TableCell>

                    {config.requiresSigner ? (
                      <TableCell className="hidden md:table-cell">
                        {getSignerName(template.signerId, template.signerName)}
                      </TableCell>
                    ) : null}

                    {config.requiresSigner ? (
                      <TableCell className="hidden md:table-cell">
                        {getSignerName(template.witnessSignerId, template.witnessSignerName)}
                      </TableCell>
                    ) : null}

                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell" title={formatDateTime(template.updatedAt)}>
                      {formatRelativeUpdatedAt(template.updatedAt)}
                    </TableCell>

                    <TableCell>
                      <Badge
                        className={
                          template.isActive
                            ? cn("bg-green-100 text-green-700 hover:bg-green-100", canManageTemplates && "cursor-pointer hover:bg-green-200", toggleActiveMutation.isPending && "pointer-events-none opacity-60")
                            : cn("bg-gray-100 text-gray-700 hover:bg-gray-100", canManageTemplates && "cursor-pointer hover:bg-gray-200", toggleActiveMutation.isPending && "pointer-events-none opacity-60")
                        }
                        onClick={canManageTemplates ? () => {
                          if (toggleActiveMutation.isPending) return
                          toggleActiveMutation.mutate({ id: template.id, isActive: !template.isActive })
                        } : undefined}
                      >
                        {template.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>

                    {canManageTemplates ? (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(event) => event.stopPropagation()}
                              aria-label="Acoes do template"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={(event) => {
                                event.stopPropagation()
                                handleEdit(template)
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer"
                              disabled={duplicateMutation.isPending}
                              onClick={(event) => {
                                event.stopPropagation()
                                duplicateMutation.mutate(template.id)
                              }}
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={(event) => {
                                event.stopPropagation()
                                setPendingDelete({ id: template.id, label: template.name })
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {!templatesQuery.isLoading ? (
          <DataPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={templates.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setCurrentPage(1)
            }}
          />
        ) : null}
      </div>
    </>
  )
}
