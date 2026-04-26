"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { mockClients, mockServiceTypes, mockTeams, mockEmployees } from "@/lib/mock-data"
import { CurrencyInput } from "@/components/ui/currency-input"
import type { ClientRecord } from "@/lib/api/clients"
import type { EmployeeRecord } from "@/lib/api/employees"
import type { ServiceRecord } from "@/lib/api/services"
import type { TeamRecord } from "@/lib/api/teams"

export interface SchedulingFormData {
  clientId: string
  serviceTypeId: string
  teamIds: string[]
  employeeIds: string[]
  date: string
  time: string
  duration: number
  value: number
  createContract: boolean
  isEmergency: boolean
  notes: string
}

interface EditingSchedule {
  id: string
  contractId?: string | null
  isManual?: boolean
  clientId: string
  serviceTypeId: string
  teamId?: string
  teamIds?: string[]
  teams?: { id: string }[]
  additionalEmployees?: { id: string }[]
  date: string
  time?: string
  duration: number
  isEmergency?: boolean
  notes?: string
}

interface SchedulingFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingSchedule?: EditingSchedule | null
  onSubmit: (formData: SchedulingFormData, isEditing: boolean) => void
  onCancel?: () => void
  clients?: ClientRecord[]
  serviceTypes?: ServiceRecord[]
  teams?: TeamRecord[]
  employees?: EmployeeRecord[]
}

const DEFAULT_FORM_DATA: SchedulingFormData = {
  clientId: "",
  serviceTypeId: "",
  teamIds: [],
  employeeIds: [],
  date: "",
  time: "",
  duration: 60,
  value: 0,
  createContract: false,
  isEmergency: false,
  notes: "",
}

