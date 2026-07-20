"use client"

import { useDeferredValue, useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { CurrencyInput } from "@/components/ui/currency-input"
import { SearchableSelect } from "@/components/ui/searchable-select"
import {
  minutesToScheduleDuration,
  SCHEDULE_DURATION_TYPE_OPTIONS,
  type ScheduleDurationType,
} from "@/lib/schedule-duration"
import {
  isEmployeeCoveredBySelectedTeams,
  normalizeTeamEmployeeSelection,
  removeEmployeesCoveredByTeams,
} from "@/lib/team-member-selection"
import type { ClientRecord } from "@/lib/api/clients"
import type { EmployeeRecord } from "@/lib/api/employees"
import type { ServiceRecord } from "@/lib/api/services"
import type { TeamRecord } from "@/lib/api/teams"
import { listTemplates } from "@/lib/api/templates"

type ScheduleManualStatus = "draft" | "scheduled" | "in_progress" | "completed" | "cancelled" | "rescheduled"

export interface SchedulingFormData {
  clientId: string
  serviceTypeId: string
  teamIds: string[]
  employeeIds: string[]
  date: string
  time: string
  durationType: ScheduleDurationType
  duration: number
  informativeTemplateId: string
  certificateTemplateId: string
  autoSendInformative: boolean
  generateCertificateRequest: boolean
  value: number
  createContract: boolean
  isEmergency: boolean
  status: ScheduleManualStatus
  notes: string
}

interface EditingSchedule {
  id: string
  contractId?: string | null
  isManual?: boolean
  clientId: string
  serviceTypeId: string
  informativeTemplateId?: string
  certificateTemplateId?: string
  autoSendInformative?: boolean
  generateCertificateRequest?: boolean
  teamId?: string
  teamIds?: string[]
  teams?: { id: string }[]
  additionalEmployees?: { id: string }[]
  date: string
  time?: string
  duration: number
  durationValue?: number
  durationType?: ScheduleDurationType
  billable?: boolean
  value?: number
  isEmergency?: boolean
  status: ScheduleManualStatus
  notes?: string
}

interface SchedulingFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingSchedule?: EditingSchedule | null
  initialFormData?: Partial<SchedulingFormData> | null
  onSubmit: (formData: SchedulingFormData, isEditing: boolean) => void
  onCancel?: () => void
  clients?: ClientRecord[]
  serviceTypes?: ServiceRecord[]
  teams?: TeamRecord[]
  employees?: EmployeeRecord[]
  canManageStatus?: boolean
  canEditDetails?: boolean
}

const DEFAULT_FORM_DATA: SchedulingFormData = {
  clientId: "",
  serviceTypeId: "",
  teamIds: [],
  employeeIds: [],
  date: "",
  time: "",
  durationType: "hours",
  duration: 1,
  informativeTemplateId: "",
  certificateTemplateId: "",
  autoSendInformative: false,
  generateCertificateRequest: false,
  value: 0,
  createContract: false,
  isEmergency: false,
  status: "scheduled",
  notes: "",
}

const NO_INFORMATIVE_TEMPLATE_VALUE = "__none__"
const NO_CERTIFICATE_TEMPLATE_VALUE = "__none__"
const SCHEDULE_STATUS_OPTIONS: Array<{ value: ScheduleManualStatus; label: string }> = [
  { value: "draft", label: "Rascunho" },
  { value: "scheduled", label: "Agendado" },
  { value: "in_progress", label: "Em andamento" },
  { value: "completed", label: "Concluído" },
  { value: "cancelled", label: "Cancelado" },
  { value: "rescheduled", label: "Reagendado" },
]

