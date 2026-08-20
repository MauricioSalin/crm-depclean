"use client"

import { useCallback, useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Pencil } from "lucide-react"
import { toast } from "sonner"

import { AttendanceCompletionFields } from "@/components/agendamentos/attendance-completion-fields"
import { AttendanceStartSlider } from "@/components/agendamentos/attendance-start-slider"
import { CompletionNaAttachments } from "@/components/agendamentos/completion-na-attachments"
import { ScheduleDetailsDialog } from "@/components/agendamentos/schedule-details-dialog"
import { SchedulingFormDialog, type SchedulingFormData } from "@/components/agendamentos/scheduling-form-dialog"
import { Button } from "@/components/ui/button"
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  completeSchedule,
  cancelScheduleAttendance,
  deleteScheduleNa,
  getScheduleById,
  listScheduleCompletionEmployees,
  renameScheduleNa,
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
import { scheduleDisposalValidationMessage, type ScheduleDisposalType } from "@/lib/schedule-disposal"

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
  const [cancelAttendanceOpen, setCancelAttendanceOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [isEditingExecution, setIsEditingExecution] = useState(false)
  const [completionStep, setCompletionStep] = useState<CompletionStep>("attachments")
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

  const prepareCompletion = useCallback((target: ScheduleRecord, step: CompletionStep = "attachments") => {
    const now = currentCompletionDateTime()
    const defaultDate = target.completionStartDate || now.date || target.date
    setShowInformation(false)
    setCompletionStep(step)
    setCompletionStartDate(defaultDate)
    setCompletionStartTime(target.completionStartTime || target.time || "")
    setCompletionEndDate(target.completionEndDate || now.date || defaultDate)
    setCompletionEndTime(target.completionEndTime || now.time)
    setCompletionDriverEmployeeId(target.attendanceDriver?.id || "")
    setCompletionHelperEmployeeIds(target.attendanceHelpers?.map((employee) => employee.id) ?? [])
    setCompletionServiceReport(target.serviceReport || "")
    setCompletionVehiclePlate(target.attendanceVehiclePlate || "")
    setCompletionDisposalType(target.attendanceDisposal?.type || "")
    setCompletionDisposalStationId(target.attendanceDisposal?.stationId || "")
    setCompletionDisposalQuantityM3(target.attendanceDisposal?.quantityM3 ?? null)
    setCompletionFiles([])
  }, [])

  useEffect(() => {
    if (!schedule) return
    setShowInformation(false)
    setEditorOpen(false)
    setIsEditingExecution(false)
    if (schedule.status === "in_progress") prepareCompletion(schedule)
  }, [prepareCompletion, schedule?.id])

  const invalidateSchedules = async () => {
    await queryClient.invalidateQueries({ queryKey: ["schedules"] })
    await queryClient.invalidateQueries({ queryKey: ["analytics"] })
  }
  const canOpenCompletion = Boolean(schedule && canAccessScheduleCompletion(schedule, currentUser))
  const canStart = Boolean(schedule && canStartSchedule(schedule, currentUser, []))
  const canEditCompletedExecution = Boolean(
    schedule?.status === "completed" && canManageAgenda && canManageLockedSchedules,
  )
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
    enabled: canOpenCompletion || canEditCompletedExecution,
  })
  const completionEmployees = completionEmployeesQuery.data?.data ?? []

  const startMutation = useMutation({
    mutationFn: (target: ScheduleRecord) => startSchedule(target.id),
    onMutate: () => ({ toastId: toast.loading("Iniciando atendimento...") }),
    onSuccess: async ({ data }, _target, context) => {
      onScheduleChange(data)
      onClose()
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

  const cancelAttendanceMutation = useMutation({
    mutationFn: (target: ScheduleRecord) => cancelScheduleAttendance(target.id),
    onMutate: () => {
      setCancelAttendanceOpen(false)
      onClose()
      return { toastId: toast.loading("Cancelando atendimento...") }
    },
    onSuccess: async ({ data }, _variables, context) => {
      onScheduleChange(data)
      await invalidateSchedules()
      toast.success("Atendimento cancelado.", {
        id: context?.toastId,
        description: "O agendamento voltou ao estado anterior.",
      })
    },
    onError: (error, _variables, context) => {
      toast.error(getApiErrorMessage(error, "Não foi possível cancelar o atendimento."), {
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
      toastId: toast.loading(files.length === 1 ? "Salvando anexo..." : `Salvando ${files.length} anexos...`),
    }),
    onSuccess: async (updatedSchedule, _variables, context) => {
      setCompletionFiles([])
      onScheduleChange(updatedSchedule)
      await invalidateSchedules()
      toast.success("Anexo salvo no agendamento.", {
        id: context?.toastId,
        description: "O arquivo já está seguro e continuará disponível mesmo sem concluir o atendimento.",
      })
    },
    onError: async (error, variables, context) => {
      setCompletionFiles([])
      const refreshed = await getScheduleById(variables.target.id).catch(() => null)
      if (refreshed?.data) onScheduleChange(refreshed.data)
      await invalidateSchedules()
      toast.error(getApiErrorMessage(error, "Não foi possível salvar o anexo."), {
        id: context?.toastId,
        description: "Os arquivos enviados antes da falha permanecem salvos. Confira a lista antes de tentar novamente.",
      })
    },
  })

  const deleteNaMutation = useMutation({
    mutationFn: ({ target, documentUrl }: { target: ScheduleRecord; documentUrl: string }) => (
      deleteScheduleNa(target.id, documentUrl)
    ),
    onMutate: () => ({ toastId: toast.loading("Removendo anexo...") }),
    onSuccess: async ({ data }, _variables, context) => {
      onScheduleChange(data)
      await invalidateSchedules()
      toast.success("Anexo removido do agendamento.", { id: context?.toastId })
    },
    onError: async (error, variables, context) => {
      const refreshed = await getScheduleById(variables.target.id).catch(() => null)
      if (refreshed?.data) onScheduleChange(refreshed.data)
      await invalidateSchedules()
      toast.error(getApiErrorMessage(error, "Não foi possível remover o anexo."), { id: context?.toastId })
    },
  })

  const renameNaMutation = useMutation({
    mutationFn: ({ target, documentUrl, fileName }: { target: ScheduleRecord; documentUrl: string; fileName: string }) => (
      renameScheduleNa(target.id, documentUrl, fileName)
    ),
    onMutate: () => ({ toastId: toast.loading("Atualizando nome do anexo...") }),
    onSuccess: async ({ data }, _variables, context) => {
      onScheduleChange(data)
      await invalidateSchedules()
      toast.success("Nome do anexo atualizado.", { id: context?.toastId })
    },
    onError: async (error, variables, context) => {
      const refreshed = await getScheduleById(variables.target.id).catch(() => null)
      if (refreshed?.data) onScheduleChange(refreshed.data)
      await invalidateSchedules()
      toast.error(getApiErrorMessage(error, "Não foi possível atualizar o nome do anexo."), { id: context?.toastId })
    },
  })

  const completeMutation = useMutation({
    mutationFn: (target: ScheduleRecord) => {
      const hasExistingNa = Boolean(target.naAttachments?.length || target.naDocumentUrl)
      if (target.status !== "completed" && !hasExistingNa) {
        throw new Error("Anexe ao menos uma NA ou evidência antes de concluir o atendimento.")
      }

      return completeSchedule(target.id, {
        startDate: completionStartDate,
        startTime: completionStartTime,
        endDate: completionEndDate,
        endTime: completionEndTime,
        driverEmployeeId: completionDriverEmployeeId,
        helperEmployeeIds: completionHelperEmployeeIds,
        serviceReport: completionServiceReport,
        vehiclePlate: completionVehiclePlate,
        disposalType: completionDisposalType || null,
        disposalStationId: completionDisposalStationId,
        disposalQuantityM3: completionDisposalQuantityM3 ?? undefined,
      })
    },
    onMutate: (target) => ({
      toastId: toast.loading(target.status === "completed" ? "Salvando execução..." : "Concluindo atendimento..."),
    }),
    onSuccess: async ({ data }, target, context) => {
      const editingExecution = target.status === "completed"
      onScheduleChange(data)
      await invalidateSchedules()
      onClose()
      toast.success(editingExecution ? "Execução atualizada." : "Atendimento concluído.", {
        id: context?.toastId,
        description: editingExecution
          ? "Os dados executados do atendimento foram corrigidos."
          : "A agenda foi atualizada com o horário executado.",
      })
    },
    onError: (error, target, context) => {
      const fallback = target.status === "completed"
        ? "Não foi possível atualizar a execução."
        : "Não foi possível concluir o atendimento."
      toast.error(getApiErrorMessage(error, fallback), {
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
              billingDueDate: formData.createContract ? formData.billingDueDate : undefined,
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

      <ConfirmActionDialog
        open={Boolean(schedule) && cancelAttendanceOpen}
        title="Cancelar atendimento?"
        description="O agendamento voltará ao estado anterior (Agendado ou Reagendado). O agendamento não será cancelado."
        confirmLabel="Cancelar atendimento"
        busy={cancelAttendanceMutation.isPending}
        onOpenChange={setCancelAttendanceOpen}
        onConfirm={() => {
          if (schedule) cancelAttendanceMutation.mutate(schedule)
        }}
      />

      <ScheduleDetailsDialog
        open={Boolean(schedule) && !editorOpen && !isEditingExecution && (!canOpenCompletion || showInformation)}
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
        canEditExecution={canEditCompletedExecution}
        onEditExecution={() => {
          if (!schedule || !canEditCompletedExecution) return
          setIsEditingExecution(true)
          prepareCompletion(schedule, "checkout")
        }}
        onBack={showInformation ? () => setShowInformation(false) : undefined}
        backLabel="Voltar para anexos do atendimento"
        onStartAttendance={async (target) => {
          if (!canStartSchedule(target, currentUser, [])) return
          await startMutation.mutateAsync(target)
        }}
      />

      <Dialog
        open={Boolean(schedule) && (canOpenCompletion || isEditingExecution) && !showInformation && !editorOpen}
        onOpenChange={(open) => {
          if (!open && !showInformation) onClose()
        }}
      >
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] min-w-0 flex-col gap-0 overflow-hidden p-0 max-sm:left-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-none max-sm:w-screen max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0 max-sm:[&_[data-slot=dialog-close]]:right-5 max-sm:[&_[data-slot=dialog-close]]:top-[calc(env(safe-area-inset-top)+1rem)] sm:h-[min(32rem,calc(100dvh-1rem))] sm:max-w-xl">
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
              if (isEditingExecution && completionStep === "attachments") {
                setCompletionStep("checkout")
                return
              }
              if (isEditingExecution) {
                setIsEditingExecution(false)
                return
              }
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
          {completionStep === "attachments" && !isEditingExecution && canEdit ? (
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
          <DialogHeader className="min-w-0 px-6 pb-4 pt-14 text-left max-sm:px-5 max-sm:pt-[calc(env(safe-area-inset-top)+3.75rem)]">
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
                idPrefix="dashboard-schedule-completion"
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
                existingAttachments={schedule?.naAttachments ?? []}
                files={completionFiles}
                disabled={completeMutation.isPending || uploadNaMutation.isPending || deleteNaMutation.isPending || renameNaMutation.isPending}
                uploading={uploadNaMutation.isPending}
                removingDocumentUrl={deleteNaMutation.isPending ? deleteNaMutation.variables?.documentUrl : undefined}
                renamingDocumentUrl={renameNaMutation.isPending ? renameNaMutation.variables?.documentUrl : undefined}
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
                onRenameExistingAttachment={(attachment, fileName) => {
                  if (!schedule || renameNaMutation.isPending) return
                  renameNaMutation.mutate({ target: schedule, documentUrl: attachment.documentUrl, fileName })
                }}
              />
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-2 bg-background px-6 pb-6 pt-3 max-sm:px-5 max-sm:pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:flex-row sm:flex-nowrap sm:justify-end sm:[&>button]:px-2.5">
            {completionStep === "attachments" && !isEditingExecution ? (
              <Button
                type="button"
                variant="outline"
                className="w-full min-w-0 sm:w-auto"
                onClick={() => setShowInformation(true)}
              >
                Ver informações
              </Button>
            ) : null}
            {completionStep === "attachments" && !isEditingExecution ? (
              canManageAgenda && schedule ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full min-w-0 border-red-500 text-red-600 hover:border-red-600 hover:bg-red-50 hover:text-red-700 hover:ring-red-600/50 sm:w-auto"
                  disabled={cancelAttendanceMutation.isPending}
                  onClick={() => setCancelAttendanceOpen(true)}
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
                !schedule ||
                (!isEditingExecution && !schedule.naAttachments?.length && !schedule.naDocumentUrl) ||
                uploadNaMutation.isPending ||
                deleteNaMutation.isPending ||
                completeMutation.isPending ||
                (completionStep === "checkout" &&
                  (!completionStartDate ||
                    !completionStartTime ||
                    !completionEndDate ||
                    !completionEndTime ||
                    Boolean(scheduleDisposalValidationMessage(
                      completionDisposalType,
                      completionDisposalStationId,
                      completionDisposalQuantityM3,
                    ))))
              }
              onClick={confirmCompletion}
            >
              {completeMutation.isPending ? (
                isEditingExecution ? "Salvando..." : "Encerrando..."
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
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
