"use client"

import { format, parseISO } from "date-fns"
import { ArrowLeft, CalendarDays, Clock3, MapPin, Sparkles, Users } from "lucide-react"

import { AttendanceStartSlider } from "@/components/agendamentos/attendance-start-slider"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useIsMobile } from "@/hooks/use-mobile"
import type { ScheduleRecord } from "@/lib/api/schedules"
import { cn } from "@/lib/utils"

interface ScheduleDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule: ScheduleRecord | null
  onStartAttendance: (schedule: ScheduleRecord) => Promise<void> | void
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
  try {
    return format(parseISO(date), "dd/MM/yyyy")
  } catch {
    return date
  }
}

function formatDuration(duration: number) {
  const hours = Math.floor(duration / 60)
  const minutes = duration % 60

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}min`
  if (hours > 0) return `${hours}h`
  return `${minutes}min`
}

export function ScheduleDetailsDialog({
  open,
  onOpenChange,
  schedule,
  onStartAttendance,
}: ScheduleDetailsDialogProps) {
  const isMobile = useIsMobile()

  if (!schedule) return null

  const assignees = [
    ...schedule.teams.map((team) => team.name),
    ...schedule.additionalEmployees.map((employee) => employee.name),
  ]

  const canStartAttendance = schedule.status === "scheduled"
  const showAttendanceAction = schedule.status === "scheduled" || schedule.status === "draft"

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

            <div className="mt-12 grid gap-3 md:mt-4 md:grid-cols-2">
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
                  {schedule.time || "Sem horário"} • {formatDuration(schedule.duration)}
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
                    <Button
                      type="button"
                      size="lg"
                      className="min-w-[220px]"
                      disabled={!canStartAttendance}
                      onClick={() => onStartAttendance(schedule)}
                    >
                      Iniciar atendimento
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {showAttendanceAction && isMobile ? (
            <div className="bg-background p-4">
              <AttendanceStartSlider
                disabled={!canStartAttendance}
                onComplete={() => onStartAttendance(schedule)}
              />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
