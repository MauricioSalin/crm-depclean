"use client"

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  Calendar,
  Check,
  Clock,
  Edit,
  Eye,
  Loader2,
  MoreHorizontal,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react"

import { listClients, type ClientRecord } from "@/lib/api/clients"
import { listEmployees, type EmployeeRecord } from "@/lib/api/employees"
import { getApiErrorMessage } from "@/lib/api/errors"
import {
  cancelSchedule,
  completeSchedule,
  createSchedule,
  deleteSchedule,
  exportSchedules,
  getScheduleById,
  listScheduleCompletionEmployees,
  listSchedules,
  reactivateSchedule,
  startSchedule,
  updateScheduleStatus,
  type SchedulePayload,
  type ScheduleRecord,
  updateSchedule,
  uploadScheduleNa,
} from "@/lib/api/schedules"
import { listServices, type ServiceRecord } from "@/lib/api/services"
import { listTeams, type TeamRecord } from "@/lib/api/teams"
import { hasAnyPermission } from "@/lib/auth/permissions"
import { getStoredUser } from "@/lib/auth/session"
import { formatCivilDate, toBrasiliaTimeKey, toCivilDateKey } from "@/lib/date-utils"
import { useMobileFiltersOpen } from "@/lib/hooks/use-mobile-filters"
import { useUrlDateRangeState } from "@/lib/hooks/use-url-date-range-state"
import { useUrlQueryState } from "@/lib/hooks/use-url-query-state"
import { formatConfiguredScheduleDuration, minutesToScheduleDuration, scheduleDurationToMinutes } from "@/lib/schedule-duration"
import { normalizeScheduleStatusFilter, SCHEDULE_STATUS_FILTER_OPTIONS } from "@/lib/schedule-status"
import {
  checkScheduleAvailability,
  formatDailyServiceCapacityViolation,
  getScheduleConflictResourceNames,
  getDailyServiceCapacityViolation,
} from "@/lib/schedule-availability"
import { canStartSchedule } from "@/lib/schedule-permissions"
import { cacheSavedSchedule } from "@/lib/schedule-query-cache"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { AttendanceCompletionFields } from "@/components/agendamentos/attendance-completion-fields"
import { AttendanceStartSlider } from "@/components/agendamentos/attendance-start-slider"
import { CompletionNaAttachments } from "@/components/agendamentos/completion-na-attachments"
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { FilterSearchInput } from "@/components/ui/filter-search-input"
import { DataPagination } from "@/components/ui/data-pagination"
import { CsvImportDialog, type CsvImportField } from "@/components/ui/csv-import-dialog"
import { EmptyState, TableEmptyState } from "@/components/ui/empty-state"
import { CardSkeletonGrid, TableSkeletonRows } from "@/components/ui/table-skeleton"
import { ScheduleTypeBadge } from "@/components/ui/schedule-type-badge"
import { BusinessStatusBadge } from "@/components/ui/business-status-badges"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { SchedulingFormDialog, type SchedulingFormData } from "./scheduling-form-dialog"
import { ScheduleDetailsDialog } from "./schedule-details-dialog"
import { CancelScheduleDialog } from "./cancel-schedule-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface AgendamentosContentProps {
  viewMode: "table" | "cards"
  openDialog?: boolean
  onDialogChange?: (open: boolean) => void
  viewToggle?: React.ReactNode
  openImport?: boolean
  onImportChange?: (open: boolean) => void
  openExport?: boolean
  onExportChange?: (open: boolean) => void
  initialScheduleId?: string
}

function getStatusBadge(status: ScheduleRecord["status"]) {
  switch (status) {
    case "draft":
      return <Badge className="bg-slate-100 text-slate-700">Rascunho</Badge>
    case "scheduled":
      return <Badge className="bg-blue-100 text-blue-800">Agendado</Badge>
    case "in_progress":
      return <Badge className="bg-yellow-100 text-yellow-800">Em andamento</Badge>
    case "completed":
      return <Badge className="bg-green-100 text-green-800">Concluído</Badge>
    case "cancelled":
      return <Badge className="bg-red-100 text-red-800">Cancelado</Badge>
    case "rescheduled":
      return <Badge className="bg-purple-100 text-purple-800">Reagendado</Badge>
  }
}

function currentCompletionDateTime() {
  const now = new Date()
  const date = toCivilDateKey(now)
  const time = toBrasiliaTimeKey(now)
  return { date, time }
}

function getDisplayedScheduleDate(schedule: ScheduleRecord) {
  return schedule.status === "completed" && schedule.completionStartDate
    ? schedule.completionStartDate
    : schedule.date
}

function getDisplayedScheduleTime(schedule: ScheduleRecord) {
  return schedule.status === "completed" && schedule.completionStartTime
    ? schedule.completionStartTime
    : schedule.time
}

function getScheduleIconTone(_schedule: Pick<ScheduleRecord, "isEmergency">) {
  return { wrapper: "bg-primary/10", icon: "text-primary" }
}

function canCancelSchedule(schedule: Pick<ScheduleRecord, "status">) {
  return !["in_progress", "completed", "cancelled"].includes(schedule.status)
}

function canEditSchedule(schedule: Pick<ScheduleRecord, "status">, canManageLockedSchedules: boolean) {
  if (["in_progress", "cancelled"].includes(schedule.status)) return false
  if (schedule.status === "completed") return canManageLockedSchedules
  return true
}

function isRecurringSchedule(schedule: Pick<ScheduleRecord, "contractId" | "isManual">) {
  return Boolean(schedule.contractId && !schedule.isManual)
}

