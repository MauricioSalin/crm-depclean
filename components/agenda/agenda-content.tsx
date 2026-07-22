"use client"

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  Calendar,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit,
  Loader2,
  MapPin,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Search,
  X,
} from "lucide-react"

import { listClients } from "@/lib/api/clients"
import { listEmployees } from "@/lib/api/employees"
import { getApiErrorMessage } from "@/lib/api/errors"
import { listSchedules, createSchedule, updateSchedule, updateScheduleStatus, startSchedule, completeSchedule, cancelSchedule, reactivateSchedule, uploadScheduleNa, type ScheduleRecord } from "@/lib/api/schedules"
import { listServices } from "@/lib/api/services"
import { listTeams } from "@/lib/api/teams"
import { hasAnyPermission } from "@/lib/auth/permissions"
import { getStoredUser } from "@/lib/auth/session"
import { addCivilDaysKey, addCivilMonthsKey, parseCivilDate, toBrasiliaTimeKey, toCivilDateKey } from "@/lib/date-utils"
import { useMobileFiltersOpen } from "@/lib/hooks/use-mobile-filters"
import { useUrlQueryState } from "@/lib/hooks/use-url-query-state"
import { cn } from "@/lib/utils"
import { checkScheduleAvailability, formatAvailabilitySlot } from "@/lib/schedule-availability"
import { canStartSchedule } from "@/lib/schedule-permissions"
import type { RecurrenceType } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { FilterSearchInput } from "@/components/ui/filter-search-input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WeekTimeline } from "./week-timeline"
import { CompletionNaAttachments } from "@/components/agendamentos/completion-na-attachments"
import { ScheduleDetailsDialog } from "@/components/agendamentos/schedule-details-dialog"
import { CancelScheduleDialog } from "@/components/agendamentos/cancel-schedule-dialog"
import { SchedulingFormDialog, type SchedulingFormData } from "@/components/agendamentos/scheduling-form-dialog"
import {
  formatConfiguredScheduleDuration,
  scheduleDurationToMinutes,
} from "@/lib/schedule-duration"

type AgendaRecurrenceType = "none" | "daily" | RecurrenceType

type AgendaRecurrenceConfig = {
  type: AgendaRecurrenceType
  daysOfWeek: number[]
  interval: number
}

type AgendaScheduledServiceRow = ScheduleRecord & {
  recurrence: AgendaRecurrenceConfig
}

const AGENDA_WORKDAY_START_TIME = "08:00"
const AGENDA_DAY_DURATION_MINUTES = 9 * 60
const DAY_PANEL_CONTENT_HIDE_MS = 80
const DAY_PANEL_DRAWER_MS = 500

const DEFAULT_RECURRENCE: AgendaRecurrenceConfig = {
  type: "none",
  daysOfWeek: [],
  interval: 1,
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Dom", fullLabel: "Domingo" },
  { value: 1, label: "Seg", fullLabel: "Segunda" },
  { value: 2, label: "Ter", fullLabel: "Terça" },
  { value: 3, label: "Qua", fullLabel: "Quarta" },
  { value: 4, label: "Qui", fullLabel: "Quinta" },
  { value: 5, label: "Sex", fullLabel: "Sexta" },
  { value: 6, label: "Sáb", fullLabel: "Sábado" },
] as const

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const

function weekdayFromCivilDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value))
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1)).getUTCDay()
}

function isWeekendCivilDateKey(dateKey: string) {
  const weekday = weekdayFromCivilDateKey(dateKey)
  return weekday === 0 || weekday === 6
}

function toBusinessDateKey(dateKey: string) {
  let current = dateKey
  while (isWeekendCivilDateKey(current)) {
    current = addCivilDaysKey(current, 1)
  }
  return current
}

function nextBusinessDateKey(dateKey: string) {
  let current = addCivilDaysKey(dateKey, 1)
  while (isWeekendCivilDateKey(current)) {
    current = addCivilDaysKey(current, 1)
  }
  return current
}

function isFullDaySchedule(schedule: Pick<AgendaScheduledServiceRow, "duration" | "durationType">) {
  return schedule.durationType === "days" || (!schedule.durationType && Number(schedule.duration) > AGENDA_DAY_DURATION_MINUTES)
}

function scheduleDaySpan(schedule: Pick<AgendaScheduledServiceRow, "duration" | "durationType">) {
  if (!isFullDaySchedule(schedule)) return 1
  return Math.max(1, Math.ceil(Number(schedule.duration || AGENDA_DAY_DURATION_MINUTES) / AGENDA_DAY_DURATION_MINUTES))
}

