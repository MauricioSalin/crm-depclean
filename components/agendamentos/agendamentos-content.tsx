"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"
import { toast } from "sonner"
import {
  Calendar,
  Camera,
  Check,
  Clock,
  Edit,
  FileUp,
  MoreHorizontal,
  Search,
  Trash2,
  X,
} from "lucide-react"

import { listClients } from "@/lib/api/clients"
import { listEmployees } from "@/lib/api/employees"
import {
  cancelSchedule,
  completeSchedule,
  createSchedule,
  deleteSchedule,
  listSchedules,
  startSchedule,
  type ScheduleRecord,
  updateSchedule,
  uploadScheduleNa,
} from "@/lib/api/schedules"
import { listServices } from "@/lib/api/services"
import { listTeams } from "@/lib/api/teams"
import { addClientAttachment } from "@/lib/client-attachments-store"
import { useUrlQueryState } from "@/lib/hooks/use-url-query-state"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
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
import { Label } from "@/components/ui/label"
import { DataPagination } from "@/components/ui/data-pagination"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { SchedulingFormDialog, type SchedulingFormData } from "./scheduling-form-dialog"
import { ScheduleDetailsDialog } from "./schedule-details-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

interface AgendamentosContentProps {
  viewMode: "table" | "cards"
  openDialog?: boolean
  onDialogChange?: (open: boolean) => void
  viewToggle?: React.ReactNode
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

function formatFileSize(size?: number) {
  if (!size) return ""
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function AgendamentosContent({ viewMode, openDialog, onDialogChange, viewToggle }: AgendamentosContentProps) {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useUrlQueryState("q")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<ScheduleRecord | null>(null)
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleRecord | null>(null)
  const [cancelTarget, setCancelTarget] = useState<ScheduleRecord | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelStep, setCancelStep] = useState<"reason" | "confirm">("reason")
  const [completionTarget, setCompletionTarget] = useState<ScheduleRecord | null>(null)
  const [completionStartTime, setCompletionStartTime] = useState("")
  const [completionEndTime, setCompletionEndTime] = useState("")
  const [completionFile, setCompletionFile] = useState<File | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ScheduleRecord | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const schedulesQuery = useQuery({
    queryKey: ["schedules"],
    queryFn: () => listSchedules(),
  })
  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: () => listClients(),
  })
  const servicesQuery = useQuery({
    queryKey: ["services"],
    queryFn: () => listServices(),
  })
  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: () => listTeams(),
  })
  const employeesQuery = useQuery({
    queryKey: ["employees"],
    queryFn: () => listEmployees(),
  })

  const schedules = schedulesQuery.data?.data ?? []
  const clients = clientsQuery.data?.data ?? []
  const services = servicesQuery.data?.data ?? []
  const teams = teamsQuery.data?.data ?? []
  const employees = employeesQuery.data?.data ?? []

  useEffect(() => {
    if (openDialog) {
      setIsDialogOpen(true)
      onDialogChange?.(false)
    }
  }, [openDialog, onDialogChange])

  const invalidateSchedules = async () => {
    await queryClient.invalidateQueries({ queryKey: ["schedules"] })
  }

  const saveMutation = useMutation({
    mutationFn: async ({ formData, scheduleId }: { formData: SchedulingFormData; scheduleId?: string }) => {
      const client = clients.find((item) => item.id === formData.clientId)
      const primaryUnit = client?.units.find((unit) => unit.isPrimary) ?? client?.units[0]
      if (!primaryUnit) {
        throw new Error("Cliente sem unidade disponível para agendamento.")
      }

      const payload = {
        clientId: formData.clientId,
        unitId: primaryUnit.id,
        serviceTypeId: formData.serviceTypeId,
        teamIds: formData.teamIds,
        additionalEmployeeIds: formData.employeeIds,
        scheduledDate: formData.date,
        scheduledTime: formData.time,
        estimatedDuration: formData.duration,
        isEmergency: formData.isEmergency,
        notes: formData.notes,
      }

      if (scheduleId) {
        return updateSchedule(scheduleId, payload)
      }

      return createSchedule(payload)
    },
    onSuccess: async ({ data }, variables) => {
      await invalidateSchedules()
      setEditingSchedule(null)
      setIsDialogOpen(false)
      toast.success(variables.scheduleId ? "Agendamento atualizado." : "Agendamento criado.", {
        description: `${data.clientName} • ${data.serviceTypeName}`,
      })
    },
    onError: (error: any) => {
      toast.error("Não foi possível salvar o agendamento.", {
        description: error?.response?.data?.message ?? error?.message ?? "Tente novamente.",
      })
    },
  })

  const startMutation = useMutation({
    mutationFn: (schedule: ScheduleRecord) => startSchedule(schedule.id),
    onSuccess: async () => {
      await invalidateSchedules()
      setSelectedSchedule(null)
      toast.success("Atendimento iniciado.", {
        description: "O agendamento foi movido para em andamento.",
      })
    },
  })

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => cancelSchedule(id, { cancellationReason: reason }),
    onSuccess: async () => {
      await invalidateSchedules()
      setCancelTarget(null)
      setCancelReason("")
      setCancelStep("reason")
      toast.success("Agendamento cancelado.", {
        description: "O motivo foi salvo no histórico.",
      })
    },
  })

  const completeMutation = useMutation({
    mutationFn: async ({ schedule, startTime, endTime, file }: { schedule: ScheduleRecord; startTime: string; endTime: string; file: File | null }) => {
      const completed = await completeSchedule(schedule.id, { startTime, endTime })
      if (file) {
        await uploadScheduleNa(schedule.id, file)
      }
      return completed
    },
    onSuccess: async ({ data }) => {
      await invalidateSchedules()
      if (completionFile) {
        addClientAttachment({
          clientId: data.clientId,
          scheduledServiceId: data.id,
          type: "service_na",
          title: `NA - ${data.serviceTypeName}`,
          fileName: completionFile.name,
          mimeType: completionFile.type || "application/octet-stream",
          fileSize: completionFile.size,
          source: "agenda",
          description: "Nota de atendimento vinculada à visita concluída.",
          metadata: {
            serviceTypeName: data.serviceTypeName,
            scheduledDate: data.date,
            startTime: completionStartTime,
            endTime: completionEndTime,
          },
        })
      }

      setCompletionTarget(null)
      setCompletionStartTime("")
      setCompletionEndTime("")
      setCompletionFile(null)
      toast.success("Atendimento concluído.", {
        description: "A agenda foi atualizada com o horário executado.",
      })
    },
    onError: (error: any) => {
      toast.error("Não foi possível concluir o atendimento.", {
        description: error?.response?.data?.message ?? error?.message ?? "Tente novamente.",
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSchedule(id),
    onSuccess: async () => {
      await invalidateSchedules()
      setPendingDelete(null)
      toast.success("Agendamento excluído.", {
        description: "O item foi removido com sucesso.",
      })
    },
  })

  const filteredSchedules = useMemo(() => {
    const term = searchTerm.toLowerCase()
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
  }, [dateRange, schedules, searchTerm, statusFilter])

  const totalItems = filteredSchedules.length
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage))
  const paginatedSchedules = filteredSchedules.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const handleFormSubmit = (formData: SchedulingFormData, isEditing: boolean) => {
    saveMutation.mutate({
      formData,
      scheduleId: isEditing ? editingSchedule?.id : undefined,
    })
  }

  const openSchedule = (schedule: ScheduleRecord) => {
    if (schedule.status === "in_progress") {
      setCompletionTarget(schedule)
      setCompletionStartTime(schedule.completionStartTime || schedule.time || "")
      setCompletionEndTime(schedule.completionEndTime || "")
      setCompletionFile(null)
      return
    }

    setSelectedSchedule(schedule)
  }

  return (
    <>
      <SchedulingFormDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) setEditingSchedule(null)
        }}
        editingSchedule={editingSchedule}
        onSubmit={handleFormSubmit}
        clients={clients}
        serviceTypes={services}
        teams={teams}
        employees={employees}
      />

      <ScheduleDetailsDialog
        open={!!selectedSchedule}
        onOpenChange={(open) => {
          if (!open) setSelectedSchedule(null)
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
                <Label htmlFor="cancel-reason">Motivo do cancelamento *</Label>
                <Textarea
                  id="cancel-reason"
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
                  onClick={() => cancelTarget && cancelMutation.mutate({ id: cancelTarget.id, reason: cancelReason.trim() })}
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
            setCompletionStartTime("")
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
              <Label htmlFor="completion-start">Horário de início *</Label>
              <Input
                id="completion-start"
                type="time"
                value={completionStartTime}
                onChange={(event) => setCompletionStartTime(event.target.value)}
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
            {completionFile && (
              <div className="flex items-center justify-between rounded-xl bg-card px-3 py-2 text-sm">
                <span className="truncate">{completionFile.name}</span>
                <span className="ml-3 shrink-0 text-xs text-muted-foreground">{formatFileSize(completionFile.size)}</span>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setCompletionTarget(null)}>
              Voltar
            </Button>
            <Button
              type="button"
              disabled={!completionTarget || !completionStartTime || !completionEndTime || completeMutation.isPending}
              onClick={() =>
                completionTarget &&
                completeMutation.mutate({
                  schedule: completionTarget,
                  startTime: completionStartTime,
                  endTime: completionEndTime,
                  file: completionFile,
                })
              }
            >
              Concluir visita
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <div className="relative col-span-2 sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente, serviço, equipe..."
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value)
                setCurrentPage(1)
              }}
              className="pl-10"
            />
          </div>
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
            className="sm:w-[260px]"
          />
          {viewToggle ? <div className="hidden shrink-0 sm:block">{viewToggle}</div> : null}
        </div>

        {viewMode === "table" ? (
          <div className="overflow-x-auto rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Cliente</TableHead>
                  <TableHead className="hidden sm:table-cell">Serviço</TableHead>
                  <TableHead className="hidden md:table-cell">Equipe / Funcionários</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSchedules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      Nenhum agendamento encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedSchedules.map((schedule) => (
                    <TableRow
                      key={schedule.id}
                      className="cursor-pointer"
                      onClick={() => openSchedule(schedule)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:flex">
                            <Calendar className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{schedule.clientName}</p>
                            <p className="text-xs text-muted-foreground sm:hidden">
                              {schedule.serviceTypeName} • {schedule.duration} min
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <p>{schedule.serviceTypeName}</p>
                        <p className="text-xs text-muted-foreground">{schedule.duration} min</p>
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
                          <span>{new Date(schedule.date).toLocaleDateString("pt-BR")}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{schedule.time}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(schedule.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(event) => {
                              event.stopPropagation()
                              setCompletionTarget(schedule)
                              setCompletionStartTime(schedule.completionStartTime || schedule.time || "")
                              setCompletionEndTime(schedule.completionEndTime || "")
                            }}
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(event) => {
                              event.stopPropagation()
                              setCancelTarget(schedule)
                              setCancelReason(schedule.cancellationReason || "")
                              setCancelStep("reason")
                            }}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={(event) => event.stopPropagation()}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setEditingSchedule(schedule)
                                  setIsDialogOpen(true)
                                }}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setPendingDelete(schedule)
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedSchedules.map((schedule) => (
              <Card key={schedule.id} className="cursor-pointer" onClick={() => openSchedule(schedule)}>
                <CardContent className="pt-6">
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:flex">
                        <Calendar className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium">{schedule.clientName}</h4>
                        <p className="text-xs text-muted-foreground">{schedule.serviceTypeName}</p>
                      </div>
                    </div>
                    {getStatusBadge(schedule.status)}
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      {schedule.time} ({schedule.duration} min)
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      {new Date(schedule.date).toLocaleDateString("pt-BR")}
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
                  <div className="mt-3 flex gap-1" onClick={(event) => event.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 flex-1 text-xs"
                      onClick={() => {
                        setEditingSchedule(schedule)
                        setIsDialogOpen(true)
                      }}
                    >
                      <Edit className="mr-1 h-3 w-3" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setCompletionTarget(schedule)
                        setCompletionStartTime(schedule.completionStartTime || schedule.time || "")
                        setCompletionEndTime(schedule.completionEndTime || "")
                      }}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setCancelTarget(schedule)
                        setCancelReason(schedule.cancellationReason || "")
                        setCancelStep("reason")
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

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
          if (pendingDelete) {
            deleteMutation.mutate(pendingDelete.id)
          }
        }}
      />
    </>
  )
}
