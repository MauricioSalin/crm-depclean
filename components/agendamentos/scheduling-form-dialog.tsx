"use client"

import { useDeferredValue, useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { NumericInput } from "@/components/ui/numeric-input"
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
import type { ScheduleDocumentSetting } from "@/lib/api/schedules"
import { listTemplates } from "@/lib/api/templates"
import { toast } from "sonner"
import { parseCivilDate, toCivilDateKey } from "@/lib/date-utils"

type ScheduleManualStatus = "draft" | "scheduled" | "in_progress" | "completed" | "cancelled" | "rescheduled"

function isValidDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

export interface SchedulingFormData {
  clientId: string
  serviceTypeId: string
  serviceTypeIds: string[]
  serviceDocumentSettings: ScheduleDocumentSetting[]
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
  serviceTypeIds?: string[]
  serviceDocumentSettings?: ScheduleDocumentSetting[]
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
  serviceTypeIds: [],
  serviceDocumentSettings: [],
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
  const [servicesPopoverOpen, setServicesPopoverOpen] = useState(false)
  const [teamsPopoverOpen, setTeamsPopoverOpen] = useState(false)
  const [employeesPopoverOpen, setEmployeesPopoverOpen] = useState(false)
  const [clientSearchTerm, setClientSearchTerm] = useState("")
  const [serviceSearchTerm, setServiceSearchTerm] = useState("")
  const [teamSearchTerm, setTeamSearchTerm] = useState("")
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("")
  const deferredClientSearchTerm = useDeferredValue(clientSearchTerm)
  const deferredServiceSearchTerm = useDeferredValue(serviceSearchTerm)
  const deferredTeamSearchTerm = useDeferredValue(teamSearchTerm)
  const deferredEmployeeSearchTerm = useDeferredValue(employeeSearchTerm)

  const informativeTemplatesQuery = useQuery({
    queryKey: ["templates", "schedule-form", "informative"],
    queryFn: () => listTemplates("", "informative"),
    staleTime: 60_000,
  })
  const certificateTemplatesQuery = useQuery({
    queryKey: ["templates", "schedule-form", "certificate"],
    queryFn: () => listTemplates("", "certificate"),
    staleTime: 60_000,
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

  const filteredServices = useMemo(() => {
    const term = deferredServiceSearchTerm.trim().toLowerCase()
    if (!term) return serviceTypes
    return serviceTypes.filter((service) =>
      service.name.toLowerCase().includes(term) ||
      service.description.toLowerCase().includes(term),
    )
  }, [deferredServiceSearchTerm, serviceTypes])

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
  const serviceById = useMemo(() => new Map(serviceTypes.map((service) => [service.id, service])), [serviceTypes])
  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams])
  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees])
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
    const serviceTypeIds = schedule.serviceTypeIds?.length
      ? [...new Set(schedule.serviceTypeIds)]
      : [schedule.serviceTypeId].filter(Boolean)
    const serviceType = serviceTypes.find((item) => item.id === serviceTypeIds[0])
    const existingSettings = new Map(
      (schedule.serviceDocumentSettings ?? []).map((setting) => [setting.serviceTypeId, setting] as const),
    )
    const serviceDocumentSettings = serviceTypeIds.map((serviceTypeId, index) => {
      const setting = existingSettings.get(serviceTypeId)
      return {
        serviceTypeId,
        informativeTemplateId: setting?.informativeTemplateId
          ?? (index === 0 ? schedule.informativeTemplateId ?? "" : ""),
        certificateTemplateId: setting?.certificateTemplateId
          ?? (index === 0 ? schedule.certificateTemplateId ?? "" : ""),
      }
    })
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
      serviceTypeId: serviceTypeIds[0] ?? "",
      serviceTypeIds,
      serviceDocumentSettings,
      teamIds: selection.teamIds,
      employeeIds: selection.employeeIds,
      date: schedule.date,
      time: schedule.time ?? "",
      durationType: durationFields.durationType,
      duration: durationFields.duration,
      informativeTemplateId: serviceDocumentSettings[0]?.informativeTemplateId ?? "",
      certificateTemplateId: serviceDocumentSettings[0]?.certificateTemplateId ?? "",
      autoSendInformative: serviceDocumentSettings.some((setting) => Boolean(setting.informativeTemplateId)),
      generateCertificateRequest: serviceDocumentSettings.some((setting) => Boolean(setting.certificateTemplateId)),
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

    const initial = { ...DEFAULT_FORM_DATA, ...(initialFormData ?? {}) }
    const serviceTypeIds = initial.serviceTypeIds?.length
      ? initial.serviceTypeIds
      : [initial.serviceTypeId].filter(Boolean)
    const serviceDocumentSettings = initial.serviceDocumentSettings?.length
      ? initial.serviceDocumentSettings
      : serviceTypeIds.map((serviceTypeId, index) => ({
          serviceTypeId,
          informativeTemplateId: index === 0 ? initial.informativeTemplateId : "",
          certificateTemplateId: index === 0 ? initial.certificateTemplateId : "",
        }))
    setFormData({
      ...initial,
      serviceTypeId: serviceTypeIds[0] ?? "",
      serviceTypeIds,
      serviceDocumentSettings,
    })
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

  const toggleService = (serviceTypeId: string) => {
    setFormData((current) => {
      const isSelected = current.serviceTypeIds.includes(serviceTypeId)
      const serviceTypeIds = isSelected
        ? current.serviceTypeIds.filter((id) => id !== serviceTypeId)
        : [...current.serviceTypeIds, serviceTypeId]
      const selectedService = serviceById.get(serviceTypeId)
      const serviceDocumentSettings = isSelected
        ? current.serviceDocumentSettings.filter((setting) => setting.serviceTypeId !== serviceTypeId)
        : [
            ...current.serviceDocumentSettings,
            {
              serviceTypeId,
              informativeTemplateId: selectedService?.defaultInformativeTemplateId ?? "",
              certificateTemplateId: selectedService?.defaultCertificateTemplateId ?? "",
            },
          ]
      const primarySetting = serviceDocumentSettings.find((setting) => setting.serviceTypeId === serviceTypeIds[0])
      const isFirstService = !isSelected && current.serviceTypeIds.length === 0

      if (!isFirstService) {
        return {
          ...current,
          serviceTypeId: serviceTypeIds[0] ?? "",
          serviceTypeIds,
          serviceDocumentSettings,
          informativeTemplateId: primarySetting?.informativeTemplateId ?? "",
          certificateTemplateId: primarySetting?.certificateTemplateId ?? "",
          autoSendInformative: serviceDocumentSettings.some((setting) => Boolean(setting.informativeTemplateId)),
          generateCertificateRequest: serviceDocumentSettings.some((setting) => Boolean(setting.certificateTemplateId)),
        }
      }

      const selection = normalizeTeamEmployeeSelection({
        teamIds: selectedService?.teamIds || [],
        employeeIds: selectedService?.employeeIds || [],
        teams,
      })
      return {
        ...current,
        serviceTypeId,
        serviceTypeIds,
        serviceDocumentSettings,
        teamIds: selection.teamIds,
        employeeIds: selection.employeeIds,
        durationType: selectedService?.durationType ?? current.durationType,
        duration: selectedService?.defaultDuration ?? current.duration,
        informativeTemplateId: primarySetting?.informativeTemplateId ?? "",
        certificateTemplateId: primarySetting?.certificateTemplateId ?? "",
        autoSendInformative: serviceDocumentSettings.some((setting) => Boolean(setting.informativeTemplateId)),
        generateCertificateRequest: serviceDocumentSettings.some((setting) => Boolean(setting.certificateTemplateId)),
        value: current.createContract ? selectedService?.baseValue ?? current.value : 0,
      }
    })
  }

  const updateDocumentSetting = (
    serviceTypeId: string,
    field: "informativeTemplateId" | "certificateTemplateId",
    value: string,
  ) => {
    setFormData((current) => {
      const serviceDocumentSettings = current.serviceDocumentSettings.map((setting) =>
        setting.serviceTypeId === serviceTypeId ? { ...setting, [field]: value } : setting,
      )
      const primarySetting = serviceDocumentSettings.find((setting) => setting.serviceTypeId === current.serviceTypeIds[0])
      return {
        ...current,
        serviceDocumentSettings,
        informativeTemplateId: primarySetting?.informativeTemplateId ?? "",
        certificateTemplateId: primarySetting?.certificateTemplateId ?? "",
        autoSendInformative: serviceDocumentSettings.some((setting) => Boolean(setting.informativeTemplateId)),
        generateCertificateRequest: serviceDocumentSettings.some((setting) => Boolean(setting.certificateTemplateId)),
      }
    })
  }

  const resetForm = () => {
    onOpenChange(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.clientId || !clientById.has(formData.clientId)) {
      toast.error("Selecione um cliente válido para o agendamento.")
      return
    }
    if (
      formData.serviceTypeIds.length === 0 ||
      formData.serviceTypeIds.some((serviceTypeId) => !serviceById.has(serviceTypeId))
    ) {
      toast.error("Selecione ao menos um serviço válido para o agendamento.")
      return
    }
    if (!isValidDateKey(formData.date)) {
      toast.error("Informe uma data válida para o agendamento.")
      return
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(formData.time)) {
      toast.error("Informe um horário válido entre 00:00 e 23:59.")
      return
    }
    if (!Number.isFinite(formData.duration) || formData.duration <= 0) {
      toast.error("Informe uma duração maior que zero para o agendamento.")
      return
    }
    if (formData.createContract && (!Number.isFinite(formData.value) || formData.value <= 0)) {
      toast.error("Informe um valor maior que zero para gerar a cobrança no financeiro.")
      return
    }

    const serviceDocumentSettings = formData.serviceTypeIds.map((serviceTypeId) => {
      const setting = formData.serviceDocumentSettings.find((item) => item.serviceTypeId === serviceTypeId)
      return {
        serviceTypeId,
        informativeTemplateId: setting?.informativeTemplateId ?? "",
        certificateTemplateId: setting?.certificateTemplateId ?? "",
      }
    })
    const primarySetting = serviceDocumentSettings[0]

    onSubmit({
      ...formData,
      serviceTypeId: formData.serviceTypeIds[0],
      serviceDocumentSettings,
      informativeTemplateId: primarySetting?.informativeTemplateId ?? "",
      certificateTemplateId: primarySetting?.certificateTemplateId ?? "",
      autoSendInformative: serviceDocumentSettings.some((setting) => Boolean(setting.informativeTemplateId)),
      generateCertificateRequest: serviceDocumentSettings.some((setting) => Boolean(setting.certificateTemplateId)),
    }, !!editingSchedule)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className="hidden" />
      <DialogContent className="flex min-w-0 max-h-[90dvh] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl max-sm:left-0 max-sm:top-4 max-sm:h-[calc(100dvh-2rem)] max-sm:max-h-none max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0">
        <DialogHeader className="shrink-0 px-6 pb-3 pt-6 pr-12 text-left sm:text-left">
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <form id="schedule-form" autoComplete="off" noValidate onSubmit={handleSubmit} className="min-h-0 min-w-0 w-full max-w-full flex-1 space-y-6 overflow-y-auto overflow-x-hidden px-6 py-5">
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

          <fieldset disabled={!canEditDetails} className="m-0 grid min-w-0 w-full max-w-full gap-5 border-0 p-0">
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
            <Label>Serviços *</Label>
            <Popover open={servicesPopoverOpen} onOpenChange={setServicesPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  <span className="text-muted-foreground">Buscar e adicionar serviços...</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Buscar serviço..."
                    value={serviceSearchTerm}
                    onValueChange={setServiceSearchTerm}
                  />
                  <CommandList>
                    <CommandEmpty>Nenhum serviço encontrado.</CommandEmpty>
                    <CommandGroup>
                      {filteredServices.map((service) => {
                        const selected = formData.serviceTypeIds.includes(service.id)
                        return (
                          <CommandItem
                            key={service.id}
                            value={service.id}
                            onSelect={() => toggleService(service.id)}
                            className="cursor-pointer"
                          >
                            <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                            {service.name}
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {formData.serviceTypeIds.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {formData.serviceTypeIds.map((serviceTypeId) => (
                  <Badge key={serviceTypeId} variant="secondary" className="gap-1 pr-1">
                    {serviceById.get(serviceTypeId)?.name ?? serviceTypeId}
                    <button
                      type="button"
                      onClick={() => toggleService(serviceTypeId)}
                      className="rounded-sm p-0.5 hover:bg-muted-foreground/10"
                      aria-label={`Remover ${serviceById.get(serviceTypeId)?.name ?? "serviço"}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : null}
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
                          <span
                            className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: team.color }}
                            aria-hidden="true"
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
          <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-3">
              <Label>Data *</Label>
              <DatePicker
                value={parseCivilDate(formData.date)}
                onChange={(date) => setFormData((current) => ({
                  ...current,
                  date: date ? toCivilDateKey(date) : "",
                }))}
                placeholder="Selecionar data"
                disabledDates={isEditing ? undefined : { dayOfWeek: [0, 6] }}
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

          <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
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
              <NumericInput
                allowDecimal
                value={formData.duration}
                onValueChange={(duration) => setFormData({ ...formData, duration })}
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

              <div className="flex items-center space-x-2 rounded-lg border border-amber-100 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
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

          <div className="space-y-2">
            <Label>Documentos por serviço</Label>
            <div className="w-0 min-w-full max-w-full overflow-x-auto overscroll-x-contain rounded-lg">
              <div className="min-w-[680px]">
                <div className="grid grid-cols-[minmax(180px,1fr)_minmax(220px,1fr)_minmax(220px,1fr)] gap-3 bg-muted/70 px-4 py-3 text-sm font-medium">
                  <span>Serviço</span>
                  <span>Informativo</span>
                  <span>Certificado</span>
                </div>
                {formData.serviceTypeIds.map((serviceTypeId) => {
                  const service = serviceById.get(serviceTypeId)
                  const setting = formData.serviceDocumentSettings.find(
                    (item) => item.serviceTypeId === serviceTypeId,
                  )

                  return (
                    <div
                      key={serviceTypeId}
                      className="grid grid-cols-[minmax(180px,1fr)_minmax(220px,1fr)_minmax(220px,1fr)] items-center gap-3 border-t px-4 py-3"
                    >
                      <span className="text-sm font-medium">{service?.name || "Serviço"}</span>
                      <SearchableSelect
                        value={setting?.informativeTemplateId || NO_INFORMATIVE_TEMPLATE_VALUE}
                        onValueChange={(value) => updateDocumentSetting(
                          serviceTypeId,
                          "informativeTemplateId",
                          value === NO_INFORMATIVE_TEMPLATE_VALUE ? "" : value,
                        )}
                        options={[
                          { value: NO_INFORMATIVE_TEMPLATE_VALUE, label: "Sem informativo" },
                          ...activeInformativeTemplates.map((template) => ({
                            value: template.id,
                            label: template.name,
                          })),
                        ]}
                        placeholder="Sem informativo"
                        searchPlaceholder="Buscar informativo..."
                        emptyMessage="Nenhum informativo encontrado."
                        includeAll={false}
                        className="w-full"
                      />
                      <SearchableSelect
                        value={setting?.certificateTemplateId || NO_CERTIFICATE_TEMPLATE_VALUE}
                        onValueChange={(value) => updateDocumentSetting(
                          serviceTypeId,
                          "certificateTemplateId",
                          value === NO_CERTIFICATE_TEMPLATE_VALUE ? "" : value,
                        )}
                        options={[
                          { value: NO_CERTIFICATE_TEMPLATE_VALUE, label: "Sem certificado" },
                          ...activeCertificateTemplates.map((template) => ({
                            value: template.id,
                            label: template.name,
                          })),
                        ]}
                        placeholder="Sem certificado"
                        searchPlaceholder="Buscar certificado..."
                        emptyMessage="Nenhum certificado encontrado."
                        includeAll={false}
                        className="w-full"
                      />
                    </div>
                  )
                })}
                {formData.serviceTypeIds.length === 0 && (
                  <p className="border-t px-4 py-5 text-center text-sm text-muted-foreground">
                    Selecione ao menos um serviço para configurar os documentos.
                  </p>
                )}
              </div>
            </div>
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
