"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, ArrowLeft, CalendarDays, Clock3, FileDown, Loader2, MapPin, OctagonX, Pencil, Sparkles, Users } from "lucide-react"
import { toast } from "sonner"

import { AttendanceStartSlider } from "@/components/agendamentos/attendance-start-slider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useIsMobile } from "@/hooks/use-mobile"
import { getApiErrorMessage } from "@/lib/api/errors"
import { exportScheduleSummaryPdf, getScheduleRescheduleOptions, rescheduleSchedule, type ScheduleRecord } from "@/lib/api/schedules"
import type { ServiceRecord } from "@/lib/api/services"
import type { TeamRecord } from "@/lib/api/teams"
import { formatCivilDate, parseCivilDate, toCivilDateKey } from "@/lib/date-utils"
import {
  checkScheduleAvailability,
  formatDailyServiceCapacityViolation,
  formatAvailabilitySlot,
  formatScheduleConflictConfirmation,
  getAvailableRescheduleTimes,
  getScheduleConflictResourceNames,
  getScheduleDailyServiceCapacityViolation,
  getScheduleRescheduleDurationConfig,
  getScheduleRescheduleIgnoredIds,
  isScheduleConflictErrorMessage,
} from "@/lib/schedule-availability"
import { formatConfiguredScheduleDuration } from "@/lib/schedule-duration"
import { formatScheduleDisposalCurrency } from "@/lib/schedule-disposal"
import { cn } from "@/lib/utils"

interface ScheduleDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule: ScheduleRecord | null
  schedules?: ScheduleRecord[]
  teams?: TeamRecord[]
  serviceTypes?: ServiceRecord[]
  onStartAttendance: (schedule: ScheduleRecord) => Promise<void> | void
  isStartingAttendance?: boolean
  canManage?: boolean
  canStart?: boolean
  canStartOutsideScheduledDate?: boolean
  canReschedule?: boolean
  canEdit?: boolean
  onEdit?: () => void
  canEditExecution?: boolean
  onEditExecution?: () => void
  onBack?: () => void
  backLabel?: string
}

function getStatusLabel(status: ScheduleRecord["status"]) {
  switch (status) {
    case "draft":
      return "Rascunho"
    case "scheduled":
      return "Agendado"
    case "in_progress":
      return "Em andamento"
    case "completed":
      return "Concluído"
    case "cancelled":
      return "Cancelado"
    case "rescheduled":
      return "Reagendado"
    default:
      return status
  }
}

function formatScheduleDate(date: string) {
  return formatCivilDate(date, date)
}

