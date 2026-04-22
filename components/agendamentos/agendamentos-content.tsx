"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Plus,
  Search,
  Edit,
  MoreHorizontal,
  Trash2,
  Clock,
  Calendar,
  Check,
  X,
  FileUp,
  Camera,
} from "lucide-react"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import type { DateRange } from "react-day-picker"
import { format } from "date-fns"
import { DataPagination } from "@/components/ui/data-pagination"
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog"
import { useUrlQueryState } from "@/lib/hooks/use-url-query-state"
import { mockScheduledServices, mockClients, mockServiceTypes, mockTeams, mockEmployees, formatCurrency } from "@/lib/mock-data"
import { SchedulingFormDialog, type SchedulingFormData } from "./scheduling-form-dialog"
import { addClientAttachment } from "@/lib/client-attachments-store"

type ScheduledServiceRow = (typeof mockScheduledServices)[number] & {
  notes?: string
  isEmergency?: boolean
  contractId?: string | null
  isManual?: boolean
  cancellationReason?: string
  completionStartTime?: string
  completionEndTime?: string
  naFileName?: string
}

interface AgendamentosContentProps {
  viewMode: "table" | "cards"
  openDialog?: boolean
  onDialogChange?: (open: boolean) => void
  viewToggle?: React.ReactNode
}

