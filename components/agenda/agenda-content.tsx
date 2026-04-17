"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Calendar as CalendarIcon,
  Check,
  X,
  Edit,
  Calendar,
  Search,
} from "lucide-react"
import { mockScheduledServices, mockClients, mockTeams, mockServiceTypes } from "@/lib/mock-data"
import { HeaderFiltersPortal } from "@/components/ui/header-filters-portal"
import { SearchableSelect } from "@/components/ui/searchable-select"

import type { RecurrenceType } from "@/lib/types"
import { WeekTimeline } from "./week-timeline"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
  openDialog?: boolean
  onDialogChange?: (open: boolean) => void
}

export function AgendaContent({ openDialog, onDialogChange }: AgendaContentProps) {
  const [scheduledServices, setScheduledServices] = useState<AgendaScheduledServiceRow[]>(
    (mockScheduledServices as (typeof mockScheduledServices)[number][]).map((s) => ({
      ...s,
      time: s.time ?? "",
      recurrence: (s.recurrence as any) ?? DEFAULT_RECURRENCE,
    }))
  )
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => new Date())
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"month" | "week">("month")

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
    const term = searchTerm.toLowerCase()
    return scheduledServices.filter(service => {
      const matchesSearch = !term ||
        service.clientName.toLowerCase().includes(term) ||
        service.serviceTypeName.toLowerCase().includes(term) ||
        service.teams?.some((t: any) => t.name.toLowerCase().includes(term)) ||
        service.additionalEmployees?.some((e: any) => e.name.toLowerCase().includes(term))
      const matchesStatus = statusFilter === "all" || service.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [scheduledServices, searchTerm, statusFilter])

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
    if (!teamId) return "#9CA3AF" // gray for no team
    const team = mockTeams.find(t => t.id === teamId)
    return team?.color || "#9CA3AF"
  }

  const selectedDateServices = selectedDate ? getServicesForDate(selectedDate) : []

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
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
                <CurrencyInput
                  value={Math.round(formData.value * 100)}
                  onChange={(cents: number) => setFormData({ ...formData, value: cents / 100 })}
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
      <HeaderFiltersPortal>
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
          <div className="relative sm:flex-none sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente, serviço, equipe..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <SearchableSelect
            value={statusFilter}
            onValueChange={setStatusFilter}
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
          <Tabs value={viewMode} onValueChange={(v) => {
            const mode = v as "month" | "week"
            if (mode === "week") {
              setCurrentDate(selectedDate || new Date())
            }
            setViewMode(mode)
          }} className="hidden sm:block shrink-0">
            <TabsList className="h-9">
              <TabsTrigger value="month" className="text-xs px-3">Mês</TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-3">Semana</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </HeaderFiltersPortal>

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
            <div className="grid grid-cols-7 gap-1 flex-1 auto-rows-fr">
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
                        transition-all duration-200 hover:bg-muted border
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
                ? selectedDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }).replace(/^\w/, c => c.toUpperCase()).replace(/de (\w)/, (_, c) => `de ${c.toUpperCase()}`)
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
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <div className="hidden sm:flex w-10 h-10 rounded-lg bg-primary/10 items-center justify-center shrink-0">
                                <Calendar className="w-5 h-5 text-primary" />
                              </div>
                              <div className="min-w-0 flex-1 pr-1">
                                <h4 className="max-w-[190px] whitespace-normal break-words text-sm font-medium leading-snug sm:max-w-none">{service.clientName}</h4>
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">{service.serviceTypeName}</p>
                              </div>
                            </div>
                            <div className="shrink-0">{getStatusBadge(service.status)}</div>
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
                          {(service.teams?.length > 0 || service.additionalEmployees?.length > 0) && (
                            <div className="flex flex-wrap gap-1 my-4">
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
      /* Week Timeline View */
      <div className="grid gap-4 lg:grid-cols-5 lg:flex-1 lg:overflow-hidden">
        <Card className="lg:col-span-3 xl:col-span-3 flex flex-col lg:overflow-hidden">
          <CardContent className="p-0 flex-1 flex flex-col min-h-0 lg:h-[calc(100vh-280px)]">
            <WeekTimeline
              events={filteredServices.map(s => ({
                id: s.id,
                title: s.clientName,
                subtitle: s.serviceTypeName,
                date: s.date,
                time: s.time || "08:00",
                duration: s.duration,
                teamColor: s.teams?.length > 0 ? (s.teams[0] as any).color || getTeamColor(s.teamId) : null,
                status: s.status,
              }))}
              currentDate={currentDate}
              selectedDate={selectedDate}
              onDateChange={setCurrentDate}
              onDaySelect={(date) => handleDateClick(date)}
            />
          </CardContent>
        </Card>

        {/* Selected Date Details (same as month view) */}
        <Card className="lg:col-span-2 xl:col-span-2 flex flex-col lg:overflow-hidden">
          <CardHeader className="py-3 px-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarIcon className="h-4 w-4" />
              {selectedDate
                ? selectedDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }).replace(/^\w/, c => c.toUpperCase()).replace(/de (\w)/, (_, c) => `de ${c.toUpperCase()}`)
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
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <div className="hidden sm:flex w-10 h-10 rounded-lg bg-primary/10 items-center justify-center shrink-0">
                                <Calendar className="w-5 h-5 text-primary" />
                              </div>
                              <div className="min-w-0 flex-1 pr-1">
                                <h4 className="max-w-[190px] whitespace-normal break-words text-sm font-medium leading-snug sm:max-w-none">{service.clientName}</h4>
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">{service.serviceTypeName}</p>
                              </div>
                            </div>
                            <div className="shrink-0">{getStatusBadge(service.status)}</div>
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
                          {(service.teams?.length > 0 || service.additionalEmployees?.length > 0) && (
                            <div className="flex flex-wrap gap-1 my-4">
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
      )}
    </div>
  )
}