function normalizeImportLookup(value: string | number | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

function normalizeImportCompact(value: string | number | null | undefined) {
  return normalizeImportLookup(value).replace(/\s+/g, "")
}

function onlyDigits(value: string | number | null | undefined) {
  return String(value ?? "").replace(/\D/g, "")
}

function splitImportList(value: string | undefined) {
  return String(value ?? "")
    .split(/[,|\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeImportBoolean(value: string | undefined) {
  const normalized = normalizeImportLookup(value)
  return ["1", "true", "sim", "s", "yes"].includes(normalized)
}

function uniqueImportIds(ids: string[]) {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)))
}

function getImportRowNumber(index: number) {
  return index + 2
}

function findImportMatch<T>(
  value: string,
  items: T[],
  getCandidates: (item: T) => Array<string | number | null | undefined>,
) {
  const normalized = normalizeImportLookup(value)
  const compact = normalizeImportCompact(value)
  const digits = onlyDigits(value)

  if (!normalized) return null

  const matches = items.filter((item) =>
    getCandidates(item).some((candidate) => {
      const candidateText = String(candidate ?? "").trim()
      if (!candidateText) return false

      return (
        normalizeImportLookup(candidateText) === normalized ||
        normalizeImportCompact(candidateText) === compact ||
        (digits.length > 0 && onlyDigits(candidateText) === digits)
      )
    }),
  )

  return matches.length === 1 ? matches[0] : matches.length > 1 ? "ambiguous" : null
}

function resolveImportClient(value: string, clients: ClientRecord[], rowIndex: number) {
  const client = findImportMatch(value, clients, (item) => [
    item.id,
    item.companyName,
    item.cnpj,
    item.email,
    item.phone,
    item.responsibleName,
    item.responsibleCpf,
    item.assessor?.name,
    item.assessor?.cpf,
    item.assessor?.email,
    item.syndic?.name,
    item.syndic?.cpf,
    item.syndic?.email,
  ])

  if (client === "ambiguous") {
    throw new Error(`Linha ${getImportRowNumber(rowIndex)}: cliente "${value}" encontrou mais de um cadastro. Use o CNPJ, e-mail ou ID do cliente.`)
  }

  if (!client) {
    throw new Error(`Linha ${getImportRowNumber(rowIndex)}: cliente "${value}" não encontrado. Use nome, CNPJ, e-mail ou ID já cadastrado.`)
  }

  return client
}

function resolveImportUnit(value: string | undefined, client: ClientRecord, rowIndex: number) {
  const unitValue = value?.trim()
  if (!unitValue) {
    const primaryUnit = client.units.find((unit) => unit.isPrimary) ?? client.units[0]
    if (!primaryUnit) {
      throw new Error(`Linha ${getImportRowNumber(rowIndex)}: cliente "${client.companyName}" não possui unidade cadastrada.`)
    }

    return primaryUnit
  }

  const unit = findImportMatch(unitValue, client.units, (item) => [
    item.id,
    item.name,
    item.address?.zipCode,
    item.address?.street,
    item.address?.number,
    item.address?.neighborhood,
    `${item.address?.street ?? ""} ${item.address?.number ?? ""}`,
    `${item.name} ${item.address?.street ?? ""} ${item.address?.number ?? ""}`,
  ])

  if (unit === "ambiguous") {
    throw new Error(`Linha ${getImportRowNumber(rowIndex)}: unidade "${unitValue}" encontrou mais de um cadastro no cliente "${client.companyName}". Use o ID da unidade.`)
  }

  if (!unit) {
    throw new Error(`Linha ${getImportRowNumber(rowIndex)}: unidade "${unitValue}" não encontrada no cliente "${client.companyName}".`)
  }

  return unit
}

function resolveImportService(value: string, services: ServiceRecord[], rowIndex: number) {
  const service = findImportMatch(value, services, (item) => [item.id, item.name])

  if (service === "ambiguous") {
    throw new Error(`Linha ${getImportRowNumber(rowIndex)}: serviço "${value}" encontrou mais de um cadastro. Use o ID do serviço.`)
  }

  if (!service) {
    throw new Error(`Linha ${getImportRowNumber(rowIndex)}: serviço "${value}" não encontrado. Use nome ou ID já cadastrado.`)
  }

  return service
}

function resolveImportTeams(value: string | undefined, teams: TeamRecord[], rowIndex: number) {
  return uniqueImportIds(splitImportList(value).map((teamValue) => {
    const team = findImportMatch(teamValue, teams, (item) => [item.id, item.name])

    if (team === "ambiguous") {
      throw new Error(`Linha ${getImportRowNumber(rowIndex)}: equipe "${teamValue}" encontrou mais de um cadastro. Use o ID da equipe.`)
    }

    if (!team) {
      throw new Error(`Linha ${getImportRowNumber(rowIndex)}: equipe "${teamValue}" não encontrada. Use nome ou ID já cadastrado.`)
    }

    return team.id
  }))
}

function resolveImportEmployees(value: string | undefined, employees: EmployeeRecord[], rowIndex: number) {
  return uniqueImportIds(splitImportList(value).map((employeeValue) => {
    const employee = findImportMatch(employeeValue, employees, (item) => [
      item.id,
      item.name,
      item.email,
      item.cpf,
      item.phone,
    ])

    if (employee === "ambiguous") {
      throw new Error(`Linha ${getImportRowNumber(rowIndex)}: funcionário "${employeeValue}" encontrou mais de um cadastro. Use CPF, e-mail ou ID.`)
    }

    if (!employee) {
      throw new Error(`Linha ${getImportRowNumber(rowIndex)}: funcionário "${employeeValue}" não encontrado. Use nome, CPF, e-mail ou ID já cadastrado.`)
    }

    return employee.id
  }))
}

function normalizeImportDate(value: string | undefined, rowIndex: number) {
  const trimmed = String(value ?? "").trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  const brazilianDate = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (brazilianDate) {
    const [, day, month, year] = brazilianDate
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }

  throw new Error(`Linha ${getImportRowNumber(rowIndex)}: data "${value}" inválida. Use dd/mm/aaaa ou aaaa-mm-dd.`)
}

function normalizeImportTime(value: string | undefined, rowIndex: number) {
  const match = String(value ?? "").trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) {
    throw new Error(`Linha ${getImportRowNumber(rowIndex)}: horário "${value}" inválido. Use HH:mm.`)
  }

  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) {
    throw new Error(`Linha ${getImportRowNumber(rowIndex)}: horário "${value}" inválido. Use HH:mm.`)
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function normalizeImportDuration(value: string | undefined, service: ServiceRecord, rowIndex: number) {
  const normalized = String(value ?? "").trim().replace(",", ".")
  if (!normalized) {
    return scheduleDurationToMinutes(service.defaultDuration, service.durationType)
  }

  const duration = Number(normalized)

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Linha ${getImportRowNumber(rowIndex)}: duração "${value}" inválida. Informe minutos acima de zero.`)
  }

  return Math.round(duration)
}

function buildScheduleImportPayload(
  row: Record<string, string>,
  rowIndex: number,
  references: {
    clients: ClientRecord[]
    services: ServiceRecord[]
    teams: TeamRecord[]
    employees: EmployeeRecord[]
  },
): SchedulePayload {
  const client = resolveImportClient(row.clientId, references.clients, rowIndex)
  const unit = resolveImportUnit(row.unitId, client, rowIndex)
  const serviceValues = splitImportList(row.serviceTypeIds?.trim() ? row.serviceTypeIds : row.serviceTypeId)
  const resolvedServices = serviceValues.length > 0
    ? uniqueImportIds(serviceValues.map((serviceValue) => resolveImportService(serviceValue, references.services, rowIndex).id))
      .map((serviceId) => references.services.find((item) => item.id === serviceId)!)
    : [resolveImportService(row.serviceTypeId, references.services, rowIndex)]
  const service = resolvedServices[0]
  const teamIds = row.teamIds?.trim()
    ? resolveImportTeams(row.teamIds, references.teams, rowIndex)
    : uniqueImportIds(service.teamIds ?? [])
  const additionalEmployeeIds = row.additionalEmployeeIds?.trim()
    ? resolveImportEmployees(row.additionalEmployeeIds, references.employees, rowIndex)
    : uniqueImportIds(service.employeeIds ?? [])
  const estimatedDuration = normalizeImportDuration(row.estimatedDuration, service, rowIndex)
  const configuredDuration = minutesToScheduleDuration(estimatedDuration, service)
  const contractServiceIds = uniqueImportIds(splitImportList(row.contractServiceIds?.trim() ? row.contractServiceIds : row.contractServiceId))
  const contractId = row.contractId?.trim() || undefined

  return {
    clientId: client.id,
    unitId: unit.id,
    contractId,
    contractServiceId: contractServiceIds[0],
    contractServiceIds,
    serviceTypeId: service.id,
    serviceTypeIds: resolvedServices.map((item) => item.id),
    teamIds,
    additionalEmployeeIds,
    scheduledDate: normalizeImportDate(row.scheduledDate, rowIndex),
    scheduledTime: normalizeImportTime(row.scheduledTime, rowIndex),
    estimatedDuration,
    durationValue: configuredDuration.duration,
    durationType: configuredDuration.durationType,
    isLegacyImport: normalizeImportBoolean(row.isLegacyImport) || Boolean(contractId),
    notes: row.notes?.trim() ?? "",
  }
}

const SCHEDULE_IMPORT_FIELDS: CsvImportField[] = [
  { key: "clientId", label: "Cliente", required: true },
  { key: "unitId", label: "Unidade" },
  { key: "contractId", label: "Contrato" },
  { key: "contractServiceIds", label: "Serviços do contrato" },
  { key: "serviceTypeId", label: "Serviço", required: true },
  { key: "serviceTypeIds", label: "Serviços anexos" },
  { key: "teamIds", label: "Equipes" },
  { key: "additionalEmployeeIds", label: "Funcionários avulsos" },
  { key: "scheduledDate", label: "Data", required: true },
  { key: "scheduledTime", label: "Horário", required: true },
  { key: "estimatedDuration", label: "Duração em minutos", required: true },
  { key: "isLegacyImport", label: "Importação legada" },
  { key: "notes", label: "Observações" },
]

export function AgendamentosContent({
  viewMode,
  openDialog,
  onDialogChange,
  viewToggle,
  openImport = false,
  onImportChange,
  openExport = false,
  onExportChange,
  initialScheduleId,
}: AgendamentosContentProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const mobileFiltersOpen = useMobileFiltersOpen()
  const [searchTerm, setSearchTerm] = useUrlQueryState("q")
  const deferredSearchTerm = useDeferredValue(searchTerm)
  const [statusFilterParam, setStatusFilter] = useUrlQueryState("status", "all", { debounceMs: 0 })
  const statusFilter = normalizeScheduleStatusFilter(statusFilterParam)
  const [dateRange, setDateRange] = useUrlDateRangeState()
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<ScheduleRecord | null>(null)
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleRecord | null>(null)
  const [cancelTarget, setCancelTarget] = useState<ScheduleRecord | null>(null)
  const [completionTarget, setCompletionTarget] = useState<ScheduleRecord | null>(null)
  const [completionStep, setCompletionStep] = useState<"attachments" | "checkout">("attachments")
  const [completionStartDate, setCompletionStartDate] = useState("")
  const [completionStartTime, setCompletionStartTime] = useState("")
  const [completionEndDate, setCompletionEndDate] = useState("")
  const [completionEndTime, setCompletionEndTime] = useState("")
  const [completionDriverEmployeeId, setCompletionDriverEmployeeId] = useState("")
  const [completionHelperEmployeeIds, setCompletionHelperEmployeeIds] = useState<string[]>([])
  const [completionServiceReport, setCompletionServiceReport] = useState("")
  const [completionFiles, setCompletionFiles] = useState<File[]>([])
  const [pendingDelete, setPendingDelete] = useState<ScheduleRecord | null>(null)
  const scheduleDialogResetTimeoutRef = useRef<number | null>(null)
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getStoredUser>>(null)
  const canManageAgenda = hasAnyPermission(currentUser, ["agenda_manage"])
  const canManageLockedSchedules = hasAnyPermission(currentUser, ["agenda_manage_locked"])
  const canManageScheduleStatus = hasAnyPermission(currentUser, ["agenda_manage_status"])
  const canOpenScheduleEditor = canManageAgenda || canManageScheduleStatus

  useEffect(() => {
    const sync = () => setCurrentUser(getStoredUser())
    sync()
    window.addEventListener("storage", sync)
    window.addEventListener("depclean:session", sync)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("depclean:session", sync)
    }
  }, [])

  const schedulesQuery = useQuery({
    queryKey: ["schedules"],
    queryFn: () => listSchedules(),
  })
  const routeScheduleQuery = useQuery({
    queryKey: ["schedule", initialScheduleId],
    queryFn: () => getScheduleById(initialScheduleId!),
    enabled: Boolean(initialScheduleId),
    retry: false,
  })
  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: () => listClients(),
    enabled: canManageAgenda,
  })
  const servicesQuery = useQuery({
    queryKey: ["services"],
    queryFn: () => listServices(),
    enabled: canManageAgenda,
  })
  const teamsQuery = useQuery({
    queryKey: ["teams", "catalog"],
    queryFn: () => listTeams(),
    enabled: canManageAgenda,
  })
  const employeesQuery = useQuery({
    queryKey: ["employees", "catalog"],
    queryFn: () => listEmployees(),
    enabled: canManageAgenda,
  })
  const completionEmployeesQuery = useQuery({
    queryKey: ["schedules", "completion-employees"],
    queryFn: () => listScheduleCompletionEmployees(),
    enabled: Boolean(completionTarget),
  })

  const schedules = schedulesQuery.data?.data ?? []
  const clients = clientsQuery.data?.data ?? []
  const services = servicesQuery.data?.data ?? []
  const teams = teamsQuery.data?.data ?? []
  const employees = employeesQuery.data?.data ?? []
  const completionEmployees = completionEmployeesQuery.data?.data ?? []
  const routeSchedule = useMemo(() => {
    if (!initialScheduleId) return null
    return schedules.find((item) => item.id === initialScheduleId) ?? routeScheduleQuery.data?.data ?? null
  }, [initialScheduleId, routeScheduleQuery.data?.data, schedules])

  useEffect(() => {
    if (!initialScheduleId || !routeSchedule) return
    setSelectedSchedule((current) => (current?.id === routeSchedule.id ? current : routeSchedule))
  }, [initialScheduleId, routeSchedule])

  useEffect(() => {
    if (!initialScheduleId || !routeScheduleQuery.isError) return
    toast.error("Agendamento não encontrado ou sem permissão de acesso.")
    router.replace("/agendamentos")
  }, [initialScheduleId, routeScheduleQuery.isError, router])

  useEffect(() => {
    if (openDialog && !canManageAgenda) {
      onDialogChange?.(false)
      return
    }

    if (openDialog) {
      clearScheduleDialogResetTimeout()
      setEditingSchedule(null)
      setIsDialogOpen(true)
      onDialogChange?.(false)
    }
  }, [canManageAgenda, openDialog, onDialogChange])

  useEffect(() => {
    return () => clearScheduleDialogResetTimeout()
  }, [])

  function clearScheduleDialogResetTimeout() {
    if (scheduleDialogResetTimeoutRef.current) {
      window.clearTimeout(scheduleDialogResetTimeoutRef.current)
      scheduleDialogResetTimeoutRef.current = null
    }
  }

  function closeScheduleDialog() {
    setIsDialogOpen(false)
    clearScheduleDialogResetTimeout()
    scheduleDialogResetTimeoutRef.current = window.setTimeout(() => {
      setEditingSchedule(null)
      scheduleDialogResetTimeoutRef.current = null
    }, 200)
  }

  function handleScheduleDialogChange(open: boolean) {
    if (open && !canManageAgenda) return

    if (open) {
      clearScheduleDialogResetTimeout()
      setIsDialogOpen(true)
      return
    }

    closeScheduleDialog()
  }

  const invalidateSchedules = async () => {
    await queryClient.invalidateQueries({ queryKey: ["schedules"] })
    await queryClient.invalidateQueries({ queryKey: ["notifications"] })
    await queryClient.invalidateQueries({ queryKey: ["certificates"] })
    await queryClient.invalidateQueries({ queryKey: ["analytics"] })
  }

  const saveMutation = useMutation({
    mutationFn: async ({
      formData,
      scheduleId,
    }: {
      formData: SchedulingFormData
      scheduleId?: string
    }) => {
      if (scheduleId && !canManageAgenda && canManageScheduleStatus) {
        return updateScheduleStatus(scheduleId, formData.status)
      }

      const client = clients.find((item) => item.id === formData.clientId)
      const primaryUnit = client?.units.find((unit) => unit.isPrimary) ?? client?.units[0]
      if (!client || !primaryUnit) {
        throw new Error("Cliente sem unidade disponível para agendamento.")
      }

      const isRecurringScheduleUpdate = Boolean(scheduleId && editingSchedule?.contractId && !editingSchedule.isManual)
      if (scheduleId && isRecurringScheduleUpdate) {
        const response = await updateSchedule(scheduleId, {
          serviceTypeId: formData.serviceTypeIds[0],
          serviceTypeIds: formData.serviceTypeIds,
          serviceDocumentSettings: formData.serviceDocumentSettings,
          teamIds: formData.teamIds,
          additionalEmployeeIds: formData.employeeIds,
          scheduledDate: formData.date,
          scheduledTime: formData.time,
          estimatedDuration: scheduleDurationToMinutes(formData.duration, formData.durationType),
          durationValue: formData.duration,
          durationType: formData.durationType,
          informativeTemplateId: formData.informativeTemplateId,
          certificateTemplateId: formData.certificateTemplateId,
          autoSendInformative: formData.autoSendInformative,
          generateCertificateRequest: formData.generateCertificateRequest,
          notes: formData.notes,
        })

        if (canManageScheduleStatus && editingSchedule?.status !== formData.status) {
          return updateScheduleStatus(scheduleId, formData.status)
        }

        return response
      }

      const payload = {
        clientId: formData.clientId,
        unitId: scheduleId ? editingSchedule?.unitId ?? primaryUnit.id : primaryUnit.id,
        serviceTypeId: formData.serviceTypeIds[0],
        serviceTypeIds: formData.serviceTypeIds,
        serviceDocumentSettings: formData.serviceDocumentSettings,
        teamIds: formData.teamIds,
        additionalEmployeeIds: formData.employeeIds,
        scheduledDate: formData.date,
        scheduledTime: formData.time,
        estimatedDuration: scheduleDurationToMinutes(formData.duration, formData.durationType),
        durationValue: formData.duration,
        durationType: formData.durationType,
        informativeTemplateId: formData.informativeTemplateId,
        certificateTemplateId: formData.certificateTemplateId,
        autoSendInformative: formData.autoSendInformative,
        generateCertificateRequest: formData.generateCertificateRequest,
        isEmergency: formData.isEmergency,
        billable: formData.createContract,
        value: formData.createContract ? formData.value : 0,
        notes: formData.notes,
      }

      if (scheduleId) {
        const response = await updateSchedule(scheduleId, payload)
        if (canManageScheduleStatus && editingSchedule?.status !== formData.status) {
          return updateScheduleStatus(scheduleId, formData.status)
        }

        return response
      }

      return createSchedule(payload)
    },
    onMutate: (variables) => {
      const toastId = toast.loading(
        variables.scheduleId
          ? "Salvando agendamento e preparando os alertas..."
          : "Criando atendimento e preparando os alertas...",
      )
      return { toastId }
    },
    onSuccess: ({ data }, variables, context) => {
      cacheSavedSchedule(queryClient, data)
      closeScheduleDialog()
      toast.success(variables.scheduleId ? "Agendamento atualizado." : "Agendamento criado.", {
        id: context?.toastId,
        description: `${data.clientName} • ${data.serviceTypeName}`,
      })
      void invalidateSchedules().catch(() => undefined)
    },
    onError: (error: any, variables, context) => {
      const message = getApiErrorMessage(error, "Não foi possível salvar o agendamento.")
      toast.error(message, {
        id: context?.toastId,
      })
    },
  })

  const startMutation = useMutation({
    mutationFn: (schedule: ScheduleRecord) => startSchedule(schedule.id),
    onMutate: () => {
      const toastId = toast.loading("Iniciando atendimento...")
      return { toastId }
    },
    onSuccess: async (_data, _variables, context) => {
      await invalidateSchedules()
      setSelectedSchedule(null)
      toast.success("Atendimento iniciado.", {
        id: context?.toastId,
        description: "O agendamento foi movido para em andamento.",
      })
    },
    onError: (error, _variables, context) => {
      toast.error(getApiErrorMessage(error, "Não foi possível iniciar o atendimento."), {
        id: context?.toastId,
      })
    },
  })

  const importSchedulesMutation = useMutation({
    mutationFn: async (rows: Array<Record<string, string>>) => {
      if (clients.length === 0) throw new Error("Carregue os clientes antes de importar agendamentos.")
      if (services.length === 0) throw new Error("Carregue os serviços antes de importar agendamentos.")

      const payloads = rows.map((row, index) =>
        buildScheduleImportPayload(row, index, {
          clients,
          services,
          teams,
          employees,
        }),
      )

      for (const payload of payloads) {
        await createSchedule(payload)
      }
    },
    onSuccess: async (_data, rows) => {
      await invalidateSchedules()
      toast.success("Agendamentos importados.", {
        description: `${rows.length} registro(s) foram inseridos no banco de dados.`,
      })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Não foi possível importar os agendamentos."))
    },
  })

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => cancelSchedule(id, { cancellationReason: reason }),
    onMutate: () => {
      setCancelTarget(null)
      const toastId = toast.loading("Cancelando agendamento...")
      return { toastId }
    },
    onSuccess: (_data, _variables, context) => {
      toast.success("Agendamento cancelado.", {
        id: context?.toastId,
        description: "O motivo foi salvo no histórico.",
      })
      void invalidateSchedules().catch(() => undefined)
    },
    onError: (error, _variables, context) => {
      toast.error(getApiErrorMessage(error, "Não foi possível cancelar o agendamento."), {
        id: context?.toastId,
      })
    },
  })

  const reactivateMutation = useMutation({
    mutationFn: (schedule: ScheduleRecord) => reactivateSchedule(schedule.id),
    onMutate: () => {
      const toastId = toast.loading("Reativando agendamento...")
      return { toastId }
    },
    onSuccess: async ({ data }, _variables, context) => {
      await invalidateSchedules()
      toast.success("Agendamento reativado.", {
        id: context?.toastId,
        description: `${data.clientName} • ${data.serviceTypeName}`,
      })
    },
    onError: (error: any, _variables, context) => {
      toast.error(getApiErrorMessage(error, "Não foi possível reativar o agendamento."), {
        id: context?.toastId,
      })
    },
  })

  const uploadNaMutation = useMutation({
    mutationFn: async ({ schedule, files }: { schedule: ScheduleRecord; files: File[] }) => {
      let updatedSchedule = schedule
      for (const file of files) {
        const response = await uploadScheduleNa(schedule.id, file)
        updatedSchedule = response.data
      }
      return updatedSchedule
    },
    onMutate: ({ files }) => {
      const toastId = toast.loading(files.length === 1 ? "Salvando NA..." : `Salvando ${files.length} NAs...`)
      return { toastId }
    },
    onSuccess: async (updatedSchedule, _variables, context) => {
      setCompletionTarget((current) => current?.id === updatedSchedule.id ? updatedSchedule : current)
      setSelectedSchedule((current) => current?.id === updatedSchedule.id ? updatedSchedule : current)
      setCompletionFiles([])
      await invalidateSchedules()
      toast.success("NA salva no agendamento.", {
        id: context?.toastId,
        description: "O arquivo já está seguro e continuará disponível mesmo sem concluir o atendimento.",
      })
    },
    onError: async (error, variables, context) => {
      setCompletionFiles([])
      const refreshed = await getScheduleById(variables.schedule.id).catch(() => null)
      if (refreshed?.data) {
        setCompletionTarget((current) => current?.id === refreshed.data.id ? refreshed.data : current)
        setSelectedSchedule((current) => current?.id === refreshed.data.id ? refreshed.data : current)
      }
      await invalidateSchedules()
      toast.error(getApiErrorMessage(error, "Não foi possível salvar a NA."), {
        id: context?.toastId,
        description: "Os arquivos enviados antes da falha permanecem salvos. Confira a lista antes de tentar novamente.",
      })
    },
  })

  const completeMutation = useMutation({
    mutationFn: async ({
      schedule,
      startDate,
      startTime,
      endDate,
      endTime,
      driverEmployeeId,
      helperEmployeeIds,
      serviceReport,
    }: {
      schedule: ScheduleRecord
      startDate: string
      startTime: string
      endDate: string
      endTime: string
      driverEmployeeId: string
      helperEmployeeIds: string[]
      serviceReport: string
    }) => {
      const hasExistingNa = Boolean(schedule.naAttachments?.length || schedule.naDocumentUrl)
      if (!hasExistingNa) {
        throw new Error("Anexe a NA da visita antes de concluir o atendimento.")
      }

      return completeSchedule(schedule.id, {
        startDate,
        startTime,
        endDate,
        endTime,
        driverEmployeeId,
        helperEmployeeIds,
        serviceReport,
      })
    },
    onMutate: () => {
      const toastId = toast.loading("Concluindo atendimento...")
      return { toastId }
    },
    onSuccess: (_response, _variables, context) => {
      setCompletionTarget(null)
      setCompletionStep("attachments")
      setCompletionStartDate("")
      setCompletionStartTime("")
      setCompletionEndDate("")
      setCompletionEndTime("")
      setCompletionDriverEmployeeId("")
      setCompletionHelperEmployeeIds([])
      setCompletionServiceReport("")
      setCompletionFiles([])
      toast.success("Atendimento concluído.", {
        id: context?.toastId,
        description: "A agenda foi atualizada com o horário executado.",
      })
      void invalidateSchedules().catch(() => undefined)
    },
    onError: (error: any, _variables, context) => {
      toast.error(getApiErrorMessage(error, "Não foi possível concluir o atendimento."), {
        id: context?.toastId,
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSchedule(id),
    onMutate: () => {
      const toastId = toast.loading("Removendo agendamento...")
      return { toastId }
    },
    onSuccess: async (_data, _variables, context) => {
      await invalidateSchedules()
      setPendingDelete(null)
      toast.success("Agendamento excluído.", {
        id: context?.toastId,
        description: "O item foi removido com sucesso.",
      })
    },
    onError: (error, _variables, context) => {
      toast.error(getApiErrorMessage(error, "Não foi possível excluir o agendamento."), {
        id: context?.toastId,
      })
    },
  })

  const exportMutation = useMutation({
    mutationFn: () => exportSchedules({
      search: searchTerm.trim() || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      dateFrom: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
      dateTo: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
    }),
    onSuccess: (blob) => {
      const dateKey = format(new Date(), "yyyy-MM-dd")
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `agendamentos-filtrados-${dateKey}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      onExportChange?.(false)
      toast.success("Planilha de agendamentos exportada.")
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Não foi possível exportar os agendamentos."))
    },
  })

  const filteredSchedules = useMemo(() => {
    const term = deferredSearchTerm.toLowerCase()
    return schedules.filter((item) => {
      const matchesSearch =
        !term ||
        item.clientName.toLowerCase().includes(term) ||
        item.serviceTypeName.toLowerCase().includes(term) ||
        item.teams.some((team) => team.name.toLowerCase().includes(term)) ||
        item.additionalEmployees.some((employee) => employee.name.toLowerCase().includes(term))

      const matchesStatus = statusFilter === "all" || item.status === statusFilter
      const fromStr = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : ""
      const toStr = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : ""
      const matchesDateFrom = !fromStr || item.date >= fromStr
      const matchesDateTo = !toStr || item.date <= toStr

      return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo
    })
  }, [dateRange, schedules, deferredSearchTerm, statusFilter])

  const totalItems = filteredSchedules.length
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage))
  const paginatedSchedules = filteredSchedules.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const handleFormSubmit = (formData: SchedulingFormData, isEditing: boolean) => {
    if (saveMutation.isPending) return

    const scheduleId = isEditing ? editingSchedule?.id : undefined
    const statusOnlyChange = Boolean(isEditing && scheduleId && canManageScheduleStatus && editingSchedule?.status !== formData.status)
    if (!canManageAgenda && !statusOnlyChange) return
    if (!canManageAgenda && statusOnlyChange) {
      saveMutation.mutate({
        formData,
        scheduleId,
      })
      return
    }

    const capacityViolation = getDailyServiceCapacityViolation({
      schedules,
      ignoreScheduleId: scheduleId,
      serviceTypeIds: formData.serviceTypeIds,
      serviceTypes: services,
      date: formData.date,
      time: formData.time,
      durationMinutes: scheduleDurationToMinutes(formData.duration, formData.durationType),
      durationType: formData.durationType,
    })
    if (capacityViolation) {
      toast.error(formatDailyServiceCapacityViolation(capacityViolation, services))
      return
    }

    const availability = checkScheduleAvailability({
      schedules,
      teams,
      formData,
      ignoreScheduleId: scheduleId,
      mode: "manual",
    })

    if (!availability.available) {
      const conflictingResources = getScheduleConflictResourceNames(availability.conflict, {
        teams,
        employees,
      })
      const isTeamConflict = availability.conflict?.reason === "resource" && formData.teamIds.length > 0
      const message = availability.conflict?.reason === "resource"
        ? isTeamConflict
          ? "A equipe ou algum funcionário da equipe não tem disponibilidade para este agendamento."
          : "O funcionário selecionado não tem disponibilidade para este agendamento."
        : "O horário selecionado não está disponível para este agendamento."
      toast.error(message, {
        description: conflictingResources.length > 0 ? conflictingResources.join(", ") : undefined,
      })
      return
    }

    saveMutation.mutate({
      formData,
      scheduleId,
    })
  }

  const openEditSchedule = (schedule: ScheduleRecord) => {
    if (!canOpenScheduleEditor) return
    if (canManageAgenda && !canEditSchedule(schedule, canManageLockedSchedules)) return

    clearScheduleDialogResetTimeout()
    setSelectedSchedule(null)
    setCancelTarget(null)
    setCompletionTarget(null)
    setEditingSchedule(schedule)
    window.setTimeout(() => setIsDialogOpen(true), 0)
  }

  const openCompletionDialog = (schedule: ScheduleRecord) => {
    if (!(canManageAgenda || canManageScheduleStatus || schedule.canAttachNa)) return

    const now = currentCompletionDateTime()
    const defaultDate = schedule.completionStartDate || now.date || schedule.date
    setCompletionTarget(schedule)
    setCompletionStep("attachments")
    setCompletionStartDate(defaultDate)
    setCompletionStartTime(schedule.completionStartTime || schedule.time || "")
    setCompletionEndDate(schedule.completionEndDate || now.date || defaultDate)
    setCompletionEndTime(schedule.completionEndTime || now.time)
    setCompletionDriverEmployeeId(schedule.attendanceDriver?.id || "")
    setCompletionHelperEmployeeIds(schedule.attendanceHelpers?.map((employee) => employee.id) ?? [])
    setCompletionServiceReport(schedule.serviceReport || "")
    setCompletionFiles([])
  }

  const openSchedule = (schedule: ScheduleRecord) => {
    if (schedule.status === "in_progress" && (canManageAgenda || canManageScheduleStatus || schedule.canAttachNa)) {
      openCompletionDialog(schedule)
      return
    }

    setSelectedSchedule(schedule)
  }

  const canDeleteSchedule = (schedule: ScheduleRecord) => {
    return canManageAgenda &&
      !isRecurringSchedule(schedule)
  }

  return (
    <>
      <CsvImportDialog
        open={canManageAgenda && openImport}
        onOpenChange={(open) => onImportChange?.(open)}
        title="Importar agendamentos"
        description="Mapeie as colunas do CSV antes de inserir os agendamentos."
        fields={SCHEDULE_IMPORT_FIELDS}
        onImport={(rows) => canManageAgenda ? importSchedulesMutation.mutateAsync(rows) : Promise.resolve()}
      />

      <SchedulingFormDialog
        open={isDialogOpen}
        onOpenChange={handleScheduleDialogChange}
        editingSchedule={editingSchedule}
        onSubmit={handleFormSubmit}
        clients={clients}
        serviceTypes={services}
        teams={teams}
        employees={employees}
        canManageStatus={canManageScheduleStatus}
        canEditDetails={canManageAgenda}
        isSubmitting={saveMutation.isPending}
      />

      <ScheduleDetailsDialog
        open={!!selectedSchedule}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSchedule(null)
            if (initialScheduleId) router.replace("/agendamentos")
          }
        }}
        schedule={selectedSchedule}
        schedules={schedules}
        teams={teams}
        serviceTypes={services}
        isStartingAttendance={startMutation.isPending}
        canManage={canManageAgenda}
        canStart={selectedSchedule ? canStartSchedule(selectedSchedule, currentUser, teams) : false}
        canStartOutsideScheduledDate={canManageAgenda}
        canReschedule={canManageAgenda}
        canEdit={Boolean(
          selectedSchedule &&
            (canManageScheduleStatus ||
              (canManageAgenda && canEditSchedule(selectedSchedule, canManageLockedSchedules))),
        )}
        onEdit={() => {
          if (selectedSchedule) openEditSchedule(selectedSchedule)
        }}
        onStartAttendance={async (schedule) => {
          if (!canStartSchedule(schedule, currentUser, teams)) return
          await startMutation.mutateAsync(schedule)
        }}
      />

      <CancelScheduleDialog
        open={!!cancelTarget}
        clientName={cancelTarget?.clientName}
        initialReason={cancelTarget?.cancellationReason || ""}
        busy={cancelMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null)
        }}
        onConfirm={(reason) => {
          if (cancelTarget) cancelMutation.mutate({ id: cancelTarget.id, reason })
        }}
      />

      <Dialog
        open={!!completionTarget}
        onOpenChange={(open) => {
          if (!open) {
            setCompletionTarget(null)
            setCompletionStep("attachments")
            setCompletionStartDate("")
            setCompletionStartTime("")
            setCompletionEndDate("")
            setCompletionEndTime("")
            setCompletionDriverEmployeeId("")
            setCompletionHelperEmployeeIds([])
            setCompletionServiceReport("")
            setCompletionFiles([])
          }
        }}
      >
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] min-w-0 flex-col gap-0 overflow-hidden p-0 max-sm:left-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-none max-sm:w-screen max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0 max-sm:[&_[data-slot=dialog-close]]:right-5 max-sm:[&_[data-slot=dialog-close]]:top-[calc(env(safe-area-inset-top)+1rem)] sm:max-w-lg">
          <DialogHeader className="min-w-0 px-6 pb-4 pt-6 max-sm:px-5 max-sm:pt-[calc(env(safe-area-inset-top)+1.75rem)]">
            <DialogTitle>
              {completionStep === "checkout" ? "Encerrar atendimento" : "NAs do atendimento"}
            </DialogTitle>
            <DialogDescription>
              {completionStep === "checkout"
                ? "Informe o período executado, a equipe de apoio e as observações para confirmar o encerramento."
                : "A NA é salva assim que for adicionada. Você pode anexar uma por dia e concluir o atendimento somente no último dia."}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-5 max-sm:px-5">
            {completionStep === "checkout" ? (
              <AttendanceCompletionFields
                idPrefix="schedule-completion"
                startDate={completionStartDate}
                startTime={completionStartTime}
                endDate={completionEndDate}
                endTime={completionEndTime}
                driverEmployeeId={completionDriverEmployeeId}
                helperEmployeeIds={completionHelperEmployeeIds}
                serviceReport={completionServiceReport}
                employees={completionEmployees}
                disabled={completeMutation.isPending || completionEmployeesQuery.isLoading}
                onStartDateChange={setCompletionStartDate}
                onStartTimeChange={setCompletionStartTime}
                onEndDateChange={setCompletionEndDate}
                onEndTimeChange={setCompletionEndTime}
                onDriverEmployeeIdChange={setCompletionDriverEmployeeId}
                onHelperEmployeeIdsChange={setCompletionHelperEmployeeIds}
                onServiceReportChange={setCompletionServiceReport}
              />
            ) : (
              <CompletionNaAttachments
                existingAttachments={completionTarget?.naAttachments ?? []}
                files={completionFiles}
                disabled={completeMutation.isPending || uploadNaMutation.isPending}
                uploading={uploadNaMutation.isPending}
                onAddFiles={(files) => {
                  if (!completionTarget || uploadNaMutation.isPending) return
                  setCompletionFiles(files)
                  uploadNaMutation.mutate({ schedule: completionTarget, files })
                }}
                onRemoveFile={() => undefined}
              />
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-2 bg-background px-6 pb-6 pt-3 max-sm:px-5 max-sm:pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="w-full min-w-0 sm:w-auto"
              onClick={() => {
                if (completionStep === "checkout") {
                  setCompletionStep("attachments")
                  return
                }
                setCompletionTarget(null)
              }}
            >
              Voltar
            </Button>
            {completionStep === "attachments" ? (
              <AttendanceStartSlider
                action="finish"
                className="sm:hidden"
                disabled={completeMutation.isPending || uploadNaMutation.isPending}
                onComplete={() => setCompletionStep("checkout")}
              />
            ) : null}
            <Button
              type="button"
              className={
                completionStep === "attachments"
                  ? "hidden w-full min-w-0 sm:inline-flex sm:w-auto"
                  : "w-full min-w-0 sm:w-auto"
              }
              disabled={
                !completionTarget ||
                (!completionTarget.naAttachments?.length && !completionTarget.naDocumentUrl) ||
                uploadNaMutation.isPending ||
                completeMutation.isPending ||
                (completionStep === "checkout" &&
                  (!completionStartDate ||
                    !completionStartTime ||
                    !completionEndDate ||
                    !completionEndTime))
              }
              onClick={() => {
                if (!completionTarget) return
                if (completionStep === "attachments") {
                  setCompletionStep("checkout")
                  return
                }

                const startedAt = new Date(`${completionStartDate}T${completionStartTime}:00`)
                const completedAt = new Date(`${completionEndDate}T${completionEndTime}:00`)
                if (completedAt.getTime() <= startedAt.getTime()) {
                  toast.error("A data e o horário final devem ser maiores que o início.")
                  return
                }

                completeMutation.mutate({
                  schedule: completionTarget,
                  startDate: completionStartDate,
                  startTime: completionStartTime,
                  endDate: completionEndDate,
                  endTime: completionEndTime,
                  driverEmployeeId: completionDriverEmployeeId,
                  helperEmployeeIds: completionHelperEmployeeIds,
                  serviceReport: completionServiceReport,
                })
              }}
            >
              {completeMutation.isPending ? (
                "Encerrando..."
              ) : completionStep === "checkout" ? (
                "Confirmar encerramento"
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4 shrink-0" />
                  Encerrar atendimento
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className={`${mobileFiltersOpen ? "grid" : "hidden"} -m-1 w-full min-w-0 shrink-0 grid-cols-2 gap-2 overflow-visible p-1 sm:flex sm:items-center`}>
          <FilterSearchInput
            wrapperClassName="col-span-2 sm:w-80"
            placeholder="Buscar cliente, serviço, equipe..."
            value={searchTerm}
            spellCheck={false}
            onValueChange={(value) => {
              setSearchTerm(value)
              setCurrentPage(1)
            }}
          />
          <SearchableSelect
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value)
              setCurrentPage(1)
            }}
            options={SCHEDULE_STATUS_FILTER_OPTIONS}
            placeholder="Status"
            searchPlaceholder="Buscar status..."
            allLabel="Todos os status"
            className="col-span-2 w-full sm:w-[160px]"
          />
          <DateRangePicker
            value={dateRange}
            onChange={(range) => {
              setDateRange(range)
              setCurrentPage(1)
            }}
            placeholder="Filtrar data"
            className="col-span-2 w-full min-w-0 sm:w-[360px]"
          />
          {viewToggle ? <div className="hidden shrink-0 sm:block">{viewToggle}</div> : null}
        </div>

        {viewMode === "table" ? (
          <div className="rounded-md md:min-h-0 md:flex-1 md:overflow-hidden">
            <Table containerClassName="md:h-full" onSortChange={() => setCurrentPage(1)}>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Cliente</TableHead>
                  <TableHead className="hidden sm:table-cell">Serviço</TableHead>
                  <TableHead className="hidden lg:table-cell">Tipo</TableHead>
                  <TableHead className="hidden md:table-cell">Equipe / Funcionários</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody page={!schedulesQuery.isLoading && filteredSchedules.length > 0 ? currentPage : undefined} pageSize={!schedulesQuery.isLoading && filteredSchedules.length > 0 ? itemsPerPage : undefined}>
                {schedulesQuery.isLoading ? (
                  <TableSkeletonRows
                    rows={5}
                    columns={[
                      { withIcon: true, width: "w-40" },
                      { className: "hidden sm:table-cell", width: "w-44" },
                      { className: "hidden lg:table-cell", width: "w-24" },
                      { className: "hidden md:table-cell", width: "w-36" },
                      { width: "w-28" },
                      { width: "w-24" },
                      { align: "right", width: "w-20" },
                    ]}
                  />
                ) : filteredSchedules.length === 0 ? (
                  <TableEmptyState colSpan={7} icon={Calendar} title="Nenhum agendamento encontrado." />
                ) : (
                  filteredSchedules.map((schedule) => (
                    <TableRow
                      key={schedule.id}
                      className="cursor-pointer"
                      onClick={() => openSchedule(schedule)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:flex ${getScheduleIconTone(schedule).wrapper}`}>
                            <Calendar className={`h-5 w-5 ${getScheduleIconTone(schedule).icon}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                              <p className="min-w-0 truncate font-semibold text-foreground">{schedule.clientName}</p>
                              {schedule.isClientDelinquent ? <BusinessStatusBadge status="delinquent" /> : null}
                            </div>
                            <p className="text-xs text-muted-foreground sm:hidden">
                              {schedule.serviceTypeName} • {formatConfiguredScheduleDuration(schedule)}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <p>{schedule.serviceTypeName}</p>
                        <p className="text-xs text-muted-foreground">{formatConfiguredScheduleDuration(schedule)}</p>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <ScheduleTypeBadge schedule={schedule} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-wrap gap-1.5">
                          {schedule.teams.map((team) => (
                            <Badge
                              key={team.id}
                              variant="secondary"
                              className="flex items-center gap-2 px-3 py-1 text-xs text-foreground/80"
                              style={{ backgroundColor: `${team.color}1A` }}
                            >
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: team.color }} />
                              {team.name}
                            </Badge>
                          ))}
                          {schedule.additionalEmployees.map((employee) => (
                            <Badge key={employee.id} variant="outline" className="px-3 py-1 text-xs">
                              {employee.name}
                            </Badge>
                          ))}
                          {!schedule.teams.length && !schedule.additionalEmployees.length ? "-" : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{formatCivilDate(getDisplayedScheduleDate(schedule))}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{getDisplayedScheduleTime(schedule)}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(schedule.status)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Abrir ações do agendamento de ${schedule.clientName}`}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={(event) => {
                                event.stopPropagation()
                                setSelectedSchedule(schedule)
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              Visualizar
                            </DropdownMenuItem>
                            {(canManageScheduleStatus || (canManageAgenda && canEditSchedule(schedule, canManageLockedSchedules))) && (
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  openEditSchedule(schedule)
                                }}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            {schedule.status === "in_progress" && (canManageAgenda || canManageScheduleStatus || schedule.canAttachNa) && (
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  openCompletionDialog(schedule)
                                }}
                              >
                                <Check className="mr-2 h-4 w-4" />
                                NAs e conclusão
                              </DropdownMenuItem>
                            )}
                            {canManageAgenda && schedule.status === "cancelled" && (
                              <DropdownMenuItem
                                className="cursor-pointer"
                                disabled={reactivateMutation.isPending && reactivateMutation.variables?.id === schedule.id}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  reactivateMutation.mutate(schedule)
                                }}
                              >
                                {reactivateMutation.isPending && reactivateMutation.variables?.id === schedule.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                )}
                                Reativar
                              </DropdownMenuItem>
                            )}
                            {canManageAgenda && canCancelSchedule(schedule) && (
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setCancelTarget(schedule)
                                }}
                              >
                                <X className="mr-2 h-4 w-4" />
                                Cancelar
                              </DropdownMenuItem>
                            )}
                            {canDeleteSchedule(schedule) && (
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setPendingDelete(schedule)
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="md:min-h-0 md:flex-1 md:overflow-y-auto md:pr-1">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {schedulesQuery.isLoading ? (
                <CardSkeletonGrid cards={4} />
              ) : paginatedSchedules.length === 0 ? (
                <EmptyState icon={Calendar} title="Nenhum agendamento encontrado." className="sm:col-span-2" />
              ) : paginatedSchedules.map((schedule) => (
                <Card key={schedule.id} className="h-full cursor-pointer" onClick={() => openSchedule(schedule)}>
                  <CardContent className="flex flex-1 flex-col">
                    <div className="mb-2 flex min-w-0 items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <div className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:flex ${getScheduleIconTone(schedule).wrapper}`}>
                          <Calendar className={`h-5 w-5 ${getScheduleIconTone(schedule).icon}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <h4 className="min-w-0 break-words text-sm font-semibold text-foreground">{schedule.clientName}</h4>
                            {schedule.isClientDelinquent ? <BusinessStatusBadge status="delinquent" /> : null}
                          </div>
                          <p className="text-xs text-muted-foreground">{schedule.serviceTypeName}</p>
                        </div>
                      </div>
                      {getStatusBadge(schedule.status)}
                    </div>
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <ScheduleTypeBadge schedule={schedule} />
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {getDisplayedScheduleTime(schedule)} ({formatConfiguredScheduleDuration(schedule)})
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {formatCivilDate(getDisplayedScheduleDate(schedule))}
                      </div>
                    </div>
                    {schedule.teams.length > 0 || schedule.additionalEmployees.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {schedule.teams.map((team) => (
                          <Badge
                            key={team.id}
                            variant="secondary"
                            className="flex items-center gap-2 px-3 py-1 text-xs text-foreground/80"
                            style={{ backgroundColor: `${team.color}1A` }}
                          >
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: team.color }} />
                            {team.name}
                          </Badge>
                        ))}
                        {schedule.additionalEmployees.map((employee) => (
                          <Badge key={employee.id} variant="outline" className="px-3 py-1 text-xs">
                            {employee.name}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    {canOpenScheduleEditor ? (
                    <div className="mt-auto grid grid-cols-2 gap-2 pt-3 [&>*:only-child]:col-span-2" onClick={(event) => event.stopPropagation()}>
                      {(canManageScheduleStatus || (canManageAgenda && canEditSchedule(schedule, canManageLockedSchedules))) && (
                        <Button type="button" variant="outline" size="sm" className="h-8 rounded-full" onClick={() => openEditSchedule(schedule)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </Button>
                      )}
                      {canManageAgenda && schedule.status === "cancelled" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-full"
                          disabled={reactivateMutation.isPending && reactivateMutation.variables?.id === schedule.id}
                          onClick={() => reactivateMutation.mutate(schedule)}
                        >
                          {reactivateMutation.isPending && reactivateMutation.variables?.id === schedule.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="mr-2 h-4 w-4" />
                          )}
                          Reativar
                        </Button>
                      )}
                      {canManageAgenda && canCancelSchedule(schedule) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-full"
                          onClick={() => {
                            setCancelTarget(schedule)
                          }}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Cancelar
                        </Button>
                      )}
                      {canDeleteSchedule(schedule) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-full"
                          onClick={() => setPendingDelete(schedule)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </Button>
                      )}
                    </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {!schedulesQuery.isLoading ? (
          <DataPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={itemsPerPage}
            totalItems={totalItems}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setItemsPerPage(size)
              setCurrentPage(1)
            }}
          />
        ) : null}
      </div>

      <ConfirmActionDialog
        open={openExport}
        title="Exportar agendamentos"
        description="O resultado será gerado de acordo com os filtros aplicados na página."
        confirmLabel="Exportar"
        cancelLabel="Cancelar"
        confirmVariant="default"
        busy={exportMutation.isPending}
        onOpenChange={(open) => {
          if (!exportMutation.isPending) onExportChange?.(open)
        }}
        onConfirm={() => exportMutation.mutate()}
      />

      <ConfirmActionDialog
        open={!!pendingDelete}
        title="Excluir agendamento"
        description={`Tem certeza que deseja excluir ${pendingDelete?.clientName ? `o agendamento de ${pendingDelete.clientName}` : "este agendamento"}? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        onConfirm={() => {
          if (pendingDelete && canDeleteSchedule(pendingDelete)) {
            deleteMutation.mutate(pendingDelete.id)
          }
        }}
        busy={deleteMutation.isPending}
      />

    </>
  )
}