export function AgendamentosContent({ viewMode, openDialog, onDialogChange, viewToggle }: AgendamentosContentProps) {
  const [scheduledServices, setScheduledServices] = useState<ScheduledServiceRow[]>(mockScheduledServices as ScheduledServiceRow[])
  const [searchTerm, setSearchTerm] = useUrlQueryState("q")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<ScheduledServiceRow | null>(null)
  const [cancelTarget, setCancelTarget] = useState<ScheduledServiceRow | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelStep, setCancelStep] = useState<"reason" | "confirm">("reason")
  const [completionTarget, setCompletionTarget] = useState<ScheduledServiceRow | null>(null)
  const [completionStartTime, setCompletionStartTime] = useState("")
  const [completionEndTime, setCompletionEndTime] = useState("")
  const [completionFile, setCompletionFile] = useState<File | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ScheduledServiceRow | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  
  // Sync dialog state with parent
  useEffect(() => {
    if (openDialog !== undefined && openDialog) {
      setIsDialogOpen(true)
      onDialogChange?.(false)
    }
  }, [openDialog, onDialogChange])

  const handleFormSubmit = (formData: SchedulingFormData, isEditing: boolean) => {
    const client = mockClients.find(c => c.id === formData.clientId)
    const serviceType = mockServiceTypes.find(st => st.id === formData.serviceTypeId)
    const formTeams = mockTeams.filter(t => formData.teamIds.includes(t.id))
    const formEmployees = mockEmployees.filter(e => formData.employeeIds.includes(e.id))

    if (!client || !serviceType) return

    const teamsData = formTeams.map(t => ({ id: t.id, name: t.name, color: t.color }))
    const employeesData = formEmployees.map(e => ({ id: e.id, name: e.name }))

    if (isEditing && editingSchedule) {
      setScheduledServices(scheduledServices.map(ss =>
        ss.id === editingSchedule.id
          ? {
              ...ss,
              clientId: formData.clientId,
              clientName: client.companyName,
              serviceTypeId: formData.serviceTypeId,
              serviceTypeName: serviceType.name,
              teamId: formData.teamIds[0] || "",
              teamName: formTeams[0]?.name,
              teams: teamsData,
              additionalEmployees: employeesData,
              date: formData.date,
              time: formData.time,
              duration: formData.duration,
              isEmergency: formData.isEmergency,
              notes: formData.notes,
            }
          : ss
      ))
    } else {
      const newSchedule: ScheduledServiceRow = {
        id: `sched-${Date.now()}`,
        contractId: null,
        isManual: true,
        clientId: formData.clientId,
        clientName: client.companyName,
        unitName: "",
        address: "",
        serviceTypeId: formData.serviceTypeId,
        serviceTypeName: serviceType.name,
        teamId: formData.teamIds[0] || "",
        teamName: formTeams[0]?.name,
        teams: teamsData,
        additionalEmployees: employeesData,
        date: formData.date,
        time: formData.time,
        duration: formData.duration,
        status: "scheduled",
        isEmergency: formData.isEmergency,
        notes: formData.notes,
        recurrence: { type: "none", daysOfWeek: [], interval: 1 },
        createdAt: new Date().toISOString(),
      }
      setScheduledServices([...scheduledServices, newSchedule])

      if (formData.createContract && formData.value > 0) {
        alert(`Agendamento criado! Cobrança de ${formatCurrency(formData.value)} gerada no financeiro.`)
      }
    }
    setEditingSchedule(null)
    setIsDialogOpen(false)
  }

  const handleEdit = (schedule: ScheduledServiceRow) => {
    setEditingSchedule(schedule)
    setIsDialogOpen(true)
  }

  const handleStatusChange = (id: string, newStatus: ScheduledServiceRow["status"]) => {
    setScheduledServices((current) => current.map(ss =>
      ss.id === id ? { ...ss, status: newStatus } : ss
    ))
  }

  const handleCancelClick = (schedule: ScheduledServiceRow) => {
    if (schedule.status === "cancelled") {
      handleStatusChange(schedule.id, "scheduled")
      return
    }

    setCancelTarget(schedule)
    setCancelReason(schedule.cancellationReason || "")
    setCancelStep("reason")
  }

  const handleCancelReasonSubmit = () => {
    if (!cancelReason.trim()) return
    setCancelStep("confirm")
  }

  const handleConfirmCancellation = () => {
    if (!cancelTarget) return

    setScheduledServices((current) => current.map((schedule) =>
      schedule.id === cancelTarget.id
        ? {
            ...schedule,
            status: "cancelled",
            cancellationReason: cancelReason.trim(),
            notes: schedule.notes
              ? `${schedule.notes}\nCancelamento: ${cancelReason.trim()}`
              : `Cancelamento: ${cancelReason.trim()}`,
          }
        : schedule
    ))
    setCancelTarget(null)
    setCancelReason("")
    setCancelStep("reason")
  }

  const handleCompletionClick = (schedule: ScheduledServiceRow) => {
    if (schedule.status === "completed") {
      handleStatusChange(schedule.id, "scheduled")
      return
    }

    setCompletionTarget(schedule)
    setCompletionStartTime(schedule.completionStartTime || schedule.time || "")
    setCompletionEndTime(schedule.completionEndTime || "")
    setCompletionFile(null)
  }

  const handleCompletionFileChange = (file?: File) => {
    setCompletionFile(file ?? null)
  }

  const handleConfirmCompletion = () => {
    if (!completionTarget || !completionStartTime || !completionEndTime) return

    setScheduledServices((current) => current.map((schedule) =>
      schedule.id === completionTarget.id
        ? {
            ...schedule,
            status: "completed",
            completionStartTime,
            completionEndTime,
            naFileName: completionFile?.name,
          }
        : schedule
    ))

    if (completionFile) {
      addClientAttachment({
        clientId: completionTarget.clientId,
        scheduledServiceId: completionTarget.id,
        type: "service_na",
        title: `NA - ${completionTarget.serviceTypeName}`,
        fileName: completionFile.name,
        mimeType: completionFile.type || "application/octet-stream",
        fileSize: completionFile.size,
        source: "agenda",
        description: "Nota de atendimento vinculada à visita concluída.",
        metadata: {
          serviceTypeName: completionTarget.serviceTypeName,
          scheduledDate: completionTarget.date,
          startTime: completionStartTime,
          endTime: completionEndTime,
        },
      })
    }

    setCompletionTarget(null)
    setCompletionStartTime("")
    setCompletionEndTime("")
    setCompletionFile(null)
  }

  const formatFileSize = (size?: number) => {
    if (!size) return ""
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleDelete = (id: string) => {
    setPendingDelete(scheduledServices.find((schedule) => schedule.id === id) ?? null)
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    setScheduledServices((current) => current.filter((schedule) => schedule.id !== pendingDelete.id))
    setPendingDelete(null)
  }

  const getStatusBadge = (status: ScheduledServiceRow["status"]) => {
    switch (status) {
      case "scheduled":
        return <Badge className="bg-blue-100 text-blue-800">Agendado</Badge>
      case "in_progress":
        return <Badge className="bg-yellow-100 text-yellow-800">Em Andamento</Badge>
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Concluído</Badge>
      case "cancelled":
        return <Badge className="bg-red-100 text-red-800">Cancelado</Badge>
    }
  }

  const filteredSchedules = scheduledServices.filter(ss => {
    const term = searchTerm.toLowerCase()
    const matchesSearch = !term ||
      ss.clientName.toLowerCase().includes(term) ||
      ss.serviceTypeName.toLowerCase().includes(term) ||
      ss.teams?.some((t: any) => t.name.toLowerCase().includes(term)) ||
      ss.additionalEmployees?.some((e: any) => e.name.toLowerCase().includes(term))
    const matchesStatus = statusFilter === "all" || ss.status === statusFilter
    const fromStr = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : ""
    const toStr = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : ""
    const matchesDateFrom = !fromStr || ss.date >= fromStr
    const matchesDateTo = !toStr || ss.date <= toStr
    return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo
  })

  const totalItems = filteredSchedules.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const paginatedSchedules = filteredSchedules.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

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
      />

      <Dialog open={!!cancelTarget} onOpenChange={(open) => {
        if (!open) {
          setCancelTarget(null)
          setCancelReason("")
          setCancelStep("reason")
        }
      }}>
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
                  onClick={handleCancelReasonSubmit}
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
                <Button type="button" className="bg-red-500 text-white hover:bg-red-600" onClick={handleConfirmCancellation}>
                  Confirmar cancelamento
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!completionTarget} onOpenChange={(open) => {
        if (!open) {
          setCompletionTarget(null)
          setCompletionStartTime("")
          setCompletionEndTime("")
          setCompletionFile(null)
        }
      }}>
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
              onChange={(event) => handleCompletionFileChange(event.target.files?.[0])}
            />
            <input
              ref={cameraInputRef}
              type="file"
              className="hidden"
              accept="image/*"
              capture="environment"
              onChange={(event) => handleCompletionFileChange(event.target.files?.[0])}
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
            <Button type="button" disabled={!completionStartTime || !completionEndTime} onClick={handleConfirmCompletion}>
              Concluir visita
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
          <div className="relative col-span-2 sm:flex-none sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente, serviço, equipe..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
              className="pl-10"
            />
          </div>
          <SearchableSelect
            value={statusFilter}
            onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1) }}
            options={[
              { value: "scheduled", label: "Agendado" },
              { value: "in_progress", label: "Em Andamento" },
              { value: "completed", label: "Concluído" },
              { value: "cancelled", label: "Cancelado" },
            ]}
            placeholder="Status"
            searchPlaceholder="Buscar status..."
            allLabel="Todos os status"
            className="sm:flex-none sm:w-[160px]"
          />
          <DateRangePicker
            value={dateRange}
            onChange={(range) => { setDateRange(range); setCurrentPage(1) }}
            placeholder="Filtrar data"
            className="sm:flex-none sm:w-[260px]"
          />
          {viewToggle && <div className="hidden sm:block shrink-0">{viewToggle}</div>}
        </div>

          {viewMode === "table" ? (
            <div className="rounded-md overflow-x-auto">
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
                      <TableRow key={schedule.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="hidden sm:flex w-10 h-10 rounded-lg bg-primary/10 items-center justify-center shrink-0">
                              <Calendar className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{schedule.clientName}</p>
                              <p className="text-xs text-muted-foreground sm:hidden">{schedule.serviceTypeName} · {schedule.duration} min</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <p>{schedule.serviceTypeName}</p>
                          <p className="text-xs text-muted-foreground">{schedule.duration} min</p>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex flex-wrap gap-1.5">
                            {schedule.teams?.map((team: any) => (
                              <Badge
                                key={team.id}
                                variant="secondary"
                                className="px-3 py-1 flex items-center gap-2 text-xs text-foreground/80"
                                style={{ backgroundColor: `${team.color}1A` }}
                              >
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                                {team.name}
                              </Badge>
                            ))}
                            {schedule.additionalEmployees?.map((emp: any) => (
                              <Badge key={emp.id} variant="outline" className="px-3 py-1 text-xs">
                                {emp.name}
                              </Badge>
                            ))}
                            {(!schedule.teams?.length && !schedule.additionalEmployees?.length) && "-"}
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
                              className={schedule.status === "completed" ? "bg-green-100 hover:bg-green-200" : ""}
                              onClick={() => handleCompletionClick(schedule)}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={schedule.status === "cancelled" ? "bg-red-100 hover:bg-red-200" : ""}
                              onClick={() => handleCancelClick(schedule)}
                            >
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(schedule)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(schedule.id)}>
                                  <Trash2 className="h-4 w-4 mr-2" />
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
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedSchedules.map((schedule) => (
                <Card key={schedule.id}>
                  <CardContent>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="hidden sm:flex w-10 h-10 rounded-lg bg-primary/10 items-center justify-center shrink-0">
                          <Calendar className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-medium text-sm">{schedule.clientName}</h4>
                          <p className="text-xs text-muted-foreground">{schedule.serviceTypeName}</p>
                        </div>
                      </div>
                      {getStatusBadge(schedule.status)}
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {schedule.time} ({schedule.duration}min)
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {new Date(schedule.date).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    {(schedule.teams?.length > 0 || schedule.additionalEmployees?.length > 0) && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {schedule.teams?.map((team: any) => (
                          <Badge
                            key={team.id}
                            variant="secondary"
                            className="px-3 py-1 flex items-center gap-2 text-xs text-foreground/80"
                            style={{ backgroundColor: `${team.color}1A` }}
                          >
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                            {team.name}
                          </Badge>
                        ))}
                        {schedule.additionalEmployees?.map((emp: any) => (
                          <Badge key={emp.id} variant="outline" className="px-3 py-1 text-xs">
                            {emp.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-1 mt-2">
                      <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => handleEdit(schedule)}>
                        <Edit className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant={schedule.status === "completed" ? "default" : "outline"}
                        size="sm"
                        className={`h-7 text-xs ${schedule.status === "completed" ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
                        onClick={() => handleCompletionClick(schedule)}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        variant={schedule.status === "cancelled" ? "default" : "outline"}
                        size="sm"
                        className={`h-7 text-xs ${schedule.status === "cancelled" ? "bg-red-600 hover:bg-red-700 text-white" : ""}`}
                        onClick={() => handleCancelClick(schedule)}
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
            onPageSizeChange={(size) => { setItemsPerPage(size); setCurrentPage(1) }}
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
        onConfirm={confirmDelete}
      />
    </>
  )
}
