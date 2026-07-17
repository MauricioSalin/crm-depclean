"use client"

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"
import { toast } from "sonner"
import {
  Calendar,
  Check,
  Clock,
  Edit,
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
  getScheduleById,
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
import { useUrlQueryState } from "@/lib/hooks/use-url-query-state"
import { formatConfiguredScheduleDuration, minutesToScheduleDuration, scheduleDurationToMinutes } from "@/lib/schedule-duration"
import { checkScheduleAvailability, formatAvailabilitySlot } from "@/lib/schedule-availability"
import { canStartSchedule } from "@/lib/schedule-permissions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
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
import { Label } from "@/components/ui/label"
import { DataPagination } from "@/components/ui/data-pagination"
import { CsvImportDialog, type CsvImportField } from "@/components/ui/csv-import-dialog"
import { EmptyState, TableEmptyState } from "@/components/ui/empty-state"
import { CardSkeletonGrid, TableSkeletonRows } from "@/components/ui/table-skeleton"
import { ScheduleTypeBadge } from "@/components/ui/schedule-type-badge"
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

export function AgendamentosContent({ viewMode, openDialog, onDialogChange, viewToggle, openImport = false, onImportChange, initialScheduleId }: AgendamentosContentProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const mobileFiltersOpen = useMobileFiltersOpen()
  const [searchTerm, setSearchTerm] = useUrlQueryState("q")
  const deferredSearchTerm = useDeferredValue(searchTerm)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<ScheduleRecord | null>(null)
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleRecord | null>(null)
  const [cancelTarget, setCancelTarget] = useState<ScheduleRecord | null>(null)
  const [completionTarget, setCompletionTarget] = useState<ScheduleRecord | null>(null)
  const [completionStartDate, setCompletionStartDate] = useState("")
  const [completionStartTime, setCompletionStartTime] = useState("")
  const [completionEndDate, setCompletionEndDate] = useState("")
  const [completionEndTime, setCompletionEndTime] = useState("")
  const [completionFiles, setCompletionFiles] = useState<File[]>([])
  const [pendingDelete, setPendingDelete] = useState<ScheduleRecord | null>(null)
  const [availabilitySuggestion, setAvailabilitySuggestion] = useState<{
    formData: SchedulingFormData
    scheduleId?: string
    requested: { date: string; time: string }
    suggested: { date: string; time: string }
  } | null>(null)
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

  const schedules = schedulesQuery.data?.data ?? []
  const clients = clientsQuery.data?.data ?? []
  const services = servicesQuery.data?.data ?? []
  const teams = teamsQuery.data?.data ?? []
  const employees = employeesQuery.data?.data ?? []
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
    mutationFn: async ({ formData, scheduleId }: { formData: SchedulingFormData; scheduleId?: string }) => {
      const client = clients.find((item) => item.id === formData.clientId)
      const primaryUnit = client?.units.find((unit) => unit.isPrimary) ?? client?.units[0]
      if (!primaryUnit) {
        throw new Error("Cliente sem unidade disponível para agendamento.")
      }

      const isRecurringScheduleUpdate = Boolean(scheduleId && editingSchedule?.contractId && !editingSchedule.isManual)
      if (scheduleId && !canManageAgenda && canManageScheduleStatus) {
        return updateScheduleStatus(scheduleId, formData.status)
      }

      if (scheduleId && isRecurringScheduleUpdate) {
        const response = await updateSchedule(scheduleId, {
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
        unitId: primaryUnit.id,
        serviceTypeId: formData.serviceTypeId,
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
      const toastId = toast.loading(variables.scheduleId ? "Salvando agendamento..." : "Criando atendimento...")
      return { toastId }
    },
    onSuccess: async ({ data }, variables, context) => {
      await invalidateSchedules()
      closeScheduleDialog()
      toast.success(variables.scheduleId ? "Agendamento atualizado." : "Agendamento criado.", {
        id: context?.toastId,
        description: `${data.clientName} • ${data.serviceTypeName}`,
      })
    },
    onError: (error: any, _variables, context) => {
      toast.error(getApiErrorMessage(error, "Não foi possível salvar o agendamento."), {
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
      const toastId = toast.loading("Cancelando agendamento...")
      return { toastId }
    },
    onSuccess: async (_data, _variables, context) => {
      await invalidateSchedules()
      setCancelTarget(null)
      toast.success("Agendamento cancelado.", {
        id: context?.toastId,
        description: "O motivo foi salvo no histórico.",
      })
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

  const completeMutation = useMutation({
    mutationFn: async ({ schedule, startDate, startTime, endDate, endTime, files }: { schedule: ScheduleRecord; startDate: string; startTime: string; endDate: string; endTime: string; files: File[] }) => {
      const hasExistingNa = Boolean(schedule.naAttachments?.length || schedule.naDocumentUrl)
      if (files.length === 0 && !hasExistingNa) {
        throw new Error("Anexe a NA da visita antes de concluir o atendimento.")
      }

      for (const file of files) {
        await uploadScheduleNa(schedule.id, file)
      }

      return completeSchedule(schedule.id, { startDate, startTime, endDate, endTime })
    },
    onMutate: () => {
      const toastId = toast.loading("Concluindo atendimento...")
      return { toastId }
    },
    onSuccess: async (_response, _variables, context) => {
      await invalidateSchedules()
      setCompletionTarget(null)
      setCompletionStartDate("")
      setCompletionStartTime("")
      setCompletionEndDate("")
      setCompletionEndTime("")
      setCompletionFiles([])
      toast.success("Atendimento concluído.", {
        id: context?.toastId,
        description: "A agenda foi atualizada com o horário executado.",
      })
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

    const availability = checkScheduleAvailability({
      schedules,
      teams,
      formData,
      ignoreScheduleId: scheduleId,
    })

    if (!availability.available && availability.suggested) {
      setAvailabilitySuggestion({
        formData,
        scheduleId,
        requested: {
          date: availability.requested.date,
          time: availability.requested.time,
        },
        suggested: availability.suggested,
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
    if (!canManageAgenda) return

    const now = currentCompletionDateTime()
    const defaultDate = schedule.date || now.date
    setCompletionTarget(schedule)
    setCompletionStartDate(schedule.completionStartDate || defaultDate)
    setCompletionStartTime(schedule.completionStartTime || schedule.time || "")
    setCompletionEndDate(schedule.completionEndDate || now.date || schedule.completionStartDate || defaultDate)
    setCompletionEndTime(schedule.completionEndTime || now.time)
    setCompletionFiles([])
  }

  const openSchedule = (schedule: ScheduleRecord) => {
    if (canManageAgenda && schedule.status === "in_progress") {
      openCompletionDialog(schedule)
      return
    }

    setSelectedSchedule(schedule)
  }

  const canDeleteSchedule = (schedule: ScheduleRecord) => {
    return canManageAgenda &&
      canManageLockedSchedules &&
      ["cancelled", "completed"].includes(schedule.status) &&
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
        isStartingAttendance={startMutation.isPending}
        canManage={canManageAgenda}
        canStart={selectedSchedule ? canStartSchedule(selectedSchedule, currentUser, teams) : false}
        canReschedule={canManageAgenda}
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
            setCompletionStartDate("")
            setCompletionStartTime("")
            setCompletionEndDate("")
            setCompletionEndTime("")
            setCompletionFiles([])
          }
        }}
      >
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] min-w-0 flex-col gap-0 overflow-hidden p-0 max-sm:left-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-none max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0 max-sm:[&_[data-slot=dialog-close]]:right-5 max-sm:[&_[data-slot=dialog-close]]:top-[calc(env(safe-area-inset-top)+1rem)] sm:max-w-lg">
          <DialogHeader className="min-w-0 px-6 pb-4 pt-6 max-sm:px-5 max-sm:pt-[calc(env(safe-area-inset-top)+1.75rem)]">
            <DialogTitle>Concluir agendamento</DialogTitle>
            <DialogDescription>
              Registre o horário executado e anexe a NA da visita para vincular ao cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-5 max-sm:px-5">
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="completion-start-date">Data de início *</Label>
                <Input
                  id="completion-start-date"
                  type="date"
                  value={completionStartDate}
                  onChange={(event) => setCompletionStartDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="completion-start">Horário de início *</Label>
                <Input
                  id="completion-start"
                  type="time"
                  value={completionStartTime}
                  onChange={(event) => setCompletionStartTime(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="completion-end-date">Data de fim *</Label>
                <Input
                  id="completion-end-date"
                  type="date"
                  value={completionEndDate}
                  onChange={(event) => setCompletionEndDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="completion-end">Horário de fim *</Label>
                <Input
                  id="completion-end"
                  type="time"
                  value={completionEndTime}
                  onChange={(event) => setCompletionEndTime(event.target.value)}
                />
              </div>
            </div>
            <CompletionNaAttachments
              existingAttachments={completionTarget?.naAttachments ?? []}
              files={completionFiles}
              disabled={completeMutation.isPending}
              onAddFiles={(files) => setCompletionFiles((current) => [...current, ...files])}
              onRemoveFile={(index) => setCompletionFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))}
            />
          </div>
          <DialogFooter className="gap-2 px-6 pb-6 pt-3 max-sm:px-5 max-sm:pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:gap-2">
            <Button type="button" variant="outline" className="w-full min-w-0 sm:w-auto" onClick={() => setCompletionTarget(null)}>
              Voltar
            </Button>
            <Button
              type="button"
              className="w-full min-w-0 sm:w-auto"
              disabled={
                !completionTarget ||
                !completionStartDate ||
                !completionStartTime ||
                !completionEndDate ||
                !completionEndTime ||
                (completionFiles.length === 0 && !completionTarget.naAttachments?.length && !completionTarget.naDocumentUrl) ||
                completeMutation.isPending
              }
              onClick={() =>
                completionTarget &&
                completeMutation.mutate({
                  schedule: completionTarget,
                  startDate: completionStartDate,
                  startTime: completionStartTime,
                  endDate: completionEndDate,
                  endTime: completionEndTime,
                  files: completionFiles,
                })
              }
            >
              {completeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
                  <span className="truncate">Concluindo...</span>
                </>
              ) : (
                "Concluir visita"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className={`${mobileFiltersOpen ? "grid" : "hidden"} -m-1 shrink-0 grid-cols-2 gap-2 overflow-visible p-1 sm:flex sm:items-center`}>
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
            options={[
              { value: "draft", label: "Rascunho" },
              { value: "scheduled", label: "Agendado" },
              { value: "in_progress", label: "Em andamento" },
              { value: "completed", label: "Concluído" },
              { value: "cancelled", label: "Cancelado" },
            ]}
            placeholder="Status"
            searchPlaceholder="Buscar status..."
            allLabel="Todos os status"
            className="sm:w-[160px]"
          />
          <DateRangePicker
            value={dateRange}
            onChange={(range) => {
              setDateRange(range)
              setCurrentPage(1)
            }}
            placeholder="Filtrar data"
            className="sm:w-[218px]"
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
                          <div>
                            <p className="font-semibold text-foreground">{schedule.clientName}</p>
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
                          <span>{formatCivilDate(schedule.date)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{schedule.time}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(schedule.status)}</TableCell>
                      <TableCell className="text-right">
                        {canOpenScheduleEditor ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={(event) => event.stopPropagation()}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
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
                            {canManageAgenda && schedule.status === "in_progress" && (
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  openCompletionDialog(schedule)
                                }}
                              >
                                <Check className="mr-2 h-4 w-4" />
                                Concluir
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
                        ) : null}
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
                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:flex ${getScheduleIconTone(schedule).wrapper}`}>
                          <Calendar className={`h-5 w-5 ${getScheduleIconTone(schedule).icon}`} />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-foreground">{schedule.clientName}</h4>
                          <p className="text-xs text-muted-foreground">{schedule.serviceTypeName}</p>
                        </div>
                      </div>
                      {getStatusBadge(schedule.status)}
                    </div>
                    <div className="mb-2">
                      <ScheduleTypeBadge schedule={schedule} />
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {schedule.time} ({formatConfiguredScheduleDuration(schedule)})
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {formatCivilDate(schedule.date)}
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
                      {canManageAgenda && schedule.status === "in_progress" && (
                        <Button type="button" variant="outline" size="sm" className="h-8 rounded-full" onClick={() => openCompletionDialog(schedule)}>
                          <Check className="mr-2 h-4 w-4" />
                          Concluir
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
                          className="h-8 rounded-full text-destructive hover:text-destructive"
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

      <Dialog
        open={!!availabilitySuggestion}
        onOpenChange={(open) => {
          if (!open) setAvailabilitySuggestion(null)
        }}
      >
        <DialogContent className="max-sm:left-0 max-sm:top-3 max-sm:h-[calc(100dvh-1.5rem)] max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:overflow-y-auto max-sm:rounded-none max-sm:border-0 sm:max-w-md">
          <DialogHeader className="min-w-0 pr-6">
            <DialogTitle>Horário indisponível</DialogTitle>
            <DialogDescription>
              Já existe um agendamento para a equipe ou funcionário nesse intervalo.
            </DialogDescription>
          </DialogHeader>
          {availabilitySuggestion ? (
            <div className="space-y-3 rounded-2xl border bg-muted/40 p-4 text-sm">
              <div>
                <p className="font-medium">Horário solicitado</p>
                <p className="text-muted-foreground">
                  {formatAvailabilitySlot(availabilitySuggestion.requested.date, availabilitySuggestion.requested.time)}
                </p>
              </div>
              <div>
                <p className="font-medium">Horário mais próximo disponível</p>
                <p className="text-muted-foreground">
                  {formatAvailabilitySlot(availabilitySuggestion.suggested.date, availabilitySuggestion.suggested.time)}
                </p>
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setAvailabilitySuggestion(null)}>
              Voltar
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!availabilitySuggestion) return
                saveMutation.mutate({
                  formData: {
                    ...availabilitySuggestion.formData,
                    date: availabilitySuggestion.suggested.date,
                    time: availabilitySuggestion.suggested.time,
                  },
                  scheduleId: availabilitySuggestion.scheduleId,
                })
                setAvailabilitySuggestion(null)
              }}
            >
              Usar horário sugerido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