export function SchedulingFormDialog({
  open,
  onOpenChange,
  editingSchedule,
  initialFormData,
  onSubmit,
  clients = [],
  serviceTypes = [],
  teams = [],
  employees = [],
  canManageStatus = false,
  canEditDetails = true,
}: SchedulingFormDialogProps) {
  const [formData, setFormData] = useState<SchedulingFormData>(DEFAULT_FORM_DATA)

  const [clientPopoverOpen, setClientPopoverOpen] = useState(false)
  const [teamsPopoverOpen, setTeamsPopoverOpen] = useState(false)
  const [employeesPopoverOpen, setEmployeesPopoverOpen] = useState(false)
  const [clientSearchTerm, setClientSearchTerm] = useState("")
  const [teamSearchTerm, setTeamSearchTerm] = useState("")
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("")
  const deferredClientSearchTerm = useDeferredValue(clientSearchTerm)
  const deferredTeamSearchTerm = useDeferredValue(teamSearchTerm)
  const deferredEmployeeSearchTerm = useDeferredValue(employeeSearchTerm)

  const informativeTemplatesQuery = useQuery({
    queryKey: ["templates", "schedule-form", "informative"],
    queryFn: () => listTemplates("", "informative"),
    enabled: open,
  })
  const certificateTemplatesQuery = useQuery({
    queryKey: ["templates", "schedule-form", "certificate"],
    queryFn: () => listTemplates("", "certificate"),
    enabled: open,
  })

  const filteredClients = useMemo(() => {
    const term = deferredClientSearchTerm.trim().toLowerCase()
    if (!term) return clients
    return clients.filter(c =>
      c.companyName.toLowerCase().includes(term) ||
      c.cnpj.includes(term)
    )
  }, [clients, deferredClientSearchTerm])

  const filteredTeams = useMemo(() => {
    const term = deferredTeamSearchTerm.trim().toLowerCase()
    if (!term) return teams
    return teams.filter(t => t.name.toLowerCase().includes(term))
  }, [teams, deferredTeamSearchTerm])

  const filteredEmployees = useMemo(() => {
    const term = deferredEmployeeSearchTerm.trim().toLowerCase()
    const availableEmployees = employees.filter((employee) =>
      !isEmployeeCoveredBySelectedTeams(employee.id, formData.teamIds, teams),
    )
    if (!term) return availableEmployees
    return availableEmployees.filter(e =>
      e.name.toLowerCase().includes(term) ||
      e.role.toLowerCase().includes(term)
    )
  }, [employees, deferredEmployeeSearchTerm, formData.teamIds, teams])

  const clientById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients])
  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams])
  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees])
  const serviceOptions = useMemo(() => serviceTypes.map((st) => ({ value: st.id, label: st.name })), [serviceTypes])
  const activeInformativeTemplates = useMemo(
    () => (informativeTemplatesQuery.data?.data ?? []).filter((template) => template.isActive && template.format === "docx"),
    [informativeTemplatesQuery.data?.data],
  )
  const activeCertificateTemplates = useMemo(
    () => (certificateTemplatesQuery.data?.data ?? []).filter((template) => template.isActive && template.format === "docx"),
    [certificateTemplatesQuery.data?.data],
  )
  const selectedClient = clientById.get(formData.clientId)
  const isEditing = Boolean(editingSchedule)
  const isRecurringSchedule = Boolean(editingSchedule?.contractId && !editingSchedule?.isManual)
  const scheduleTypeLabel = isRecurringSchedule ? "Atendimento recorrente" : "Atendimento avulso"
  const dialogTitle = isEditing
    ? `Editar ${isRecurringSchedule ? "atendimento recorrente" : "atendimento avulso"}`
    : "Novo atendimento avulso"

  const getInitialFormData = (schedule: EditingSchedule): SchedulingFormData => {
    const serviceType = serviceTypes.find((item) => item.id === schedule.serviceTypeId)
    let durationFields = minutesToScheduleDuration(schedule.duration, serviceType)
    const configuredDuration = Number(schedule.durationValue)

    if (schedule.durationType && Number.isFinite(configuredDuration) && configuredDuration >= 1) {
      durationFields = {
        durationType: schedule.durationType,
        duration: configuredDuration,
      }
    }

    const selection = normalizeTeamEmployeeSelection({
      teamIds: schedule.teamIds ?? schedule.teams?.map((team) => team.id) ?? (schedule.teamId ? [schedule.teamId] : []),
      employeeIds: schedule.additionalEmployees?.map((employee) => employee.id) ?? [],
      teams,
    })

    return {
      clientId: schedule.clientId,
      serviceTypeId: schedule.serviceTypeId,
      teamIds: selection.teamIds,
      employeeIds: selection.employeeIds,
      date: schedule.date,
      time: schedule.time ?? "",
      durationType: durationFields.durationType,
      duration: durationFields.duration,
      informativeTemplateId: schedule.informativeTemplateId ?? "",
      certificateTemplateId: schedule.certificateTemplateId ?? "",
      autoSendInformative: Boolean(schedule.informativeTemplateId) || schedule.autoSendInformative === true,
      generateCertificateRequest: Boolean(schedule.certificateTemplateId) || schedule.generateCertificateRequest === true,
      value: schedule.billable ? Number(schedule.value ?? 0) : 0,
      createContract: Boolean(schedule.billable),
      isEmergency: schedule.isEmergency ?? false,
      status: schedule.status,
      notes: schedule.notes || "",
    }
  }

  useEffect(() => {
    if (!open) return

    if (editingSchedule) {
      setFormData(getInitialFormData(editingSchedule))
      return
    }

    setFormData({ ...DEFAULT_FORM_DATA, ...(initialFormData ?? {}) })
  }, [open, editingSchedule, initialFormData, serviceTypes, teams])

  const toggleTeam = (teamId: string) => {
    const teamIds = formData.teamIds.includes(teamId)
      ? formData.teamIds.filter(id => id !== teamId)
      : [...formData.teamIds, teamId]
    setFormData({
      ...formData,
      teamIds,
      employeeIds: removeEmployeesCoveredByTeams(formData.employeeIds, teamIds, teams),
    })
  }

  const toggleEmployee = (employeeId: string) => {
    if (!formData.employeeIds.includes(employeeId) && isEmployeeCoveredBySelectedTeams(employeeId, formData.teamIds, teams)) {
      return
    }

    if (formData.employeeIds.includes(employeeId)) {
      setFormData({ ...formData, employeeIds: formData.employeeIds.filter(id => id !== employeeId) })
    } else {
      setFormData({ ...formData, employeeIds: [...formData.employeeIds, employeeId] })
    }
  }

  const resetForm = () => {
    onOpenChange(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      informativeTemplateId: formData.autoSendInformative ? formData.informativeTemplateId : "",
      certificateTemplateId: formData.generateCertificateRequest ? formData.certificateTemplateId : "",
    }, !!editingSchedule)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className="hidden" />
      <DialogContent className="flex max-h-[90dvh] max-w-2xl flex-col gap-0 overflow-hidden p-0 max-sm:left-0 max-sm:top-4 max-sm:h-[calc(100dvh-2rem)] max-sm:max-h-none max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0">
        <DialogHeader className="shrink-0 px-6 pb-3 pt-6 pr-12 text-left sm:text-left">
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <form id="schedule-form" autoComplete="off" onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <div className="flex flex-col items-center gap-2 text-center">
            <Badge variant={isRecurringSchedule ? "secondary" : "outline"} className="w-fit justify-center">
              {scheduleTypeLabel}
            </Badge>
            {isRecurringSchedule ? (
              <p className="max-w-md text-sm text-muted-foreground">
                Data, horário, duração, observações, equipes e funcionários avulsos podem ser alterados neste atendimento.
              </p>
            ) : null}
          </div>

          {isEditing && canManageStatus ? (
            <div className="space-y-2">
              <Label>Status manual</Label>
              <Select
                value={formData.status}
                onValueChange={(status) => setFormData({ ...formData, status: status as ScheduleManualStatus })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <fieldset disabled={!canEditDetails} className="m-0 grid min-w-0 gap-5 border-0 p-0">
          {/* Client Selection */}
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <Popover
              open={isRecurringSchedule ? false : clientPopoverOpen}
              onOpenChange={isRecurringSchedule ? undefined : setClientPopoverOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  disabled={isRecurringSchedule}
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
            <SearchableSelect
              value={formData.serviceTypeId}
              onValueChange={(value) => {
                const serviceType = serviceTypes.find(st => st.id === value)
                const selection = normalizeTeamEmployeeSelection({
                  teamIds: serviceType?.teamIds || [],
                  employeeIds: serviceType?.employeeIds || [],
                  teams,
                })
                const autoSendInformative = serviceType?.autoSendInformative === true
                const generateCertificateRequest = serviceType?.generateCertificateRequest === true
                const informativeTemplateId = autoSendInformative ? serviceType?.defaultInformativeTemplateId ?? "" : ""
                const certificateTemplateId = generateCertificateRequest ? serviceType?.defaultCertificateTemplateId ?? "" : ""
                setFormData({
                  ...formData,
                  serviceTypeId: value,
                  teamIds: selection.teamIds,
                  employeeIds: selection.employeeIds,
                  durationType: serviceType?.durationType ?? formData.durationType,
                  duration: serviceType?.defaultDuration ?? formData.duration,
                  informativeTemplateId,
                  certificateTemplateId,
                  autoSendInformative,
                  generateCertificateRequest,
                  value: formData.createContract ? serviceType?.baseValue ?? formData.value : 0,
                })
              }}
              options={serviceOptions}
              placeholder="Selecione o serviço"
              searchPlaceholder="Buscar serviço..."
              emptyMessage="Nenhum serviço encontrado."
              includeAll={false}
              className="w-full"
              disabled={isRecurringSchedule}
            />
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
                  const team = teamById.get(teamId)
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
                        className="h-4 w-4 shrink-0 rounded-full p-0 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                        onClick={() => toggleTeam(teamId)}
                      >
                        <X className="h-3 w-3" />
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
                  const emp = employeeById.get(empId)
                  return emp ? (
                    <Badge key={empId} variant="outline" className="px-3 py-1 flex items-center gap-2">
                      <span>{emp.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 shrink-0 rounded-full p-0 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                        onClick={() => toggleEmployee(empId)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ) : null
                })}
              </div>
            )}
          </div>

          {/* Date, Time, Duration */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de Duração</Label>
              <Select
                value={formData.durationType}
                onValueChange={(value) => setFormData({ ...formData, durationType: value as ScheduleDurationType })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_DURATION_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Duração</Label>
              <Input
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                min={1}
                className="w-full"
              />
            </div>
          </div>

          {/* Value */}
          {!(editingSchedule && editingSchedule.contractId && !editingSchedule.isManual) && (
          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <CurrencyInput
              value={formData.createContract ? Math.round(formData.value * 100) : 0}
              onChange={(cents) => setFormData({ ...formData, value: cents / 100 })}
              disabled={!formData.createContract}
              className={!formData.createContract ? "cursor-not-allowed opacity-60" : undefined}
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
          {!(editingSchedule && editingSchedule.contractId && !editingSchedule.isManual) && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
                <Checkbox
                  id="createContract"
                  checked={formData.createContract}
                  onCheckedChange={(checked) => {
                    const serviceType = serviceTypes.find((item) => item.id === formData.serviceTypeId)
                    setFormData({
                      ...formData,
                      createContract: !!checked,
                      value: checked ? formData.value || serviceType?.baseValue || 0 : 0,
                    })
                  }}
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

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              value={formData.informativeTemplateId || NO_INFORMATIVE_TEMPLATE_VALUE}
              onValueChange={(value) => {
                const informativeTemplateId = value === NO_INFORMATIVE_TEMPLATE_VALUE ? "" : value
                setFormData({
                  ...formData,
                  informativeTemplateId,
                  autoSendInformative: Boolean(informativeTemplateId),
                })
              }}
              disabled={activeInformativeTemplates.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sem informativo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_INFORMATIVE_TEMPLATE_VALUE}>Sem informativo</SelectItem>
                {activeInformativeTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={formData.certificateTemplateId || NO_CERTIFICATE_TEMPLATE_VALUE}
              onValueChange={(value) => {
                const certificateTemplateId = value === NO_CERTIFICATE_TEMPLATE_VALUE ? "" : value
                setFormData({
                  ...formData,
                  certificateTemplateId,
                  generateCertificateRequest: Boolean(certificateTemplateId),
                })
              }}
              disabled={activeCertificateTemplates.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sem certificado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CERTIFICATE_TEMPLATE_VALUE}>Sem certificado</SelectItem>
                {activeCertificateTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          </fieldset>

        </form>
        <DialogFooter className="shrink-0 px-6 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
          <Button type="button" variant="outline" onClick={resetForm}>
            Cancelar
          </Button>
          <Button type="submit" form="schedule-form" className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {editingSchedule ? "Salvar" : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