export function ScheduleDetailsDialog({
  open,
  onOpenChange,
  schedule,
  schedules = [],
  teams = [],
  serviceTypes = [],
  onStartAttendance,
  isStartingAttendance = false,
  canManage = true,
  canStart,
  canStartOutsideScheduledDate = false,
  canReschedule,
  canEdit = false,
  onEdit,
  canEditExecution = false,
  onEditExecution,
  onBack,
  backLabel = "Voltar",
}: ScheduleDetailsDialogProps) {
  const isMobile = useIsMobile()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<"details" | "reschedule">("details")
  const [customDate, setCustomDate] = useState("")
  const [customTime, setCustomTime] = useState("")
  const [rescheduleConflict, setRescheduleConflict] = useState<{
    requested: { date: string; time: string }
    suggested?: { date: string; time: string }
    conflictingResources: string[]
  } | null>(null)
  const canStartAction = canStart ?? (canManage && !schedule?.isClientDelinquent)
  const canRescheduleAction = canReschedule ?? canManage

  useEffect(() => {
    if (!open || !schedule) return
    setMode("details")
    setCustomDate(schedule.date)
    setCustomTime(schedule.time || "08:00")
    setRescheduleConflict(null)
  }, [open, schedule?.id, schedule?.date, schedule?.time])

  const optionsQuery = useQuery({
    queryKey: ["schedule", "reschedule-options", schedule?.id],
    queryFn: () => getScheduleRescheduleOptions(schedule!.id),
    enabled: canRescheduleAction && open && mode === "reschedule" && Boolean(schedule?.id),
  })

  const customDateValue = useMemo(() => {
    if (!customDate) return null
    return parseCivilDate(customDate)
  }, [customDate])

  const availableCustomTimes = useMemo(
    () =>
      getAvailableRescheduleTimes({
        schedules,
        teams,
        schedule,
        date: customDate,
        mode: "manual",
      }),
    [customDate, schedule, schedules, teams],
  )

  const getDateUnavailabilityReason = (date: Date) => {
    const dateKey = toCivilDateKey(date)
    if (dateKey < toCivilDateKey(new Date())) return "Data anterior ao dia atual"
    if (!schedule) return undefined
    const capacityViolation = getScheduleDailyServiceCapacityViolation({
      schedules,
      schedule,
      serviceTypes,
      date: dateKey,
    })
    if (capacityViolation) {
      return formatDailyServiceCapacityViolation(capacityViolation, serviceTypes)
    }

    return getAvailableRescheduleTimes({
      schedules,
      teams,
      schedule,
      date: dateKey,
      mode: "manual",
    }).length === 0
      ? "Horário indisponível"
      : undefined
  }

  useEffect(() => {
    if (!open || mode !== "reschedule" || !schedule || !customDate) return
    if (!customTime && availableCustomTimes.length > 0) {
      setCustomTime(availableCustomTimes[0] ?? "")
    }
  }, [availableCustomTimes, customDate, customTime, mode, open, schedule])

  const rescheduleMutation = useMutation({
    mutationFn: (payload: { scheduledDate: string; scheduledTime?: string; allowConflict?: boolean }) =>
      rescheduleSchedule(schedule!.id, payload),
    onMutate: () => {
      const toastId = toast.loading("Reagendando atendimento...")
      return { toastId }
    },
    onSuccess: async (_response, _variables, context) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["schedules"] }),
        queryClient.invalidateQueries({ queryKey: ["analytics"] }),
      ])
      toast.success("Atendimento reagendado.", {
        id: context?.toastId,
        description: _variables.allowConflict
          ? "O horário com conflito foi mantido conforme sua confirmação."
          : "A disponibilidade da equipe foi validada antes de salvar.",
      })
      onOpenChange(false)
    },
    onError: (error, variables, context) => {
      const message = getApiErrorMessage(error, "Não foi possível reagendar o atendimento.")
      if (!variables.allowConflict && isScheduleConflictErrorMessage(message)) {
        toast.dismiss(context?.toastId)
        setRescheduleConflict({
          requested: {
            date: variables.scheduledDate,
            time: variables.scheduledTime || schedule?.time || "08:00",
          },
          conflictingResources: [],
        })
        return
      }

      toast.error(message, {
        id: context?.toastId,
      })
    },
  })

  const exportSummaryMutation = useMutation({
    mutationFn: () => exportScheduleSummaryPdf(schedule!.id),
    onMutate: () => {
      const toastId = toast.loading("Gerando resumo do agendamento...")
      return { toastId }
    },
    onSuccess: ({ blob, fileName }, _variables, context) => {
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = objectUrl
      anchor.download = fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
      toast.success("Resumo exportado.", {
        id: context?.toastId,
        description: "O PDF foi gerado para download sem ser salvo no R2.",
      })
    },
    onError: (error, _variables, context) => {
      toast.error(getApiErrorMessage(error, "Não foi possível exportar o resumo do agendamento."), {
        id: context?.toastId,
      })
    },
  })

  if (!schedule) return null

  const assignees = [
    ...schedule.teams.map((team) => team.name),
    ...schedule.additionalEmployees.map((employee) => employee.name),
  ]

  const isRecurringSchedule = Boolean(schedule.contractId && !schedule.isManual)
  const hasStartableStatus = ["scheduled", "rescheduled"].includes(schedule.status)
  const scheduledDate = parseCivilDate(schedule.date)
  const isScheduledForToday = Boolean(
    scheduledDate && toCivilDateKey(scheduledDate) === toCivilDateKey(new Date()),
  )
  const canStartAttendance =
    canStartAction && hasStartableStatus && (isScheduledForToday || canStartOutsideScheduledDate)
  const isBlockedByScheduleDate =
    canStartAction && hasStartableStatus && !isScheduledForToday && !canStartOutsideScheduledDate
  const hasDelinquencyWarning = Boolean(schedule.isClientDelinquent && hasStartableStatus)
  const canRescheduleSchedule = canRescheduleAction && ["draft", "scheduled", "rescheduled"].includes(schedule.status)
  const multiDayTotal = Math.trunc(Number(schedule.multiDayTotal) || 0)
  const isMultiDayMainSchedule = Number(schedule.multiDayIndex) === 1 && multiDayTotal > 1
  const isMultiDayChildSchedule = Number(schedule.multiDayIndex) > 1 && multiDayTotal > 1
  const showAttendanceAction = canStartAttendance || isBlockedByScheduleDate || canRescheduleSchedule || (canManage && schedule.status === "draft")
  const attendanceMessage = isBlockedByScheduleDate
    ? `Este atendimento só pode ser iniciado na data agendada: ${formatScheduleDate(schedule.date)}.`
    : canStartAttendance
      ? "Use o botão abaixo para iniciar o atendimento deste agendamento."
      : "O atendimento será liberado assim que o contrato estiver assinado."
  const delinquencyWarningMessage = "Atenção: este cliente possui parcela vencida. A inadimplência não impede o atendimento."
  const rescheduleOptions = optionsQuery.data?.data ?? []

  const submitReschedule = (date: string, time: string, validateAvailability = false, allowConflict = false) => {
    if (!date) {
      toast.error("Escolha uma data para reagendar.")
      return
    }
    const scheduledTime = time || schedule.time || "08:00"
    const capacityViolation = getScheduleDailyServiceCapacityViolation({
      schedules,
      schedule,
      serviceTypes,
      date,
      time: scheduledTime,
    })
    if (capacityViolation) {
      toast.error(formatDailyServiceCapacityViolation(capacityViolation, serviceTypes))
      return
    }

    if (validateAvailability && !allowConflict) {
      const { duration, durationType } = getScheduleRescheduleDurationConfig(schedule)
      const availability = checkScheduleAvailability({
        schedules,
        teams,
        ignoreScheduleId: schedule.id,
        ignoreScheduleIds: getScheduleRescheduleIgnoredIds(schedules, schedule),
        mode: "manual",
        formData: {
          teamIds: schedule.teams.map((team) => team.id),
          employeeIds: schedule.additionalEmployees.map((employee) => employee.id),
          date,
          time: scheduledTime,
          durationType,
          duration,
          isEmergency: schedule.isEmergency,
        },
      })
      if (!availability.available) {
        setRescheduleConflict({
          requested: { date, time: scheduledTime },
          suggested: availability.suggested,
          conflictingResources: getScheduleConflictResourceNames(availability.conflict, {
            teams: schedule.teams,
            employees: schedule.additionalEmployees,
          }),
        })
        return
      }
    }

    setRescheduleConflict(null)
    rescheduleMutation.mutate({
      scheduledDate: date,
      scheduledTime,
      allowConflict,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "gap-0 p-0",
          isMobile
            ? "left-0 top-0 h-[100dvh] max-h-none w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0"
            : "sm:max-w-xl lg:max-w-2xl",
        )}
      >
        {onBack && mode === "details" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={backLabel}
            className={cn(
              "absolute left-3 z-20 gap-1.5 px-2 text-foreground hover:text-foreground",
              isMobile ? "top-[calc(env(safe-area-inset-top)+0.85rem)]" : "top-3",
            )}
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        ) : null}
        {canEdit && onEdit && mode === "details" ? (
          <button
            type="button"
            aria-label="Editar agendamento"
            className="ring-offset-background focus-visible:ring-ring absolute right-14 top-4 z-20 inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-transparent text-muted-foreground opacity-100 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
            onClick={onEdit}
          >
            <Pencil />
            <span className="sr-only">Editar agendamento</span>
          </button>
        ) : null}
        <div className={cn("flex flex-col", isMobile ? "h-full" : "")}>
          {isMobile ? (
            <DialogHeader className="shrink-0 bg-background px-5 pb-2 pt-[calc(env(safe-area-inset-top)+1.75rem)] text-left">
              <DialogTitle className="sr-only">
                Detalhes do agendamento de {schedule.clientName}
              </DialogTitle>
            </DialogHeader>
          ) : null}

          <div className={cn("flex-1 overflow-y-auto", isMobile ? "px-5 pb-5 pt-2" : "p-6")}>
            {!isMobile ? (
              <DialogHeader className="relative items-center space-y-1.5 pb-2 text-center sm:pb-3">
                <DialogTitle className="sr-only">
                  Detalhes do agendamento de {schedule.clientName}
                </DialogTitle>
              </DialogHeader>
            ) : null}

            {mode === "reschedule" ? (
              <div className="mt-2 space-y-5">
                <div>
                  <p className="text-lg font-semibold text-foreground">Reagendar atendimento</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Escolha uma sugestão validada ou informe uma nova data e horário.
                  </p>
                </div>

                {isMultiDayMainSchedule ? (
                  <p className="rounded-2xl bg-primary/5 px-4 py-3 text-sm text-foreground">
                    Este é o primeiro dia. Ao reagendar, os {multiDayTotal} dias do atendimento serão movidos juntos.
                  </p>
                ) : isMultiDayChildSchedule ? (
                  <p className="rounded-2xl bg-primary/5 px-4 py-3 text-sm text-foreground">
                    Somente este dia será reagendado, com duração de 1 dia.
                  </p>
                ) : null}

                <div className="rounded-2xl border p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    Sugestões disponíveis
                  </div>
                  {optionsQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Procurando horários livres...
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-3">
                      {rescheduleOptions.map((option) => (
                        <Button
                          key={`${option.date}-${option.time}`}
                          type="button"
                          variant="outline"
                          className="h-auto justify-start rounded-2xl px-4 py-3 text-left"
                          disabled={rescheduleMutation.isPending}
                          onClick={() => submitReschedule(option.date, option.time)}
                        >
                          <span className="flex flex-col">
                            <span className="font-semibold">{formatScheduleDate(option.date)}</span>
                            <span className="text-xs text-muted-foreground">{option.time}</span>
                          </span>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                    <Clock3 className="h-4 w-4 text-primary" />
                    Escolher manualmente
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="reschedule-date">Data</Label>
                      <DatePicker
                        value={customDateValue}
                        onChange={(date) => {
                          setCustomDate(date ? toCivilDateKey(date) : "")
                          setCustomTime(schedule.time || "08:00")
                          setRescheduleConflict(null)
                        }}
                        placeholder="Escolha uma data"
                        className="rounded-full"
                        disabled={rescheduleMutation.isPending}
                        disabledDates={(date) => toCivilDateKey(date) < toCivilDateKey(new Date())}
                        dateTooltip={getDateUnavailabilityReason}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reschedule-time">Horário</Label>
                      <Input
                        id="reschedule-time"
                        type="time"
                        value={customTime}
                        className="h-9 w-full rounded-full"
                        disabled={!customDate || rescheduleMutation.isPending}
                        onChange={(event) => {
                          setCustomTime(event.target.value)
                          setRescheduleConflict(null)
                        }}
                      />
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {customDate && availableCustomTimes.length === 0
                      ? "Não há horário livre nesta data, mas você ainda pode informar um horário e confirmar o conflito."
                      : `${availableCustomTimes.length} horário(s) livre(s) encontrado(s). A escolha será validada antes de salvar.`}
                  </p>
                  {rescheduleConflict ? (
                    <div className="mt-4 space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                        <div>
                          <p className="font-semibold">Conflito de horário</p>
                          <p className="mt-1 text-amber-900/80">
                            {formatScheduleConflictConfirmation(rescheduleConflict.conflictingResources)}
                          </p>
                          <p className="mt-1 text-amber-900/80">
                            Horário solicitado: {formatAvailabilitySlot(rescheduleConflict.requested.date, rescheduleConflict.requested.time)}.
                          </p>
                        </div>
                      </div>
                      {rescheduleConflict.suggested ? (
                        <p>
                          Próximo horário livre: <strong>{formatAvailabilitySlot(rescheduleConflict.suggested.date, rescheduleConflict.suggested.time)}</strong>
                        </p>
                      ) : null}
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={rescheduleMutation.isPending}
                          onClick={() => setRescheduleConflict(null)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          disabled={rescheduleMutation.isPending}
                          onClick={() => submitReschedule(
                            rescheduleConflict.requested.date,
                            rescheduleConflict.requested.time,
                            false,
                            true,
                          )}
                        >
                          Continuar
                        </Button>
                        {rescheduleConflict.suggested ? (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={rescheduleMutation.isPending}
                            onClick={() => submitReschedule(
                              rescheduleConflict.suggested!.date,
                              rescheduleConflict.suggested!.time,
                            )}
                          >
                            Usar horário sugerido
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <>
            <div className={cn("flex flex-wrap justify-center gap-2", isMobile ? "mt-2" : "mt-4")}>
              <Badge variant={isRecurringSchedule ? "secondary" : "outline"}>
                {isRecurringSchedule ? "Atendimento recorrente" : "Atendimento avulso"}
              </Badge>
              {schedule.isClientDelinquent ? (
                <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Inadimplente</Badge>
              ) : null}
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {schedule.status === "completed" ? (
                <div data-schedule-detail-card="execution" className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-4 md:col-span-2">
                  <div className="mb-3 flex items-center gap-1.5 text-sm font-medium">
                    <Clock3 className="h-4 w-4 text-primary" />
                    <span>Execução do atendimento</span>
                    {canEditExecution && onEditExecution ? (
                      <button
                        type="button"
                        aria-label="Editar execução do atendimento"
                        className="ring-offset-background focus-visible:ring-ring inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full bg-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0"
                        onClick={onEditExecution}
                      >
                        <Pencil />
                        <span className="sr-only">Editar execução do atendimento</span>
                      </button>
                    ) : null}
                  </div>
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Período executado</p>
                      <p className="mt-1 text-foreground">
                        {formatScheduleDate(schedule.completionStartDate || schedule.date)} às {schedule.completionStartTime || "--:--"}
                        {" até "}
                        {formatScheduleDate(schedule.completionEndDate || schedule.completionStartDate || schedule.date)} às {schedule.completionEndTime || "--:--"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Motorista</p>
                      <p className="mt-1 text-foreground">{schedule.attendanceDriver?.name || "Não informado"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Placa do veículo</p>
                      <p className="mt-1 text-foreground">{schedule.attendanceVehiclePlate || "Não informada"}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ajudantes</p>
                      <p className="mt-1 text-foreground">
                        {schedule.attendanceHelpers?.length
                          ? schedule.attendanceHelpers.map((employee) => employee.name).join(" • ")
                          : "Nenhum ajudante informado"}
                      </p>
                    </div>
                    {schedule.attendanceDisposal ? (
                      <div data-schedule-execution-disposal className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Descarte</p>
                          <p className="mt-1 text-foreground">
                            {schedule.attendanceDisposal.type === "fossa" ? "Fossa" : "Gordura"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quantidade</p>
                          <p className="mt-1 text-foreground">
                            {schedule.attendanceDisposal.quantityM3.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} m³
                          </p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estação</p>
                          <p className="mt-1 text-foreground">{schedule.attendanceDisposal.stationName}</p>
                        </div>
                        <div data-schedule-execution-disposal-value className="sm:col-span-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Valor</p>
                          <p className="mt-1 text-foreground">
                            {formatScheduleDisposalCurrency(schedule.attendanceDisposal.totalValue)}
                          </p>
                        </div>
                      </div>
                    ) : null}
                    <div data-schedule-execution-notes className="pt-3 sm:col-span-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Observações do atendimento
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-foreground">
                        {schedule.serviceReport?.trim() || "Nenhuma observação registrada."}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div data-schedule-detail-card="service" className="rounded-2xl border p-4 md:col-span-2">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Serviço
                </div>
                <p className="text-sm text-foreground">{schedule.serviceTypeName}</p>
              </div>

              <div data-schedule-detail-card="scheduled-date" className="rounded-2xl border p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Data
                </div>
                <p className="text-sm text-muted-foreground">{formatScheduleDate(schedule.date)}</p>
              </div>

              <div data-schedule-detail-card="scheduled-time" className="rounded-2xl border p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Clock3 className="h-4 w-4 text-primary" />
                  Horário e duração
                </div>
                <p className="text-sm text-muted-foreground">
                  {schedule.time || "Sem horário"} • {formatConfiguredScheduleDuration(schedule)}
                </p>
              </div>

              <div className="rounded-2xl border p-4 md:col-span-2">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <MapPin className="h-4 w-4 text-primary" />
                  Local
                </div>
                {schedule.clientName ? <p className="text-sm font-semibold text-foreground">{schedule.clientName}</p> : null}
                <p className="text-sm text-muted-foreground">{schedule.address || "Endereço não informado"}</p>
              </div>

              <div className="rounded-2xl border p-4 md:col-span-2">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4 text-primary" />
                  Equipes e avulsos
                </div>
                <p className="text-sm text-muted-foreground">
                  {assignees.length > 0 ? assignees.join(" • ") : "Nenhuma equipe ou funcionário vinculado."}
                </p>
              </div>

              {schedule.status === "cancelled" ? (
                <div className="rounded-2xl border border-red-100 bg-red-50/70 p-4 md:col-span-2">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-red-700">
                    <OctagonX className="h-4 w-4" />
                    Motivo do cancelamento
                  </div>
                  <p className="text-sm text-red-700/80">
                    {schedule.cancellationReason || "Motivo não informado."}
                  </p>
                </div>
              ) : null}

              {schedule.notes ? (
                <div className="rounded-2xl border p-4 md:col-span-2">
                  <div className="mb-2 text-sm font-medium">Observações do agendamento</div>
                  <p className="text-sm text-muted-foreground">{schedule.notes}</p>
                </div>
              ) : null}

              {schedule.status === "completed" ? (
                <div className="flex justify-end pt-4 md:col-span-2">
                  <Button
                    type="button"
                    className="w-full sm:w-auto"
                    disabled={exportSummaryMutation.isPending}
                    onClick={() => exportSummaryMutation.mutate()}
                  >
                    {exportSummaryMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="mr-2 h-4 w-4" />
                    )}
                    Exportar
                  </Button>
                </div>
              ) : null}

              {showAttendanceAction && !isMobile ? (
                <div className="pt-2 md:col-span-2">
                  <div className="flex flex-col items-start gap-3 rounded-2xl border p-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {isBlockedByScheduleDate
                          ? "Atendimento indisponível nesta data"
                          : canStartAttendance
                            ? "Pronto para iniciar o atendimento"
                            : getStatusLabel(schedule.status)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {attendanceMessage}
                      </p>
                      {hasDelinquencyWarning ? (
                        <p className="mt-2 text-sm text-red-700">
                          {delinquencyWarningMessage}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canRescheduleSchedule ? (
                        <Button
                          type="button"
                          size="lg"
                          variant="outline"
                          className="min-w-[160px]"
                          onClick={() => setMode("reschedule")}
                        >
                          Reagendar
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="lg"
                        className="min-w-[220px]"
                        disabled={!canStartAttendance || isStartingAttendance}
                        onClick={() => onStartAttendance(schedule)}
                      >
                        {isStartingAttendance ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Iniciando...
                          </>
                        ) : (
                          "Iniciar atendimento"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
              </>
            )}
          </div>

          {mode === "reschedule" ? (
            <DialogFooter className="px-6 pb-6 pt-0 max-sm:px-5 max-sm:pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
              <Button
                type="button"
                disabled={rescheduleMutation.isPending || !customDate || !customTime}
                onClick={() => submitReschedule(customDate, customTime, true)}
              >
                {rescheduleMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validando...
                  </>
                ) : (
                  "Salvar reagendamento"
                )}
              </Button>
            </DialogFooter>
          ) : null}

          {showAttendanceAction && isMobile && mode === "details" ? (
            <div className="shrink-0 space-y-3 bg-background px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
              {hasDelinquencyWarning ? (
                <p className="text-center text-sm text-red-700">
                  {delinquencyWarningMessage}
                </p>
              ) : null}
              {isBlockedByScheduleDate ? (
                <p className="text-center text-sm text-muted-foreground">
                  {attendanceMessage}
                </p>
              ) : null}
              {canRescheduleSchedule ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full rounded-2xl"
                  onClick={() => setMode("reschedule")}
                >
                  Reagendar
                </Button>
              ) : null}
              <AttendanceStartSlider
                disabled={!canStartAttendance || isStartingAttendance}
                isSubmitting={isStartingAttendance}
                onComplete={() => onStartAttendance(schedule)}
              />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
