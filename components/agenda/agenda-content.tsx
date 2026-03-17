"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
// Tabs moved to page level
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Calendar as CalendarIcon,
  Check,
  X,
  Edit,
  Building,
} from "lucide-react"
import { DataPagination } from "@/components/ui/data-pagination"
import { mockScheduledServices, mockClients, mockTeams, mockServiceTypes } from "@/lib/mock-data"
import { getColorFromClass } from "@/lib/utils"
import type { RecurrenceType } from "@/lib/types"

type AgendaRecurrenceType = "none" | "daily" | RecurrenceType
type AgendaScheduledServiceRow = Omit<(typeof mockScheduledServices)[number], "recurrence" | "time"> & {
  time: string
  recurrence: { type: AgendaRecurrenceType; daysOfWeek: number[]; interval: number }
  notes?: string
}

const DEFAULT_RECURRENCE: AgendaScheduledServiceRow["recurrence"] = {
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
]

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

interface AgendaContentProps {
  viewMode: "month" | "list"
  openDialog?: boolean
  onDialogChange?: (open: boolean) => void
  viewToggle?: React.ReactNode
}

export function AgendaContent({ viewMode, openDialog, onDialogChange, viewToggle }: AgendaContentProps) {
  const [scheduledServices, setScheduledServices] = useState<AgendaScheduledServiceRow[]>(
    (mockScheduledServices as (typeof mockScheduledServices)[number][]).map((s) => ({
      ...s,
      time: s.time ?? "",
      recurrence: (s.recurrence as any) ?? DEFAULT_RECURRENCE,
    }))
  )
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => new Date())
  const [teamFilter, setTeamFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  // Pagination for list view
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<AgendaScheduledServiceRow | null>(null)
  const [formData, setFormData] = useState({
    clientId: "",
    serviceTypeId: "",
    teamId: "",
    date: new Date().toISOString().split("T")[0],
    time: "",
    duration: 60,
    value: 0,
    createContract: false,
    recurrence: {
      ...DEFAULT_RECURRENCE,
    },
    notes: "",
  })

  // Sync dialog state with external props
  useEffect(() => {
    if (openDialog !== undefined && openDialog !== isDialogOpen) {
      setIsDialogOpen(openDialog)
    }
  }, [openDialog])

  // Handle internal dialog state changes
  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open)
    onDialogChange?.(open)
  }

  const currentMonth = currentDate.getMonth()
  const currentYear = currentDate.getFullYear()

  const daysInMonth = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1)
    const lastDay = new Date(currentYear, currentMonth + 1, 0)
    const startPadding = firstDay.getDay()
    const days: (Date | null)[] = []

    for (let i = 0; i < startPadding; i++) {
      days.push(null)
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(currentYear, currentMonth, i))
    }

    return days
  }, [currentMonth, currentYear])

  const filteredServices = useMemo(() => {
    return scheduledServices.filter(service => {
      const matchesTeam = teamFilter === "all" || service.teamId === teamFilter
      const matchesStatus = statusFilter === "all" || service.status === statusFilter
      return matchesTeam && matchesStatus
    })
  }, [scheduledServices, teamFilter, statusFilter])

  const sortedServices = useMemo(() => {
    return [...filteredServices].sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`)
      const dateB = new Date(`${b.date}T${b.time}`)
      return dateA.getTime() - dateB.getTime()
    })
  }, [filteredServices])

  const totalPages = Math.ceil(sortedServices.length / pageSize)
  const paginatedServices = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedServices.slice(start, start + pageSize)
  }, [sortedServices, currentPage, pageSize])

  const getServicesForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0]
    return filteredServices.filter(service => service.date === dateStr)
  }

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentYear, currentMonth + direction, 1))
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const client = mockClients.find(c => c.id === formData.clientId)
    const serviceType = mockServiceTypes.find(st => st.id === formData.serviceTypeId)
    const team = mockTeams.find(t => t.id === formData.teamId)
    const teamsData = team ? [{ id: team.id, name: team.name, color: team.color }] : []

    if (!client || !serviceType) return

    if (editingService) {
      setScheduledServices(scheduledServices.map(ss =>
        ss.id === editingService.id
          ? {
            ...ss,
            clientId: formData.clientId,
            clientName: client.companyName,
            serviceTypeId: formData.serviceTypeId,
            serviceTypeName: serviceType.name,
            teamId: formData.teamId,
            teamName: team?.name,
            teams: teamsData,
            date: formData.date,
            time: formData.time,
            duration: formData.duration,
            recurrence: formData.recurrence,
            notes: formData.notes,
          }
          : ss
      ))
    } else {
      const newService: AgendaScheduledServiceRow = {
        id: `sched-${Date.now()}`,
        contractId: null,
        isManual: true,
        clientId: formData.clientId,
        clientName: client.companyName,
        unitName: "",
        address: "",
        serviceTypeId: formData.serviceTypeId,
        serviceTypeName: serviceType.name,
        teamId: formData.teamId,
        teamName: team?.name,
        teams: teamsData,
        additionalEmployees: [],
        date: formData.date,
        time: formData.time,
        duration: formData.duration,
        status: "scheduled",
        recurrence: formData.recurrence,
        notes: formData.notes,
        createdAt: new Date().toISOString(),
      }
      setScheduledServices([...scheduledServices, newService])
    }
    resetForm()
  }

  const resetForm = () => {
    setFormData({
      clientId: "",
      serviceTypeId: "",
      teamId: "",
      date: "",
      time: "",
      duration: 60,
      value: 0,
        createContract: false,
      recurrence: { ...DEFAULT_RECURRENCE },
      notes: "",
    })
    setEditingService(null)
    handleDialogChange(false)
  }

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    setFormData(prev => ({ ...prev, date: date.toISOString().split("T")[0] }))
  }

  const handleEditService = (service: AgendaScheduledServiceRow) => {
    setEditingService(service)
    setFormData({
      clientId: service.clientId,
      serviceTypeId: service.serviceTypeId,
      teamId: service.teamId || "",
      date: service.date,
      time: service.time ?? "",
      duration: service.duration,
      value: 0,
        createContract: false,
      recurrence: service.recurrence || { ...DEFAULT_RECURRENCE },
      notes: service.notes || "",
    })
    handleDialogChange(true)
  }

  const handleStatusChange = (serviceId: string, newStatus: AgendaScheduledServiceRow["status"]) => {
    setScheduledServices(scheduledServices.map(ss =>
      ss.id === serviceId ? { ...ss, status: newStatus } : ss
    ))
  }

  const getStatusBadge = (status: AgendaScheduledServiceRow["status"]) => {
    switch (status) {
      case "scheduled":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Agendado</Badge>
      case "in_progress":
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Em Andamento</Badge>
      case "completed":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Concluído</Badge>
      case "cancelled":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Cancelado</Badge>
    }
  }

  const getTeamColor = (teamId?: string) => {
    const team = mockTeams.find(t => t.id === teamId)
    return getColorFromClass(team?.color || '')
  }

  const selectedDateServices = selectedDate ? getServicesForDate(selectedDate) : []

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-180px)] lg:overflow-hidden">
      <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingService ? "Editar Agendamento" : "Novo Agendamento"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Cliente</Label>
                <Select
                  value={formData.clientId}
                  onValueChange={(value) => setFormData({ ...formData, clientId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockClients.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Tipo de Serviço</Label>
                <Select
                  value={formData.serviceTypeId}
                  onValueChange={(value) => setFormData({ ...formData, serviceTypeId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockServiceTypes.filter(st => st.isActive).map(type => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Equipe</Label>
                <Select
                  value={formData.teamId}
                  onValueChange={(value) => setFormData({ ...formData, teamId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockTeams.map(team => (
                      <SelectItem key={team.id} value={team.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }} />
                          {team.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Horário</Label>
                <Input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Duração (min)</Label>
                <Input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                  min={15}
                  step={15}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                  min={0}
                  step={0.01}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label>Recorrência</Label>
                <Select
                  value={formData.recurrence.type}
                  onValueChange={(value) => setFormData({
                    ...formData,
                    recurrence: { ...formData.recurrence, type: value as AgendaRecurrenceType }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Único</SelectItem>
                    <SelectItem value="daily">Diário</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="biweekly">Quinzenal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.recurrence.type === "weekly" && (
              <div className="space-y-2">
                <Label>Dias da Semana</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <div key={day.value} className="flex items-center gap-1">
                      <Checkbox
                        id={`agenda-day-${day.value}`}
                        checked={formData.recurrence.daysOfWeek?.includes(day.value)}
                        onCheckedChange={(checked) => {
                          const days = formData.recurrence.daysOfWeek || []
                          if (checked) {
                            setFormData({
                              ...formData,
                              recurrence: {
                                ...formData.recurrence,
                                daysOfWeek: [...days, day.value]
                              }
                            })
                          } else {
                            setFormData({
                              ...formData,
                              recurrence: {
                                ...formData.recurrence,
                                daysOfWeek: days.filter(d => d !== day.value)
                              }
                            })
                          }
                        }}
                      />
                      <Label htmlFor={`agenda-day-${day.value}`} className="text-sm">{day.label}</Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações sobre o serviço"
              />
            </div>

            {!editingService && (
              <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
                <Checkbox
                  id="createContract"
                  checked={formData.createContract}
                  onCheckedChange={(checked) => setFormData({ ...formData, createContract: !!checked })}
                />
                <div className="flex flex-col">
                  <Label htmlFor="createContract" className="text-sm font-medium cursor-pointer">
                    Gerar contrato para este agendamento
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Um novo contrato será criado para o cliente com este serviço
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {editingService ? "Salvar" : "Agendar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="flex-1 sm:flex-initial sm:w-[180px]">
            <SelectValue placeholder="Filtrar por equipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as equipes</SelectItem>
            {mockTeams.map(team => (
              <SelectItem key={team.id} value={team.id}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }} />
                  {team.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="flex-1 sm:flex-initial sm:w-[180px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="scheduled">Agendado</SelectItem>
            <SelectItem value="in_progress">Em Andamento</SelectItem>
            <SelectItem value="completed">Concluído</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        {viewToggle && <div className="hidden sm:block shrink-0">{viewToggle}</div>}
      </div>

      {viewMode === "month" ? (
        <div className="grid gap-4 lg:grid-cols-5 lg:flex-1 lg:overflow-hidden">
          {/* Calendar Grid */}
          <Card className="lg:col-span-3 xl:col-span-3 flex flex-col lg:overflow-hidden">
            <CardHeader className="py-2 px-4 shrink-0">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="text-base">
                  {MONTHS[currentMonth]} {currentYear}
                </CardTitle>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0 flex-1 flex flex-col min-h-0">
              <div className="grid grid-cols-7 gap-1 shrink-0">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day.value} className="text-center text-xs font-medium text-muted-foreground py-1">
                    {day.label}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 flex-1">
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
                      className={`
                        rounded-lg flex flex-col items-center justify-center p-1 text-sm
                        transition-all duration-200 hover:bg-muted border aspect-square
                        ${isToday(date) ? "bg-primary/10 border-primary" : "border-transparent"}
                        ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}
                      `}
                    >
                      <span className={`font-medium ${isToday(date) ? "text-primary" : ""}`}>
                        {date.getDate()}
                      </span>
                      {services.length > 0 && (
                        <div className="flex items-center justify-center gap-1 mt-1 flex-wrap">
                          {[...new Set(services.map(s => s.teamId))].slice(0, 4).map((teamId) => (
                            <div
                              key={teamId || 'no-team'}
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: getTeamColor(teamId) }}
                              title={`${services.filter(s => s.teamId === teamId).length} serviço(s)`}
                            />
                          ))}
                          {[...new Set(services.map(s => s.teamId))].length > 4 && (
                            <span className="text-[9px] text-muted-foreground">
                              +{[...new Set(services.map(s => s.teamId))].length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Selected Date Details */}
          <Card className="lg:col-span-2 xl:col-span-2 flex flex-col lg:overflow-hidden">
            <CardHeader className="py-3 px-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <CalendarIcon className="h-4 w-4" />
                {selectedDate
                  ? selectedDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
                  : "Selecione uma data"
                }
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 lg:overflow-hidden px-0">
              {selectedDate ? (
                selectedDateServices.length > 0 ? (
                  <ScrollArea className="lg:h-full">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 px-6">
                      {selectedDateServices.map((service) => (
                        <Card key={service.id}>
                          <CardContent>
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div>
                                  <h4 className="font-medium text-sm">{service.clientName}</h4>
                                  <p className="text-xs text-muted-foreground">{service.serviceTypeName}</p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1.5">
                                {getStatusBadge(service.status)}
                                {(service.teams?.length > 0 || service.additionalEmployees?.length > 0) && (
                                  <div className="flex flex-wrap justify-end gap-1">
                                    {service.teams?.map((team: any) => (
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
                                    {service.additionalEmployees?.map((emp: any) => (
                                      <Badge key={emp.id} variant="outline" className="px-3 py-1 text-xs">
                                        {emp.name}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="space-y-1 text-xs text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                {service.time} ({service.duration}min)
                              </div>
                              {service.address && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-3 w-3" />
                                  <span className="truncate">{service.address}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1 mt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 h-7 text-xs"
                                onClick={() => handleEditService(service)}
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                Editar
                              </Button>
                              <Button
                                variant={service.status === "completed" ? "default" : "outline"}
                                size="sm"
                                className={`h-7 text-xs ${service.status === "completed" ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
                                onClick={() => handleStatusChange(service.id, service.status === "completed" ? "scheduled" : "completed")}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                variant={service.status === "cancelled" ? "default" : "outline"}
                                size="sm"
                                className={`h-7 text-xs ${service.status === "cancelled" ? "bg-red-600 hover:bg-red-700 text-white" : ""}`}
                                onClick={() => handleStatusChange(service.id, service.status === "cancelled" ? "scheduled" : "cancelled")}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum serviço agendado</p>
                    <Button
                      variant="link"
                      className="text-primary mt-2"
                      onClick={() => handleDialogChange(true)}
                    >
                      Agendar serviço
                    </Button>
                  </div>
                )
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Clique em uma data para ver os detalhes</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="flex-1 flex flex-col">
          <CardContent className="p-4 flex-1 flex flex-col">
            <div className="rounded-md overflow-x-auto flex-1">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-4 text-left font-medium">Data/Hora</th>
                    <th className="h-10 px-4 text-left font-medium">Cliente</th>
                    <th className="h-10 px-4 text-left font-medium hidden sm:table-cell">Serviço</th>
                    <th className="h-10 px-4 text-left font-medium hidden md:table-cell">Equipe</th>
                    <th className="h-10 px-4 text-left font-medium">Status</th>
                    <th className="h-10 px-4 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedServices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="h-24 text-center text-muted-foreground">
                        Nenhum agendamento encontrado.
                      </td>
                    </tr>
                  ) : (
                    paginatedServices.map((service) => (
                      <tr key={service.id} className="border-b">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-1 h-8 rounded-full"
                              style={{ backgroundColor: getTeamColor(service.teamId) }}
                            />
                            <div>
                              <div className="font-medium">
                                {new Date(service.date).toLocaleDateString("pt-BR")}
                              </div>
                              <div className="text-sm text-muted-foreground">{service.time}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            {service.clientName}
                          </div>
                        </td>
                        <td className="p-4 hidden sm:table-cell">{service.serviceTypeName}</td>
                        <td className="p-4 hidden md:table-cell">
                          <div className="flex flex-wrap gap-1.5">
                            {service.teams?.map((team: any) => (
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
                            {service.additionalEmployees?.map((emp: any) => (
                              <Badge key={emp.id} variant="outline" className="px-3 py-1 text-xs">
                                {emp.name}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="p-4">{getStatusBadge(service.status)}</td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditService(service)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={service.status === "completed" ? "bg-green-100 hover:bg-green-200" : ""}
                              onClick={() => handleStatusChange(service.id, service.status === "completed" ? "scheduled" : "completed")}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={service.status === "cancelled" ? "bg-red-100 hover:bg-red-200" : ""}
                              onClick={() => handleStatusChange(service.id, service.status === "cancelled" ? "scheduled" : "cancelled")}
                            >
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <DataPagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={sortedServices.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1) }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
