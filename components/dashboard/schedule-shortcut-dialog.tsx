"use client"

import { useCallback, useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Check, Pencil } from "lucide-react"
import { toast } from "sonner"

import { AttendanceCompletionFields } from "@/components/agendamentos/attendance-completion-fields"
import { AttendanceStartSlider } from "@/components/agendamentos/attendance-start-slider"
import { CompletionNaAttachments } from "@/components/agendamentos/completion-na-attachments"
import { ScheduleDetailsDialog } from "@/components/agendamentos/schedule-details-dialog"
import { SchedulingFormDialog, type SchedulingFormData } from "@/components/agendamentos/scheduling-form-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  completeSchedule,
  deleteScheduleNa,
  getScheduleById,
  listScheduleCompletionEmployees,
  startSchedule,
  updateSchedule,
  updateScheduleStatus,
  uploadScheduleNa,
  type ScheduleRecord,
} from "@/lib/api/schedules"
import { listClients } from "@/lib/api/clients"
import { listEmployees } from "@/lib/api/employees"
import { getApiErrorMessage } from "@/lib/api/errors"
import { listServices } from "@/lib/api/services"
import { listTeams } from "@/lib/api/teams"
import { hasAnyPermission } from "@/lib/auth/permissions"
import { toBrasiliaTimeKey, toCivilDateKey } from "@/lib/date-utils"
import { useCurrentUser } from "@/hooks/use-permissions"
import { scheduleDurationToMinutes } from "@/lib/schedule-duration"
import { canAccessScheduleCompletion, canStartSchedule } from "@/lib/schedule-permissions"
import { cacheSavedSchedule } from "@/lib/schedule-query-cache"

type CompletionStep = "attachments" | "checkout"

type ScheduleShortcutDialogProps = {
  schedule: ScheduleRecord | null
  onClose: () => void
  onScheduleChange: (schedule: ScheduleRecord) => void
}

function currentCompletionDateTime() {
  const now = new Date()
  return {
    date: toCivilDateKey(now),
    time: toBrasiliaTimeKey(now),
  }
}

