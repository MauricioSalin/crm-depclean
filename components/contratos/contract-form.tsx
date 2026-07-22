"use client"

import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { DocxTemplateEditor, type DocxTemplateEditorRef } from "@/components/templates/docx-template-editor"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import {
  Plus,
  Trash2,
  Save,
  FileText,
  Building2,
  Briefcase,
  Users,
  Check,
  ChevronsUpDown,
  X,
  ArrowLeft,
  RefreshCw,
  Upload,
  Download,
  Mail,
  Phone,
  DollarSign,
} from "lucide-react"
import { cn, formatContractNumber, getColorFromClass } from "@/lib/utils"
import { useHasAnyPermission } from "@/hooks/use-permissions"
import { withReturnTo } from "@/lib/navigation"
import { addCivilMonthsKey, formatCivilDate, formatCivilLongDate, parseCivilDate, toCivilDateKey } from "@/lib/date-utils"
import type { RecurrenceRule, RecurrenceRuleType, RecurrenceType } from "@/lib/types"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { listClients } from "@/lib/api/clients"
import {
  createContract,
  deleteContract,
  getContractById,
  previewContract,
  updateContract,
  uploadContractDocument,
  type ContractPayload,
} from "@/lib/api/contracts"
import { getApiErrorMessage } from "@/lib/api/errors"
import { isClosedClicksignContractStatus } from "@/lib/contract-status"
import { formatCNPJ, formatCPF, formatPhone } from "@/lib/masks"
import { listServices } from "@/lib/api/services"
import { listTemplates } from "@/lib/api/templates"
import { listTeams } from "@/lib/api/teams"
import { listEmployees } from "@/lib/api/employees"
import { getOrganizationSettings, listClientTypes } from "@/lib/api/settings"
import {
  isEmployeeCoveredBySelectedTeams,
  normalizeTeamEmployeeSelection,
  removeEmployeesCoveredByTeams,
} from "@/lib/team-member-selection"

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const normalizeClientSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()

const formatDate = (value: Date | string) =>
  formatCivilDate(value)

const getFirstInstallmentDueDate = (installments?: Array<{ number: number; dueDate: string }>) => {
  const firstInstallment = [...(installments ?? [])].sort((left, right) => left.number - right.number)[0]
  return firstInstallment?.dueDate ? String(firstInstallment.dueDate).split("T")[0] : ""
}

const createDefaultContractRecurrenceRules = (): RecurrenceRule[] => [
  { type: "range", minUnits: 1, maxUnits: 200, recurrence: "semiannual" },
  { type: "range", minUnits: 200, maxUnits: 300, recurrence: "quarterly" },
  { type: "above", minUnits: 300, maxUnits: Infinity, recurrence: "monthly" },
]

const formatMaybeDate = (value?: Date | string) => {
  if (!value) return ""
  return formatCivilDate(value, "")
}

const formatLongDate = (value: Date | string = new Date()) => {
  return formatCivilLongDate(value).replace(/ de (.)/u, (_match, letter: string) => ` de ${letter.toLocaleUpperCase("pt-BR")}`)
}

