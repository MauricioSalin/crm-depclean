"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  LayoutGrid,
  List
} from "lucide-react"
import { DataPagination } from "@/components/ui/data-pagination"
import { mockScheduledServices, mockClients, mockServiceTypes, mockTeams, mockEmployees, formatCurrency } from "@/lib/mock-data"
import { SchedulingFormDialog, type SchedulingFormData } from "./scheduling-form-dialog"

type ScheduledServiceRow = (typeof mockScheduledServices)[number] & {
  notes?: string
  isEmergency?: boolean
  contractId?: string | null
  isManual?: boolean
}

interface AgendamentosContentProps {
  openDialog?: boolean
  onDialogChange?: (open: boolean) => void
}

export function AgendamentosContent({ openDialog, onDialogChange }: AgendamentosContentProps) {
  const [scheduledServices, setScheduledServices] = useState<ScheduledServiceRow[]>(mockScheduledServices as ScheduledServiceRow[])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"table" | "cards">("table")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<ScheduledServiceRow | null>(null)
  
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
    setScheduledServices(scheduledServices.map(ss =>
      ss.id === id ? { ...ss, status: newStatus } : ss
    ))
  }

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este agendamento?")) {
      setScheduledServices(scheduledServices.filter(ss => ss.id !== id))
    }
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
    const matchesSearch = 
      ss.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ss.serviceTypeName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || ss.status === statusFilter
    return matchesSearch && matchesStatus
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

      <div>
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative w-full sm:w-1/3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por cliente ou serviço..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1) }}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="scheduled">Agendado</SelectItem>
                    <SelectItem value="in_progress">Em Andamento</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "table" | "cards")}>
                  <TabsList>
                    <TabsTrigger value="table">
                      <List className="h-4 w-4" />
                    </TabsTrigger>
                    <TabsTrigger value="cards">
                      <LayoutGrid className="h-4 w-4" />
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </div>

          {viewMode === "table" ? (
            <div className="rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead width="25%">Cliente</TableHead>
                    <TableHead width="20%">Serviço</TableHead>
                    <TableHead width="18%" className="hidden md:table-cell">Equipe</TableHead>
                    <TableHead width="12%">Data/Hora</TableHead>
                    <TableHead width="12%">Status</TableHead>
                    <TableHead width="13%" className="text-right">Ações</TableHead>
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
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Calendar className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{schedule.clientName}</p>
                              <p className="text-xs text-muted-foreground sm:hidden">{schedule.serviceTypeName}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
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
                              onClick={() => handleStatusChange(schedule.id, schedule.status === "completed" ? "scheduled" : "completed")}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={schedule.status === "cancelled" ? "bg-red-100 hover:bg-red-200" : ""}
                              onClick={() => handleStatusChange(schedule.id, schedule.status === "cancelled" ? "scheduled" : "cancelled")}
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
                <Card key={schedule.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-primary" />
                      </div>
                      {getStatusBadge(schedule.status)}
                    </div>
                    <h3 className="font-semibold mb-1 truncate">{schedule.clientName}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{schedule.serviceTypeName}</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4 shrink-0" />
                        <span>{new Date(schedule.date).toLocaleDateString("pt-BR")} - {schedule.time}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-4 h-4 shrink-0" />
                        <span>{schedule.duration} minutos</span>
                      </div>
                      {(schedule.teams?.length > 0 || schedule.additionalEmployees?.length > 0) && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
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
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(schedule)}>
                        <Edit className="w-4 h-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant={schedule.status === "completed" ? "default" : "outline"}
                        size="sm"
                        className={schedule.status === "completed" ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                        onClick={() => handleStatusChange(schedule.id, schedule.status === "completed" ? "scheduled" : "completed")}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={schedule.status === "cancelled" ? "default" : "outline"}
                        size="sm"
                        className={schedule.status === "cancelled" ? "bg-red-600 hover:bg-red-700 text-white" : ""}
                        onClick={() => handleStatusChange(schedule.id, schedule.status === "cancelled" ? "scheduled" : "cancelled")}
                      >
                        <X className="h-4 w-4" />
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
    </>
  )
}