export function ScheduleShortcutDialog({
  schedule,
  onClose,
  onScheduleChange,
}: ScheduleShortcutDialogProps) {
  const queryClient = useQueryClient()
  const currentUser = useCurrentUser()
  const canManageAgenda = hasAnyPermission(currentUser, ["agenda_manage", "settings_manage"])
  const canManageScheduleStatus = hasAnyPermission(currentUser, ["agenda_manage_status", "settings_manage"])
  const canManageLockedSchedules = hasAnyPermission(currentUser, ["agenda_manage_locked", "settings_manage"])
  const [showInformation, setShowInformation] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [completionStep, setCompletionStep] = useState<CompletionStep>("attachments")
  const [completionStartDate, setCompletionStartDate] = useState("")
  const [completionStartTime, setCompletionStartTime] = useState("")
  const [completionEndDate, setCompletionEndDate] = useState("")
  const [completionEndTime, setCompletionEndTime] = useState("")
  const [completionDriverEmployeeId, setCompletionDriverEmployeeId] = useState("")
  const [completionHelperEmployeeIds, setCompletionHelperEmployeeIds] = useState<string[]>([])
  const [completionServiceReport, setCompletionServiceReport] = useState("")
  const [completionFiles, setCompletionFiles] = useState<File[]>([])

  const prepareCompletion = useCallback((target: ScheduleRecord) => {
    const now = currentCompletionDateTime()
    const defaultDate = target.completionStartDate || now.date || target.date
    setShowInformation(false)
    setCompletionStep("attachments")
    setCompletionStartDate(defaultDate)
    setCompletionStartTime(target.completionStartTime || target.time || "")
    setCompletionEndDate(target.completionEndDate || now.date || defaultDate)
    setCompletionEndTime(target.completionEndTime || now.time)
    setCompletionDriverEmployeeId(target.attendanceDriver?.id || "")
    setCompletionHelperEmployeeIds(target.attendanceHelpers?.map((employee) => employee.id) ?? [])
    setCompletionServiceReport(target.serviceReport || "")
    setCompletionFiles([])
  }, [])

  useEffect(() => {
    if (!schedule) return
    setShowInformation(false)
    setEditorOpen(false)
    if (schedule.status === "in_progress") prepareCompletion(schedule)
  }, [prepareCompletion, schedule?.id])

  const invalidateSchedules = async () => {
    await queryClient.invalidateQueries({ queryKey: ["schedules"] })
    await queryClient.invalidateQueries({ queryKey: ["analytics"] })
  }
  const canOpenCompletion = Boolean(schedule && canAccessScheduleCompletion(schedule, currentUser))
  const canStart = Boolean(schedule && canStartSchedule(schedule, currentUser, []))
  const canEdit = Boolean(
    schedule &&
    schedule.status !== "cancelled" &&
    (schedule.status !== "completed" || canManageLockedSchedules) &&
    (canManageAgenda || canManageScheduleStatus),
  )

  const clientsQuery = useQuery({
    queryKey: ["clients", "dashboard-schedule-editor"],
    queryFn: () => listClients(),
    enabled: canEdit,
  })
  const servicesQuery = useQuery({
    queryKey: ["services", "dashboard-schedule-editor"],
    queryFn: () => listServices(),
    enabled: canEdit,
  })
  const teamsQuery = useQuery({
    queryKey: ["teams", "catalog"],
    queryFn: () => listTeams(),
    enabled: canEdit,
  })
  const employeesQuery = useQuery({
    queryKey: ["employees", "catalog"],
    queryFn: () => listEmployees(),
    enabled: canEdit,
  })
  const clients = clientsQuery.data?.data ?? []
  const services = servicesQuery.data?.data ?? []
  const teams = teamsQuery.data?.data ?? []
  const employees = employeesQuery.data?.data ?? []

  const completionEmployeesQuery = useQuery({
    queryKey: ["schedules", "completion-employees"],
    queryFn: () => listScheduleCompletionEmployees(),
    enabled: canOpenCompletion,
  })
  const completionEmployees = completionEmployeesQuery.data?.data ?? []

  const startMutation = useMutation({
    mutationFn: (target: ScheduleRecord) => startSchedule(target.id),
    onMutate: () => ({ toastId: toast.loading("Iniciando atendimento...") }),
    onSuccess: async ({ data }, _target, context) => {
      prepareCompletion(data)
      onScheduleChange(data)
      await invalidateSchedules()
      toast.success("Atendimento iniciado.", {
        id: context?.toastId,
        description: "O agendamento foi movido para em andamento.",
      })
    },
    onError: (error, _target, context) => {
      toast.error(getApiErrorMessage(error, "Não foi possível iniciar o atendimento."), {
        id: context?.toastId,
      })
    },
  })

  const uploadNaMutation = useMutation({
    mutationFn: async ({ target, files }: { target: ScheduleRecord; files: File[] }) => {
      let updatedSchedule = target
      for (const file of files) {
        const response = await uploadScheduleNa(target.id, file)
        updatedSchedule = response.data
      }
      return updatedSchedule
    },
    onMutate: ({ files }) => ({
      toastId: toast.loading(files.length === 1 ? "Salvando NA..." : `Salvando ${files.length} NAs...`),
    }),
    onSuccess: async (updatedSchedule, _variables, context) => {
      setCompletionFiles([])
      onScheduleChange(updatedSchedule)
      await invalidateSchedules()
      toast.success("NA salva no agendamento.", {
        id: context?.toastId,
        description: "O arquivo já está seguro e continuará disponível mesmo sem concluir o atendimento.",
      })
    },
    onError: async (error, variables, context) => {
      setCompletionFiles([])
      const refreshed = await getScheduleById(variables.target.id).catch(() => null)
      if (refreshed?.data) onScheduleChange(refreshed.data)
      await invalidateSchedules()
      toast.error(getApiErrorMessage(error, "Não foi possível salvar a NA."), {
        id: context?.toastId,
        description: "Os arquivos enviados antes da falha permanecem salvos. Confira a lista antes de tentar novamente.",
      })
    },
  })

  const deleteNaMutation = useMutation({
    mutationFn: ({ target, documentUrl }: { target: ScheduleRecord; documentUrl: string }) => (
      deleteScheduleNa(target.id, documentUrl)
    ),
    onMutate: () => ({ toastId: toast.loading("Removendo NA...") }),
    onSuccess: async ({ data }, _variables, context) => {
      onScheduleChange(data)
      await invalidateSchedules()
      toast.success("NA removida do agendamento.", { id: context?.toastId })
    },
    onError: async (error, variables, context) => {
      const refreshed = await getScheduleById(variables.target.id).catch(() => null)
      if (refreshed?.data) onScheduleChange(refreshed.data)
      await invalidateSchedules()
      toast.error(getApiErrorMessage(error, "Não foi possível remover a NA."), { id: context?.toastId })
    },
  })

  const completeMutation = useMutation({
    mutationFn: (target: ScheduleRecord) => {
      const hasExistingNa = Boolean(target.naAttachments?.length || target.naDocumentUrl)
      if (!hasExistingNa) throw new Error("Anexe a NA da visita antes de concluir o atendimento.")

      return completeSchedule(target.id, {
        startDate: completionStartDate,
        startTime: completionStartTime,
        endDate: completionEndDate,
        endTime: completionEndTime,
        driverEmployeeId: completionDriverEmployeeId,
        helperEmployeeIds: completionHelperEmployeeIds,
        serviceReport: completionServiceReport,
      })
    },
    onMutate: () => ({ toastId: toast.loading("Concluindo atendimento...") }),
    onSuccess: async ({ data }, _target, context) => {
      onScheduleChange(data)
      await invalidateSchedules()
      onClose()
      toast.success("Atendimento concluído.", {
        id: context?.toastId,
        description: "A agenda foi atualizada com o horário executado.",
      })
    },
    onError: (error, _target, context) => {
      toast.error(getApiErrorMessage(error, "Não foi possível concluir o atendimento."), {
        id: context?.toastId,
      })
    },
  })

  const saveMutation = useMutation({
    mutationFn: async ({ target, formData }: { target: ScheduleRecord; formData: SchedulingFormData }) => {
      if (!canManageAgenda && canManageScheduleStatus) {
        return updateScheduleStatus(target.id, formData.status)
      }
      if (!canManageAgenda) throw new Error("Você não tem permissão para editar este agendamento.")

      const commonPayload = {
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
      }
      const response = await updateSchedule(
        target.id,
        target.contractId && !target.isManual
          ? commonPayload
          : {
              ...commonPayload,
              isEmergency: formData.isEmergency,
              billable: formData.createContract,
              value: formData.createContract ? formData.value : 0,
            },
      )

      if (canManageScheduleStatus && target.status !== formData.status) {
        return updateScheduleStatus(target.id, formData.status)
      }
      return response
    },
    onMutate: () => ({ toastId: toast.loading("Salvando agendamento...") }),
    onSuccess: async ({ data }, _variables, context) => {
      cacheSavedSchedule(queryClient, data)
      onScheduleChange(data)
      setEditorOpen(false)
      await invalidateSchedules()
      toast.success("Agendamento atualizado.", { id: context?.toastId })
    },
    onError: (error, _variables, context) => {
      toast.error(getApiErrorMessage(error, "Não foi possível atualizar o agendamento."), {
        id: context?.toastId,
      })
    },
  })

  const confirmCompletion = () => {
    if (!schedule) return
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

    completeMutation.mutate(schedule)
  }

  return (
    <>
      <SchedulingFormDialog
        open={Boolean(schedule) && editorOpen}
        onOpenChange={(open) => {
          if (!open) setEditorOpen(false)
        }}
        editingSchedule={schedule}
        onSubmit={(formData) => {
          if (schedule) saveMutation.mutate({ target: schedule, formData })
        }}
        clients={clients}
        serviceTypes={services}
        teams={teams}
        employees={employees}
        canManageStatus={canManageScheduleStatus}
        canEditDetails={canManageAgenda}
        isSubmitting={saveMutation.isPending}
      />

      <ScheduleDetailsDialog
        open={Boolean(schedule) && !editorOpen && (!canOpenCompletion || showInformation)}
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
        schedule={schedule}
        isStartingAttendance={startMutation.isPending}
        canManage={canManageAgenda}
        canStart={canStart}
        canStartOutsideScheduledDate={canManageAgenda}
        canReschedule={false}
        canEdit={canEdit}
        onEdit={() => setEditorOpen(true)}
        onBack={showInformation ? () => setShowInformation(false) : undefined}
        backLabel="Voltar para NAs do atendimento"
        onStartAttendance={async (target) => {
          if (!canStartSchedule(target, currentUser, [])) return
          await startMutation.mutateAsync(target)
        }}
      />

      <Dialog
        open={Boolean(schedule) && canOpenCompletion && !showInformation && !editorOpen}
        onOpenChange={(open) => {
          if (!open && !showInformation) onClose()
        }}
      >
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] min-w-0 flex-col gap-0 overflow-hidden p-0 max-sm:left-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-none max-sm:w-screen max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0 max-sm:[&_[data-slot=dialog-close]]:right-5 max-sm:[&_[data-slot=dialog-close]]:top-[calc(env(safe-area-inset-top)+1rem)] sm:max-w-lg">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={completionStep === "checkout" ? "Voltar para NAs do atendimento" : "Voltar"}
            className="absolute left-3 top-3 z-20 gap-1.5 px-2 text-foreground hover:text-foreground max-sm:top-[calc(env(safe-area-inset-top)+0.85rem)]"
            onClick={() => {
              if (completionStep === "checkout") {
                setCompletionStep("attachments")
                return
              }
              onClose()
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          {completionStep === "attachments" && canEdit ? (
            <button
              type="button"
              aria-label="Editar agendamento"
              className="ring-offset-background focus-visible:ring-ring absolute right-14 top-4 z-20 inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 max-sm:top-[calc(env(safe-area-inset-top)+1rem)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
              onClick={() => setEditorOpen(true)}
            >
              <Pencil />
              <span className="sr-only">Editar agendamento</span>
            </button>
          ) : null}
          <DialogHeader className="min-w-0 px-6 pb-4 pt-14 max-sm:px-5 max-sm:pt-[calc(env(safe-area-inset-top)+3.75rem)]">
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
                idPrefix="dashboard-schedule-completion"
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
                existingAttachments={schedule?.naAttachments ?? []}
                files={completionFiles}
                disabled={completeMutation.isPending || uploadNaMutation.isPending || deleteNaMutation.isPending}
                uploading={uploadNaMutation.isPending}
                removingDocumentUrl={deleteNaMutation.isPending ? deleteNaMutation.variables?.documentUrl : undefined}
                onAddFiles={(files) => {
                  if (!schedule || uploadNaMutation.isPending) return
                  setCompletionFiles(files)
                  uploadNaMutation.mutate({ target: schedule, files })
                }}
                onRemoveFile={() => undefined}
                onRemoveExistingAttachment={(attachment) => {
                  if (!schedule || deleteNaMutation.isPending) return
                  deleteNaMutation.mutate({ target: schedule, documentUrl: attachment.documentUrl })
                }}
              />
            )}
          </div>

          <div className={`flex shrink-0 gap-2 bg-background px-6 pb-6 pt-3 max-sm:px-5 max-sm:pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:flex-row sm:flex-wrap sm:justify-end ${completionStep === "attachments" ? "max-sm:grid max-sm:grid-cols-2" : "flex-col"}`}>
            {completionStep === "attachments" ? (
              <Button
                type="button"
                variant="outline"
                className="w-full min-w-0 max-sm:h-12 max-sm:px-2 max-sm:text-xs sm:basis-full"
                onClick={() => setShowInformation(true)}
              >
                Ver informações
              </Button>
            ) : null}
            {completionStep === "attachments" ? (
              <AttendanceStartSlider
                action="finish"
                compact
                className="sm:hidden"
                disabled={completeMutation.isPending || uploadNaMutation.isPending || deleteNaMutation.isPending}
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
                !schedule ||
                (!schedule.naAttachments?.length && !schedule.naDocumentUrl) ||
                uploadNaMutation.isPending ||
                deleteNaMutation.isPending ||
                completeMutation.isPending ||
                (completionStep === "checkout" &&
                  (!completionStartDate || !completionStartTime || !completionEndDate || !completionEndTime))
              }
              onClick={confirmCompletion}
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
    </>
  )
}