function scheduleOccupiesDate(schedule: AgendaScheduledServiceRow, dateKey: string) {
  if (!isFullDaySchedule(schedule)) return schedule.date === dateKey

  let currentDate = toBusinessDateKey(schedule.date)
  const days = scheduleDaySpan(schedule)
  for (let index = 0; index < days; index += 1) {
    if (currentDate === dateKey) return true
    currentDate = nextBusinessDateKey(currentDate)
  }

  return false
}

interface AgendaContentProps {
  openDialog?: boolean
  onDialogChange?: (open: boolean) => void
}

const currentCompletionDateTime = () => {
  const now = new Date()
  const date = toCivilDateKey(now)
  const time = toBrasiliaTimeKey(now)
  return { date, time }
}

const mapSchedule = (schedule: ScheduleRecord): AgendaScheduledServiceRow => ({
  ...schedule,
  recurrence: schedule.recurrence ?? { ...DEFAULT_RECURRENCE },
  notes: schedule.notes ?? "",
})

function getScheduleIconTone(schedule: Pick<ScheduleRecord, "isEmergency">) {
  return schedule.isEmergency
    ? { wrapper: "bg-amber-50", icon: "text-amber-700" }
    : { wrapper: "bg-primary/10", icon: "text-primary" }
}

function canCancelSchedule(schedule: Pick<ScheduleRecord, "status">) {
  return !["in_progress", "completed", "cancelled"].includes(schedule.status)
}

function canEditSchedule(schedule: Pick<ScheduleRecord, "status">, canManageLockedSchedules: boolean) {
  if (["in_progress", "cancelled"].includes(schedule.status)) return false
  if (schedule.status === "completed") return canManageLockedSchedules
  return true
}

