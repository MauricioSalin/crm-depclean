"use client"

import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft,
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
  Pencil,
  RotateCcw,
  Search,
  X,
} from "lucide-react"

import { listClients } from "@/lib/api/clients"
import { listEmployees } from "@/lib/api/employees"
import { getApiErrorMessage } from "@/lib/api/errors"
import { listSchedules, createSchedule, updateSchedule, updateScheduleStatus, startSchedule, cancelScheduleAttendance, completeSchedule, cancelSchedule, reactivateSchedule, uploadScheduleNa, deleteScheduleNa, getScheduleById, listScheduleCompletionEmployees, type ScheduleRecord } from "@/lib/api/schedules"
import { listServices } from "@/lib/api/services"
import { listTeams } from "@/lib/api/teams"
import { useIsMobile } from "@/hooks/use-mobile"
import { hasAnyPermission } from "@/lib/auth/permissions"
import { getStoredUser } from "@/lib/auth/session"
import { addCivilDaysKey, addCivilMonthsKey, parseCivilDate, toBrasiliaTimeKey, toCivilDateKey } from "@/lib/date-utils"
import { useMobileFiltersOpen } from "@/lib/hooks/use-mobile-filters"
import { useUrlDateRangeState } from "@/lib/hooks/use-url-date-range-state"
import { useUrlQueryState } from "@/lib/hooks/use-url-query-state"
import { normalizeScheduleStatusFilter, SCHEDULE_STATUS_FILTER_OPTIONS } from "@/lib/schedule-status"
import { cn } from "@/lib/utils"
import {
  checkScheduleAvailability,
  formatDailyServiceCapacityViolation,
  getScheduleConflictResourceNames,
  getDailyServiceCapacityViolation,
  isScheduleConflictErrorMessage,
} from "@/lib/schedule-availability"
import { canAccessScheduleCompletion, canStartSchedule } from "@/lib/schedule-permissions"
import { cacheSavedSchedule } from "@/lib/schedule-query-cache"
import { scheduleDisposalValidationMessage, type ScheduleDisposalType } from "@/lib/schedule-disposal"
import type { RecurrenceType } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DatePicker } from "@/components/ui/date-picker"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { Input } from "@/components/ui/input"
import { FilterSearchInput } from "@/components/ui/filter-search-input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AgendaPeriodSelector } from "./agenda-period-selector"
import { WeekTimeline, type TimelineResource } from "./week-timeline"
import { CompletionNaAttachments } from "@/components/agendamentos/completion-na-attachments"
import { AttendanceCompletionFields } from "@/components/agendamentos/attendance-completion-fields"
import { AttendanceStartSlider } from "@/components/agendamentos/attendance-start-slider"
import { ScheduleDetailsDialog } from "@/components/agendamentos/schedule-details-dialog"
import { CancelScheduleDialog } from "@/components/agendamentos/cancel-schedule-dialog"
import { ScheduleConflictDialog } from "@/components/agendamentos/schedule-conflict-dialog"
import { SchedulingFormDialog, type SchedulingFormData } from "@/components/agendamentos/scheduling-form-dialog"
import {
  scheduleDurationToMinutes,
} from "@/lib/schedule-duration"
import {
  formatScheduleDisplayDuration,
  getScheduleDisplaySegments,
  resolveScheduleDisplayPeriod,
} from "@/lib/schedule-display-period"

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
const AGENDA_DAY_DURATION_MINUTES = 8 * 60
const DAY_PANEL_CONTENT_HIDE_MS = 80
const DAY_PANEL_DRAWER_MS = 500
const DAY_PANEL_STORAGE_VERSION = "v1"
const EMERGENCY_SCHEDULE_COLOR = "#dc2626"

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

function scheduleDaySpan(schedule: Pick<AgendaScheduledServiceRow, "duration" | "durationValue" | "durationType">) {
  if (!isFullDaySchedule(schedule)) return 1

  if (schedule.durationType === "days") {
    const configuredDays = Number(schedule.durationValue)
    if (Number.isFinite(configuredDays) && configuredDays > 0) {
      return Math.max(1, Math.ceil(configuredDays))
    }
  }

  return Math.max(1, Math.ceil(Number(schedule.duration || AGENDA_DAY_DURATION_MINUTES) / AGENDA_DAY_DURATION_MINUTES))
}

function scheduleOccupiesDate(schedule: AgendaScheduledServiceRow, dateKey: string) {
  const displayPeriod = resolveScheduleDisplayPeriod(schedule)
  if (displayPeriod.usesExecutionPeriod) {
    return getScheduleDisplaySegments(schedule).some((segment) => segment.date === dateKey)
  }

  if (!isFullDaySchedule(schedule)) return schedule.date === dateKey

  let currentDate = schedule.date
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
    ? { wrapper: "bg-red-100", icon: "text-red-600" }
    : { wrapper: "bg-primary/10", icon: "text-primary" }
}

function canCancelSchedule(schedule: Pick<ScheduleRecord, "status">) {
  return !["in_progress", "completed", "cancelled"].includes(schedule.status)
}

function canEditSchedule(schedule: Pick<ScheduleRecord, "status">, canManageLockedSchedules: boolean) {
  if (schedule.status === "cancelled") return false
  if (schedule.status === "completed") return canManageLockedSchedules
  return true
}

function canShowScheduleEditAction(
  schedule: Pick<ScheduleRecord, "status">,
  canManageAgenda: boolean,
  canManageScheduleStatus: boolean,
  canManageLockedSchedules: boolean,
) {
  if (schedule.status === "cancelled") return false
  return canManageScheduleStatus || (canManageAgenda && canEditSchedule(schedule, canManageLockedSchedules))
}