export function SchedulingFormDialog({
  open,
  onOpenChange,
  editingSchedule,
  onSubmit,
  clients = mockClients as unknown as ClientRecord[],
  serviceTypes = mockServiceTypes as unknown as ServiceRecord[],
  teams = mockTeams as unknown as TeamRecord[],
  employees = mockEmployees as unknown as EmployeeRecord[],
}: SchedulingFormDialogProps) {
  const [formData, setFormData] = useState<SchedulingFormData>(DEFAULT_FORM_DATA)

  const [clientPopoverOpen, setClientPopoverOpen] = useState(false)
  const [teamsPopoverOpen, setTeamsPopoverOpen] = useState(false)
  const [employeesPopoverOpen, setEmployeesPopoverOpen] = useState(false)
  const [clientSearchTerm, setClientSearchTerm] = useState("")
  const [teamSearchTerm, setTeamSearchTerm] = useState("")
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("")

  const filteredClients = clients.filter(c =>
    c.companyName.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
    c.cnpj.includes(clientSearchTerm)
  )

  const filteredTeams = teams.filter(t =>
    t.name.toLowerCase().includes(teamSearchTerm.toLowerCase())
  )

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
    e.role.toLowerCase().includes(employeeSearchTerm.toLowerCase())
  )

  const selectedClient = clients.find(c => c.id === formData.clientId)

  const getInitialFormData = (schedule: EditingSchedule): SchedulingFormData => ({
    clientId: schedule.clientId,
    serviceTypeId: schedule.serviceTypeId,
    teamIds: schedule.teamIds ?? schedule.teams?.map((team) => team.id) ?? (schedule.teamId ? [schedule.teamId] : []),
    employeeIds: schedule.additionalEmployees?.map((employee) => employee.id) ?? [],
    date: schedule.date,
    time: schedule.time ?? "",
    duration: schedule.duration,
    value: 0,
    createContract: false,
    isEmergency: schedule.isEmergency ?? false,
    notes: schedule.notes || "",
  })

  useEffect(() => {
    if (!open) return

    if (editingSchedule) {
      setFormData(getInitialFormData(editingSchedule))
      return
    }

    setFormData(DEFAULT_FORM_DATA)
  }, [open, editingSchedule])

  const toggleTeam = (teamId: string) => {
    if (formData.teamIds.includes(teamId)) {
      setFormData({ ...formData, teamIds: formData.teamIds.filter(id => id !== teamId) })
    } else {
      setFormData({ ...formData, teamIds: [...formData.teamIds, teamId] })
    }
  }

  const toggleEmployee = (employeeId: string) => {
    if (formData.employeeIds.includes(employeeId)) {
      setFormData({ ...formData, employeeIds: formData.employeeIds.filter(id => id !== employeeId) })
    } else {
      setFormData({ ...formData, employeeIds: [...formData.employeeIds, employeeId] })
    }
  }

  const resetForm = () => {
    setFormData(DEFAULT_FORM_DATA)
    onOpenChange(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData, !!editingSchedule)
    resetForm()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className="hidden" />
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingSchedule ? "Editar Agendamento" : "Novo Agendamento Manual"}</DialogTitle>
        </DialogHeader>
        <form autoComplete="off" onSubmit={handleSubmit} className="space-y-6">
          {/* Client Selection */}
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  {selectedClient ? selectedClient.companyName : (
                    <span className="text-muted-foreground">Buscar cliente...</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Buscar cliente..."
                    value={clientSearchTerm}
                    onValueChange={setClientSearchTerm}
                  />
                  <CommandList>
                    <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                    <CommandGroup>
                      {filteredClients.map((client) => (
                        <CommandItem
                          key={client.id}
                          value={client.companyName}
                          onSelect={() => {
                            setFormData({ ...formData, clientId: client.id })
                            setClientPopoverOpen(false)
                          }}
                          className="cursor-pointer"
                        >
                          <span>{client.companyName}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Service Type */}
          <div className="space-y-2">
            <Label>Serviço *</Label>
            <Select
              value={formData.serviceTypeId}
              onValueChange={(value) => {
                const serviceType = serviceTypes.find(st => st.id === value)
                setFormData({
                  ...formData,
                  serviceTypeId: value,
                  teamIds: serviceType?.teamIds || [],
                })
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o serviço" />
              </SelectTrigger>
              <SelectContent>
                {serviceTypes.map((st) => (
                  <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Teams */}
          <div className="space-y-2">
            <Label>Equipes</Label>
            <Popover open={teamsPopoverOpen} onOpenChange={setTeamsPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  <span className="text-muted-foreground">Buscar e adicionar equipes...</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Buscar equipe..."
                    value={teamSearchTerm}
                    onValueChange={setTeamSearchTerm}
                  />
                  <CommandList>
                    <CommandEmpty>Nenhuma equipe encontrada.</CommandEmpty>
                    <CommandGroup>
                      {filteredTeams.map((team) => (
                        <CommandItem
                          key={team.id}
                          value={team.name}
                          onSelect={() => toggleTeam(team.id)}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.teamIds.includes(team.id) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span>{team.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {formData.teamIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.teamIds.map(teamId => {
                  const team = teams.find(t => t.id === teamId)
                  return team ? (
                    <Badge
                      key={teamId}
                      variant="secondary"
                      className="px-3 py-1 flex items-center gap-2 text-foreground/80"
                      style={{ backgroundColor: `${team.color}1A` }}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: team.color }}
                      />
                      <span>{team.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-3.5 w-3.5 p-0 hover:bg-transparent"
                        onClick={() => toggleTeam(teamId)}
                      >
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </Badge>
                  ) : null
                })}
              </div>
            )}
          </div>

          {/* Employees */}
          <div className="space-y-2">
            <Label>Funcionários Avulsos</Label>
            <Popover open={employeesPopoverOpen} onOpenChange={setEmployeesPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  <span className="text-muted-foreground">Buscar e adicionar funcionários...</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Buscar funcionário..."
                    value={employeeSearchTerm}
                    onValueChange={setEmployeeSearchTerm}
                  />
                  <CommandList>
                    <CommandEmpty>Nenhum funcionário encontrado.</CommandEmpty>
                    <CommandGroup>
                      {filteredEmployees.map((emp) => (
                        <CommandItem
                          key={emp.id}
                          value={emp.name}
                          onSelect={() => toggleEmployee(emp.id)}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.employeeIds.includes(emp.id) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{emp.name}</span>
                            <span className="text-sm text-muted-foreground">{emp.role}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {formData.employeeIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.employeeIds.map(empId => {
                  const emp = employees.find(e => e.id === empId)
                  return emp ? (
                    <Badge key={empId} variant="outline" className="px-3 py-1 flex items-center gap-2">
                      <span>{emp.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-3.5 w-3.5 p-0 hover:bg-transparent"
                        onClick={() => toggleEmployee(empId)}
                      >
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </Badge>
                  ) : null
                })}
              </div>
            )}
          </div>

          {/* Date, Time, Duration */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Horário *</Label>
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
          </div>

          {/* Value */}
          {!(editingSchedule && editingSchedule.contractId && !editingSchedule.isManual) && (
          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <CurrencyInput
              value={Math.round(formData.value * 100)}
              onChange={(cents) => setFormData({ ...formData, value: cents / 100 })}
            />
          </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Observações sobre o agendamento"
            />
          </div>

          {/* Create Contract Option */}
          {!editingSchedule && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
                <Checkbox
                  id="createContract"
                  checked={formData.createContract}
                  onCheckedChange={(checked) => setFormData({ ...formData, createContract: !!checked })}
                />
                <div className="flex flex-col">
                  <Label htmlFor="createContract" className="text-sm font-medium cursor-pointer">
                    Gerar cobrança no financeiro
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Uma cobrança será criada com o valor informado
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-100 rounded-lg dark:bg-red-950/30 dark:border-red-900/40">
                <Checkbox
                  id="isEmergency"
                  checked={formData.isEmergency}
                  onCheckedChange={(checked) => setFormData({ ...formData, isEmergency: !!checked })}
                />
                <div className="flex flex-col">
                  <Label htmlFor="isEmergency" className="text-sm font-medium cursor-pointer">
                    Agendamento emergencial
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Marca o agendamento como prioritário/emergencial
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={resetForm}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {editingSchedule ? "Salvar" : "Agendar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
