"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, CalendarDays, Clock3, Loader2, MapPin, OctagonX, Sparkles, Users } from "lucide-react"
import { toast } from "sonner"

import { AttendanceStartSlider } from "@/components/agendamentos/attendance-start-slider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useIsMobile } from "@/hooks/use-mobile"
import { getApiErrorMessage } from "@/lib/api/errors"
import { getScheduleRescheduleOptions, rescheduleSchedule, type ScheduleRecord } from "@/lib/api/schedules"
import { formatCivilDate } from "@/lib/date-utils"
import { formatConfiguredScheduleDuration } from "@/lib/schedule-duration"
import { cn } from "@/lib/utils"

interface ScheduleDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule: ScheduleRecord | null
  onStartAttendance: (schedule: ScheduleRecord) => Promise<void> | void
  isStartingAttendance?: boolean
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
  onStartAttendance,
  isStartingAttendance = false,
}: ScheduleDetailsDialogProps) {
  const isMobile = useIsMobile()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<"details" | "reschedule">("details")
  const [customDate, setCustomDate] = useState("")
  const [customTime, setCustomTime] = useState("")

  useEffect(() => {
    if (!open || !schedule) return
    setMode("details")
    setCustomDate(schedule.date)
    setCustomTime(schedule.time || "08:00")
  }, [open, schedule?.id, schedule?.date, schedule?.time])

  const optionsQuery = useQuery({
    queryKey: ["schedule", "reschedule-options", schedule?.id],
    queryFn: () => getScheduleRescheduleOptions(schedule!.id),
    enabled: open && mode === "reschedule" && Boolean(schedule?.id),
  })

  const rescheduleMutation = useMutation({
    mutationFn: (payload: { scheduledDate: string; scheduledTime?: string }) =>
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
        description: "A disponibilidade da equipe foi validada antes de salvar.",
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
  const canStartAttendance = schedule.status === "scheduled" || schedule.status === "rescheduled"
  const canReschedule = ["draft", "scheduled", "rescheduled"].includes(schedule.status)
  const showAttendanceAction = canStartAttendance || schedule.status === "draft"
  const rescheduleOptions = optionsQuery.data?.data ?? []

  const submitReschedule = (date: string, time: string) => {
    if (!date) {
      toast.error("Escolha uma data para reagendar.")
      return
    }

    rescheduleMutation.mutate({
      scheduledDate: date,
      scheduledTime: time || schedule.time || "08:00",
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={!isMobile}
        className={cn(
          "gap-0 p-0",
          isMobile
            ? "top-0 left-0 h-[100dvh] max-w-none translate-x-0 translate-y-0 rounded-none border-0"
            : "sm:max-w-xl lg:max-w-2xl",
        )}
      >
        <div className={cn("flex flex-col", isMobile ? "h-full" : "")}>
          <div className="flex-1 overflow-y-auto p-5 sm:p-6">
            <DialogHeader className="relative items-center space-y-1.5 pb-2 text-center sm:pb-3">
              <DialogTitle className="sr-only">
                Detalhes do agendamento de {schedule.clientName}
              </DialogTitle>
              {isMobile ? (
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="absolute left-0 top-0 h-9 gap-1 rounded-full px-2 text-sm font-medium"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </Button>
                </DialogClose>
              ) : null}
            </DialogHeader>

            {mode === "reschedule" ? (
              <div className={cn("space-y-5", isMobile ? "mt-12" : "mt-2")}>
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
                      <Input
                        id="reschedule-date"
                        type="date"
                        value={customDate}
                        onChange={(event) => setCustomDate(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reschedule-time">Horário</Label>
                      <Input
                        id="reschedule-time"
                        type="time"
                        value={customTime}
                        onChange={(event) => setCustomTime(event.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    className="mt-4 w-full sm:w-auto"
                    disabled={rescheduleMutation.isPending}
                    onClick={() => submitReschedule(customDate, customTime)}
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
            <div className={cn("flex justify-center", isMobile ? "mt-12" : "mt-4")}>
              <Badge variant={isRecurringSchedule ? "secondary" : "outline"}>
                {isRecurringSchedule ? "Atendimento recorrente" : "Atendimento avulso"}
              </Badge>
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
                  <div className="flex flex-col items-start gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {canStartAttendance ? "Pronto para iniciar o atendimento" : getStatusLabel(schedule.status)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {canStartAttendance
                          ? "Use o botão abaixo para iniciar o atendimento deste agendamento."
                          : "O atendimento será liberado assim que o contrato estiver assinado."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canReschedule ? (
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
            <div className="space-y-3 bg-background p-4">
              {canReschedule ? (
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