export function AgendaContent({ openDialog, onDialogChange }: AgendaContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isMobile = useIsMobile()
  const queryClient = useQueryClient()
  const mobileFiltersOpen = useMobileFiltersOpen()
  const initialAgendaDateKey = useMemo(() => toCivilDateKey(new Date()), [])
  const [agendaDateParam, setAgendaDateParam] = useUrlQueryState("date", initialAgendaDateKey, { debounceMs: 0 })
  const initialAgendaDate = useMemo(
    () => parseCivilDate(agendaDateParam) ?? parseCivilDate(initialAgendaDateKey) ?? new Date(),
    [agendaDateParam, initialAgendaDateKey],
  )
  const [currentDate, setCurrentDateState] = useState(initialAgendaDate)
  const [selectedDate, setSelectedDateState] = useState<Date | null>(initialAgendaDate)
  const currentDateKeyRef = useRef(toCivilDateKey(initialAgendaDate))
  const [searchTerm, setSearchTerm] = useUrlQueryState("q")
  const deferredSearchTerm = useDeferredValue(searchTerm)
  const [statusFilterParam, setStatusFilter] = useUrlQueryState("status", "all", { debounceMs: 0 })
  const statusFilter = normalizeScheduleStatusFilter(statusFilterParam)
  const [dateRange, setDateRange] = useUrlDateRangeState()
  const [viewModeParam, setViewModeParam] = useUrlQueryState("view", "week", { debounceMs: 0 })
  const viewMode = !searchParams.has("view") && isMobile
    ? "day"
    : viewModeParam === "month" || viewModeParam === "day"
      ? viewModeParam
      : "week"
  const dayPanelStorageKey = useMemo(() => {
    const user = getStoredUser()
    return `depclean:agenda-day-panel-open:${DAY_PANEL_STORAGE_VERSION}:${user?.id ?? user?.email ?? "default"}`
  }, [])
  const [dayPanelOpen, setDayPanelOpen] = useState(false)
  const [dayPanelContentVisible, setDayPanelContentVisible] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<AgendaScheduledServiceRow | null>(null)
  const [initialFormData, setInitialFormData] = useState<Partial<SchedulingFormData> | null>(null)
  const [availabilitySuggestion, setAvailabilitySuggestion] = useState<{
    formData: SchedulingFormData
    scheduleId?: string
    requested: { date: string; time: string }
    suggested?: { date: string; time: string }
    conflictingResources: string[]
  } | null>(null)
  const [selectedSchedule, setSelectedSchedule] = useState<AgendaScheduledServiceRow | null>(null)
  const [cancelTarget, setCancelTarget] = useState<AgendaScheduledServiceRow | null>(null)
  const [attendanceCancelTarget, setAttendanceCancelTarget] = useState<AgendaScheduledServiceRow | null>(null)
  const [completionTarget, setCompletionTarget] = useState<AgendaScheduledServiceRow | null>(null)
  const [completionInfoOpen, setCompletionInfoOpen] = useState(false)
  const [completionStep, setCompletionStep] = useState<"attachments" | "checkout">("attachments")
  const [completionStartDate, setCompletionStartDate] = useState("")
  const [completionStartTime, setCompletionStartTime] = useState("")
  const [completionEndDate, setCompletionEndDate] = useState("")
  const [completionEndTime, setCompletionEndTime] = useState("")
  const [completionDriverEmployeeId, setCompletionDriverEmployeeId] = useState("")
  const [completionHelperEmployeeIds, setCompletionHelperEmployeeIds] = useState<string[]>([])
  const [completionServiceReport, setCompletionServiceReport] = useState("")
  const [completionVehiclePlate, setCompletionVehiclePlate] = useState("")
  const [completionDisposalType, setCompletionDisposalType] = useState<ScheduleDisposalType | "">("")
  const [completionDisposalStationId, setCompletionDisposalStationId] = useState("")
  const [completionDisposalQuantityM3, setCompletionDisposalQuantityM3] = useState<number | null>(null)
  const [completionFiles, setCompletionFiles] = useState<File[]>([])
  const scheduleDialogResetTimeoutRef = useRef<number | null>(null)
  const dayPanelTransitionTimeoutRef = useRef<number | null>(null)
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getStoredUser>>(null)
  const canManageAgenda = hasAnyPermission(currentUser, ["agenda_manage"])
  const canCancelAttendance = hasAnyPermission(currentUser, ["agenda_manage", "settings_manage"])
  const canManageLockedSchedules = hasAnyPermission(currentUser, ["agenda_manage_locked"])
  const canManageScheduleStatus = hasAnyPermission(currentUser, ["agenda_manage_status"])
  const canOpenScheduleEditor = canManageAgenda || canManageScheduleStatus
  const canEditCompletedExecution = canManageAgenda && canManageLockedSchedules
  const restrictAgendaToOwnEmployee = Boolean(
    currentUser?.permissions.includes("agenda_own_view") &&
    !currentUser.permissions.includes("settings_manage"),
  )

  const resetCompletionDialog = useCallback(() => {
    setCompletionTarget(null)
    setCompletionInfoOpen(false)
    setCompletionStep("attachments")
    setCompletionStartDate("")
    setCompletionStartTime("")
    setCompletionEndDate("")
    setCompletionEndTime("")
    setCompletionDriverEmployeeId("")
    setCompletionHelperEmployeeIds([])
    setCompletionServiceReport("")
    setCompletionVehiclePlate("")
    setCompletionDisposalType("")
    setCompletionDisposalStationId("")
    setCompletionDisposalQuantityM3(null)
    setCompletionFiles([])
  }, [])

  const closeCompletionDialog = useCallback(() => {
    resetCompletionDialog()
    if (!searchParams.get("scheduleId")) return

    const params = new URLSearchParams(searchParams.toString())
    params.delete("scheduleId")
    const query = params.toString()
    router.replace(query ? `/agenda?${query}` : "/agenda", { scroll: false })
  }, [resetCompletionDialog, router, searchParams])

  const openCompletionDialog = useCallback((schedule: AgendaScheduledServiceRow) => {
    if (!canAccessScheduleCompletion(schedule, currentUser)) return

    const now = currentCompletionDateTime()
    const defaultDate = schedule.completionStartDate || now.date || schedule.date
    setCompletionTarget(schedule)
    setCompletionInfoOpen(false)
    setCompletionStep("attachments")
    setCompletionStartDate(defaultDate)
    setCompletionStartTime(schedule.completionStartTime || schedule.time || "")
    setCompletionEndDate(schedule.completionEndDate || now.date || defaultDate)
    setCompletionEndTime(schedule.completionEndTime || now.time)
    setCompletionDriverEmployeeId(schedule.attendanceDriver?.id || "")
    setCompletionHelperEmployeeIds(schedule.attendanceHelpers?.map((employee) => employee.id) ?? [])
    setCompletionServiceReport(schedule.serviceReport || "")
    setCompletionVehiclePlate(schedule.attendanceVehiclePlate || "")
    setCompletionDisposalType(schedule.attendanceDisposal?.type || "")
    setCompletionDisposalStationId(schedule.attendanceDisposal?.stationId || "")
    setCompletionDisposalQuantityM3(schedule.attendanceDisposal?.quantityM3 ?? null)
    setCompletionFiles([])
  }, [currentUser])

  const openExecutionEditDialog = useCallback((schedule: AgendaScheduledServiceRow) => {
    if (schedule.status !== "completed" || !canEditCompletedExecution) return

    const now = currentCompletionDateTime()
    const defaultDate = schedule.completionStartDate || now.date || schedule.date
    setSelectedSchedule(null)
    setCompletionTarget(schedule)
    setCompletionInfoOpen(false)
    setCompletionStep("checkout")
    setCompletionStartDate(defaultDate)
    setCompletionStartTime(schedule.completionStartTime || schedule.time || "")
    setCompletionEndDate(schedule.completionEndDate || now.date || defaultDate)
    setCompletionEndTime(schedule.completionEndTime || now.time)
    setCompletionDriverEmployeeId(schedule.attendanceDriver?.id || "")
    setCompletionHelperEmployeeIds(schedule.attendanceHelpers?.map((employee) => employee.id) ?? [])
    setCompletionServiceReport(schedule.serviceReport || "")
    setCompletionVehiclePlate(schedule.attendanceVehiclePlate || "")
    setCompletionDisposalType(schedule.attendanceDisposal?.type || "")
    setCompletionDisposalStationId(schedule.attendanceDisposal?.stationId || "")
    setCompletionDisposalQuantityM3(schedule.attendanceDisposal?.quantityM3 ?? null)
    setCompletionFiles([])
  }, [canEditCompletedExecution])

  const openSchedule = useCallback((schedule: AgendaScheduledServiceRow) => {
    if (canAccessScheduleCompletion(schedule, currentUser)) {
      openCompletionDialog(schedule)
      return
    }

    setSelectedSchedule(schedule)
  }, [currentUser, openCompletionDialog])

  const setCurrentDate = useCallback((date: Date) => {
    const dateKey = toCivilDateKey(date)
    currentDateKeyRef.current = dateKey
    setCurrentDateState(date)
    setAgendaDateParam(dateKey)
  }, [setAgendaDateParam])

  const setSelectedDate = useCallback((date: Date | null) => {
    setSelectedDateState(date)
    if (date) setCurrentDate(date)
  }, [setCurrentDate])

  useEffect(() => {
    const parsedDate = parseCivilDate(agendaDateParam) ?? parseCivilDate(initialAgendaDateKey) ?? new Date()
    const parsedDateKey = toCivilDateKey(parsedDate)
    if (currentDateKeyRef.current === parsedDateKey) return

    currentDateKeyRef.current = parsedDateKey
    setCurrentDateState(parsedDate)
    setSelectedDateState(parsedDate)
  }, [agendaDateParam, initialAgendaDateKey])

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

  useLayoutEffect(() => {
    if (searchParams.has("view")) return
    if (!window.matchMedia("(max-width: 767px)").matches) return
    setViewModeParam("day")
  }, [searchParams, setViewModeParam])

  useEffect(() => {
    try {
      const storedOpen = window.localStorage.getItem(dayPanelStorageKey) === "true"
      setDayPanelOpen(storedOpen)
      setDayPanelContentVisible(storedOpen)
    } catch {
      setDayPanelOpen(false)
      setDayPanelContentVisible(false)
    }
  }, [dayPanelStorageKey])

  useEffect(() => {
    if (viewMode !== "week" && dateRange) setDateRange(undefined)
  }, [dateRange, setDateRange, viewMode])

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
  const completionEmployeesQuery = useQuery({
    queryKey: ["schedules", "completion-employees"],
    queryFn: () => listScheduleCompletionEmployees(),
    enabled: Boolean(completionTarget),
  })

  const schedules = useMemo(
    () => (schedulesQuery.data?.data ?? []).map(mapSchedule),
    [schedulesQuery.data?.data],
  )
  const clients = clientsQuery.data?.data ?? []
  const serviceTypes = serviceTypesQuery.data?.data ?? []
  const teams = teamsQuery.data?.data ?? []
  const employees = employeesQuery.data?.data ?? []
  const completionEmployees = completionEmployeesQuery.data?.data ?? []

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
      try {
        window.localStorage.setItem(dayPanelStorageKey, "false")
      } catch {}
      setDayPanelContentVisible(false)
      dayPanelTransitionTimeoutRef.current = window.setTimeout(() => {
        setDayPanelOpen(false)
        dayPanelTransitionTimeoutRef.current = null
      }, DAY_PANEL_CONTENT_HIDE_MS)
      return
    }

    try {
      window.localStorage.setItem(dayPanelStorageKey, "true")
    } catch {}
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
    mutationFn: async ({
      formData,
      scheduleId,
      allowConflict = false,
    }: {
      formData: SchedulingFormData
      scheduleId?: string
      allowConflict?: boolean
    }) => {
      if (scheduleId && !canManageAgenda && canManageScheduleStatus) {
        return updateScheduleStatus(scheduleId, formData.status)
      }

      const client = clients.find((item) => item.id === formData.clientId)
      const primaryUnit =
        client?.units.find((unit) => unit.isPrimary) ??
        client?.units[0]

      if (!client || !primaryUnit) {
        throw new Error("Cliente sem unidade disponível para agendamento.")
      }

      const isRecurringScheduleUpdate = Boolean(scheduleId && editingService?.contractId && !editingService.isManual)
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
          allowConflict,
        })

        if (canManageScheduleStatus && editingService?.status !== formData.status) {
          return updateScheduleStatus(scheduleId, formData.status)
        }

        return response
      }

      const payload = {
        clientId: formData.clientId,
        unitId: scheduleId ? editingService?.unitId ?? primaryUnit.id : primaryUnit.id,
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
        allowConflict,
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
      const toastId = toast.loading(
        variables.scheduleId
          ? "Salvando agendamento e preparando os alertas..."
          : "Criando atendimento e preparando os alertas...",
      )
      return { toastId }
    },
    onSuccess: (response, variables, context) => {
      cacheSavedSchedule(queryClient, response.data)
      closeScheduleDialog()
      toast.success(variables.scheduleId ? "Agendamento atualizado." : "Agendamento criado.", {
        id: context?.toastId,
        description: `${response.data.clientName} • ${response.data.serviceTypeName}`,
      })
      void invalidateSchedules().catch(() => undefined)
    },
    onError: (error: any, variables, context) => {
      const message = getApiErrorMessage(error, "Não foi possível salvar o agendamento.")
      if (!variables.allowConflict && isScheduleConflictErrorMessage(message)) {
        toast.dismiss(context?.toastId)
        const availability = checkScheduleAvailability({
          schedules,
          teams,
          formData: variables.formData,
          ignoreScheduleId: variables.scheduleId,
          mode: "manual",
        })
        setAvailabilitySuggestion({
          formData: variables.formData,
          scheduleId: variables.scheduleId,
          requested: {
            date: variables.formData.date,
            time: variables.formData.time,
          },
          suggested: availability.suggested,
          conflictingResources: getScheduleConflictResourceNames(availability.conflict, {
            teams,
            employees,
          }),
        })
        return
      }

      toast.error(message, {
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
    onSuccess: async (_response, _variables, context) => {
      await invalidateSchedules()
      setSelectedSchedule(null)
      closeCompletionDialog()
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
    onError: (error: any, _variables, context) => {
      toast.error(getApiErrorMessage(error, "Não foi possível cancelar o agendamento."), {
        id: context?.toastId,
      })
    },
  })

  const cancelAttendanceMutation = useMutation({
    mutationFn: (id: string) => cancelScheduleAttendance(id),
    onMutate: () => {
      setAttendanceCancelTarget(null)
      closeCompletionDialog()
      return { toastId: toast.loading("Cancelando atendimento...") }
    },
    onSuccess: (_response, _id, context) => {
      toast.success("Atendimento cancelado.", {
        id: context?.toastId,
        description: "O agendamento voltou ao estado anterior.",
      })
      void invalidateSchedules().catch(() => undefined)
    },
    onError: (error, _id, context) => {
      toast.error(getApiErrorMessage(error, "Não foi possível cancelar o atendimento."), {
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

  const uploadNaMutation = useMutation({
    mutationFn: async ({ schedule, files }: { schedule: AgendaScheduledServiceRow; files: File[] }) => {
      let updatedSchedule: AgendaScheduledServiceRow = schedule
      for (const file of files) {
        const response = await uploadScheduleNa(schedule.id, file)
        updatedSchedule = response.data
      }
      return updatedSchedule
    },
    onMutate: ({ files }) => {
      const toastId = toast.loading(files.length === 1 ? "Salvando anexo..." : `Salvando ${files.length} anexos...`)
      return { toastId }
    },
    onSuccess: async (updatedSchedule, _variables, context) => {
      setCompletionTarget((current) => current?.id === updatedSchedule.id ? updatedSchedule : current)
      setSelectedSchedule((current) => current?.id === updatedSchedule.id ? updatedSchedule : current)
      setCompletionFiles([])
      await invalidateSchedules()
      toast.success("Anexo salvo no agendamento.", {
        id: context?.toastId,
        description: "O arquivo já está seguro e continuará disponível mesmo sem concluir o atendimento.",
      })
    },
    onError: async (error, variables, context) => {
      setCompletionFiles([])
      const refreshed = await getScheduleById(variables.schedule.id).catch(() => null)
      if (refreshed?.data) {
        setCompletionTarget((current) => current?.id === refreshed.data.id ? refreshed.data as AgendaScheduledServiceRow : current)
        setSelectedSchedule((current) => current?.id === refreshed.data.id ? refreshed.data as AgendaScheduledServiceRow : current)
      }
      await invalidateSchedules()
      toast.error(getApiErrorMessage(error, "Não foi possível salvar o anexo."), {
        id: context?.toastId,
        description: "Os arquivos enviados antes da falha permanecem salvos. Confira a lista antes de tentar novamente.",
      })
    },
  })

  const deleteNaMutation = useMutation({
    mutationFn: ({ schedule, documentUrl }: { schedule: AgendaScheduledServiceRow; documentUrl: string }) => (
      deleteScheduleNa(schedule.id, documentUrl)
    ),
    onMutate: () => ({ toastId: toast.loading("Removendo anexo...") }),
    onSuccess: async ({ data }, _variables, context) => {
      const updatedSchedule = data as AgendaScheduledServiceRow
      setCompletionTarget((current) => current?.id === updatedSchedule.id ? updatedSchedule : current)
      setSelectedSchedule((current) => current?.id === updatedSchedule.id ? updatedSchedule : current)
      await invalidateSchedules()
      toast.success("Anexo removido do agendamento.", { id: context?.toastId })
    },
    onError: async (error, variables, context) => {
      const refreshed = await getScheduleById(variables.schedule.id).catch(() => null)
      if (refreshed?.data) {
        setCompletionTarget((current) => current?.id === refreshed.data.id ? refreshed.data as AgendaScheduledServiceRow : current)
        setSelectedSchedule((current) => current?.id === refreshed.data.id ? refreshed.data as AgendaScheduledServiceRow : current)
      }
      await invalidateSchedules()
      toast.error(getApiErrorMessage(error, "Não foi possível remover o anexo."), { id: context?.toastId })
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
      vehiclePlate,
      disposalType,
      disposalStationId,
      disposalQuantityM3,
    }: {
      schedule: AgendaScheduledServiceRow
      startDate: string
      startTime: string
      endDate: string
      endTime: string
      driverEmployeeId: string
      helperEmployeeIds: string[]
      serviceReport: string
      vehiclePlate: string
      disposalType: ScheduleDisposalType | ""
      disposalStationId: string
      disposalQuantityM3: number | null
    }) => {
      const isEditingExecution = schedule.status === "completed"
      const hasExistingNa = Boolean(schedule.naAttachments?.length || schedule.naDocumentUrl)
      if (!isEditingExecution && !hasExistingNa) {
        throw new Error("Anexe ao menos uma NA ou evidência antes de concluir o atendimento.")
      }

      return completeSchedule(schedule.id, {
        startDate,
        startTime,
        endDate,
        endTime,
        driverEmployeeId,
        helperEmployeeIds,
        serviceReport,
        vehiclePlate,
        disposalType: disposalType || null,
        disposalStationId: disposalStationId || undefined,
        disposalQuantityM3: disposalQuantityM3 ?? undefined,
      })
    },
    onMutate: ({ schedule }) => {
      const toastId = toast.loading(
        schedule.status === "completed" ? "Salvando execução..." : "Concluindo atendimento...",
      )
      return { toastId }
    },
    onSuccess: (_response, variables, context) => {
      const isEditingExecution = variables.schedule.status === "completed"
      closeCompletionDialog()
      toast.success(isEditingExecution ? "Execução atualizada." : "Atendimento concluído.", {
        id: context?.toastId,
        description: isEditingExecution
          ? "Os dados executados do atendimento foram corrigidos."
          : "A agenda foi atualizada com o horário executado.",
      })
      void invalidateSchedules().catch(() => undefined)
    },
    onError: (error: any, variables, context) => {
      const fallback = variables.schedule.status === "completed"
        ? "Não foi possível atualizar a execução."
        : "Não foi possível concluir o atendimento."
      toast.error(getApiErrorMessage(error, fallback), {
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
      const fromStr = dateRange?.from ? toCivilDateKey(dateRange.from) : ""
      const toStr = dateRange?.to ? toCivilDateKey(dateRange.to) : ""
      const displayPeriod = resolveScheduleDisplayPeriod(service)
      const dateFrom = displayPeriod.usesExecutionPeriod ? displayPeriod.date : service.date
      const dateTo = displayPeriod.usesExecutionPeriod ? displayPeriod.endDate : service.date
      const matchesDateFrom = !fromStr || dateTo >= fromStr
      const matchesDateTo = !toStr || dateFrom <= toStr

      return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo
    })
  }, [dateRange, schedules, deferredSearchTerm, statusFilter])

  const getServicesForDate = (date: Date) => {
    const dateStr = toCivilDateKey(date)
    return filteredServices.filter((service) => scheduleOccupiesDate(service, dateStr))
  }

  const navigateMonth = (direction: number) => {
    const monthStartKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`
    setSelectedDate(parseCivilDate(addCivilMonthsKey(monthStartKey, direction)) ?? new Date())
  }

  const isToday = (date: Date) => {
    return toCivilDateKey(date) === toCivilDateKey(new Date())
  }

  const handleFormSubmit = (formData: SchedulingFormData, isEditing: boolean) => {
    if (saveMutation.isPending) return

    const scheduleId = isEditing ? editingService?.id : undefined
    const statusOnlyChange = Boolean(isEditing && scheduleId && canManageScheduleStatus && editingService?.status !== formData.status)
    if (!canManageAgenda && !statusOnlyChange) return
    if (!canManageAgenda && statusOnlyChange) {
      saveMutation.mutate({ formData, scheduleId })
      return
    }

    const capacityViolation = getDailyServiceCapacityViolation({
      schedules,
      ignoreScheduleId: scheduleId,
      serviceTypeIds: formData.serviceTypeIds,
      serviceTypes,
      date: formData.date,
      time: formData.time,
      durationMinutes: scheduleDurationToMinutes(formData.duration, formData.durationType),
      durationType: formData.durationType,
    })
    if (capacityViolation) {
      toast.error(formatDailyServiceCapacityViolation(capacityViolation, serviceTypes))
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
      setAvailabilitySuggestion({
        formData,
        scheduleId,
        requested: {
          date: availability.requested.date,
          time: availability.requested.time,
        },
        suggested: availability.suggested,
        conflictingResources: getScheduleConflictResourceNames(availability.conflict, {
          teams,
          employees,
        }),
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
    if (service.status === "cancelled") return
    if (canManageAgenda && !canEditSchedule(service, canManageLockedSchedules)) return

    clearScheduleDialogResetTimeout()
    setSelectedSchedule(null)
    setCancelTarget(null)
    resetCompletionDialog()
    setEditingService(service)
    setInitialFormData(null)
    window.setTimeout(() => setIsDialogOpen(true), 0)
    onDialogChange?.(true)
  }

  const openScheduleFormAtSlot = (date: Date, time: string, resource?: TimelineResource) => {
    if (!canManageAgenda) return

    clearScheduleDialogResetTimeout()
    setSelectedDate(date)
    setEditingService(null)
    setInitialFormData({
      date: toCivilDateKey(date),
      time,
      durationType: "hours",
      duration: 1,
      teamIds: resource?.assignment?.teamIds ?? [],
      employeeIds: resource?.assignment?.employeeIds ?? [],
    })
    setIsDialogOpen(true)
    onDialogChange?.(true)
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

  const getScheduleColor = (schedule: Pick<AgendaScheduledServiceRow, "isEmergency" | "teamId" | "teams">) => {
    if (schedule.isEmergency) return EMERGENCY_SCHEDULE_COLOR
    return schedule.teams[0]?.color || getTeamColor(schedule.teamId)
  }

  const timelineEvents = useMemo(() => {
    const resourceIdsForSchedule = (service: AgendaScheduledServiceRow) => {
      const resourceIds = new Set<string>()

      for (const employee of service.additionalEmployees) resourceIds.add(`employee:${employee.id}`)
      for (const assignedTeam of service.teams) resourceIds.add(`team:${assignedTeam.id}`)

      if (resourceIds.size === 0) resourceIds.add("unassigned")
      return [...resourceIds]
    }

    return filteredServices.flatMap((service) => {
      const linkedTotalDays = Math.max(1, Number(service.multiDayTotal) || 1)
      const linkedDayIndex = Math.min(linkedTotalDays, Math.max(1, Number(service.multiDayIndex) || 1))
      const baseEvent = {
        id: service.id,
        scheduleId: service.id,
        hoverGroupId: service.multiDayGroupId || service.id,
        title: service.clientName,
        subtitle: linkedTotalDays > 1
          ? `${service.serviceTypeName} (${linkedDayIndex}/${linkedTotalDays})`
          : service.serviceTypeName,
        referenceLabel: linkedTotalDays > 1 ? `${linkedDayIndex}/${linkedTotalDays}` : undefined,
        teamColor: getScheduleColor(service),
        teamNames: [...service.teams.map((team) => team.name), ...service.additionalEmployees.map((employee) => employee.name)],
        resourceIds: resourceIdsForSchedule(service),
        isEmergency: service.isEmergency,
        status: service.status,
      }

      const displayPeriod = resolveScheduleDisplayPeriod(service)
      if (displayPeriod.usesExecutionPeriod) {
        const segments = getScheduleDisplaySegments(service)
        return segments.map((segment, index) => ({
          ...baseEvent,
          id: `${service.id}-execution-${segment.date}`,
          subtitle: segments.length > 1
            ? `${service.serviceTypeName} (${index + 1}/${segments.length})`
            : baseEvent.subtitle,
          referenceLabel: segments.length > 1
            ? `${index + 1}/${segments.length}`
            : baseEvent.referenceLabel,
          date: segment.date,
          time: segment.time,
          duration: segment.durationMinutes,
          totalDays: segments.length,
        }))
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
        scheduleId?: string
        hoverGroupId?: string
        title: string
        subtitle: string
        date: string
        time: string
        duration: number
        totalDays?: number
        referenceLabel?: string
        teamColor: string | null
        teamNames?: string[]
        resourceIds?: string[]
        isEmergency?: boolean
        status: string
      }> = []
      let currentDate = service.date

      for (let index = 0; index < days; index += 1) {
        events.push({
          ...baseEvent,
          id: `${service.id}-${currentDate}`,
          subtitle: days > 1 ? `${service.serviceTypeName} (${index + 1}/${days})` : baseEvent.subtitle,
          referenceLabel: days > 1 ? `${index + 1}/${days}` : baseEvent.referenceLabel,
          date: currentDate,
          time: AGENDA_WORKDAY_START_TIME,
          duration: AGENDA_DAY_DURATION_MINUTES,
          totalDays: Math.max(days, linkedTotalDays),
        })
        currentDate = nextBusinessDateKey(currentDate)
      }

      return events
    })
  }, [filteredServices, teams])

  const dayTimelineEvents = useMemo(() => {
    const employeeId = currentUser?.employeeId?.trim()
    if (viewMode !== "day" || !restrictAgendaToOwnEmployee || !employeeId) return timelineEvents

    const ownResourceId = `employee:${employeeId}`
    return timelineEvents.map((event) => ({
      ...event,
      resourceIds: [ownResourceId],
    }))
  }, [currentUser?.employeeId, restrictAgendaToOwnEmployee, timelineEvents, viewMode])

  const dayResources = useMemo<TimelineResource[]>(() => {
    if (viewMode !== "day") return []

    const dateKey = toCivilDateKey(currentDate)
    const activeResourceIds = new Set(
      dayTimelineEvents
        .filter((event) => event.date === dateKey)
        .flatMap((event) => event.resourceIds ?? []),
    )
    const employeeById = new Map(employees.map((employee) => [employee.id, employee]))
    const additionalEmployeeById = new Map(
      filteredServices.flatMap((service) => service.additionalEmployees).map((employee) => [employee.id, employee]),
    )
    const assignedTeamById = new Map(
      filteredServices.flatMap((service) => service.teams).map((team) => [team.id, team]),
    )

    return [...activeResourceIds].map((resourceId) => {
      if (resourceId === "unassigned") {
        return { id: resourceId, kind: "unassigned" as const, name: "Sem responsável", subtitle: "Atribuição pendente" }
      }

      const [kind, id] = resourceId.split(":", 2)
      if (kind === "employee") {
        const employee = employeeById.get(id) ?? additionalEmployeeById.get(id) ?? (
          currentUser?.employeeId === id ? currentUser : undefined
        )
        const role = employee && "role" in employee ? String(employee.role ?? "") : ""
        return {
          id: resourceId,
          kind: "employee" as const,
          name: employee?.name ?? "Funcionário",
          subtitle: role || "Responsável",
          assignment: { employeeIds: [id] },
        }
      }

      const team = assignedTeamById.get(id)
      return {
        id: resourceId,
        kind: "team" as const,
        name: team?.name ?? "Equipe",
        subtitle: "Equipe responsável",
        assignment: { teamIds: [id] },
      }
    }).sort((left, right) => {
      const kindOrder = { employee: 0, team: 1, unassigned: 2 }
      const kindDifference = kindOrder[left.kind] - kindOrder[right.kind]
      return kindDifference || left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" })
    })
  }, [currentDate, currentUser, dayTimelineEvents, employees, filteredServices, viewMode])

  const selectedDateServices = selectedDate ? getServicesForDate(selectedDate) : []

  useEffect(() => {
    const scheduleId = searchParams.get("scheduleId")
    if (!scheduleId || schedules.length === 0 || !currentUser) return

    const schedule = schedules.find((item) => item.id === scheduleId)
    if (!schedule) return

    const selectedScheduleDate = parseCivilDate(resolveScheduleDisplayPeriod(schedule).date) ?? new Date()
    setSelectedDate(selectedScheduleDate)
    openSchedule(schedule)
  }, [currentUser, openSchedule, schedules, searchParams, setSelectedDate])

  const detailsSchedule = completionInfoOpen ? completionTarget : selectedSchedule
  const isEditingExecution = completionTarget?.status === "completed"

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
        isSubmitting={saveMutation.isPending}
      />

      <ScheduleDetailsDialog
        open={!!detailsSchedule}
        onOpenChange={(open) => {
          if (!open) {
            if (completionInfoOpen) {
              closeCompletionDialog()
            } else {
              setSelectedSchedule(null)
              if (searchParams.get("scheduleId")) {
                const params = new URLSearchParams(searchParams.toString())
                params.delete("scheduleId")
                const query = params.toString()
                router.replace(query ? `/agenda?${query}` : "/agenda", { scroll: false })
              }
            }
          }
        }}
        schedule={detailsSchedule}
        schedules={schedules}
        teams={teams}
        serviceTypes={serviceTypes}
        isStartingAttendance={startMutation.isPending}
        canManage={canManageAgenda}
        canStart={detailsSchedule ? canStartSchedule(detailsSchedule, currentUser, teams) : false}
        canStartOutsideScheduledDate={canManageAgenda}
        canReschedule={canManageAgenda}
        canEdit={Boolean(
          detailsSchedule &&
            canShowScheduleEditAction(
              detailsSchedule,
              canManageAgenda,
              canManageScheduleStatus,
              canManageLockedSchedules,
            ),
        )}
        onEdit={() => {
          if (detailsSchedule) handleEditService(detailsSchedule)
        }}
        canEditExecution={Boolean(
          detailsSchedule?.status === "completed" && canEditCompletedExecution,
        )}
        onEditExecution={() => {
          if (detailsSchedule) openExecutionEditDialog(detailsSchedule)
        }}
        onBack={completionInfoOpen ? () => setCompletionInfoOpen(false) : undefined}
        backLabel="Voltar para anexos do atendimento"
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

      <ConfirmActionDialog
        open={Boolean(attendanceCancelTarget)}
        title="Cancelar atendimento?"
        description="O agendamento voltará ao estado anterior (Agendado ou Reagendado). O agendamento não será cancelado."
        confirmLabel="Cancelar atendimento"
        busy={cancelAttendanceMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setAttendanceCancelTarget(null)
        }}
        onConfirm={() => {
          if (attendanceCancelTarget) cancelAttendanceMutation.mutate(attendanceCancelTarget.id)
        }}
      />

      <Dialog
        open={!!completionTarget && !completionInfoOpen}
        onOpenChange={(open) => {
          if (!open && !completionInfoOpen) closeCompletionDialog()
        }}
      >
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] min-w-0 flex-col gap-0 overflow-hidden p-0 max-sm:left-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-none max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0 max-sm:[&_[data-slot=dialog-close]]:right-5 max-sm:[&_[data-slot=dialog-close]]:top-[calc(env(safe-area-inset-top)+1rem)] sm:max-w-lg">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={
              isEditingExecution
                ? "Voltar"
                : completionStep === "checkout"
                  ? "Voltar para anexos do atendimento"
                  : "Voltar"
            }
            className="absolute left-3 top-3 z-20 gap-1.5 px-2 text-foreground hover:text-foreground max-sm:top-[calc(env(safe-area-inset-top)+0.85rem)]"
            onClick={() => {
              if (completionStep === "checkout" && !isEditingExecution) {
                setCompletionStep("attachments")
                return
              }
              if (completionStep === "attachments" && isEditingExecution) {
                setCompletionStep("checkout")
                return
              }
              closeCompletionDialog()
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          {completionStep === "attachments" &&
          !isEditingExecution &&
          completionTarget &&
          canShowScheduleEditAction(
            completionTarget,
            canManageAgenda,
            canManageScheduleStatus,
            canManageLockedSchedules,
          ) ? (
            <button
              type="button"
              aria-label="Editar agendamento"
              className="ring-offset-background focus-visible:ring-ring absolute right-14 top-4 z-20 inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 max-sm:top-[calc(env(safe-area-inset-top)+1rem)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
              onClick={() => handleEditService(completionTarget)}
            >
              <Pencil />
              <span className="sr-only">Editar agendamento</span>
            </button>
          ) : null}
          <DialogHeader className="min-w-0 px-6 pb-4 pt-14 max-sm:px-5 max-sm:pt-[calc(env(safe-area-inset-top)+3.75rem)]">
            <DialogTitle>
              {completionStep === "attachments"
                ? "Anexos do atendimento"
                : isEditingExecution
                ? "Editar execução do atendimento"
                : "Encerrar atendimento"}
            </DialogTitle>
            <DialogDescription>
              {completionStep === "attachments"
                ? "Adicione NAs e evidências da execução. Cada arquivo é salvo no agendamento assim que for anexado."
                : isEditingExecution
                ? "Revise o período executado, a equipe de apoio e as observações antes de salvar."
                : "Informe o período executado, a equipe de apoio e as observações para confirmar o encerramento."}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-5 max-sm:px-5">
            {completionStep === "checkout" ? (
              <AttendanceCompletionFields
                idPrefix="agenda-completion"
                startDate={completionStartDate}
                startTime={completionStartTime}
                endDate={completionEndDate}
                endTime={completionEndTime}
                canEditStart={canManageAgenda}
                driverEmployeeId={completionDriverEmployeeId}
                helperEmployeeIds={completionHelperEmployeeIds}
                serviceReport={completionServiceReport}
                vehiclePlate={completionVehiclePlate}
                disposalType={completionDisposalType}
                disposalStationId={completionDisposalStationId}
                disposalQuantityM3={completionDisposalQuantityM3}
                employees={completionEmployees}
                disabled={completeMutation.isPending || completionEmployeesQuery.isLoading}
                onStartDateChange={setCompletionStartDate}
                onStartTimeChange={setCompletionStartTime}
                onEndDateChange={setCompletionEndDate}
                onEndTimeChange={setCompletionEndTime}
                onDriverEmployeeIdChange={setCompletionDriverEmployeeId}
                onHelperEmployeeIdsChange={setCompletionHelperEmployeeIds}
                onServiceReportChange={setCompletionServiceReport}
                onVehiclePlateChange={setCompletionVehiclePlate}
                onDisposalTypeChange={setCompletionDisposalType}
                onDisposalStationIdChange={setCompletionDisposalStationId}
                onDisposalQuantityM3Change={setCompletionDisposalQuantityM3}
              />
            ) : (
              <CompletionNaAttachments
                existingAttachments={completionTarget?.naAttachments ?? []}
                files={completionFiles}
                disabled={completeMutation.isPending || uploadNaMutation.isPending || deleteNaMutation.isPending}
                uploading={uploadNaMutation.isPending}
                removingDocumentUrl={deleteNaMutation.isPending ? deleteNaMutation.variables?.documentUrl : undefined}
                onAddFiles={(files) => {
                  if (!completionTarget || uploadNaMutation.isPending) return
                  setCompletionFiles(files)
                  uploadNaMutation.mutate({ schedule: completionTarget, files })
                }}
                onRemoveFile={() => undefined}
                onRemoveExistingAttachment={(attachment) => {
                  if (!completionTarget || deleteNaMutation.isPending) return
                  deleteNaMutation.mutate({ schedule: completionTarget, documentUrl: attachment.documentUrl })
                }}
              />
            )}
          </div>

          <DialogFooter className="flex-col gap-2 px-6 pb-6 pt-3 max-sm:px-5 max-sm:pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:flex-row sm:flex-nowrap sm:gap-2 sm:[&>button]:px-2.5">
            {completionStep === "attachments" && !isEditingExecution ? (
              <Button
                type="button"
                variant="outline"
                className="w-full min-w-0 sm:w-auto"
                onClick={() => setCompletionInfoOpen(true)}
              >
                Ver informações
              </Button>
            ) : null}
            {completionStep === "attachments" && !isEditingExecution ? (
              canCancelAttendance && completionTarget ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full min-w-0 border-red-500 text-red-600 hover:border-red-600 hover:bg-red-50 hover:text-red-700 hover:ring-red-600/50 sm:w-auto"
                  disabled={cancelAttendanceMutation.isPending}
                  onClick={() => setAttendanceCancelTarget(completionTarget)}
                >
                  Cancelar atendimento
                </Button>
              ) : null
            ) : null}
            {completionStep === "attachments" && !isEditingExecution ? (
              <AttendanceStartSlider
                action="finish"
                className="sm:hidden"
                disabled={completeMutation.isPending || uploadNaMutation.isPending || deleteNaMutation.isPending}
                onComplete={() => setCompletionStep("checkout")}
              />
            ) : null}
            {completionStep === "checkout" && isEditingExecution ? (
              <Button
                type="button"
                variant="outline"
                className="w-full min-w-0 sm:w-auto"
                disabled={completeMutation.isPending || uploadNaMutation.isPending || deleteNaMutation.isPending}
                onClick={() => setCompletionStep("attachments")}
              >
                Editar anexos
              </Button>
            ) : null}
            <Button
              type="button"
              className={
                completionStep === "attachments" && !isEditingExecution
                  ? "hidden w-full min-w-0 sm:inline-flex sm:w-auto"
                  : "w-full min-w-0 sm:w-auto"
              }
              disabled={
                !completionTarget ||
                (!isEditingExecution && !completionTarget.naAttachments?.length && !completionTarget.naDocumentUrl) ||
                uploadNaMutation.isPending ||
                deleteNaMutation.isPending ||
                (completionStep === "checkout" && (
                  !completionStartDate ||
                  !completionStartTime ||
                  !completionEndDate ||
                  !completionEndTime ||
                  Boolean(scheduleDisposalValidationMessage(
                    completionDisposalType,
                    completionDisposalStationId,
                    completionDisposalQuantityM3,
                  ))
                )) ||
                completeMutation.isPending
              }
              onClick={() => {
                if (!completionTarget) return
                if (completionStep === "attachments") {
                  setCompletionStep("checkout")
                  if (isEditingExecution) toast.success("Anexos atualizados.")
                  return
                }

                const startedAt = new Date(`${completionStartDate}T${completionStartTime}:00`)
                const completedAt = new Date(`${completionEndDate}T${completionEndTime}:00`)
                if (completedAt.getTime() <= startedAt.getTime()) {
                  toast.error("A data e o horário final devem ser maiores que o início.")
                  return
                }

                const disposalValidationMessage = scheduleDisposalValidationMessage(
                  completionDisposalType,
                  completionDisposalStationId,
                  completionDisposalQuantityM3,
                )
                if (disposalValidationMessage) {
                  toast.error(disposalValidationMessage)
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
                  vehiclePlate: completionVehiclePlate,
                  disposalType: completionDisposalType,
                  disposalStationId: completionDisposalStationId,
                  disposalQuantityM3: completionDisposalQuantityM3,
                })
              }}
            >
              {completeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
                  <span className="truncate">{isEditingExecution ? "Salvando..." : "Concluindo..."}</span>
                </>
              ) : isEditingExecution && completionStep === "attachments" ? (
                "Salvar"
              ) : isEditingExecution ? (
                "Salvar"
              ) : completionStep === "checkout" ? (
                "Confirmar encerramento"
              ) : (
                "Encerrar atendimento"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScheduleConflictDialog
        open={Boolean(availabilitySuggestion)}
        requested={availabilitySuggestion?.requested}
        suggested={availabilitySuggestion?.suggested}
        conflictingResources={availabilitySuggestion?.conflictingResources}
        busy={saveMutation.isPending}
        onCancel={() => setAvailabilitySuggestion(null)}
        onContinue={() => {
          if (!availabilitySuggestion) return
          saveMutation.mutate({
            formData: availabilitySuggestion.formData,
            scheduleId: availabilitySuggestion.scheduleId,
            allowConflict: true,
          })
          setAvailabilitySuggestion(null)
        }}
        onUseSuggested={() => {
          if (!availabilitySuggestion?.suggested) return
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
      />

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
            options={SCHEDULE_STATUS_FILTER_OPTIONS}
            placeholder="Status"
            searchPlaceholder="Buscar status..."
            allLabel="Todos os status"
            className="sm:w-[160px]"
          />

          <div
            data-agenda-period-filter
            className={cn(
              "col-span-2 w-full min-w-0 sm:col-auto sm:shrink-0 sm:transition-[width] sm:duration-500 sm:ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none",
              viewMode === "week" ? "sm:w-[360px]" : "sm:w-[180px]",
            )}
          >
            {viewMode === "day" ? (
              <DatePicker
                value={currentDate}
                onChange={(date) => {
                  if (date) setSelectedDate(date)
                }}
                ariaLabel="Filtrar dia"
                className="w-full min-w-0"
              />
            ) : viewMode === "week" ? (
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
                placeholder="Filtrar data"
                className="w-full min-w-0"
              />
            ) : (
              <AgendaPeriodSelector
                date={currentDate}
                label={`${MONTHS[currentMonth]} ${currentYear}`}
                mode="month"
                variant="filter"
                ariaLabel="Filtrar mês e ano"
                triggerClassName="w-full min-w-0"
                onSelect={setSelectedDate}
              />
            )}
          </div>

          <Tabs
            data-agenda-view-tabs
            value={viewMode}
            onValueChange={(value) => {
              const mode = value as "month" | "week" | "day"
              if (mode === "week" || mode === "day") {
                setCurrentDate(selectedDate || new Date())
              }
              if (mode !== "week") setDateRange(undefined)
              setViewModeParam(mode)
            }}
            className="hidden shrink-0 sm:block [&_[data-slot=tabs-indicator]]:duration-500 [&_[data-slot=tabs-indicator]]:ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:[&_[data-slot=tabs-indicator]]:transition-none"
          >
            <TabsList className="h-9">
              <TabsTrigger value="day" className="px-3 text-xs">
                Dia
              </TabsTrigger>
              <TabsTrigger value="week" className="px-3 text-xs">
                Semana
              </TabsTrigger>
              <TabsTrigger value="month" className="px-3 text-xs">
                Mês
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
          <Card className="flex h-full min-h-[420px] min-w-0 flex-col gap-0 py-0 lg:flex-1 lg:overflow-hidden">
            <CardHeader data-agenda-period-navigation className="flex h-14 shrink-0 items-center px-3 py-0">
              <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center">
                <Button variant="ghost" size="icon" className="h-9 w-9 justify-self-start" onClick={() => navigateMonth(-1)}>
                  <span className="sr-only">Mês anterior</span>
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <CardTitle className="text-base">
                  <AgendaPeriodSelector
                    date={currentDate}
                    label={`${MONTHS[currentMonth]} ${currentYear}`}
                    mode="month"
                    onSelect={(date) => {
                      setCurrentDate(date)
                      setSelectedDate(date)
                    }}
                  />
                </CardTitle>
                <div className="flex items-center justify-self-end gap-2">
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigateMonth(1)}>
                    <span className="sr-only">Próximo mês</span>
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden h-9 rounded-full px-4 text-sm sm:inline-flex"
                    onClick={() => {
                      const today = new Date()
                      setSelectedDate(today)
                      setDateRange(undefined)
                    }}
                  >
                    Hoje
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              <div className="grid h-10 w-full shrink-0 grid-cols-7 items-center gap-1">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day.value} className="text-center text-xs font-medium text-muted-foreground">
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
                                style={{ backgroundColor: getScheduleColor(service) }}
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
            data-agenda-day-details
            aria-hidden={!isMobile && !dayPanelOpen}
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
                dayPanelContentVisible ? "lg:opacity-100 lg:delay-75" : "lg:opacity-0",
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
                        <Card
                          key={service.id}
                          className={cn(
                            "group cursor-pointer border-border/70 transition-colors duration-200 hover:border-primary/30",
                            service.status === "in_progress" && !service.isEmergency && "border-[#edd66b] hover:border-[#ddc253]",
                            service.isEmergency && "border-red-300 hover:border-red-400",
                          )}
                          onClick={() => openSchedule(service)}
                        >
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
                                {resolveScheduleDisplayPeriod(service).time} ({formatScheduleDisplayDuration(service)})
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

                            {canOpenScheduleEditor || canAccessScheduleCompletion(service, currentUser) ? (
                            <div className="mt-2 flex gap-1" onClick={(event) => event.stopPropagation()}>
                              {canShowScheduleEditAction(
                                service,
                                canManageAgenda,
                                canManageScheduleStatus,
                                canManageLockedSchedules,
                              ) && (
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
                              {canAccessScheduleCompletion(service, currentUser) && (
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
          <Card className="flex min-w-0 flex-col overflow-hidden py-0 lg:flex-1">
            <CardContent className="flex h-[calc(100dvh-280px)] min-h-[420px] flex-none flex-col p-0 lg:h-[calc(100vh-280px)] lg:min-h-0 lg:flex-1 lg:[@media(max-height:1199px)]:h-[calc(100dvh-180px)]">
              <WeekTimeline
                events={viewMode === "day" ? dayTimelineEvents : timelineEvents}
                currentDate={currentDate}
                selectedDate={selectedDate}
                mode={viewMode === "day" ? "day" : "week"}
                resources={dayResources}
                onDateChange={setCurrentDate}
                onToday={() => setDateRange(undefined)}
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
            data-agenda-day-details
            aria-hidden={!isMobile && !dayPanelOpen}
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
                dayPanelContentVisible ? "lg:opacity-100 lg:delay-75" : "lg:opacity-0",
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
                        <Card
                          key={service.id}
                          className={cn(
                            "group cursor-pointer border-border/70 transition-colors duration-200 hover:border-primary/30",
                            service.status === "in_progress" && !service.isEmergency && "border-[#edd66b] hover:border-[#ddc253]",
                            service.isEmergency && "border-red-300 hover:border-red-400",
                          )}
                          onClick={() => openSchedule(service)}
                        >
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
                                {resolveScheduleDisplayPeriod(service).time} ({formatScheduleDisplayDuration(service)})
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

                            {canOpenScheduleEditor || canAccessScheduleCompletion(service, currentUser) ? (
                            <div className="mt-2 flex gap-1" onClick={(event) => event.stopPropagation()}>
                              {canShowScheduleEditAction(
                                service,
                                canManageAgenda,
                                canManageScheduleStatus,
                                canManageLockedSchedules,
                              ) && (
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
                              {canAccessScheduleCompletion(service, currentUser) && (
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
