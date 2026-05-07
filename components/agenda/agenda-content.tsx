"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  Calendar,
  Calendar as CalendarIcon,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit,
  FileUp,
  MapPin,
  Search,
  X,
} from "lucide-react"

import { listClients } from "@/lib/api/clients"
import { listEmployees } from "@/lib/api/employees"
import { getApiErrorMessage } from "@/lib/api/errors"
import { listSchedules, createSchedule, updateSchedule, startSchedule, completeSchedule, cancelSchedule, uploadScheduleNa, type ScheduleRecord } from "@/lib/api/schedules"
import { listServices } from "@/lib/api/services"
import { listTeams } from "@/lib/api/teams"
import { toCivilDateKey } from "@/lib/date-utils"
import { useMobileFiltersOpen } from "@/lib/hooks/use-mobile-filters"
import { useUrlQueryState } from "@/lib/hooks/use-url-query-state"
import { checkScheduleAvailability, formatAvailabilitySlot } from "@/lib/schedule-availability"
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
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { WeekTimeline } from "./week-timeline"
import { ScheduleDetailsDialog } from "@/components/agendamentos/schedule-details-dialog"
import { SchedulingFormDialog, type SchedulingFormData } from "@/components/agendamentos/scheduling-form-dialog"
import {
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

interface AgendaContentProps {
  openDialog?: boolean
  onDialogChange?: (open: boolean) => void
}

const formatFileSize = (size?: number) => {
  if (!size) return ""
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

const mapSchedule = (schedule: ScheduleRecord): AgendaScheduledServiceRow => ({
  ...schedule,
  recurrence: schedule.recurrence ?? { ...DEFAULT_RECURRENCE },
  notes: schedule.notes ?? "",
})

function getScheduleIconTone(schedule: Pick<ScheduleRecord, "isEmergency">) {
  return schedule.isEmergency
    ? { wrapper: "bg-red-50", icon: "text-red-600" }
    : { wrapper: "bg-primary/10", icon: "text-primary" }
}

function canCancelSchedule(schedule: Pick<ScheduleRecord, "status">) {
  return !["in_progress", "completed"].includes(schedule.status)
}

export function AgendaContent({ openDialog, onDialogChange }: AgendaContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const mobileFiltersOpen = useMobileFiltersOpen()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const [searchTerm, setSearchTerm] = useUrlQueryState("q")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"month" | "week">("month")
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
  const [cancelReason, setCancelReason] = useState("")
  const [cancelStep, setCancelStep] = useState<"reason" | "confirm">("reason")
  const [completionTarget, setCompletionTarget] = useState<AgendaScheduledServiceRow | null>(null)
  const [completionStartDate, setCompletionStartDate] = useState("")
  const [completionStartTime, setCompletionStartTime] = useState("")
  const [completionEndDate, setCompletionEndDate] = useState("")
  const [completionEndTime, setCompletionEndTime] = useState("")
  const [completionFile, setCompletionFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const schedulesQuery = useQuery({
    queryKey: ["schedules", "agenda"],
    queryFn: () => listSchedules(),
  })
  const clientsQuery = useQuery({
    queryKey: ["clients", "agenda"],
    queryFn: () => listClients(),
  })
  const serviceTypesQuery = useQuery({
    queryKey: ["services", "agenda"],
    queryFn: () => listServices(),
  })
  const teamsQuery = useQuery({
    queryKey: ["teams", "agenda"],
    queryFn: () => listTeams(),
  })
  const employeesQuery = useQuery({
    queryKey: ["employees", "agenda"],
    queryFn: () => listEmployees(),
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
        setEditingService(null)
        setInitialFormData({
          date: selectedDate ? toCivilDateKey(selectedDate) : toCivilDateKey(new Date()),
        })
      }
      setIsDialogOpen(openDialog)
    }
  }, [openDialog, isDialogOpen, selectedDate])

  const invalidateSchedules = async () => {
    await queryClient.invalidateQueries({ queryKey: ["schedules"] })
    await queryClient.invalidateQueries({ queryKey: ["schedules", "agenda"] })
    await queryClient.invalidateQueries({ queryKey: ["agendamentos"] })
    await queryClient.invalidateQueries({ queryKey: ["notifications"] })
    await queryClient.invalidateQueries({ queryKey: ["analytics"] })
  }

  const resetForm = () => {
    setEditingService(null)
    setInitialFormData(null)
    setIsDialogOpen(false)
    onDialogChange?.(false)
  }

  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open)
    onDialogChange?.(open)
    if (!open) {
      setEditingService(null)
      setInitialFormData(null)
    }
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

      const payload = {
        clientId: formData.clientId,
        unitId: scheduleId ? editingService?.unitId ?? primaryUnit.id : primaryUnit.id,
        serviceTypeId: formData.serviceTypeId,
        teamIds: formData.teamIds,
        additionalEmployeeIds: formData.employeeIds,
        scheduledDate: formData.date,
        scheduledTime: formData.time,
        estimatedDuration: scheduleDurationToMinutes(formData.duration, formData.durationType),
        isEmergency: formData.isEmergency,
        billable: formData.createContract,
        value: formData.createContract ? formData.value : 0,
        notes: formData.notes,
      }

      if (scheduleId) {
        return updateSchedule(scheduleId, payload)
      }

      return createSchedule(payload)
    },
    onMutate: (variables) => {
      const toastId = toast.loading(variables.scheduleId ? "Salvando agendamento..." : "Criando atendimento...")
      return { toastId }
    },
    onSuccess: async (response, variables, context) => {
      await invalidateSchedules()
      resetForm()
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
    onSuccess: async () => {
      await invalidateSchedules()
      setSelectedSchedule(null)
      toast.success("Atendimento iniciado.", {
        description: "O agendamento foi movido para em andamento.",
      })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Não foi possível iniciar o atendimento."))
    },
  })

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      cancelSchedule(id, { cancellationReason: reason }),
    onSuccess: async () => {
      await invalidateSchedules()
      setCancelTarget(null)
      setCancelReason("")
      setCancelStep("reason")
      toast.success("Agendamento cancelado.", {
        description: "O motivo foi salvo no histórico.",
      })
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, "Não foi possível cancelar o agendamento."))
    },
  })

  const completeMutation = useMutation({
    mutationFn: async ({
      schedule,
      startDate,
      startTime,
      endDate,
      endTime,
      file,
    }: {
      schedule: AgendaScheduledServiceRow
      startDate: string
      startTime: string
      endDate: string
      endTime: string
      file: File | null
    }) => {
      const completed = await completeSchedule(schedule.id, { startDate, startTime, endDate, endTime })
      if (file) {
        await uploadScheduleNa(schedule.id, file)
      }
      return completed
    },
    onSuccess: async ({ data }) => {
      await invalidateSchedules()
      setCompletionTarget(null)
      setCompletionStartDate("")
      setCompletionStartTime("")
      setCompletionEndDate("")
      setCompletionEndTime("")
      setCompletionFile(null)
      toast.success("Atendimento concluído.", {
        description: "A agenda foi atualizada com o horário executado.",
      })
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, "Não foi possível concluir o atendimento."))
    },
  })

  const currentMonth = currentDate.getMonth()
  const currentYear = currentDate.getFullYear()

  const daysInMonth = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1)
    const lastDay = new Date(currentYear, currentMonth + 1, 0)
    const startPadding = firstDay.getDay()
    const days: (Date | null)[] = []

    for (let index = 0; index < startPadding; index += 1) {
      days.push(null)
    }

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      days.push(new Date(currentYear, currentMonth, day))
    }

    return days
  }, [currentMonth, currentYear])

  const filteredServices = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
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
  }, [schedules, searchTerm, statusFilter])

  const getServicesForDate = (date: Date) => {
    const dateStr = toCivilDateKey(date)
    return filteredServices.filter((service) => service.date === dateStr)
  }

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentYear, currentMonth + direction, 1))
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const handleFormSubmit = (formData: SchedulingFormData, isEditing: boolean) => {
    const scheduleId = isEditing ? editingService?.id : undefined
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
    setSelectedSchedule(null)
    setCancelTarget(null)
    setCompletionTarget(null)
    setEditingService(service)
    setInitialFormData(null)
    window.setTimeout(() => setIsDialogOpen(true), 0)
  }

  const openScheduleFormAtSlot = (date: Date, time: string) => {
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
    const defaultDate = schedule.date || toCivilDateKey(new Date())
    setCompletionTarget(schedule)
    setCompletionStartDate(schedule.completionStartDate || defaultDate)
    setCompletionStartTime(schedule.completionStartTime || schedule.time || "")
    setCompletionEndDate(schedule.completionEndDate || schedule.completionStartDate || defaultDate)
    setCompletionEndTime(schedule.completionEndTime || "")
    setCompletionFile(null)
  }

  const openSchedule = (schedule: AgendaScheduledServiceRow) => {
    if (schedule.status === "in_progress") {
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

  const selectedDateServices = selectedDate ? getServicesForDate(selectedDate) : []

  useEffect(() => {
    const scheduleId = searchParams.get("scheduleId")
    if (!scheduleId || schedules.length === 0) return

    const schedule = schedules.find((item) => item.id === scheduleId)
    if (!schedule) return

    setSelectedDate(new Date(`${schedule.date}T00:00:00`))
    setCurrentDate(new Date(`${schedule.date}T00:00:00`))
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
        onStartAttendance={async (schedule) => {
          await startMutation.mutateAsync(schedule)
        }}
      />

      <Dialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) {
            setCancelTarget(null)
            setCancelReason("")
            setCancelStep("reason")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {cancelStep === "reason" ? (
            <>
              <DialogHeader>
                <DialogTitle>Cancelar agendamento</DialogTitle>
                <DialogDescription>
                  Informe o motivo do cancelamento para manter o histórico claro para a equipe.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="agenda-cancel-reason">Motivo do cancelamento *</Label>
                <Textarea
                  id="agenda-cancel-reason"
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  placeholder="Ex.: cliente pediu reagendamento, acesso indisponível, equipe sem janela..."
                  className="min-h-28"
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button type="button" variant="outline" onClick={() => setCancelTarget(null)}>
                  Voltar
                </Button>
                <Button
                  type="button"
                  disabled={!cancelReason.trim()}
                  className="bg-red-500 text-white hover:bg-red-600"
                  onClick={() => setCancelStep("confirm")}
                >
                  Cancelar agendamento
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Confirmar cancelamento?</DialogTitle>
                <DialogDescription>
                  Esta ação vai marcar o agendamento de {cancelTarget?.clientName} como cancelado.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-900">
                <p className="font-medium">Motivo registrado</p>
                <p className="mt-1 text-red-800">{cancelReason}</p>
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button type="button" variant="outline" onClick={() => setCancelStep("reason")}>
                  Voltar
                </Button>
                <Button
                  type="button"
                  className="bg-red-500 text-white hover:bg-red-600"
                  onClick={() => {
                    if (cancelTarget) {
                      cancelMutation.mutate({ id: cancelTarget.id, reason: cancelReason.trim() })
                    }
                  }}
                >
                  Confirmar cancelamento
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!completionTarget}
        onOpenChange={(open) => {
          if (!open) {
            setCompletionTarget(null)
            setCompletionStartDate("")
            setCompletionStartTime("")
            setCompletionEndDate("")
            setCompletionEndTime("")
            setCompletionFile(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Concluir agendamento</DialogTitle>
            <DialogDescription>
              Registre o horário executado e anexe a NA da visita para vincular ao cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
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

          <div className="space-y-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4">
            <div>
              <p className="text-sm font-semibold">Anexo da NA</p>
              <p className="text-xs text-muted-foreground">PDF, DOCX, imagem ou foto tirada pela câmera.</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              onChange={(event) => setCompletionFile(event.target.files?.[0] ?? null)}
            />
            <input
              ref={cameraInputRef}
              type="file"
              className="hidden"
              accept="image/*"
              capture="environment"
              onChange={(event) => setCompletionFile(event.target.files?.[0] ?? null)}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" className="flex-1" onClick={() => fileInputRef.current?.click()}>
                <FileUp className="mr-2 h-4 w-4" />
                Anexar arquivo
              </Button>
              <Button type="button" variant="outline" className="flex-1" onClick={() => cameraInputRef.current?.click()}>
                <Camera className="mr-2 h-4 w-4" />
                Usar câmera
              </Button>
            </div>
            {completionFile ? (
              <div className="flex items-center justify-between rounded-xl bg-card px-3 py-2 text-sm">
                <span className="truncate">{completionFile.name}</span>
                <span className="ml-3 shrink-0 text-xs text-muted-foreground">{formatFileSize(completionFile.size)}</span>
              </div>
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setCompletionTarget(null)}>
              Voltar
            </Button>
            <Button
              type="button"
              disabled={!completionTarget || !completionStartDate || !completionStartTime || !completionEndDate || !completionEndTime || completeMutation.isPending}
              onClick={() => {
                if (completionTarget) {
                  completeMutation.mutate({
                    schedule: completionTarget,
                    startDate: completionStartDate,
                    startTime: completionStartTime,
                    endDate: completionEndDate,
                    endTime: completionEndTime,
                    file: completionFile,
                  })
                }
              }}
            >
              Concluir visita
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
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

      <div className={`${mobileFiltersOpen ? "grid" : "hidden"} grid-cols-2 gap-2 sm:flex sm:items-center`}>
        <div className="relative sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente, serviço, equipe..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-10"
          />
        </div>

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

      {viewMode === "month" ? (
        <div className="grid gap-4 lg:flex-1 lg:grid-cols-5 lg:overflow-hidden">
          <Card className="flex h-full min-h-[420px] flex-col lg:col-span-3 lg:overflow-hidden xl:col-span-3">
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
                        <span className={`font-medium ${isToday(date) ? "text-primary" : ""}`}>{date.getDate()}</span>
                        {services.length > 0 ? (
                          <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
                            {[...new Set(services.map((service) => service.teamId))].slice(0, 4).map((teamId) => (
                              <div
                                key={teamId || "no-team"}
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: getTeamColor(teamId) }}
                                title={`${services.filter((service) => service.teamId === teamId).length} serviço(s)`}
                              />
                            ))}
                            {[...new Set(services.map((service) => service.teamId))].length > 4 ? (
                              <span className="text-[9px] text-muted-foreground">
                                +{[...new Set(services.map((service) => service.teamId))].length - 4}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="flex flex-col lg:col-span-2 lg:overflow-hidden xl:col-span-2">
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
                    <div className="grid grid-cols-1 gap-3 px-6 sm:grid-cols-2 lg:grid-cols-1">
                      {selectedDateServices.map((service) => (
                        <Card key={service.id} className="cursor-pointer" onClick={() => openSchedule(service)}>
                          <CardContent>
                            <div className="mb-4 flex items-start justify-between gap-3">
                              <div className="flex min-w-0 flex-1 items-center gap-2">
                                <div className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:flex ${getScheduleIconTone(service).wrapper}`}>
                                  <Calendar className={`h-5 w-5 ${getScheduleIconTone(service).icon}`} />
                                </div>
                                <div className="min-w-0 flex-1 pr-1">
                                  <h4 className="max-w-[190px] whitespace-normal break-words text-sm font-medium leading-snug sm:max-w-none">
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
                                {service.time} ({service.duration} min)
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

                            <div className="mt-2 flex gap-1" onClick={(event) => event.stopPropagation()}>
                              {service.status !== "in_progress" && (
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
                              {service.status === "in_progress" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    openCompletionDialog(service)
                                  }}
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                              )}
                              {canCancelSchedule(service) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    setCancelTarget(service)
                                    setCancelReason(service.cancellationReason || "")
                                    setCancelStep("reason")
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
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
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 lg:flex-1 lg:grid-cols-5 lg:overflow-hidden">
          <Card className="flex flex-col lg:col-span-3 lg:overflow-hidden xl:col-span-3">
            <CardContent className="flex min-h-0 flex-1 flex-col p-0 lg:h-[calc(100vh-280px)]">
              <WeekTimeline
                events={filteredServices.map((service) => ({
                  id: service.id,
                  title: service.clientName,
                  subtitle: service.serviceTypeName,
                  date: service.date,
                  time: service.time || "08:00",
                  duration: service.duration,
                  teamColor: service.teams.length > 0 ? service.teams[0].color : getTeamColor(service.teamId),
                  status: service.status,
                }))}
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

          <Card className="flex flex-col lg:col-span-2 lg:overflow-hidden xl:col-span-2">
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
                    <div className="grid grid-cols-1 gap-3 px-6 sm:grid-cols-2 lg:grid-cols-1">
                      {selectedDateServices.map((service) => (
                        <Card key={service.id} className="cursor-pointer" onClick={() => openSchedule(service)}>
                          <CardContent>
                            <div className="mb-4 flex items-start justify-between gap-3">
                              <div className="flex min-w-0 flex-1 items-center gap-2">
                                <div className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:flex ${getScheduleIconTone(service).wrapper}`}>
                                  <Calendar className={`h-5 w-5 ${getScheduleIconTone(service).icon}`} />
                                </div>
                                <div className="min-w-0 flex-1 pr-1">
                                  <h4 className="max-w-[190px] whitespace-normal break-words text-sm font-medium leading-snug sm:max-w-none">
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
                                {service.time} ({service.duration} min)
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

                            <div className="mt-2 flex gap-1" onClick={(event) => event.stopPropagation()}>
                              {service.status !== "in_progress" && (
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
                              {service.status === "in_progress" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    openCompletionDialog(service)
                                  }}
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                              )}
                              {canCancelSchedule(service) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    setCancelTarget(service)
                                    setCancelReason(service.cancellationReason || "")
                                    setCancelStep("reason")
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
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
          </Card>
        </div>
      )}
    </div>
  )
}
