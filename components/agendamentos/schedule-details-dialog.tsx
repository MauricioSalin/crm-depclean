"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, ArrowLeft, CalendarDays, Clock3, Loader2, MapPin, OctagonX, Sparkles, Users } from "lucide-react"
import { toast } from "sonner"

import { AttendanceStartSlider } from "@/components/agendamentos/attendance-start-slider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useIsMobile } from "@/hooks/use-mobile"
import { getApiErrorMessage } from "@/lib/api/errors"
import { getScheduleRescheduleOptions, rescheduleSchedule, type ScheduleRecord } from "@/lib/api/schedules"
import type { TeamRecord } from "@/lib/api/teams"
import { formatCivilDate, parseCivilDate, toCivilDateKey } from "@/lib/date-utils"
import { checkScheduleAvailability, formatAvailabilitySlot, getAvailableRescheduleTimes } from "@/lib/schedule-availability"
import { formatConfiguredScheduleDuration } from "@/lib/schedule-duration"
import { cn } from "@/lib/utils"

interface ScheduleDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule: ScheduleRecord | null
  schedules?: ScheduleRecord[]
  teams?: TeamRecord[]
  onStartAttendance: (schedule: ScheduleRecord) => Promise<void> | void
  isStartingAttendance?: boolean
  canManage?: boolean
  canStart?: boolean
  canReschedule?: boolean
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
  onStartAttendance,
  isStartingAttendance = false,
  canManage = true,
  canStart,
  canReschedule,
}: ScheduleDetailsDialogProps) {
  const isMobile = useIsMobile()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<"details" | "reschedule">("details")
  const [customDate, setCustomDate] = useState("")
  const [customTime, setCustomTime] = useState("")
  const [rescheduleConflict, setRescheduleConflict] = useState<{
    requested: { date: string; time: string }
    suggested?: { date: string; time: string }
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
      }),
    [customDate, schedule, schedules, teams],
  )

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
    onError: (error, _variables, context) => {
      toast.error(getApiErrorMessage(error, "Não foi possível reagendar o atendimento."), {
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
  const canStartAttendance = canStartAction && ["scheduled", "rescheduled"].includes(schedule.status)
  const isBlockedByDelinquency = Boolean(schedule.isClientDelinquent && !canStartAction && ["scheduled", "rescheduled"].includes(schedule.status))
  const canRescheduleSchedule = canRescheduleAction && ["draft", "scheduled", "rescheduled"].includes(schedule.status)
  const showAttendanceAction = canStartAttendance || isBlockedByDelinquency || canRescheduleSchedule || (canManage && schedule.status === "draft")
  const attendanceMessage = isBlockedByDelinquency
    ? "Este cliente possui parcela vencida. Apenas usuários com permissão para gerenciar o status da agenda podem iniciar o atendimento."
    : canStartAttendance
      ? "Use o botão abaixo para iniciar o atendimento deste agendamento."
      : "O atendimento será liberado assim que o contrato estiver assinado."
  const rescheduleOptions = optionsQuery.data?.data ?? []

  const submitReschedule = (date: string, time: string, validateAvailability = false, allowConflict = false) => {
    if (!date) {
      toast.error("Escolha uma data para reagendar.")
      return
    }
    const scheduledTime = time || schedule.time || "08:00"
    if (validateAvailability && !allowConflict) {
      const durationType = schedule.durationType ?? "hours"
      const duration = Number(schedule.durationValue) > 0
        ? Number(schedule.durationValue)
        : Math.max(1 / 60, Number(schedule.duration || 60) / 60)
      const availability = checkScheduleAvailability({
        schedules,
        teams,
        ignoreScheduleId: schedule.id,
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
            ? "left-0 top-3 h-[calc(100dvh-1.5rem)] max-w-none translate-x-0 translate-y-0 rounded-none border-0"
            : "sm:max-w-xl lg:max-w-2xl",
        )}
      >
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
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-foreground">Reagendar atendimento</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Escolha uma sugestão validada ou informe uma nova data e horário.
                    </p>
                  </div>
                  {!isMobile ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setMode("details")}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Voltar
                    </Button>
                  ) : null}
                </div>

                {isMobile ? (
                  <Button type="button" variant="ghost" size="sm" className="pl-0" onClick={() => setMode("details")}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar para detalhes
                  </Button>
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
                          <p className="font-semibold">Horário indisponível</p>
                          <p className="mt-1 text-amber-900/80">
                            Já existe um atendimento para a equipe ou funcionário em {formatAvailabilitySlot(rescheduleConflict.requested.date, rescheduleConflict.requested.time)}.
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
                          className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                          disabled={rescheduleMutation.isPending}
                          onClick={() => submitReschedule(
                            rescheduleConflict.requested.date,
                            rescheduleConflict.requested.time,
                            false,
                            true,
                          )}
                        >
                          Continuar mesmo assim
                        </Button>
                        {rescheduleConflict.suggested ? (
                          <Button
                            type="button"
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
                  <Button
                    type="button"
                    className="mt-4 w-full sm:w-auto"
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
              <div className="rounded-2xl border p-4 md:col-span-2">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Serviço
                </div>
                <p className="text-sm text-foreground">{schedule.serviceTypeName}</p>
              </div>

              <div className="rounded-2xl border p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Data
                </div>
                <p className="text-sm text-muted-foreground">{formatScheduleDate(schedule.date)}</p>
              </div>

              <div className="rounded-2xl border p-4">
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
                  <div className="mb-2 text-sm font-medium">Observações</div>
                  <p className="text-sm text-muted-foreground">{schedule.notes}</p>
                </div>
              ) : null}

              {showAttendanceAction && !isMobile ? (
                <div className="pt-2 md:col-span-2">
                  <div className="flex flex-col items-start gap-3 rounded-2xl border p-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {isBlockedByDelinquency
                          ? "Atendimento bloqueado por inadimplência"
                          : canStartAttendance
                            ? "Pronto para iniciar o atendimento"
                            : getStatusLabel(schedule.status)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {attendanceMessage}
                      </p>
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

          {showAttendanceAction && isMobile && mode === "details" ? (
            <div className="shrink-0 space-y-3 bg-background px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
              {isBlockedByDelinquency ? (
                <p className="text-center text-sm text-red-700">{attendanceMessage}</p>
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