export function AgendaContent({ openDialog, onDialogChange }: AgendaContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const mobileFiltersOpen = useMobileFiltersOpen()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const [searchTerm, setSearchTerm] = useUrlQueryState("q")
  const deferredSearchTerm = useDeferredValue(searchTerm)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"month" | "week">("week")
  const [dayPanelOpen, setDayPanelOpen] = useState(true)
  const [dayPanelContentVisible, setDayPanelContentVisible] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<AgendaScheduledServiceRow | null>(null)
  const [initialFormData, setInitialFormData] = useState<Partial<SchedulingFormData> | null>(null)
  const [availabilitySuggestion, setAvailabilitySuggestion] = useState<{
    formData: SchedulingFormData
    scheduleId?: string
    requested: { date: string; time: string }
    suggested: { date: string; time: string }
  } | null>(null)
  const [selectedSchedule, setSelectedSchedule] = useState<AgendaScheduledServiceRow | null>(null)
  const [cancelTarget, setCancelTarget] = useState<AgendaScheduledServiceRow | null>(null)
  const [completionTarget, setCompletionTarget] = useState<AgendaScheduledServiceRow | null>(null)
  const [completionStartDate, setCompletionStartDate] = useState("")
  const [completionStartTime, setCompletionStartTime] = useState("")
  const [completionEndDate, setCompletionEndDate] = useState("")
  const [completionEndTime, setCompletionEndTime] = useState("")
  const [completionFiles, setCompletionFiles] = useState<File[]>([])
  const scheduleDialogResetTimeoutRef = useRef<number | null>(null)
  const dayPanelTransitionTimeoutRef = useRef<number | null>(null)
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
    queryKey: ["schedules", "agenda"],
    queryFn: () => listSchedules(),
  })
  const clientsQuery = useQuery({
    queryKey: ["clients", "agenda"],
    queryFn: () => listClients(),
    enabled: canManageAgenda,
  })
  const serviceTypesQuery = useQuery({
    queryKey: ["services", "agenda"],
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

  const schedules = useMemo(
    () => (schedulesQuery.data?.data ?? []).map(mapSchedule),
    [schedulesQuery.data?.data],
  )
  const clients = clientsQuery.data?.data ?? []
  const serviceTypes = serviceTypesQuery.data?.data ?? []
  const teams = teamsQuery.data?.data ?? []
  const employees = employeesQuery.data?.data ?? []

  useEffect(() => {
    if (openDialog !== undefined && openDialog !== isDialogOpen) {
      if (openDialog) {
        clearScheduleDialogResetTimeout()
        if (!editingService && !initialFormData) {
          setInitialFormData({
            date: selectedDate ? toCivilDateKey(selectedDate) : toCivilDateKey(new Date()),
          })
        }
        setIsDialogOpen(true)
        return
      }

      closeScheduleDialog()
    }
  }, [openDialog, isDialogOpen, selectedDate, editingService, initialFormData])

  useEffect(() => {
    return () => {
      clearScheduleDialogResetTimeout()
      clearDayPanelTransitionTimeout()
    }
  }, [])

  const clearScheduleDialogResetTimeout = () => {
    if (scheduleDialogResetTimeoutRef.current) {
      window.clearTimeout(scheduleDialogResetTimeoutRef.current)
      scheduleDialogResetTimeoutRef.current = null
    }
  }

  const clearDayPanelTransitionTimeout = () => {
    if (dayPanelTransitionTimeoutRef.current) {
      window.clearTimeout(dayPanelTransitionTimeoutRef.current)
      dayPanelTransitionTimeoutRef.current = null
    }
  }

  const toggleDayPanel = () => {
    clearDayPanelTransitionTimeout()

    if (dayPanelOpen) {
      setDayPanelContentVisible(false)
      dayPanelTransitionTimeoutRef.current = window.setTimeout(() => {
        setDayPanelOpen(false)
        dayPanelTransitionTimeoutRef.current = null
      }, DAY_PANEL_CONTENT_HIDE_MS)
      return
    }

    setDayPanelContentVisible(false)
    setDayPanelOpen(true)
    dayPanelTransitionTimeoutRef.current = window.setTimeout(() => {
      setDayPanelContentVisible(true)
      dayPanelTransitionTimeoutRef.current = null
    }, DAY_PANEL_DRAWER_MS)
  }

  const resetScheduleDialogState = () => {
    setEditingService(null)
    setInitialFormData(null)
  }

  const closeScheduleDialog = () => {
    setIsDialogOpen(false)
    onDialogChange?.(false)
    clearScheduleDialogResetTimeout()
    scheduleDialogResetTimeoutRef.current = window.setTimeout(() => {
      resetScheduleDialogState()
      scheduleDialogResetTimeoutRef.current = null
    }, 200)
  }

  const handleDialogChange = (open: boolean) => {
    if (open) {
      clearScheduleDialogResetTimeout()
      setIsDialogOpen(true)
      onDialogChange?.(true)
      return
    }

    closeScheduleDialog()
  }

  const invalidateSchedules = async () => {
    await queryClient.invalidateQueries({ queryKey: ["schedules"] })
    await queryClient.invalidateQueries({ queryKey: ["schedules", "agenda"] })
    await queryClient.invalidateQueries({ queryKey: ["agendamentos"] })
    await queryClient.invalidateQueries({ queryKey: ["notifications"] })
    await queryClient.invalidateQueries({ queryKey: ["certificates"] })
    await queryClient.invalidateQueries({ queryKey: ["analytics"] })
  }

  const saveMutation = useMutation({
    mutationFn: async ({ formData, scheduleId }: { formData: SchedulingFormData; scheduleId?: string }) => {
      const client = clients.find((item) => item.id === formData.clientId)
      const primaryUnit =
        client?.units.find((unit) => unit.isPrimary) ??
        client?.units[0]

      if (!client || !primaryUnit) {
        throw new Error("Cliente sem unidade disponível para agendamento.")
      }

      const isRecurringScheduleUpdate = Boolean(scheduleId && editingService?.contractId && !editingService.isManual)
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

        if (canManageScheduleStatus && editingService?.status !== formData.status) {
          return updateScheduleStatus(scheduleId, formData.status)
        }

        return response
      }

      const payload = {
        clientId: formData.clientId,
        unitId: scheduleId ? editingService?.unitId ?? primaryUnit.id : primaryUnit.id,
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
        if (canManageScheduleStatus && editingService?.status !== formData.status) {
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
    onSuccess: async (response, variables, context) => {
      await invalidateSchedules()
      closeScheduleDialog()
      toast.success(variables.scheduleId ? "Agendamento atualizado." : "Agendamento criado.", {
        id: context?.toastId,
        description: `${response.data.clientName} • ${response.data.serviceTypeName}`,
      })
    },
    onError: (error: any, _variables, context) => {
      toast.error(getApiErrorMessage(error, "Não foi possível salvar o agendamento."), {
        id: context?.toastId,
      })
    },
  })

  const startMutation = useMutation({
    mutationFn: (schedule: AgendaScheduledServiceRow) => startSchedule(schedule.id),
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

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      cancelSchedule(id, { cancellationReason: reason }),
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
    onError: (error: any, _variables, context) => {
      toast.error(getApiErrorMessage(error, "Não foi possível cancelar o agendamento."), {
        id: context?.toastId,
      })
    },
  })

  const reactivateMutation = useMutation({
    mutationFn: (schedule: AgendaScheduledServiceRow) => reactivateSchedule(schedule.id),
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
    mutationFn: async ({
      schedule,
      startDate,
      startTime,
      endDate,
      endTime,
      files,
    }: {
      schedule: AgendaScheduledServiceRow
      startDate: string
      startTime: string
      endDate: string
      endTime: string
      files: File[]
    }) => {
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

  const currentDateKey = toCivilDateKey(currentDate)
  const currentMonth = Number(currentDateKey.slice(5, 7)) - 1
  const currentYear = Number(currentDateKey.slice(0, 4))

  const daysInMonth = useMemo(() => {
    const monthStartKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`
    const monthEndKey = addCivilDaysKey(addCivilMonthsKey(monthStartKey, 1), -1)
    const lastDay = Number(monthEndKey.slice(8, 10))
    const startPadding = weekdayFromCivilDateKey(monthStartKey)
    const days: (Date | null)[] = []

    for (let index = 0; index < startPadding; index += 1) {
      days.push(null)
    }

    for (let day = 1; day <= lastDay; day += 1) {
      days.push(parseCivilDate(`${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`))
    }

    return days
  }, [currentMonth, currentYear])

  const filteredServices = useMemo(() => {
    const term = deferredSearchTerm.toLowerCase().trim()
    return schedules.filter((service) => {
      const matchesSearch =
        !term ||
        service.clientName.toLowerCase().includes(term) ||
        service.serviceTypeName.toLowerCase().includes(term) ||
        service.teams.some((team) => team.name.toLowerCase().includes(term)) ||
        service.additionalEmployees.some((employee) => employee.name.toLowerCase().includes(term))

      const matchesStatus = statusFilter === "all" || service.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [schedules, deferredSearchTerm, statusFilter])

  const getServicesForDate = (date: Date) => {
    const dateStr = toCivilDateKey(date)
    return filteredServices.filter((service) => scheduleOccupiesDate(service, dateStr))
  }

  const navigateMonth = (direction: number) => {
    const monthStartKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`
    setCurrentDate(parseCivilDate(addCivilMonthsKey(monthStartKey, direction)) ?? new Date())
  }

  const isToday = (date: Date) => {
    return toCivilDateKey(date) === toCivilDateKey(new Date())
  }

  const handleFormSubmit = (formData: SchedulingFormData, isEditing: boolean) => {
    const scheduleId = isEditing ? editingService?.id : undefined
    const statusOnlyChange = Boolean(isEditing && scheduleId && canManageScheduleStatus && editingService?.status !== formData.status)
    if (!canManageAgenda && !statusOnlyChange) return
    if (!canManageAgenda && statusOnlyChange) {
      saveMutation.mutate({ formData, scheduleId })
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

    saveMutation.mutate({ formData, scheduleId })
  }

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
  }

  const handleEditService = (service: AgendaScheduledServiceRow) => {
    if (!canOpenScheduleEditor) return
    if (canManageAgenda && !canEditSchedule(service, canManageLockedSchedules)) return

    clearScheduleDialogResetTimeout()
    setSelectedSchedule(null)
    setCancelTarget(null)
    setCompletionTarget(null)
    setEditingService(service)
    setInitialFormData(null)
    window.setTimeout(() => setIsDialogOpen(true), 0)
    onDialogChange?.(true)
  }

  const openScheduleFormAtSlot = (date: Date, time: string) => {
    if (!canManageAgenda) return

    clearScheduleDialogResetTimeout()
    setSelectedDate(date)
    setEditingService(null)
    setInitialFormData({
      date: toCivilDateKey(date),
      time,
      durationType: "hours",
      duration: 1,
    })
    setIsDialogOpen(true)
    onDialogChange?.(true)
  }

  const openCompletionDialog = (schedule: AgendaScheduledServiceRow) => {
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

  const openSchedule = (schedule: AgendaScheduledServiceRow) => {
    if (canManageAgenda && schedule.status === "in_progress") {
      openCompletionDialog(schedule)
      return
    }

    setSelectedSchedule(schedule)
  }

  const getStatusBadge = (status: AgendaScheduledServiceRow["status"]) => {
    switch (status) {
      case "draft":
        return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Rascunho</Badge>
      case "scheduled":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Agendado</Badge>
      case "in_progress":
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Em andamento</Badge>
      case "completed":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Concluído</Badge>
      case "cancelled":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Cancelado</Badge>
      case "rescheduled":
        return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">Reagendado</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getTeamColor = (teamId?: string) => {
    if (!teamId) return "#9CA3AF"
    return teams.find((team) => team.id === teamId)?.color || "#9CA3AF"
  }

  const timelineEvents = useMemo(() => filteredServices.flatMap((service) => {
    const baseEvent = {
      id: service.id,
      scheduleId: service.id,
      hoverGroupId: service.id,
      title: service.clientName,
      subtitle: service.serviceTypeName,
      teamColor: service.teams.length > 0 ? service.teams[0].color : getTeamColor(service.teamId),
      teamNames: [...service.teams.map((team) => team.name), ...service.additionalEmployees.map((employee) => employee.name)],
      status: service.status,
    }

    if (!isFullDaySchedule(service)) {
      return [{
        ...baseEvent,
        date: service.date,
        time: service.time || AGENDA_WORKDAY_START_TIME,
        duration: service.duration,
      }]
    }

    const days = scheduleDaySpan(service)
    const events: Array<{
      id: string
      title: string
      subtitle: string
      date: string
      time: string
      duration: number
      teamColor: string | null
      status: string
    }> = []
    let currentDate = toBusinessDateKey(service.date)

    for (let index = 0; index < days; index += 1) {
      events.push({
        ...baseEvent,
        id: `${service.id}-${currentDate}`,
        subtitle: days > 1 ? `${service.serviceTypeName} (${index + 1}/${days})` : service.serviceTypeName,
        date: currentDate,
        time: AGENDA_WORKDAY_START_TIME,
        duration: AGENDA_DAY_DURATION_MINUTES,
      })
      currentDate = nextBusinessDateKey(currentDate)
    }

    return events
  }), [filteredServices, teams])

  const selectedDateServices = selectedDate ? getServicesForDate(selectedDate) : []

  useEffect(() => {
    const scheduleId = searchParams.get("scheduleId")
    if (!scheduleId || schedules.length === 0) return

    const schedule = schedules.find((item) => item.id === scheduleId)
    if (!schedule) return

    const selectedScheduleDate = parseCivilDate(schedule.date) ?? new Date()
    setSelectedDate(selectedScheduleDate)
    setCurrentDate(selectedScheduleDate)
    setSelectedSchedule(schedule)
  }, [schedules, searchParams])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <SchedulingFormDialog
        open={isDialogOpen}
        onOpenChange={handleDialogChange}
        editingSchedule={editingService}
        initialFormData={initialFormData}
        onSubmit={handleFormSubmit}
        clients={clients}
        serviceTypes={serviceTypes}
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
            if (searchParams.get("scheduleId")) {
              router.replace("/agenda", { scroll: false })
            }
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
        contentClassName="max-sm:left-0 max-sm:top-3 max-sm:h-[calc(100dvh-1.5rem)] max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:overflow-y-auto max-sm:rounded-none max-sm:border-0 sm:max-w-md"
        reasonInputId="agenda-cancel-reason"
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
                <Label htmlFor="agenda-completion-start-date">Data de início *</Label>
                <Input
                  id="agenda-completion-start-date"
                  type="date"
                  value={completionStartDate}
                  onChange={(event) => setCompletionStartDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agenda-completion-start">Horário de início *</Label>
                <Input
                  id="agenda-completion-start"
                  type="time"
                  value={completionStartTime}
                  onChange={(event) => setCompletionStartTime(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agenda-completion-end-date">Data de fim *</Label>
                <Input
                  id="agenda-completion-end-date"
                  type="date"
                  value={completionEndDate}
                  onChange={(event) => setCompletionEndDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agenda-completion-end">Horário de fim *</Label>
                <Input
                  id="agenda-completion-end"
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
              onClick={() => {
                if (completionTarget) {
                  completeMutation.mutate({
                    schedule: completionTarget,
                    startDate: completionStartDate,
                    startTime: completionStartTime,
                    endDate: completionEndDate,
                    endTime: completionEndTime,
                    files: completionFiles,
                  })
                }
              }}
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

      <div className={`${mobileFiltersOpen ? "grid" : "hidden"} -m-1 grid-cols-2 gap-2 overflow-visible p-1 sm:flex sm:w-full sm:items-center sm:justify-between`}>
        <div className="contents sm:flex sm:min-w-0 sm:items-center sm:gap-2">
          <FilterSearchInput
            wrapperClassName="sm:w-80"
            placeholder="Buscar cliente, serviço, equipe..."
            value={searchTerm}
            spellCheck={false}
            onValueChange={setSearchTerm}
          />

          <SearchableSelect
            value={statusFilter}
            onValueChange={setStatusFilter}
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

          <Tabs
            value={viewMode}
            onValueChange={(value) => {
              const mode = value as "month" | "week"
              if (mode === "week") {
                setCurrentDate(selectedDate || new Date())
              }
              setViewMode(mode)
            }}
            className="hidden shrink-0 sm:block"
          >
            <TabsList className="h-9">
              <TabsTrigger value="month" className="px-3 text-xs">
                Mês
              </TabsTrigger>
              <TabsTrigger value="week" className="px-3 text-xs">
                Semana
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-ml-1 hidden h-8 w-8 shrink-0 rounded-lg text-muted-foreground/55 transition-colors duration-200 hover:bg-secondary/60 hover:text-muted-foreground lg:inline-flex"
          title={dayPanelOpen ? "Recolher detalhes do dia" : "Mostrar detalhes do dia"}
          aria-label={dayPanelOpen ? "Recolher detalhes do dia" : "Mostrar detalhes do dia"}
          aria-pressed={!dayPanelOpen}
          onClick={toggleDayPanel}
        >
          {dayPanelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        </Button>
      </div>

      {viewMode === "month" ? (
        <div
          className={cn(
            "grid gap-4 lg:flex lg:flex-1 lg:overflow-hidden lg:transition-[gap] lg:duration-500 lg:ease-[cubic-bezier(.22,1,.36,1)]",
            dayPanelOpen ? "lg:gap-4" : "lg:gap-0",
          )}
        >
          <Card className="flex h-full min-h-[420px] min-w-0 flex-col lg:flex-1 lg:overflow-hidden">
            <CardHeader className="shrink-0 px-4 py-2">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => navigateMonth(-1)}>
                  <span className="sr-only">Mês anterior</span>
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <CardTitle className="text-base">
                  {MONTHS[currentMonth]} {currentYear}
                </CardTitle>
                <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => navigateMonth(1)}>
                  <span className="sr-only">Próximo mês</span>
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-0">
              <div className="grid w-full shrink-0 grid-cols-7 gap-1">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day.value} className="py-1 text-center text-xs font-medium text-muted-foreground">
                    {day.label}
                  </div>
                ))}
              </div>

              <div className="grid min-h-0 w-full flex-1 auto-rows-fr grid-cols-7 gap-1">
                {daysInMonth.map((date, index) => {
                  if (!date) {
                    return <div key={`empty-${index}`} />
                  }

                  const services = getServicesForDate(date)
                  const isSelected = selectedDate?.toDateString() === date.toDateString()

                  return (
                    <button
                      key={date.toISOString()}
                      onClick={() => handleDateClick(date)}
                      className={`h-full min-h-12 w-full rounded-lg border p-1 text-sm transition-all duration-200 hover:bg-muted ${
                        isToday(date) ? "border-primary bg-primary/10" : "border-transparent"
                      } ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}`}
                    >
                      <div className="flex h-full flex-col items-center justify-center">
                        <span className={`font-medium ${isToday(date) ? "text-primary" : ""}`}>{Number(toCivilDateKey(date).slice(8, 10))}</span>
                        {services.length > 0 ? (
                          <div className="mx-auto mt-1 flex w-[5.75rem] max-w-full flex-wrap justify-center gap-1">
                            {services.map((service) => (
                              <div
                                key={service.id}
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: getTeamColor(service.teamId) }}
                                title={`${service.clientName} - ${service.serviceTypeName}`}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card
            aria-hidden={!dayPanelOpen}
            className={cn(
              "flex min-w-0 flex-col overflow-hidden lg:shrink-0 lg:transition-[width,opacity,border-color] lg:duration-500 lg:ease-[cubic-bezier(.22,1,.36,1)]",
              dayPanelOpen
                ? "lg:w-[380px] lg:opacity-100 xl:w-[420px]"
                : "lg:pointer-events-none lg:w-0 lg:border-transparent lg:opacity-0",
            )}
          >
            <div
              className={cn(
                "flex h-full min-w-0 flex-col transition-opacity duration-100 ease-out lg:min-w-[380px] xl:min-w-[420px]",
                dayPanelContentVisible ? "opacity-100 delay-75" : "opacity-0",
              )}
            >
              <CardHeader className="px-4 py-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CalendarIcon className="h-4 w-4" />
                  {selectedDate
                    ? selectedDate
                        .toLocaleDateString("pt-BR", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })
                        .replace(/^\w/, (value) => value.toUpperCase())
                    : "Selecione uma data"}
                </CardTitle>
              </CardHeader>

              <CardContent className="flex-1 px-0 lg:overflow-hidden">
              {selectedDate ? (
                selectedDateServices.length > 0 ? (
                  <ScrollArea className="lg:h-full">
                    <div className="grid grid-cols-1 gap-3 px-6 py-2 sm:grid-cols-2 lg:grid-cols-1">
                      {selectedDateServices.map((service) => (
                        <Card key={service.id} className="group cursor-pointer border-border/70 transition-colors duration-200 hover:border-primary/30" onClick={() => openSchedule(service)}>
                          <CardContent>
                            <div className="mb-4 flex items-start justify-between gap-3">
                              <div className="flex min-w-0 flex-1 items-center gap-2">
                                <div className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:flex ${getScheduleIconTone(service).wrapper}`}>
                                  <Calendar className={`h-5 w-5 ${getScheduleIconTone(service).icon}`} />
                                </div>
                                <div className="min-w-0 flex-1 pr-1">
                                  <h4 className="max-w-[190px] whitespace-normal break-words text-sm font-semibold leading-snug text-foreground/80 sm:max-w-none">
                                    {service.clientName}
                                  </h4>
                                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                    {service.serviceTypeName}
                                  </p>
                                </div>
                              </div>
                              <div className="shrink-0">{getStatusBadge(service.status)}</div>
                            </div>

                            <div className="space-y-1 text-xs text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                {service.time} ({formatConfiguredScheduleDuration(service)})
                              </div>
                              {service.address ? (
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-3 w-3" />
                                  <span className="truncate">{service.address}</span>
                                </div>
                              ) : null}
                            </div>

                            {service.teams.length > 0 || service.additionalEmployees.length > 0 ? (
                              <div className="my-4 flex flex-wrap gap-1">
                                {service.teams.map((team) => (
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
                                {service.additionalEmployees.map((employee) => (
                                  <Badge key={employee.id} variant="outline" className="px-3 py-1 text-xs">
                                    {employee.name}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}

                            {canOpenScheduleEditor ? (
                            <div className="mt-2 flex gap-1" onClick={(event) => event.stopPropagation()}>
                              {(canManageScheduleStatus || (canManageAgenda && canEditSchedule(service, canManageLockedSchedules))) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 flex-1 text-xs"
                                  onClick={() => handleEditService(service)}
                                >
                                  <Edit className="mr-1 h-3 w-3" />
                                  Editar
                                </Button>
                              )}
                              {canManageAgenda && service.status === "cancelled" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 flex-1 text-xs"
                                  disabled={reactivateMutation.isPending && reactivateMutation.variables?.id === service.id}
                                  onClick={() => reactivateMutation.mutate(service)}
                                >
                                  {reactivateMutation.isPending && reactivateMutation.variables?.id === service.id ? (
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  ) : (
                                    <RotateCcw className="mr-1 h-3 w-3" />
                                  )}
                                  Reativar
                                </Button>
                              )}
                              {canManageAgenda && service.status === "in_progress" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 flex-1 text-xs"
                                  onClick={() => {
                                    openCompletionDialog(service)
                                  }}
                                >
                                  <Check className="mr-1 h-3 w-3" />
                                  Concluir
                                </Button>
                              )}
                              {canManageAgenda && canCancelSchedule(service) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 flex-1 text-xs"
                                  onClick={() => {
                                    setCancelTarget(service)
                                  }}
                                >
                                  <X className="mr-1 h-3 w-3" />
                                  Cancelar
                                </Button>
                              )}
                            </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <EmptyState icon={CalendarIcon} title="Nenhum serviço agendado." className="min-h-[320px]" />
                )
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <CalendarIcon className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p className="text-sm">Clique em uma data para ver os detalhes.</p>
                </div>
              )}
              </CardContent>
            </div>
          </Card>
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-4 lg:flex lg:flex-1 lg:overflow-hidden lg:transition-[gap] lg:duration-500 lg:ease-[cubic-bezier(.22,1,.36,1)]",
            dayPanelOpen ? "lg:gap-4" : "lg:gap-0",
          )}
        >
          <Card className="flex min-w-0 flex-col lg:flex-1 lg:overflow-hidden">
            <CardContent className="flex min-h-0 flex-1 flex-col p-0 lg:h-[calc(100vh-280px)] lg:[@media(max-height:1199px)]:h-[calc(100dvh-180px)]">
              <WeekTimeline
                events={timelineEvents}
                currentDate={currentDate}
                selectedDate={selectedDate}
                onDateChange={setCurrentDate}
                onDaySelect={(date) => handleDateClick(date)}
                onEventClick={(eventId) => {
                  const schedule = filteredServices.find((service) => service.id === eventId)
                  if (schedule) {
                    openSchedule(schedule)
                  }
                }}
                onSlotClick={openScheduleFormAtSlot}
              />
            </CardContent>
          </Card>

          <Card
            aria-hidden={!dayPanelOpen}
            className={cn(
              "flex min-w-0 flex-col overflow-hidden lg:shrink-0 lg:transition-[width,opacity,border-color] lg:duration-500 lg:ease-[cubic-bezier(.22,1,.36,1)]",
              dayPanelOpen
                ? "lg:w-[380px] lg:opacity-100 xl:w-[420px]"
                : "lg:pointer-events-none lg:w-0 lg:border-transparent lg:opacity-0",
            )}
          >
            <div
              className={cn(
                "flex h-full min-w-0 flex-col transition-opacity duration-100 ease-out lg:min-w-[380px] xl:min-w-[420px]",
                dayPanelContentVisible ? "opacity-100 delay-75" : "opacity-0",
              )}
            >
              <CardHeader className="px-4 py-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CalendarIcon className="h-4 w-4" />
                  {selectedDate
                    ? selectedDate
                        .toLocaleDateString("pt-BR", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })
                        .replace(/^\w/, (value) => value.toUpperCase())
                    : "Selecione uma data"}
                </CardTitle>
              </CardHeader>

              <CardContent className="flex-1 px-0 lg:overflow-hidden">
              {selectedDate ? (
                selectedDateServices.length > 0 ? (
                  <ScrollArea className="lg:h-full">
                    <div className="grid grid-cols-1 gap-3 px-6 py-2 sm:grid-cols-2 lg:grid-cols-1">
                      {selectedDateServices.map((service) => (
                        <Card key={service.id} className="group cursor-pointer border-border/70 transition-colors duration-200 hover:border-primary/30" onClick={() => openSchedule(service)}>
                          <CardContent>
                            <div className="mb-4 flex items-start justify-between gap-3">
                              <div className="flex min-w-0 flex-1 items-center gap-2">
                                <div className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:flex ${getScheduleIconTone(service).wrapper}`}>
                                  <Calendar className={`h-5 w-5 ${getScheduleIconTone(service).icon}`} />
                                </div>
                                <div className="min-w-0 flex-1 pr-1">
                                  <h4 className="max-w-[190px] whitespace-normal break-words text-sm font-semibold leading-snug text-foreground/80 sm:max-w-none">
                                    {service.clientName}
                                  </h4>
                                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                    {service.serviceTypeName}
                                  </p>
                                </div>
                              </div>
                              <div className="shrink-0">{getStatusBadge(service.status)}</div>
                            </div>

                            <div className="space-y-1 text-xs text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                {service.time} ({formatConfiguredScheduleDuration(service)})
                              </div>
                              {service.address ? (
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-3 w-3" />
                                  <span className="truncate">{service.address}</span>
                                </div>
                              ) : null}
                            </div>

                            {service.teams.length > 0 || service.additionalEmployees.length > 0 ? (
                              <div className="my-4 flex flex-wrap gap-1">
                                {service.teams.map((team) => (
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
                                {service.additionalEmployees.map((employee) => (
                                  <Badge key={employee.id} variant="outline" className="px-3 py-1 text-xs">
                                    {employee.name}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}

                            {canOpenScheduleEditor ? (
                            <div className="mt-2 flex gap-1" onClick={(event) => event.stopPropagation()}>
                              {(canManageScheduleStatus || (canManageAgenda && canEditSchedule(service, canManageLockedSchedules))) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 flex-1 text-xs"
                                  onClick={() => handleEditService(service)}
                                >
                                  <Edit className="mr-1 h-3 w-3" />
                                  Editar
                                </Button>
                              )}
                              {canManageAgenda && service.status === "cancelled" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 flex-1 text-xs"
                                  disabled={reactivateMutation.isPending && reactivateMutation.variables?.id === service.id}
                                  onClick={() => reactivateMutation.mutate(service)}
                                >
                                  {reactivateMutation.isPending && reactivateMutation.variables?.id === service.id ? (
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  ) : (
                                    <RotateCcw className="mr-1 h-3 w-3" />
                                  )}
                                  Reativar
                                </Button>
                              )}
                              {canManageAgenda && service.status === "in_progress" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 flex-1 text-xs"
                                  onClick={() => {
                                    openCompletionDialog(service)
                                  }}
                                >
                                  <Check className="mr-1 h-3 w-3" />
                                  Concluir
                                </Button>
                              )}
                              {canManageAgenda && canCancelSchedule(service) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 flex-1 text-xs"
                                  onClick={() => {
                                    setCancelTarget(service)
                                  }}
                                >
                                  <X className="mr-1 h-3 w-3" />
                                  Cancelar
                                </Button>
                              )}
                            </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <EmptyState icon={CalendarIcon} title="Nenhum serviço agendado." className="min-h-[320px]" />
                )
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <CalendarIcon className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p className="text-sm">Clique em uma data para ver os detalhes.</p>
                </div>
              )}
              </CardContent>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