const formatAddress = (address?: {
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  zipCode?: string
}) => {
  if (!address) return ""
  return [
    [address.street, address.number].filter(Boolean).join(", "),
    address.complement,
    address.neighborhood,
    [address.city, address.state].filter(Boolean).join("/"),
    address.zipCode ? `CEP ${address.zipCode}` : "",
  ].filter(Boolean).join(" - ")
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

function buildServiceSectionsHtml(
  contractServices: Array<{ serviceTypeId: string; clauses?: string[] }>,
  serviceTypes: Array<{ id: string; name: string; clauses?: string[] }>,
) {
  return contractServices
    .filter((service) => service.serviceTypeId)
    .map((service, serviceIndex) => {
      const serviceType = serviceTypes.find((item) => item.id === service.serviceTypeId)
      const sourceClauses = service.clauses?.length ? service.clauses : (serviceType?.clauses ?? [])
      const clauses = sourceClauses.length
        ? sourceClauses.map((clause, clauseIndex) => `<p><strong>${serviceIndex + 1}.${clauseIndex + 1}.</strong> ${escapeHtml(clause)}</p>`).join("")
        : `<p><strong>${serviceIndex + 1}.1.</strong> Cláusulas específicas não informadas para este serviço.</p>`

      return `<p><strong>${serviceIndex + 1}. ${escapeHtml(serviceType?.name ?? "Serviço")}</strong></p>${clauses}`
    })
    .join("")
}

interface ContractFormProps {
  contractId?: string
  isEditing?: boolean
  returnTo?: string
}

interface ContractService {
  id: string
  serviceTypeId: string
  informativeTemplateId: string
  certificateTemplateId: string
  autoSendInformative: boolean
  generateCertificateRequest: boolean
  teamIds: string[]
  employeeIds: string[]
  recurrence: string
  duration: number
  durationType: "hours" | "shift" | "days"
  clauses: string[]
}

const formatServiceDuration = (service?: { defaultDuration?: number; durationType?: "hours" | "shift" | "days" }) => {
  if (!service) return "-"
  const duration = Number(service.defaultDuration ?? 0)
  if (!duration) return "-"
  if (service.durationType === "shift") return `${duration} turno${duration === 1 ? "" : "s"}`
  if (service.durationType === "days") return `${duration} dia${duration === 1 ? "" : "s"}`
  return `${duration} hora${duration === 1 ? "" : "s"}`
}

const recurrenceOptions = [
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quinzenal" },
  { value: "monthly", label: "Mensal" },
  { value: "bimonthly", label: "Bimestral" },
  { value: "quarterly", label: "Trimestral" },
  { value: "semiannual", label: "Semestral" },
  { value: "annual", label: "Anual" },
]

const NO_INFORMATIVE_TEMPLATE_VALUE = "__none__"
const NO_CERTIFICATE_TEMPLATE_VALUE = "__none__"

function isPresent<T>(value: T | null | undefined): value is T {
  return value != null
}

const isContractSigned = (contract?: { status?: string; clicksign?: { status?: string } } | null) => {
  if (!contract) return false
  return isClosedClicksignContractStatus(contract.status)
}

export function ContractForm({ contractId, isEditing = false, returnTo }: ContractFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const formBackHref = returnTo || "/contratos"
  const canDeleteContracts = useHasAnyPermission(["contracts_delete"])

  const clientsQuery = useQuery({
    queryKey: ["clients", "contract-form"],
    queryFn: () => listClients(),
  })
  const servicesQuery = useQuery({
    queryKey: ["services", "contract-form"],
    queryFn: () => listServices(),
  })
  const templatesQuery = useQuery({
    queryKey: ["templates", "contract-form"],
    queryFn: () => listTemplates("", "contract"),
  })
  const informativeTemplatesQuery = useQuery({
    queryKey: ["templates", "contract-form", "informative"],
    queryFn: () => listTemplates("", "informative"),
  })
  const certificateTemplatesQuery = useQuery({
    queryKey: ["templates", "contract-form", "certificate"],
    queryFn: () => listTemplates("", "certificate"),
  })
  const teamsQuery = useQuery({
    queryKey: ["teams", "catalog"],
    queryFn: () => listTeams(),
  })
  const employeesQuery = useQuery({
    queryKey: ["employees", "catalog"],
    queryFn: () => listEmployees(),
  })
  const clientTypesQuery = useQuery({
    queryKey: ["client-types", "contract-form"],
    queryFn: () => listClientTypes(""),
  })
  const organizationSettingsQuery = useQuery({
    queryKey: ["organization-settings", "contract-form"],
    queryFn: () => getOrganizationSettings(),
  })
  const contractQuery = useQuery({
    queryKey: ["contract", contractId],
    queryFn: () => getContractById(contractId!),
    enabled: Boolean(contractId),
  })

  const clients = clientsQuery.data?.data ?? []
  const serviceTypes = servicesQuery.data?.data ?? []
  const templates = templatesQuery.data?.data ?? []
  const informativeTemplates = informativeTemplatesQuery.data?.data ?? []
  const certificateTemplates = certificateTemplatesQuery.data?.data ?? []
  const teams = teamsQuery.data?.data ?? []
  const employees = employeesQuery.data?.data ?? []
  const clientTypes = clientTypesQuery.data?.data.items ?? []
  const organizationSettings = organizationSettingsQuery.data?.data ?? null
  const getClientTypeById = (id: string) => clientTypes.find((type) => type.id === id)
  const contract = contractQuery.data?.data
  const client = contract ? clients.find((c) => c.id === contract.clientId) : undefined

  type CreateStep = "form" | "editor"

  const [step, setStep] = useState<CreateStep>("form")
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false)
  const [isFinalizingCreate, setIsFinalizingCreate] = useState(false)
  const finalizeCreateInFlightRef = useRef(false)
  const [draftMeta, setDraftMeta] = useState<{ contractNumber: string; createdAt: Date } | null>(null)
  const [draftPreview, setDraftPreview] = useState<{
    contractNumber: string
    endDate: string
    firstDueDate: string
    renderedHtml: string
    totalValue: number
    recurrence: string
  } | null>(null)
  const docxEditorRef = useRef<DocxTemplateEditorRef | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const [editorView, setEditorView] = useState<"editor" | "preview">("editor")
  const [importedDocxFile, setImportedDocxFile] = useState<File | null>(null)
  const [importNoticeOpen, setImportNoticeOpen] = useState(false)
  const [importNoticeText, setImportNoticeText] = useState<string>("")
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)

  const initialUnitIds = useMemo(() => {
    const direct = (contract as unknown as { unitIds?: string[] })?.unitIds ?? []
    if (direct.length > 0) return direct
    const fromServices = contract?.services?.flatMap((s: any) => s.unitIds ?? []) ?? []
    return Array.from(new Set(fromServices))
  }, [contract])

  const [selectedClientId, setSelectedClientId] = useState(contract?.clientId || "")
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false)
  const [clientSearchInput, setClientSearchInput] = useState("")
  const [clientSearchTerm, setClientSearchTerm] = useState("")
  const clientListRef = useRef<HTMLDivElement | null>(null)
  const [templatePopoverOpen, setTemplatePopoverOpen] = useState(false)
  const [createAutomatedSchedules, setCreateAutomatedSchedules] = useState(false)
  const [createAutomatedInformatives, setCreateAutomatedInformatives] = useState(false)
  const [startDate, setStartDate] = useState(
    contract?.creationDate
      ? String(contract.creationDate).split("T")[0]
      : contract?.startDate
        ? String(contract.startDate).split("T")[0]
        : ""
  )
  const [firstDueDate, setFirstDueDate] = useState(
    getFirstInstallmentDueDate(contract?.installments)
  )
  const [firstVisitDate, setFirstVisitDate] = useState(
    contract?.firstVisitDate ? String(contract.firstVisitDate).split("T")[0] : ""
  )
  const [firstVisitTime, setFirstVisitTime] = useState(contract?.firstVisitTime || "08:00")
  const [installmentsCount, setInstallmentsCount] = useState(contract?.installmentsCount || 1)
  const endDate = useMemo(() => {
    if (!startDate) return ""
    return addCivilMonthsKey(startDate, installmentsCount)
  }, [startDate, installmentsCount])
  const [dueDay, setDueDay] = useState(((contract as any)?.dueDay ?? (contract as any)?.paymentDay ?? 10) as number)
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>(initialUnitIds)
  const [services, setServices] = useState<ContractService[]>(
    contract?.services.map((s) => {
      const legacyTeamId = (s as any).teamId
      const informativeTemplateId = (s as any).informativeTemplateId ?? (contract as any)?.automationInformativeTemplateId ?? ""
      const certificateTemplateId = (s as any).certificateTemplateId ?? (contract as any)?.automationCertificateTemplateId ?? ""
      return {
        id: s.id,
        serviceTypeId: s.serviceTypeId,
        informativeTemplateId,
        certificateTemplateId,
        autoSendInformative: Boolean(informativeTemplateId),
        generateCertificateRequest: Boolean(certificateTemplateId),
        teamIds: (s as any).teamIds ?? (legacyTeamId ? [legacyTeamId] : []),
        employeeIds: (s as any).additionalEmployeeIds ?? (s as any).employeeIds ?? [],
        recurrence: (s as any).recurrence ?? "monthly",
        duration: Number((s as any).duration ?? 1),
        durationType: ((s as any).durationType ?? "hours") as "hours" | "shift" | "days",
        clauses: [...((s as any).clauses ?? [])],
      }
    }) || []
  )
  const [contractValue, setContractValue] = useState(contract?.totalValue ? Math.round(contract.totalValue * 100) : 0)
  const [downPaymentValue, setDownPaymentValue] = useState(contract?.downPaymentValue ? Math.round(contract.downPaymentValue * 100) : 0)

  // Contract-level recurrence rules
  const [contractRecurrenceRules, setContractRecurrenceRules] = useState<RecurrenceRule[]>(
    (contract as any)?.recurrenceRules ?? createDefaultContractRecurrenceRules()
  )
  const [addRulePopoverOpen, setAddRulePopoverOpen] = useState(false)

  // Service edit dialog
  const [editServiceDialogOpen, setEditServiceDialogOpen] = useState(false)
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [clausesServiceId, setClausesServiceId] = useState<string | null>(null)
  const [clausesDialogOpen, setClausesDialogOpen] = useState(false)
  const clausesDialogCloseTimeoutRef = useRef<number | null>(null)
  const [teamsPopoverOpen, setTeamsPopoverOpen] = useState(false)
  const [employeesPopoverOpen, setEmployeesPopoverOpen] = useState(false)
  const [teamSearchTerm, setTeamSearchTerm] = useState("")
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("")
  const deferredTeamSearchTerm = useDeferredValue(teamSearchTerm)
  const deferredEmployeeSearchTerm = useDeferredValue(employeeSearchTerm)
  const clientById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients])
  const templateById = useMemo(() => new Map(templates.map((template) => [template.id, template])), [templates])
  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees])
  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams])
  const serviceTypeById = useMemo(() => new Map(serviceTypes.map((serviceType) => [serviceType.id, serviceType])), [serviceTypes])

  const selectedClient = clientById.get(selectedClientId)
  const selectedTemplate = templateById.get(selectedTemplateId)
  const selectedTemplateSigner = selectedTemplate?.signerId ? employeeById.get(selectedTemplate.signerId) : undefined
  const totalValue = contractValue / 100
  const downPaymentAmount = downPaymentValue / 100
  const hasDownPayment = downPaymentAmount > 0 && installmentsCount > 1
  const remainingInstallmentsCount = hasDownPayment ? installmentsCount - 1 : installmentsCount
  const remainingContractValue = Math.max(totalValue - downPaymentAmount, 0)
  const regularInstallmentValue = remainingInstallmentsCount > 0
    ? (hasDownPayment ? remainingContractValue : totalValue) / remainingInstallmentsCount
    : totalValue
  const firstInstallmentValue = hasDownPayment ? downPaymentAmount : regularInstallmentValue
  const activeContractTemplates = useMemo(
    () => templates.filter((template) => template.isActive),
    [templates],
  )
  const activeInformativeTemplates = useMemo(
    () => informativeTemplates.filter((template) => template.isActive && template.format === "docx"),
    [informativeTemplates],
  )
  const activeCertificateTemplates = useMemo(
    () => certificateTemplates.filter((template) => template.isActive && template.format === "docx"),
    [certificateTemplates],
  )
  const editingService = services.find(s => s.id === editingServiceId)
  const clausesEditingService = services.find((service) => service.id === clausesServiceId) ?? null
  const clausesEditingServiceType = clausesEditingService
    ? serviceTypeById.get(clausesEditingService.serviceTypeId) ?? null
    : null
  const filteredClients = useMemo(() => {
    const search = normalizeClientSearch(clientSearchTerm)
    if (!search) return clients

    return clients.filter((item) => normalizeClientSearch(`${item.companyName} ${item.cnpj ?? ""}`).includes(search))
  }, [clientSearchTerm, clients])

  const clearClausesDialogCloseTimeout = () => {
    if (clausesDialogCloseTimeoutRef.current) {
      window.clearTimeout(clausesDialogCloseTimeoutRef.current)
      clausesDialogCloseTimeoutRef.current = null
    }
  }

  const closeServiceClausesDialog = () => {
    setClausesDialogOpen(false)
    clearClausesDialogCloseTimeout()
    clausesDialogCloseTimeoutRef.current = window.setTimeout(() => {
      setClausesServiceId(null)
      clausesDialogCloseTimeoutRef.current = null
    }, 220)
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => setClientSearchTerm(clientSearchInput), 250)
    return () => window.clearTimeout(timeout)
  }, [clientSearchInput])

  useEffect(() => {
    clientListRef.current?.scrollTo({ top: 0 })
  }, [clientSearchTerm])

  useEffect(() => {
    if (!contract) return

    const directUnitIds = contract.unitIds ?? []
    const serviceUnitIds = contract.services?.flatMap((service) => service.unitIds ?? []) ?? []
    const initialServiceList = (contract.services ?? []).map((service) => ({
      id: service.id,
      serviceTypeId: service.serviceTypeId,
      informativeTemplateId: service.informativeTemplateId ?? contract.automationInformativeTemplateId ?? "",
      certificateTemplateId: service.certificateTemplateId ?? contract.automationCertificateTemplateId ?? "",
      autoSendInformative: Boolean(service.informativeTemplateId ?? contract.automationInformativeTemplateId),
      generateCertificateRequest: Boolean(service.certificateTemplateId ?? contract.automationCertificateTemplateId),
      teamIds: service.teamIds ?? [],
      employeeIds: service.additionalEmployeeIds ?? [],
      recurrence: service.recurrence ?? "monthly",
      duration: Number(service.duration ?? 1),
      durationType: service.durationType ?? "hours",
      clauses: [...(service.clauses ?? [])],
    }))

    setSelectedClientId(contract.clientId ?? "")
    setSelectedTemplateId(contract.templateId ?? "")
    setCreateAutomatedSchedules(contract.automationCreateSchedules ?? true)
    setCreateAutomatedInformatives(contract.automationCreateInformatives ?? true)
    setStartDate(
      contract.creationDate
        ? String(contract.creationDate).split("T")[0]
        : contract.startDate
          ? String(contract.startDate).split("T")[0]
          : "",
    )
    setFirstDueDate(getFirstInstallmentDueDate(contract.installments))
    setFirstVisitDate(contract.firstVisitDate ? String(contract.firstVisitDate).split("T")[0] : "")
    setFirstVisitTime(contract.firstVisitTime || "08:00")
    setInstallmentsCount(contract.installmentsCount ?? 1)
    setDueDay(contract.paymentDay ?? 10)
    setSelectedUnitIds(Array.from(new Set([...directUnitIds, ...serviceUnitIds])))
    setServices(initialServiceList)
    setContractValue(Math.round((contract.totalValue ?? 0) * 100))
    setDownPaymentValue(Math.round((contract.downPaymentValue ?? 0) * 100))
    setContractRecurrenceRules(
      contract.recurrenceRules?.length
        ? contract.recurrenceRules.map((rule) => ({
            type: rule.type,
            minUnits: rule.minUnits,
            maxUnits: rule.maxUnits,
            recurrence: rule.recurrence as RecurrenceType,
          }))
        : createDefaultContractRecurrenceRules(),
    )
  }, [contract])

  useEffect(() => {
    setDownPaymentValue((current) => Math.min(current, contractValue))
  }, [contractValue])

  useEffect(() => {
    return () => clearClausesDialogCloseTimeout()
  }, [])

  useEffect(() => {
    if (!createAutomatedSchedules) {
      setCreateAutomatedInformatives(false)
    }
  }, [createAutomatedSchedules])

  useEffect(() => {
    if (serviceTypes.length === 0) return
    setServices((current) =>
      current.map((service) => {
        if (!service.serviceTypeId) return service
        const serviceType = serviceTypes.find((item) => item.id === service.serviceTypeId)
        if (!serviceType) return service
        const defaultSelection = normalizeTeamEmployeeSelection({
          teamIds: service.teamIds.length > 0 ? service.teamIds : [...(serviceType.teamIds ?? [])],
          employeeIds: service.employeeIds.length > 0 ? service.employeeIds : [...(serviceType.employeeIds ?? [])],
          teams,
        })
        return {
          ...service,
          recurrence: service.recurrence || serviceType.defaultRecurrence || "monthly",
          duration: service.duration || Number(serviceType.defaultDuration ?? 1),
          durationType: service.durationType || serviceType.durationType || "hours",
          teamIds: defaultSelection.teamIds,
          employeeIds: defaultSelection.employeeIds,
          clauses: service.clauses.length > 0 ? service.clauses : [...(serviceType.clauses ?? [])],
          informativeTemplateId: service.informativeTemplateId,
          certificateTemplateId: service.certificateTemplateId,
          autoSendInformative: Boolean(service.informativeTemplateId),
          generateCertificateRequest: Boolean(service.certificateTemplateId),
        }
      }),
    )
  }, [serviceTypes, teams])

  useEffect(() => {
    if (createAutomatedSchedules && startDate && !firstVisitDate) {
      setFirstVisitDate(startDate)
    }
  }, [createAutomatedSchedules, firstVisitDate, startDate])

  const selectedUnitsForDraft = useMemo(() => {
    const units = selectedClient?.units ?? []
    if (units.length === 0) return []
    const selected = units.filter((u) => selectedUnitIds.includes(u.id))
    if (selected.length > 0) return selected
    const primary = units.find((u) => u.isPrimary) ?? units[0]
    return primary ? [primary] : []
  }, [selectedClient?.units, selectedUnitIds])

  // Auto-select all filiais when client changes
  useEffect(() => {
    if (!selectedClient?.units?.length) {
      setSelectedUnitIds([])
      return
    }
    if (!isEditing) {
      setSelectedUnitIds(selectedClient.units.map(u => u.id))
    }
  }, [selectedClientId])

  const getRecurrenceLabel = (recurrence: string) => {
    const labels: Record<string, string> = {
      weekly: "Semanal",
      biweekly: "Quinzenal",
      monthly: "Mensal",
      bimonthly: "Bimestral",
      quarterly: "Trimestral",
      semiannual: "Semestral",
      annual: "Anual"
    }
    return labels[recurrence] || recurrence
  }

  const buildRecurrenceConditionLabel = (
    clientTypeName: string,
    rule: { type: "range" | "above"; minUnits: number; maxUnits: number },
    previousMaxUnits?: number,
  ) => {
    if (rule.type === "above") {
      return `${clientTypeName} acima de ${rule.minUnits} unidades`
    }

    if (rule.minUnits <= 1) {
      return `${clientTypeName} com até ${rule.maxUnits} unidades`
    }

    const startUnits = previousMaxUnits && previousMaxUnits > 0 ? previousMaxUnits : rule.minUnits
    return `${clientTypeName} de ${startUnits} a ${rule.maxUnits} unidades`
  }

  const buildRecurrenceTableHtml = () => {
    const clientTypeName = getClientTypeById(selectedClient?.clientTypeId ?? "")?.name ?? "Cliente"
    const sortedRules = [...contractRecurrenceRules].sort((current, next) => {
      if (current.minUnits !== next.minUnits) return current.minUnits - next.minUnits
      return current.maxUnits - next.maxUnits
    })
    let previousRangeMax = 0

    const rows = sortedRules.map((rule) => {
      const normalizedRule = {
        type: rule.type,
        minUnits: Number(rule.minUnits),
        maxUnits: Number.isFinite(rule.maxUnits) ? Number(rule.maxUnits) : Number.MAX_SAFE_INTEGER,
      }
      const condition = buildRecurrenceConditionLabel(clientTypeName, normalizedRule, previousRangeMax)
      if (rule.type === "range") previousRangeMax = normalizedRule.maxUnits
      const visitLabel = `Visita ${getRecurrenceLabel(rule.recurrence).toLocaleLowerCase("pt-BR")}`

      return `<tr><td style="border:1px solid #000;padding:4px 8px;font-weight:700;">${escapeHtml(condition)}</td><td style="border:1px solid #000;padding:4px 8px;font-weight:700;">${escapeHtml(visitLabel)}</td></tr>`
    }).join("")

    return `<table style="border-collapse:collapse;width:100%;max-width:520px;"><tbody>${rows}</tbody></table>`
  }

  const updateContractRule = (ruleIndex: number, field: keyof RecurrenceRule, value: number | string) => {
    setContractRecurrenceRules(prev => {
      const rules = [...prev]
      rules[ruleIndex] = { ...rules[ruleIndex], [field]: value }
      return rules
    })
  }

  const addContractRule = (ruleType: RecurrenceRuleType) => {
    const newRule: RecurrenceRule = ruleType === "range"
      ? { type: "range", minUnits: 1, maxUnits: 100, recurrence: "monthly" as RecurrenceType }
      : { type: "above", minUnits: 100, maxUnits: Infinity, recurrence: "monthly" as RecurrenceType }
    setContractRecurrenceRules(prev => [...prev, newRule])
    setAddRulePopoverOpen(false)
  }

  const removeContractRule = (ruleIndex: number) => {
    setContractRecurrenceRules(prev => prev.filter((_, i) => i !== ruleIndex))
  }

  const createDraftContractNumber = () => {
    const year = toCivilDateKey(new Date()).slice(0, 4)
    const seq = String(Date.now()).slice(-3)
    return `DEP-${year}-${seq}`
  }

  const buildContractPayload = (
    renderedHtml?: string,
    options?: { contractNumber?: string },
  ): ContractPayload => ({
    clientId: selectedClientId,
    templateId: selectedTemplateId,
    contractNumber: options?.contractNumber,
    automationCreateSchedules: createAutomatedSchedules,
    automationCreateInformatives: createAutomatedInformatives,
    automationInformativeTemplateId: "",
    automationCreateCertificates: false,
    automationCertificateTemplateId: "",
    unitIds: selectedUnitIds,
    totalValue,
    downPaymentValue: downPaymentAmount,
    duration: installmentsCount,
    startDate,
    firstDueDate,
    paymentDay: dueDay,
    installmentsCount,
    recurrence: services.find((service) => service.serviceTypeId)?.recurrence ?? "monthly",
    recurrenceRules: contractRecurrenceRules.map((rule) => ({
      type: rule.type,
      minUnits: Number(rule.minUnits),
      maxUnits: Number.isFinite(rule.maxUnits) ? Number(rule.maxUnits) : Number.MAX_SAFE_INTEGER,
      recurrence: rule.recurrence,
    })),
    services: services
      .filter((service) => service.serviceTypeId)
      .map((service) => {
        const serviceType = serviceTypes.find((item) => item.id === service.serviceTypeId)
        return {
          id: service.id.startsWith("temp-") ? undefined : service.id,
          serviceTypeId: service.serviceTypeId,
          value: serviceType?.baseValue ?? 0,
          teamIds: service.teamIds,
          additionalEmployeeIds: service.employeeIds,
          unitIds: selectedUnitIds,
          clauses: service.clauses?.length ? service.clauses : serviceType?.clauses ?? [],
          informativeTemplateId: service.informativeTemplateId,
          certificateTemplateId: service.certificateTemplateId,
          autoSendInformative: Boolean(service.informativeTemplateId),
          generateCertificateRequest: Boolean(service.certificateTemplateId),
          recurrence: service.recurrence || serviceType?.defaultRecurrence || "monthly",
          duration: Math.max(1, Number(service.duration || serviceType?.defaultDuration || 1)),
          durationType: service.durationType || serviceType?.durationType || "hours",
          isActive: true,
        }
      }),
    renderedHtml,
  })

  const docxPreviewVariables = useMemo(() => {
    if (!selectedClient || !draftMeta || !draftPreview) return null

    const selectedUnit = selectedClient.units.find((unit) => selectedUnitIds.includes(unit.id)) ??
      selectedClient.units.find((unit) => unit.isPrimary) ??
      selectedClient.units[0]
    const selectedServiceTypes = services
      .filter((service) => service.serviceTypeId)
      .map((service) => serviceTypes.find((item) => item.id === service.serviceTypeId))
      .filter(Boolean)
    const serviceNames = selectedServiceTypes.map((service) => service?.name).filter(Boolean).join(", ")
    const serviceSectionsText = services
      .filter((service) => service.serviceTypeId)
      .map((service, serviceIndex) => {
        const serviceType = serviceTypes.find((item) => item.id === service.serviceTypeId)
        const sourceClauses = service.clauses?.length ? service.clauses : serviceType?.clauses ?? []
        const clauses = sourceClauses.length
          ? sourceClauses.map((clause, clauseIndex) => `${serviceIndex + 1}.${clauseIndex + 1}. ${clause}`).join("\n")
          : `${serviceIndex + 1}.1. Cláusulas específicas não informadas para este serviço.`

        return `${serviceIndex + 1}. ${serviceType?.name ?? "Serviço"}\n${clauses}`
      })
      .join("\n\n")
    const serviceSectionsHtml = buildServiceSectionsHtml(services, serviceTypes)
    return {
      client: {
        address: formatAddress(selectedUnit?.address),
        assessor: {
          cpf: formatCPF(selectedClient.assessor?.cpf ?? ""),
          email: selectedClient.assessor?.email ?? "",
          name: selectedClient.assessor?.name ?? "",
          phone: selectedClient.assessor?.phone ?? "",
        },
        cnpj: formatCNPJ(selectedClient.cnpj),
        companyName: selectedClient.companyName,
        email: selectedClient.email,
        phone: selectedClient.phone,
        responsibleCpf: formatCPF(selectedClient.responsibleCpf ?? ""),
        responsibleName: selectedClient.responsibleName,
        syndic: {
          cpf: formatCPF(selectedClient.syndic?.cpf ?? ""),
          email: selectedClient.syndic?.email ?? "",
          name: selectedClient.syndic?.name ?? "",
          phone: selectedClient.syndic?.phone ?? "",
        },
      },
      contractor: {
        address: formatAddress(organizationSettings?.address),
        cnpj: formatCNPJ(organizationSettings?.cnpj ?? ""),
        email: organizationSettings?.email ?? "",
        legalName: organizationSettings?.legalName ?? "",
        phone: organizationSettings?.phone ?? "",
        signerCpf: selectedTemplateSigner?.cpf ? formatCPF(selectedTemplateSigner.cpf) : "",
        signerName: selectedTemplateSigner?.name ?? "",
        signerRole: selectedTemplateSigner?.role ?? "",
      },
      document: {
        generatedDate: formatMaybeDate(draftMeta.createdAt),
        generatedDateLong: formatLongDate(draftMeta.createdAt),
      },
      contract: {
        createdAt: formatMaybeDate(draftMeta.createdAt),
        createdAtLong: formatLongDate(draftMeta.createdAt),
        durationMonths: String(installmentsCount),
        endDate: formatMaybeDate(draftPreview.endDate || endDate),
        endDateLong: formatLongDate(draftPreview.endDate || endDate),
        firstVisitDate: formatMaybeDate(firstVisitDate),
        firstVisitDateLong: firstVisitDate ? formatLongDate(firstVisitDate) : "",
        firstVisitTime,
        firstDueDate: formatMaybeDate(draftPreview.firstDueDate),
        firstDueDateLong: formatLongDate(draftPreview.firstDueDate),
        downPaymentValue: formatCurrency(downPaymentAmount),
        firstInstallmentValue: formatCurrency(firstInstallmentValue),
        installmentValue: formatCurrency(regularInstallmentValue),
        installmentsCount: String(installmentsCount),
        remainingInstallmentsCount: String(hasDownPayment ? remainingInstallmentsCount : 0),
        number: formatContractNumber(draftPreview.contractNumber),
        paymentDay: String(dueDay).padStart(2, "0"),
        recurrence: getRecurrenceLabel(services.find((service) => service.serviceTypeId)?.recurrence ?? "monthly"),
        recurrenceTable: buildRecurrenceTableHtml(),
        startDate: formatMaybeDate(startDate),
        startDateLong: formatLongDate(startDate),
        totalValue: formatCurrency(totalValue),
      },
      service: {
        name: serviceNames,
        description: selectedServiceTypes.map((service) => service?.description).filter(Boolean).join("\n"),
      },
      services: {
        names: serviceNames,
        sectionsHtml: serviceSectionsHtml,
        sectionsText: serviceSectionsText,
        summary: serviceNames.toLowerCase(),
      },
      unit: {
        address: {
          city: selectedUnit?.address.city ?? "",
          cityState: selectedUnit ? `${selectedUnit.address.city}/${selectedUnit.address.state}` : "",
          full: formatAddress(selectedUnit?.address),
          neighborhood: selectedUnit?.address.neighborhood ?? "",
          number: selectedUnit?.address.number ?? "",
          state: selectedUnit?.address.state ?? "",
          street: selectedUnit?.address.street ?? "",
          zipCode: selectedUnit?.address.zipCode ?? "",
        },
        name: selectedUnit?.name ?? "",
        reservoirProfile: {
          observations: selectedUnit?.reservoirProfile?.observations ?? "",
          validityMonths: String(selectedUnit?.reservoirProfile?.validityMonths ?? 6),
        },
      },
    }
  }, [
    contractRecurrenceRules,
    draftMeta,
    draftPreview,
    dueDay,
    downPaymentAmount,
    endDate,
    firstVisitDate,
    firstVisitTime,
    firstInstallmentValue,
    hasDownPayment,
    installmentsCount,
    organizationSettings,
    regularInstallmentValue,
    remainingInstallmentsCount,
    selectedClient,
    selectedTemplateSigner,
    selectedUnitIds,
    serviceTypes,
    services,
    startDate,
    totalValue,
  ])

  const previewMutation = useMutation({
    mutationFn: previewContract,
  })

  const createMutation = useMutation({
    mutationFn: createContract,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contracts"] })
      await queryClient.invalidateQueries({ queryKey: ["contracts", "list"] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ContractPayload> }) => updateContract(id, payload),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["contract", response.data.id] })
      await queryClient.invalidateQueries({ queryKey: ["contracts"] })
      await queryClient.invalidateQueries({ queryKey: ["contracts", "list"] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteContract(id),
    onSuccess: async () => {
      if (contractId) {
        await queryClient.invalidateQueries({ queryKey: ["contract", contractId] })
      }
      await queryClient.invalidateQueries({ queryKey: ["contracts"] })
      await queryClient.invalidateQueries({ queryKey: ["contracts", "list"] })
      toast.success("Contrato removido.")
      router.push("/contratos")
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Não foi possível remover o contrato."))
    },
  })

  useEffect(() => {
    if (step !== "editor") return
    // Evita o texto do cabeçalho ficar “selecionado” ao entrar na etapa do editor
    requestAnimationFrame(() => {
      try {
        globalThis.getSelection?.()?.removeAllRanges?.()
      } catch {
        // noop
      }
    })

    // Ao entrar na etapa do editor, manter o scroll no início
    requestAnimationFrame(() => {
      try {
        globalThis.scrollTo?.(0, 0)
      } catch {
        // noop
      }
    })
  }, [step])

  useEffect(() => {
    if (step !== "editor") return
    // Ao alternar entre Editar / Prévia, voltar para o topo
    requestAnimationFrame(() => {
      try {
        globalThis.scrollTo?.(0, 0)
      } catch {
        // noop
      }
    })
  }, [editorView, step])

  const openImport = () => importInputRef.current?.click()

  const handleImportFile = async (file: File) => {
    const name = file.name.toLowerCase()

    if (
      name.endsWith(".docx") ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      setImportedDocxFile(file)
      setImportNoticeText("DOCX importado. O editor foi atualizado com o arquivo selecionado.")
      setImportNoticeOpen(true)
      setEditorView("editor")
      return
    }

    setImportNoticeText("Formato não suportado. Importe um arquivo DOCX.")
    setImportNoticeOpen(true)
  }

  const addService = () => {
    setServices((current) => [
      ...current,
      {
        id: `temp-${crypto.randomUUID()}`,
        serviceTypeId: "",
        informativeTemplateId: "",
        certificateTemplateId: "",
        autoSendInformative: false,
        generateCertificateRequest: false,
        teamIds: [],
        employeeIds: [],
        recurrence: "monthly",
        duration: 1,
        durationType: "hours",
        clauses: [],
      }
    ])
  }

  const removeService = (id: string) => {
    setServices((current) => current.filter((service) => service.id !== id))
  }

  const updateService = (id: string, field: keyof ContractService, value: string | number | string[] | boolean) => {
    setServices((current) => current.map(s => {
      if (s.id !== id) return s
      if (field === "serviceTypeId") {
        const serviceType = serviceTypes.find(st => st.id === value)
        const informativeTemplateId = serviceType?.defaultInformativeTemplateId || ""
        const certificateTemplateId = serviceType?.defaultCertificateTemplateId || ""
        const defaultSelection = normalizeTeamEmployeeSelection({
          teamIds: [...(serviceType?.teamIds ?? [])],
          employeeIds: [...(serviceType?.employeeIds ?? [])],
          teams,
        })
        return {
          ...s,
          [field]: value as string,
          informativeTemplateId,
          certificateTemplateId,
          autoSendInformative: Boolean(informativeTemplateId),
          generateCertificateRequest: Boolean(certificateTemplateId),
          teamIds: defaultSelection.teamIds,
          employeeIds: defaultSelection.employeeIds,
          recurrence: serviceType?.defaultRecurrence || "monthly",
          duration: Number(serviceType?.defaultDuration ?? 1),
          durationType: serviceType?.durationType || "hours",
          clauses: [...(serviceType?.clauses ?? [])],
        }
      }
      if (field === "autoSendInformative") {
        const autoSendInformative = value === true
        return {
          ...s,
          autoSendInformative,
          informativeTemplateId: autoSendInformative ? s.informativeTemplateId : "",
        }
      }
      if (field === "generateCertificateRequest") {
        const generateCertificateRequest = value === true
        return {
          ...s,
          generateCertificateRequest,
          certificateTemplateId: generateCertificateRequest ? s.certificateTemplateId : "",
        }
      }
      if (field === "informativeTemplateId") {
        const informativeTemplateId = value as string
        return {
          ...s,
          informativeTemplateId,
          autoSendInformative: Boolean(informativeTemplateId),
        }
      }
      if (field === "certificateTemplateId") {
        const certificateTemplateId = value as string
        return {
          ...s,
          certificateTemplateId,
          generateCertificateRequest: Boolean(certificateTemplateId),
        }
      }
      return { ...s, [field]: value }
    }))
  }

  const openEditServiceDialog = (serviceId: string) => {
    setEditingServiceId(serviceId)
    setEditServiceDialogOpen(true)
  }

  const openServiceClausesDialog = (serviceId: string) => {
    clearClausesDialogCloseTimeout()
    setClausesServiceId(serviceId)
    setClausesDialogOpen(true)
  }

  const addClauseToService = (serviceId: string) => {
    setServices((current) =>
      current.map((service) =>
        service.id === serviceId
          ? { ...service, clauses: [...service.clauses, ""] }
          : service,
      ),
    )
  }

  const updateServiceClause = (serviceId: string, index: number, value: string) => {
    setServices((current) =>
      current.map((service) => {
        if (service.id !== serviceId) return service
        const clauses = [...service.clauses]
        clauses[index] = value
        return { ...service, clauses }
      }),
    )
  }

  const removeServiceClause = (serviceId: string, index: number) => {
    setServices((current) =>
      current.map((service) =>
        service.id === serviceId
          ? { ...service, clauses: service.clauses.filter((_, clauseIndex) => clauseIndex !== index) }
          : service,
      ),
    )
  }

  const toggleTeamForService = (teamId: string) => {
    if (!editingService) return
    const newTeamIds = editingService.teamIds.includes(teamId)
      ? editingService.teamIds.filter(id => id !== teamId)
      : [...editingService.teamIds, teamId]
    setServices((current) => current.map((service) =>
      service.id === editingService.id
        ? {
            ...service,
            teamIds: newTeamIds,
            employeeIds: removeEmployeesCoveredByTeams(service.employeeIds, newTeamIds, teams),
          }
        : service,
    ))
  }

  const toggleEmployeeForService = (employeeId: string) => {
    if (!editingService) return
    if (!editingService.employeeIds.includes(employeeId) && isEmployeeCoveredBySelectedTeams(employeeId, editingService.teamIds, teams)) {
      return
    }

    const newEmployeeIds = editingService.employeeIds.includes(employeeId)
      ? editingService.employeeIds.filter(id => id !== employeeId)
      : [...editingService.employeeIds, employeeId]
    updateService(editingService.id, "employeeIds", newEmployeeIds)
  }

  const filteredTeams = useMemo(() => {
    const term = deferredTeamSearchTerm.trim().toLowerCase()
    if (!term) return teams
    return teams.filter(t => t.name.toLowerCase().includes(term))
  }, [deferredTeamSearchTerm, teams])

  const filteredEmployees = useMemo(() => {
    const term = deferredEmployeeSearchTerm.trim().toLowerCase()
    const availableEmployees = employees.filter((employee) =>
      !editingService || !isEmployeeCoveredBySelectedTeams(employee.id, editingService.teamIds, teams),
    )
    if (!term) return availableEmployees
    return availableEmployees.filter(e =>
      e.name.toLowerCase().includes(term) ||
      e.role.toLowerCase().includes(term)
    )
  }, [deferredEmployeeSearchTerm, editingService, employees, teams])

  const toggleUnit = (unitId: string) => {
    setSelectedUnitIds(prev =>
      prev.includes(unitId)
        ? prev.filter(id => id !== unitId)
        : [...prev, unitId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (previewMutation.isPending || updateMutation.isPending || createMutation.isPending || isFinalizingCreate) return

    if (isEditing && isContractSigned(contract)) {
      toast.error("Contratos assinados não podem ser editados.")
      return
    }

    if (!selectedClientId || !selectedClient) {
      toast.error("Selecione um cliente para continuar.")
      return
    }

    if (!selectedTemplateId || !selectedTemplate?.isActive) {
      toast.error("Selecione um template para continuar.")
      return
    }


    if (!startDate) {
      toast.error("Preencha a data de criação do contrato.")
      return
    }

    if (!firstDueDate) {
      toast.error("Preencha a data da primeira parcela.")
      return
    }

    if (!Number.isInteger(installmentsCount) || installmentsCount < 1) {
      toast.error("Informe uma quantidade de parcelas inteira e maior que zero.")
      return
    }

    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) {
      toast.error("Informe um dia de vencimento entre 1 e 28.")
      return
    }

    if (!Number.isFinite(totalValue) || totalValue <= 0) {
      toast.error("Informe um valor total maior que zero para o contrato.")
      return
    }

    if (selectedUnitIds.length === 0) {
      toast.error("Selecione ao menos uma unidade do cliente para o contrato.")
      return
    }

    if (downPaymentValue > 0 && installmentsCount < 2) {
      toast.error("Para usar valor de entrada, informe ao menos 2 parcelas.")
      return
    }

    if (downPaymentValue > contractValue) {
      toast.error("O valor de entrada não pode ser maior que o valor do contrato.")
      return
    }

    const selectedServices = services.filter((service) => service.serviceTypeId)
    if (selectedServices.length === 0) {
      toast.error("Adicione ao menos um serviço ao contrato.")
      return
    }

    const invalidService = selectedServices.find((service) => {
      const serviceTypeExists = serviceTypeById.has(service.serviceTypeId)
      const durationIsValid = Number.isFinite(service.duration) && service.duration > 0
      return !serviceTypeExists || !durationIsValid || !service.recurrence
    })
    if (invalidService) {
      const serviceName = serviceTypeById.get(invalidService.serviceTypeId)?.name ?? "serviço selecionado"
      if (!Number.isFinite(invalidService.duration) || invalidService.duration <= 0) {
        toast.error(`Informe uma duração maior que zero para ${serviceName}.`)
      } else if (!invalidService.recurrence) {
        toast.error(`Selecione a recorrência de ${serviceName}.`)
      } else {
        toast.error("Um dos serviços selecionados não existe mais. Remova-o e selecione novamente.")
      }
      return
    }

    const invalidRecurrenceRuleIndex = contractRecurrenceRules.findIndex((rule) => {
      const hasValidMinimum = Number.isInteger(rule.minUnits) && rule.minUnits >= 1
      const hasValidMaximum = rule.type === "above"
        || (Number.isInteger(rule.maxUnits) && rule.maxUnits >= rule.minUnits)
      return !hasValidMinimum || !hasValidMaximum || !rule.recurrence
    })
    if (invalidRecurrenceRuleIndex >= 0) {
      toast.error(`Revise os limites da regra de recorrência ${invalidRecurrenceRuleIndex + 1}.`)
      return
    }

    const payload = buildContractPayload()

    if (isEditing) {
      if (!contractId) return
      const toastId = toast.loading("Salvando contrato...")
      try {
        await updateMutation.mutateAsync({ id: contractId, payload })
        toast.success("Contrato atualizado com sucesso.", { id: toastId })
        router.push(formBackHref)
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Não foi possível atualizar o contrato."), { id: toastId })
      }
      return
    }

    const toastId = toast.loading("Gerando prévia do contrato...")
    try {
      const preview = await previewMutation.mutateAsync(payload)
      const createdAt = new Date()
      setDraftMeta({ contractNumber: preview.data.contractNumber, createdAt })
      setDraftPreview(preview.data)
      setImportedDocxFile(null)
      setEditorView("editor")
      setStep("editor")
      toast.success("Prévia do contrato pronta.", { id: toastId })
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível gerar a prévia do contrato."), { id: toastId })
    }
  }

  const finalizeCreate = async () => {
    if (finalizeCreateInFlightRef.current || createMutation.isPending || isFinalizingCreate) return

    finalizeCreateInFlightRef.current = true
    setIsFinalizingCreate(true)
    const loadingToast = toast.loading("Salvando contrato como rascunho...")

    try {
      const editedDocxFile = await docxEditorRef.current?.saveToFile()
      if (!editedDocxFile) {
        throw new Error("O editor DOCX ainda não carregou o documento para salvar.")
      }

      const response = await createMutation.mutateAsync(
        {
          ...buildContractPayload(draftPreview?.renderedHtml || "", { contractNumber: draftMeta?.contractNumber }),
          status: "draft",
        },
      )
      await uploadContractDocument(response.data.id, editedDocxFile)
      setDraftMeta((current) =>
        current ?? { contractNumber: response.data.contractNumber, createdAt: new Date(response.data.createdAt) }
      )

      await queryClient.invalidateQueries({ queryKey: ["contract", response.data.id] })
      await queryClient.invalidateQueries({ queryKey: ["contracts"] })
      await queryClient.invalidateQueries({ queryKey: ["contracts", "list"] })
      setConfirmCreateOpen(false)
      toast.dismiss(loadingToast)
      toast.success("Contrato salvo como rascunho. Revise os agendamentos antes de enviar ao ClickSign.")
      router.replace(withReturnTo(`/contratos/${response.data.id}`, formBackHref))
    } catch (error) {
      toast.dismiss(loadingToast)
      toast.error(getApiErrorMessage(error, "Não foi possível criar o contrato."))
    } finally {
      finalizeCreateInFlightRef.current = false
      setIsFinalizingCreate(false)
    }
  }

  if (!isEditing && step === "editor") {
    const contractNumber = draftMeta?.contractNumber ?? createDraftContractNumber()
    return (
      <div className="space-y-3">
        <input
          ref={importInputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleImportFile(file)
            e.currentTarget.value = ""
          }}
        />

        <Tabs value={editorView} onValueChange={(v) => setEditorView(v as typeof editorView)} className="w-full">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="editor">Editar</TabsTrigger>
              <TabsTrigger value="preview">Prévia</TabsTrigger>
            </TabsList>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("form")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao formulário
              </Button>
              <Button
                type="button"
                className="bg-primary hover:bg-primary/90"
                onClick={() => setConfirmCreateOpen(true)}
                disabled={isFinalizingCreate || createMutation.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                {isFinalizingCreate || createMutation.isPending ? "Salvando rascunho..." : "Concluir e salvar rascunho"}
              </Button>
            </div>
          </div>

          <div className="mt-4 h-[calc(100dvh-235px)] min-h-[720px]">
            <DocxTemplateEditor
              ref={docxEditorRef}
              activeTab={editorView}
              applyVariablesToEditor
              baseFileName={selectedTemplate?.baseFileName}
              kind="contract"
              previewDataKey={[
                draftPreview?.contractNumber ?? "",
                selectedClientId,
                selectedTemplateId,
                selectedUnitIds.join(","),
                totalValue,
                downPaymentValue,
                installmentsCount,
                dueDay,
              ].join("|")}
              previewVariables={docxPreviewVariables}
              sourceFile={importedDocxFile}
              templateFormat={selectedTemplate?.format ?? "docx"}
              templateId={selectedTemplate?.id}
              templateName={formatContractNumber(draftPreview?.contractNumber) || selectedTemplate?.name || "Contrato"}
            />
          </div>
        </Tabs>

        <AlertDialog open={importNoticeOpen} onOpenChange={setImportNoticeOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Importação</AlertDialogTitle>
              <AlertDialogDescription>{importNoticeText}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setImportNoticeOpen(false)} className="bg-primary hover:bg-primary/90">
                Entendi
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={confirmCreateOpen}
          onOpenChange={(open) => {
            if (isFinalizingCreate || createMutation.isPending) return
            setConfirmCreateOpen(open)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Salvar este contrato como rascunho?</AlertDialogTitle>
              <AlertDialogDescription>
                O contrato ainda não será enviado ao ClickSign. No perfil do contrato, você poderá revisar e salvar
                os agendamentos previstos antes do envio para assinatura.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isFinalizingCreate || createMutation.isPending}>Voltar e revisar</AlertDialogCancel>
              <AlertDialogAction
                disabled={isFinalizingCreate || createMutation.isPending}
                onClick={(event) => {
                  event.preventDefault()
                  finalizeCreate()
                }}
                className="bg-primary hover:bg-primary/90"
              >
                {isFinalizingCreate || createMutation.isPending ? "Salvando..." : "Salvar rascunho"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  if (isEditing && contractQuery.isLoading) {
    return (
      <Card className="space-y-5 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-32 w-full" />
        <div className="flex justify-end gap-2">
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-36 rounded-full" />
        </div>
      </Card>
    )
  }

  if (isEditing && contractQuery.isError) {
    return (
      <Card className="p-8 text-center">
        <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Contrato não encontrado</h2>
        <p className="mt-1 text-sm text-muted-foreground">Não foi possível carregar os dados deste contrato.</p>
        <Button className="mt-4" variant="outline" onClick={() => router.push(formBackHref)}>
          Voltar para contratos
        </Button>
      </Card>
    )
  }

  if (isEditing && isContractSigned(contract)) {
    return (
      <Card className="p-8 text-center">
        <FileText className="mx-auto mb-3 h-8 w-8 text-primary" />
        <h2 className="text-lg font-semibold">Contrato assinado</h2>
        <p className="mt-1 text-sm text-muted-foreground">Contratos assinados não podem ser editados.</p>
        <Button className="mt-4" variant="outline" onClick={() => router.push(formBackHref)}>
          Voltar para o contrato
        </Button>
      </Card>
    )
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-6">
      {/* Client Selection */}
      <Card className="p-4 sm:p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          Cliente
        </h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-2 md:w-[380px] lg:col-span-2">
            <Label>Selecionar Cliente *</Label>
            <Popover
              open={clientPopoverOpen}
              onOpenChange={(nextOpen) => {
                setClientPopoverOpen(nextOpen)
                if (!nextOpen) {
                  setClientSearchInput("")
                  setClientSearchTerm("")
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                  disabled={isEditing}
                >
                  {selectedClientId
                    ? selectedClient?.companyName
                    : "Selecione um cliente"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(calc(100vw-2.5rem),440px)] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Buscar cliente..."
                    value={clientSearchInput}
                    onValueChange={setClientSearchInput}
                  />
                  <CommandList ref={clientListRef}>
                    <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                    <CommandGroup>
                      {filteredClients.map((c) => {
                        const totalUnits = c.units?.reduce((sum, u) => sum + (u.unitCount ?? 0), 0) ?? 0
                        return (
                          <CommandItem
                            key={c.id}
                            value={c.companyName}
                            onSelect={() => {
                              setSelectedClientId(c.id)
                              setClientPopoverOpen(false)
                            }}
                            className="grid w-full grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-2 cursor-pointer"
                          >
                            <Check className={cn("h-4 w-4", selectedClientId === c.id ? "opacity-100" : "opacity-0")} />
                            <span className="min-w-0 leading-5">{c.companyName}</span>
                            <Badge variant="secondary" className="shrink-0 tabular-nums">
                              {totalUnits}
                            </Badge>
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          {selectedClient && (() => {
            const clientType = getClientTypeById(selectedClient.clientTypeId)
            const assessor = selectedClient.assessor
            const syndic = selectedClient.syndic
            const hasAssessor = Boolean(assessor?.name || assessor?.cpf || assessor?.email || assessor?.phone)
            const hasSyndic = Boolean(syndic?.name || syndic?.cpf || syndic?.email || syndic?.phone)

            return (
              <>
              <div className="w-fit max-w-full rounded-lg bg-muted/50 p-4 lg:col-span-2">
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${getColorFromClass(clientType?.color || '')}1A` }}
                  >
                    <Building2 className="w-5 h-5" style={{ color: getColorFromClass(clientType?.color || '') }} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{selectedClient.companyName}</p>
                      <Badge
                        style={{ backgroundColor: getColorFromClass(clientType?.color || '') }}
                        className="text-white border-0 hover:opacity-90"
                      >
                        {clientType?.name}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{formatCNPJ(selectedClient.cnpj)}</p>
                    <p className="text-sm text-muted-foreground">{selectedClient.email}</p>
                  </div>
                </div>
              </div>

              {hasAssessor && (
                <div className="rounded-lg bg-muted/50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Assessor</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{assessor.name || "Assessor"}</p>
                        <Badge variant={assessor.receivesNotifications ? "default" : "secondary"} className={assessor.receivesNotifications ? "bg-primary hover:bg-primary/90" : ""}>
                          {assessor.receivesNotifications ? "Recebe notificações" : "Sem notificações"}
                        </Badge>
                      </div>
                      {assessor.cpf && <p className="text-sm text-muted-foreground">{formatCPF(assessor.cpf)}</p>}
                      {assessor.phone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" />
                          {formatPhone(assessor.phone)}
                        </p>
                      )}
                      {assessor.email && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5" />
                          {assessor.email}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {hasSyndic && (
                <div className="rounded-lg bg-muted/50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Síndico</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{syndic.name || "Síndico"}</p>
                        <Badge variant={syndic.receivesNotifications ? "default" : "secondary"} className={syndic.receivesNotifications ? "bg-primary hover:bg-primary/90" : ""}>
                          {syndic.receivesNotifications ? "Recebe notificações" : "Sem notificações"}
                        </Badge>
                      </div>
                      {syndic.cpf && <p className="text-sm text-muted-foreground">{formatCPF(syndic.cpf)}</p>}
                      {syndic.phone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" />
                          {formatPhone(syndic.phone)}
                        </p>
                      )}
                      {syndic.email && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5" />
                          {syndic.email}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              </>
            )
          })()}
        </div>
      </Card>

      {/* Branch Selection */}
      {selectedClient && selectedClient.units && selectedClient.units.length > 0 && (
        <Card className="p-4 sm:p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Filiais do Contrato
          </h3>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {selectedClient.units.map((unit) => (
                <label
                  key={unit.id}
                  htmlFor={`unit-${unit.id}`}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedUnitIds.includes(unit.id) ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                >
                  <Checkbox
                    id={`unit-${unit.id}`}
                    checked={selectedUnitIds.includes(unit.id)}
                    onCheckedChange={() => toggleUnit(unit.id)}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{unit.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {unit.address.street}, {unit.address.number} - {unit.address.neighborhood}
                    </p>
                    {unit.unitCount > 0 && (
                      <p className="text-xs text-muted-foreground">{unit.unitCount} unidades</p>
                    )}
                  </div>
                  {unit.isPrimary && (
                    <Badge variant="outline">Matriz</Badge>
                  )}
                </label>
              ))}
            </div>
        </Card>
      )}

      {/* Automation Settings */}
      <Card className="p-4 sm:p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Configuração de automatização
        </h3>
        <div className="flex flex-col gap-4">
          <div className="space-y-2 md:w-[340px]">
            <Label>Template do contrato *</Label>
            <Popover open={templatePopoverOpen} onOpenChange={setTemplatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  {selectedTemplateId
                    ? selectedTemplate?.name
                    : "Selecione um template"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(calc(100vw-2.5rem),400px)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar template..." />
                  <CommandList>
                    <CommandEmpty>Nenhum template encontrado.</CommandEmpty>
                    <CommandGroup>
                      {activeContractTemplates.map((t) => (
                        <CommandItem
                          key={t.id}
                          value={t.name}
                          onSelect={() => {
                            setSelectedTemplateId(t.id)
                            setTemplatePopoverOpen(false)
                          }}
                          className="cursor-pointer"
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedTemplateId === t.id ? "opacity-100" : "opacity-0")} />
                          <span>{t.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          {selectedTemplateId && (() => {
            const template = selectedTemplate
            if (!template) return null
            return (
              <div className="p-3 rounded-lg bg-muted/50 flex items-start gap-3 md:max-w-[520px]">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{template.name}</p>
                    <Badge className="bg-green-100 text-green-700 border-0 hover:bg-green-100">Ativo</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Atualizado em {new Date(template.updatedAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            )
          })()}
        </div>

        <div className="mt-6 flex max-w-[520px] flex-col gap-5">
          <div className="flex flex-col gap-3">
            <label className={cn(
              "flex min-h-[66px] cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors",
              createAutomatedSchedules ? "border-primary/30 bg-[#eef7e8]" : "border-transparent bg-[#f6faf2] hover:bg-[#eef7e8]"
            )}>
              <Checkbox
                className="mt-0.5"
                checked={createAutomatedSchedules}
                onCheckedChange={(checked) => setCreateAutomatedSchedules(Boolean(checked))}
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-5">Criar agendamentos automatizados</span>
                <span className="block text-xs leading-5 text-muted-foreground">
                  Agendamentos serão criados pela recorrência do contrato.
                </span>
              </span>
            </label>

            <label className={cn(
              "flex min-h-[66px] items-start gap-3 rounded-2xl border px-4 py-3 transition-colors",
              createAutomatedSchedules ? "cursor-pointer" : "cursor-not-allowed opacity-60",
              createAutomatedInformatives ? "border-primary/30 bg-[#eef7e8]" : "border-transparent bg-[#f6faf2] hover:bg-[#eef7e8]"
            )}>
              <Checkbox
                className="mt-0.5"
                checked={createAutomatedInformatives}
                disabled={!createAutomatedSchedules}
                onCheckedChange={(checked) => setCreateAutomatedInformatives(Boolean(checked))}
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-5">Criar informativos automatizados</span>
                <span className="block text-xs leading-5 text-muted-foreground">
                  Um informativo será gerado para cada agendamento.
                </span>
              </span>
            </label>
          </div>
        </div>
      </Card>

      {/* Contract Details */}
      <Card className="p-4 sm:p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Dados do Contrato
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[176px_176px_160px_180px]">
          <div className="min-w-0 space-y-2">
            <Label>Data de criação *</Label>
            <DatePicker
              value={parseCivilDate(startDate)}
              onChange={(date) => setStartDate(date ? toCivilDateKey(date) : "")}
              placeholder="Selecionar data"
              className="h-10 w-full"
            />
          </div>
          <div className="min-w-0 space-y-2">
            <Label>Data da primeira parcela *</Label>
            <DatePicker
              value={parseCivilDate(firstDueDate)}
              onChange={(date) => setFirstDueDate(date ? toCivilDateKey(date) : "")}
              placeholder="Selecionar data"
              className="h-10 w-full"
            />
          </div>
          <div className="space-y-2">
            <Label>Nº de parcelas *</Label>
            <Input
              type="tel"
              inputMode="numeric"
              value={installmentsCount}
              onChange={(e) => setInstallmentsCount(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Dia de vencimento *</Label>
            <Input
              type="tel"
              inputMode="numeric"
              value={dueDay}
              onChange={(e) => setDueDay(Math.min(28, Math.max(1, parseInt(e.target.value) || 1)))}
              min={1}
              max={28}
              required
            />
          </div>
        </div>
        <p className="mt-3 max-w-xl text-xs text-muted-foreground">
          A vigência começa quando o contrato é concluído no Clicksign. A data da primeira parcela é definida acima; as demais seguem o dia de vencimento informado.
        </p>
        {firstDueDate && installmentsCount > 0 && (
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <span>Prazo contratual: <strong className="text-foreground">{installmentsCount} {installmentsCount === 1 ? "mês" : "meses"}</strong></span>
            <span>1ª parcela: <strong className="text-foreground">{formatCivilDate(firstDueDate)}</strong></span>
          </div>
        )}
      </Card>

      {/* Contract-level recurrence */}
      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-semibold">
              <RefreshCw className="h-5 w-5 text-primary" />
              Recorrência das visitas
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Defina a frequência conforme o número de unidades vinculadas ao contrato.
            </p>
          </div>

          <Popover open={addRulePopoverOpen} onOpenChange={setAddRulePopoverOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="shrink-0">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar regra
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-1" align="end">
              <button
                type="button"
                className="w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                onClick={() => addContractRule("range")}
              >
                <span className="block font-medium">Intervalo</span>
                <span className="block text-xs text-muted-foreground">De um limite até outro</span>
              </button>
              <button
                type="button"
                className="w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                onClick={() => addContractRule("above")}
              >
                <span className="block font-medium">Acima de</span>
                <span className="block text-xs text-muted-foreground">Acima de um limite</span>
              </button>
            </PopoverContent>
          </Popover>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table className="min-w-[680px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[130px]">Tipo</TableHead>
                <TableHead>Condição</TableHead>
                <TableHead className="w-[190px]">Recorrência</TableHead>
                <TableHead className="w-[72px] text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contractRecurrenceRules.map((rule, ruleIndex) => (
                  <TableRow key={`${rule.type}-${ruleIndex}`}>
                    <TableCell>
                      <Badge variant="outline" className="whitespace-nowrap">
                        {rule.type === "range" ? "Intervalo" : "Acima de"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {rule.type === "range" ? (
                          <>
                            <Input
                              type="tel"
                              inputMode="numeric"
                              aria-label="Quantidade inicial de unidades"
                              className="h-9 w-24"
                              min={1}
                              value={rule.minUnits}
                              onChange={(event) => updateContractRule(ruleIndex, "minUnits", Math.max(1, Number(event.target.value) || 1))}
                            />
                            <span className="text-sm text-muted-foreground">a</span>
                            <Input
                              type="tel"
                              inputMode="numeric"
                              aria-label="Quantidade final de unidades"
                              className="h-9 w-24"
                              min={1}
                              value={rule.maxUnits}
                              onChange={(event) => updateContractRule(ruleIndex, "maxUnits", Math.max(1, Number(event.target.value) || 1))}
                            />
                          </>
                        ) : (
                          <Input
                            type="tel"
                            inputMode="numeric"
                            aria-label="Quantidade mínima de unidades"
                            className="h-9 w-24"
                            min={1}
                            value={rule.minUnits}
                            onChange={(event) => updateContractRule(ruleIndex, "minUnits", Math.max(1, Number(event.target.value) || 1))}
                          />
                        )}
                        <span className="whitespace-nowrap text-sm text-muted-foreground">unidades</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={rule.recurrence}
                        onValueChange={(value) => updateContractRule(ruleIndex, "recurrence", value)}
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Semanal</SelectItem>
                          <SelectItem value="biweekly">Quinzenal</SelectItem>
                          <SelectItem value="monthly">Mensal</SelectItem>
                          <SelectItem value="bimonthly">Bimestral</SelectItem>
                          <SelectItem value="quarterly">Trimestral</SelectItem>
                          <SelectItem value="semiannual">Semestral</SelectItem>
                          <SelectItem value="annual">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Remover regra"
                        aria-label="Remover regra"
                        onClick={() => removeContractRule(ruleIndex)}
                        disabled={contractRecurrenceRules.length === 1}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Services */}
      <Card className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            Serviços do Contrato
          </h3>
          <Button type="button" variant="outline" size="sm" onClick={addService}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Serviço
          </Button>
        </div>

        {services.length > 0 ? (
          <div className="overflow-x-auto rounded-lg">
            <Table className="min-w-[1760px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[300px]">Serviço</TableHead>
                  <TableHead className="w-[260px]">Informativo</TableHead>
                  <TableHead className="w-[260px]">Certificado</TableHead>
                  <TableHead className="w-[210px]">Duração</TableHead>
                  <TableHead className="w-[180px]">Recorrência</TableHead>
                  <TableHead>Equipes / Funcionários</TableHead>
                  <TableHead className="w-[110px] text-center">Cláusulas</TableHead>
                  <TableHead className="w-[132px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => {
                  const serviceTeams = service.teamIds.map((id) => teamById.get(id)).filter(isPresent)
                  const serviceEmployees = service.employeeIds.map((id) => employeeById.get(id)).filter(isPresent)
                  return (
                    <TableRow key={service.id} className="hover:bg-muted/20">
                      <TableCell className="w-[300px] py-3 align-top">
                        <SearchableSelect
                          value={service.serviceTypeId}
                          onValueChange={(v) => updateService(service.id, "serviceTypeId", v)}
                          options={serviceTypes.map((serviceType) => ({ value: serviceType.id, label: serviceType.name }))}
                          placeholder="Selecione o serviço"
                          searchPlaceholder="Buscar serviço..."
                          emptyMessage="Nenhum serviço encontrado."
                          includeAll={false}
                          className="w-full min-w-[260px]"
                        />
                      </TableCell>
                      <TableCell className="w-[260px] py-3 align-top">
                        <SearchableSelect
                          value={service.informativeTemplateId || NO_INFORMATIVE_TEMPLATE_VALUE}
                          onValueChange={(value) =>
                            updateService(
                              service.id,
                              "informativeTemplateId",
                              value === NO_INFORMATIVE_TEMPLATE_VALUE ? "" : value,
                            )
                          }
                          options={[
                            { value: NO_INFORMATIVE_TEMPLATE_VALUE, label: "Sem informativo" },
                            ...activeInformativeTemplates.map((template) => ({ value: template.id, label: template.name })),
                          ]}
                          placeholder="Sem informativo"
                          searchPlaceholder="Buscar informativo..."
                          emptyMessage="Nenhum informativo encontrado."
                          includeAll={false}
                          disabled={!service.serviceTypeId}
                          className="w-full min-w-[230px]"
                        />
                      </TableCell>
                      <TableCell className="w-[260px] py-3 align-top">
                        <SearchableSelect
                          value={service.certificateTemplateId || NO_CERTIFICATE_TEMPLATE_VALUE}
                          onValueChange={(value) =>
                            updateService(
                              service.id,
                              "certificateTemplateId",
                              value === NO_CERTIFICATE_TEMPLATE_VALUE ? "" : value,
                            )
                          }
                          options={[
                            { value: NO_CERTIFICATE_TEMPLATE_VALUE, label: "Sem certificado" },
                            ...activeCertificateTemplates.map((template) => ({ value: template.id, label: template.name })),
                          ]}
                          placeholder="Sem certificado"
                          searchPlaceholder="Buscar certificado..."
                          emptyMessage="Nenhum certificado encontrado."
                          includeAll={false}
                          disabled={!service.serviceTypeId}
                          className="w-full min-w-[230px]"
                        />
                      </TableCell>
                      <TableCell className="py-3 align-top">
                        <div className="flex gap-2">
                          <Select
                            value={service.durationType}
                            onValueChange={(v) => updateService(service.id, "durationType", v as "hours" | "shift" | "days")}
                          >
                            <SelectTrigger className="w-[115px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="hours">Horas</SelectItem>
                              <SelectItem value="shift">Turnos</SelectItem>
                              <SelectItem value="days">Dias</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="tel"
                            inputMode="decimal"
                            min={1}
                            className="w-[72px]"
                            value={service.duration}
                            onChange={(event) => updateService(service.id, "duration", Math.max(1, Number(event.target.value) || 1))}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="py-3 align-top">
                        <Select
                          value={service.recurrence}
                          onValueChange={(v) => updateService(service.id, "recurrence", v)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {recurrenceOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="py-3 align-top">
                        <div className="flex min-h-9 flex-wrap items-center gap-1.5">
                          {serviceTeams.map(t => (
                            <Badge
                              key={t.id}
                              variant="secondary"
                              className="px-3 py-1 flex items-center gap-2 text-xs text-foreground/80"
                              style={{ backgroundColor: `${t.color}1A` }}
                            >
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                              {t.name}
                            </Badge>
                          ))}
                          {serviceEmployees.map(e => (
                            <Badge key={e.id} variant="outline" className="px-3 py-1 text-xs">
                              {e.name}
                            </Badge>
                          ))}
                          {serviceTeams.length === 0 && serviceEmployees.length === 0 && (
                            <span className="text-sm text-muted-foreground">Nenhum</span>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => openEditServiceDialog(service.id)}
                            aria-label="Adicionar equipes e funcionários"
                            title="Adicionar equipes e funcionários"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-center align-top">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => openServiceClausesDialog(service.id)}
                          disabled={!service.serviceTypeId}
                          title="Editar cláusulas do serviço"
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                      </TableCell>
                      <TableCell className="py-3 align-top">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeService(service.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground rounded-lg">
            <p>Nenhum serviço adicionado</p>
            <p className="text-sm">Clique em "Adicionar Serviço" para começar</p>
          </div>
        )}

      </Card>

      {/* Contract Value */}
      <Card className="p-4 sm:p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" />
          Valor do Contrato
        </h3>
        <div className="w-full max-w-[380px] space-y-4">
          <div className="space-y-2">
            <Label>Valor do Contrato *</Label>
            <CurrencyInput
              value={contractValue}
              onChange={setContractValue}
            />
            <p className="text-xs text-muted-foreground">
              Informe o valor total contratado para geração das parcelas e relatórios financeiros.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Valor de Entrada</Label>
            <CurrencyInput
              value={downPaymentValue}
              onChange={(value) => setDownPaymentValue(Math.min(value, contractValue))}
            />
            <p className="text-xs text-muted-foreground">
              A primeira parcela será a entrada; o saldo será dividido nas demais parcelas.
            </p>
          </div>

          <div className="rounded-lg bg-muted/30 p-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total do contrato</p>
              <p className="mt-2 text-3xl font-bold text-primary">{formatCurrency(totalValue)}</p>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <div className="rounded-lg bg-background/70 p-3">
                <span className="block text-xs">Parcelas</span>
                <strong className="text-foreground">{installmentsCount}x</strong>
              </div>
              {downPaymentValue > 0 ? (
                <>
                  <div className="rounded-lg bg-background/70 p-3">
                    <span className="block text-xs">Entrada (1ª parcela)</span>
                    <strong className="text-foreground">{formatCurrency(downPaymentAmount)}</strong>
                  </div>
                  <div className="rounded-lg bg-background/70 p-3">
                    <span className="block text-xs">Demais parcelas</span>
                    <strong className="text-foreground">{Math.max(installmentsCount - 1, 0)}x</strong>
                  </div>
                  <div className="rounded-lg bg-background/70 p-3">
                    <span className="block text-xs">Valor das demais</span>
                    <strong className="text-foreground">{formatCurrency(hasDownPayment ? regularInstallmentValue : 0)}</strong>
                  </div>
                </>
              ) : (
                <div className="rounded-lg bg-background/70 p-3">
                  <span className="block text-xs">Valor por parcela</span>
                  <strong className="text-foreground">{formatCurrency(regularInstallmentValue)}</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex justify-end">
        <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:justify-end">
          {isEditing && contractId && canDeleteContracts ? (
            <Button
              type="button"
              variant="outline"
              className="max-sm:col-span-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setRemoveDialogOpen(true)}
              disabled={deleteMutation.isPending || updateMutation.isPending}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Remover
            </Button>
          ) : null}
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => router.push(formBackHref)} disabled={previewMutation.isPending || updateMutation.isPending || createMutation.isPending || isFinalizingCreate}>
            Cancelar
          </Button>
          <Button type="submit" className="w-full bg-primary hover:bg-primary/90 sm:w-auto" disabled={previewMutation.isPending || updateMutation.isPending || createMutation.isPending || isFinalizingCreate}>
            <Save className="w-4 h-4 mr-2" />
            {previewMutation.isPending || updateMutation.isPending ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Contrato"}
          </Button>
        </div>
      </div>

      <ConfirmActionDialog
        open={canDeleteContracts && removeDialogOpen}
        title="Remover contrato"
        description={`Tem certeza que deseja remover ${
          contract?.contractNumber ? `o contrato ${formatContractNumber(contract.contractNumber)}` : "este contrato"
        }? Esta ação não pode ser desfeita.`}
        confirmLabel="Remover"
        busy={deleteMutation.isPending}
        onOpenChange={setRemoveDialogOpen}
        onConfirm={() => {
          if (!canDeleteContracts) return
          if (!contractId) return
          if (deleteMutation.isPending) return
          deleteMutation.mutate(contractId)
        }}
      />

      <Dialog open={clausesDialogOpen && Boolean(clausesEditingService)} onOpenChange={(open) => {
        if (open) {
          setClausesDialogOpen(true)
          return
        }

        closeServiceClausesDialog()
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cláusulas do serviço</DialogTitle>
          </DialogHeader>
          {clausesEditingService && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/70 p-4">
                <p className="font-semibold">{clausesEditingServiceType?.name ?? "Serviço"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ajuste as cláusulas apenas para este contrato. O cadastro do serviço permanece como padrão para os próximos contratos.
                </p>
              </div>
              <div className="space-y-3">
                {clausesEditingService.clauses.length > 0 ? (
                  clausesEditingService.clauses.map((clause, index) => (
                    <div key={`${clausesEditingService.id}-${index}`} className="flex gap-2">
                      <Textarea
                        value={clause}
                        onChange={(event) => updateServiceClause(clausesEditingService.id, index, event.target.value)}
                        placeholder={`Cláusula ${index + 1}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeServiceClause(clausesEditingService.id, index)}
                        title="Remover cláusula"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                    Nenhuma cláusula configurada para este serviço neste contrato.
                  </p>
                )}
              </div>
              <div className="flex justify-between gap-3">
                <Button type="button" variant="outline" onClick={() => addClauseToService(clausesEditingService.id)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar cláusula
                </Button>
                <Button type="button" onClick={closeServiceClausesDialog}>
                  Concluir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Service Dialog - Teams and Employees */}
      <Dialog open={editServiceDialogOpen} onOpenChange={setEditServiceDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Equipes e Funcionários</DialogTitle>
          </DialogHeader>
          {editingService && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Equipes</Label>
                <Popover open={teamsPopoverOpen} onOpenChange={setTeamsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      <span className="text-muted-foreground">Buscar e adicionar equipes...</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Buscar equipe..."
                        value={teamSearchTerm}
                        onValueChange={setTeamSearchTerm}
                      />
                      <CommandList>
                        <CommandEmpty>Nenhuma equipe encontrada.</CommandEmpty>
                        <CommandGroup>
                          {filteredTeams.map((team) => (
                            <CommandItem
                              key={team.id}
                              value={team.name}
                              onSelect={() => toggleTeamForService(team.id)}
                              className="cursor-pointer"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  editingService.teamIds.includes(team.id) ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span>{team.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {editingService.teamIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {editingService.teamIds.map(teamId => {
                      const team = teams.find(t => t.id === teamId)
                      const teamColor = team ? getColorFromClass(team.color) : "#94A3B8"
                      return team ? (
                        <Badge
                          key={teamId}
                          variant="secondary"
                          className="px-3 py-1 flex items-center gap-2 text-foreground/80"
                          style={{ backgroundColor: `${teamColor}1A` }}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: teamColor }}
                          />
                          <span>{team.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 shrink-0 rounded-full p-0 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                            onClick={() => toggleTeamForService(teamId)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ) : null
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Funcionários Avulsos</Label>
                <Popover open={employeesPopoverOpen} onOpenChange={setEmployeesPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      <span className="text-muted-foreground">Buscar e adicionar funcionários...</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Buscar funcionário..."
                        value={employeeSearchTerm}
                        onValueChange={setEmployeeSearchTerm}
                      />
                      <CommandList>
                        <CommandEmpty>Nenhum funcionário encontrado.</CommandEmpty>
                        <CommandGroup>
                          {filteredEmployees.map((emp) => (
                            <CommandItem
                              key={emp.id}
                              value={emp.name}
                              onSelect={() => toggleEmployeeForService(emp.id)}
                              className="cursor-pointer"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  editingService.employeeIds.includes(emp.id) ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{emp.name}</span>
                                <span className="text-sm text-muted-foreground">{emp.role}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {editingService.employeeIds.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {editingService.employeeIds.map(empId => {
                      const emp = employees.find(e => e.id === empId)
                      return emp ? (
                        <Badge key={empId} variant="outline" className="px-3 py-1 flex items-center gap-2">
                          <span>{emp.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 shrink-0 rounded-full p-0 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                            onClick={() => toggleEmployeeForService(empId)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ) : null
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => setEditServiceDialogOpen(false)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Concluir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </form>
  )
}
