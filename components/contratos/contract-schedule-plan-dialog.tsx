"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarClock, Clock3, Download, Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { NumericInput } from "@/components/ui/numeric-input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { MultiSelect } from "@/components/ui/multi-select"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  exportContractSchedulePlan,
  getContractSchedulePlan,
  saveContractSchedulePlan,
  type ContractRecord,
} from "@/lib/api/contracts"
import { getApiErrorMessage } from "@/lib/api/errors"
import type { EmployeeRecord } from "@/lib/api/employees"
import type { ScheduleRecord } from "@/lib/api/schedules"
import type { ServiceRecord } from "@/lib/api/services"
import type { TeamRecord } from "@/lib/api/teams"
import { parseCivilDate, toCivilDateKey } from "@/lib/date-utils"
import {
  checkScheduleAvailability,
  formatDailyServiceCapacityViolation,
  getAvailableRescheduleTimes,
  getDailyServiceCapacityViolation,
  getScheduleConflictResourceNames,
} from "@/lib/schedule-availability"
import { removeEmployeesCoveredByTeams } from "@/lib/team-member-selection"
import { formatConfiguredScheduleDuration, normalizeAutomatedScheduleDuration } from "@/lib/schedule-duration"
import { formatContractNumber, getColorFromClass } from "@/lib/utils"

type ContractSchedulePlanDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contract: ContractRecord
  schedules: ScheduleRecord[]
  serviceTypes: ServiceRecord[]
  teams: TeamRecord[]
  employees: EmployeeRecord[]
}

const WORKDAY_DURATION_MINUTES = 8 * 60
const SHIFT_DURATION_MINUTES = 4 * 60
const ADDED_PLAN_ITEM_PREFIX = "sched-added-"
const ROUTINE_VISIT_SERVICE_ID = "srv-visita-de-rotina"

const durationToMinutes = (value: number, type: "minutes" | "hours" | "shift" | "days") => {
  if (type === "minutes") return value
  if (type === "days") return value * WORKDAY_DURATION_MINUTES
  if (type === "shift") return value * SHIFT_DURATION_MINUTES
  return value * 60
}

const cloneItems = (items: ScheduleRecord[]) => items.map((item) => {
  const normalizedDuration = normalizeAutomatedScheduleDuration(item.duration)

  return {
    ...item,
    duration: normalizedDuration.durationMinutes,
    durationValue: normalizedDuration.durationValue,
    durationType: normalizedDuration.durationType,
    teams: [...item.teams],
    additionalEmployees: [...item.additionalEmployees],
    serviceTypeIds: [...item.serviceTypeIds],
    contractServiceIds: [...item.contractServiceIds],
    serviceItems: [...(item.serviceItems ?? [])],
  }
})

const isWeekendDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return weekday === 0 || weekday === 6
}

const toPayload = (items: ScheduleRecord[]) => ({
  items: items.map((item) => ({
    id: item.id,
    contractServiceId: item.contractServiceId ?? "",
    contractServiceIds: item.contractServiceIds,
    date: item.date,
    time: item.time,
    durationValue: Number(item.durationValue ?? 1),
    durationType: item.durationType ?? "hours",
    teamIds: item.teams.map((team) => team.id),
    additionalEmployeeIds: item.additionalEmployees.map((employee) => employee.id),
  })),
})

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function ContractSchedulePlanDialog({
  open,
  onOpenChange,
  contract,
  schedules,
  serviceTypes,
  teams,
  employees,
}: ContractSchedulePlanDialogProps) {
  const queryClient = useQueryClient()
  const [items, setItems] = useState<ScheduleRecord[]>([])
  const [generatedItems, setGeneratedItems] = useState<ScheduleRecord[]>([])
  const [editingAssigneeId, setEditingAssigneeId] = useState<string | null>(null)
  const [editingServicesId, setEditingServicesId] = useState<string | null>(null)

  const planQuery = useQuery({
    queryKey: ["contract-schedule-plan", contract.id],
    queryFn: () => getContractSchedulePlan(contract.id),
    enabled: open,
    staleTime: 0,
  })

  useEffect(() => {
    if (!open || !planQuery.data?.data.items) return
    setItems(cloneItems(planQuery.data.data.items))
    setGeneratedItems(cloneItems(planQuery.data.data.generatedItems))
  }, [open, planQuery.data])

  const actualSchedules = useMemo(
    () => schedules.filter((item) => item.contractId !== contract.id),
    [contract.id, schedules],
  )
  const availabilitySchedules = useMemo(
    () => [...actualSchedules, ...items],
    [actualSchedules, items],
  )
  const serviceTypeMap = useMemo(
    () => new Map(serviceTypes.map((service) => [service.id, service])),
    [serviceTypes],
  )
  const teamMap = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams])
  const employeeMap = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees])
  const contractServiceOptions = useMemo(
    () => contract.services
      .filter((service) => service.isActive !== false)
      .map((contractService) => ({
        contractService,
        serviceType: serviceTypeMap.get(contractService.serviceTypeId),
      }))
      .filter((option) => Boolean(option.serviceType)),
    [contract.services, serviceTypeMap],
  )
  const todayDateKey = toCivilDateKey(new Date())
  const planEndDate = planQuery.data?.data.endDate ?? ""
  const dateAvailabilityCache = useMemo(
    () => new WeakMap<ScheduleRecord, Map<string, { blockReason?: string; availableTimes: string[] }>>(),
    [availabilitySchedules, planEndDate, serviceTypes, teams, todayDateKey],
  )
  const editingAssignee = items.find((item) => item.id === editingAssigneeId) ?? null
  const editingServices = items.find((item) => item.id === editingServicesId) ?? null
  const editingTeamIds = editingAssignee?.teams.map((team) => team.id) ?? []
  const editingEmployeeIds = editingAssignee?.additionalEmployees.map((employee) => employee.id) ?? []
  const availableEmployeeOptions = employees
    .filter((employee) => !teams
      .filter((team) => editingTeamIds.includes(team.id))
      .some((team) => team.memberIds.includes(employee.id)))
    .map((employee) => ({ id: employee.id, name: employee.name, subtitle: employee.role }))

  const updateItem = (id: string, changes: Partial<ScheduleRecord>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item))
  }

  const canApplyAssignment = (item: ScheduleRecord, teamIds: string[], employeeIds: string[]) => {
    const availability = checkScheduleAvailability({
      schedules: availabilitySchedules,
      teams,
      ignoreScheduleId: item.id,
      formData: {
        teamIds,
        employeeIds,
        date: item.date,
        time: item.time,
        duration: Number(item.durationValue ?? 1),
        durationType: item.durationType ?? "hours",
      },
      mode: "automation",
    })
    if (availability.available || availability.conflict?.reason !== "resource") return true

    const resources = getScheduleConflictResourceNames(availability.conflict, { teams, employees })
    toast.error(
      teamIds.length > 0
        ? "A equipe ou algum funcionário da equipe não tem disponibilidade para este agendamento."
        : "O funcionário selecionado não tem disponibilidade para este agendamento.",
      { description: resources.length > 0 ? resources.join(", ") : undefined },
    )
    return false
  }

  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }

  const updateItemTeams = (teamIds: string[]) => {
    if (!editingAssignee) return
    const additionalEmployeeIds = removeEmployeesCoveredByTeams(editingEmployeeIds, teamIds, teams)
    if (!canApplyAssignment(editingAssignee, teamIds, additionalEmployeeIds)) return
    updateItem(editingAssignee.id, {
      teams: teamIds.map((teamId) => teamMap.get(teamId)).filter((team): team is TeamRecord => Boolean(team)),
      additionalEmployees: additionalEmployeeIds
        .map((employeeId) => employeeMap.get(employeeId))
        .filter((employee): employee is EmployeeRecord => Boolean(employee))
        .map((employee) => ({ id: employee.id, name: employee.name })),
    })
  }

  const updateItemEmployees = (employeeIds: string[]) => {
    if (!editingAssignee) return
    if (!canApplyAssignment(editingAssignee, editingTeamIds, employeeIds)) return
    updateItem(editingAssignee.id, {
      additionalEmployees: employeeIds
        .map((employeeId) => employeeMap.get(employeeId))
        .filter((employee): employee is EmployeeRecord => Boolean(employee))
        .map((employee) => ({ id: employee.id, name: employee.name })),
    })
  }

  const getServiceTemplate = (contractServiceId: string, unitId?: string) => {
    const candidates = [...generatedItems, ...items].filter(
      (item) => item.contractServiceId === contractServiceId || item.contractServiceIds.includes(contractServiceId),
    )
    return candidates.find((item) => item.unitId === unitId) ?? candidates[0]
  }

  const getDailyCapacityViolation = (item: ScheduleRecord, date: string) =>
    getDailyServiceCapacityViolation({
      schedules: availabilitySchedules,
      ignoreScheduleId: item.id,
      serviceTypeIds: item.serviceTypeIds?.length ? item.serviceTypeIds : [item.serviceTypeId],
      serviceTypes,
      date,
      time: item.time || "08:00",
      durationMinutes: durationToMinutes(Number(item.durationValue ?? 1), item.durationType ?? "hours"),
      durationType: item.durationType,
      serviceItems: item.serviceItems,
      mode: "automation",
    })

  const getDateBlockReason = (item: ScheduleRecord, date: string) => {
    if (isWeekendDateKey(date)) return "Fim de semana"
    if (date < todayDateKey) return "Data anterior a hoje"
    if (planEndDate && date >= planEndDate) return "Fora da vigência do contrato"
    const capacityViolation = getDailyCapacityViolation(item, date)
    if (capacityViolation) return formatDailyServiceCapacityViolation(capacityViolation, serviceTypes)
    return undefined
  }

  const getDateAvailableTimes = (item: ScheduleRecord, date: string) =>
    getAvailableRescheduleTimes({
      schedules: availabilitySchedules,
      teams,
      schedule: item,
      date,
    })

  const getDateAvailability = (item: ScheduleRecord, date: string) => {
    let itemCache = dateAvailabilityCache.get(item)
    if (!itemCache) {
      itemCache = new Map()
      dateAvailabilityCache.set(item, itemCache)
    }
    const cached = itemCache.get(date)
    if (cached) return cached

    const blockReason = getDateBlockReason(item, date)
    const evaluation = {
      blockReason,
      availableTimes: blockReason ? [] : getDateAvailableTimes(item, date),
    }
    itemCache.set(date, evaluation)
    return evaluation
  }

  const availableTimes = (item: ScheduleRecord, date: string) =>
    getDateAvailability(item, date).availableTimes

  const getDateTooltip = (item: ScheduleRecord, date: string) => {
    const { blockReason, availableTimes: dateTimes } = getDateAvailability(item, date)
    if (blockReason) return blockReason
    return dateTimes.length === 0
      ? "Horário indisponível"
      : undefined
  }

  const updateItemServices = (contractServiceIds: string[]) => {
    if (!editingServices) return
    if (contractServiceIds.length === 0) {
      toast.error("O agendamento deve manter ao menos um serviço.")
      return
    }

    const selectedOptions = contractServiceIds
      .map((contractServiceId) => contractServiceOptions.find((option) => option.contractService.id === contractServiceId))
      .filter((option): option is NonNullable<typeof option> => Boolean(option?.serviceType))
    if (selectedOptions.length !== contractServiceIds.length) {
      toast.error("Não foi possível carregar a configuração de um dos serviços do contrato.")
      return
    }

    const serviceItems = selectedOptions.map(({ contractService, serviceType }) => {
      const durationValue = Number(contractService.duration ?? serviceType?.defaultDuration ?? 1)
      const durationType = contractService.durationType ?? serviceType?.durationType ?? "hours"
      return {
        contractServiceId: contractService.id,
        serviceTypeId: contractService.serviceTypeId,
        durationMinutes: durationToMinutes(durationValue, durationType),
        durationValue,
        durationType,
        countsTowardPackageDuration: contractService.serviceTypeId !== ROUTINE_VISIT_SERVICE_ID,
      }
    })
    const contributingItems = serviceItems.filter((serviceItem) => serviceItem.countsTowardPackageDuration)
    const duration = contributingItems.length > 0
      ? contributingItems.reduce((total, serviceItem) => total + serviceItem.durationMinutes, 0)
      : Math.max(...serviceItems.map((serviceItem) => serviceItem.durationMinutes))
    const packageDuration = normalizeAutomatedScheduleDuration(duration)
    const primary = selectedOptions.find((option) => option.contractService.serviceTypeId !== ROUTINE_VISIT_SERVICE_ID)
      ?? selectedOptions[0]!
    const changedItem: ScheduleRecord = {
      ...editingServices,
      contractServiceId: primary.contractService.id,
      contractServiceIds,
      serviceTypeId: primary.contractService.serviceTypeId,
      serviceTypeIds: serviceItems.map((serviceItem) => serviceItem.serviceTypeId),
      serviceItems,
      serviceTypeName: selectedOptions.map((option) => option.serviceType?.name).join(", "),
      serviceDocumentSettings: selectedOptions.map(({ contractService }) => ({
        serviceTypeId: contractService.serviceTypeId,
        informativeTemplateId: contractService.informativeTemplateId ?? "",
        certificateTemplateId: contractService.certificateTemplateId ?? "",
      })),
      informativeTemplateId: primary.contractService.informativeTemplateId ?? "",
      certificateTemplateId: primary.contractService.certificateTemplateId ?? "",
      autoSendInformative: selectedOptions.some((option) => option.contractService.autoSendInformative),
      generateCertificateRequest: selectedOptions.some((option) => option.contractService.generateCertificateRequest),
      duration: packageDuration.durationMinutes,
      durationValue: packageDuration.durationValue,
      durationType: packageDuration.durationType,
      time: packageDuration.durationMinutes >= WORKDAY_DURATION_MINUTES ? "08:00" : editingServices.time,
    }
    const times = availableTimes(changedItem, changedItem.date)
    changedItem.time = times.includes(changedItem.time) ? changedItem.time : times[0] ?? changedItem.time
    updateItem(editingServices.id, changedItem)
  }

  const addItem = () => {
    const firstOption = contractServiceOptions[0]
    if (!firstOption) {
      toast.error("O contrato não possui serviços disponíveis para agendamento.")
      return
    }

    const template = getServiceTemplate(firstOption.contractService.id)
    if (!template) {
      toast.error("Não foi possível carregar a configuração dos serviços do contrato.")
      return
    }

    const addedItem: ScheduleRecord = {
      ...cloneItems([template])[0],
      id: `${ADDED_PLAN_ITEM_PREFIX}${crypto.randomUUID()}`,
      date: "",
      time: "",
      status: "scheduled",
    }
    setItems((current) => [...current, addedItem])
  }

  const saveMutation = useMutation({
    mutationFn: () => saveContractSchedulePlan(contract.id, toPayload(items)),
    onSuccess: async (response) => {
      setItems(response.data.items)
      await queryClient.invalidateQueries({ queryKey: ["contract-schedule-plan", contract.id] })
      await queryClient.invalidateQueries({ queryKey: ["contract", contract.id] })
      await queryClient.invalidateQueries({ queryKey: ["contracts"] })
      await queryClient.invalidateQueries({ queryKey: ["schedules"] })
      toast.success("Plano de agendamentos salvo com sucesso.")
      onOpenChange(false)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Não foi possível salvar o plano de agendamentos.")),
  })

  const exportMutation = useMutation({
    mutationFn: () => exportContractSchedulePlan(contract.id, toPayload(items)),
    onSuccess: (blob) => {
      const safeNumber = formatContractNumber(contract.contractNumber).toLowerCase().replace(/[^a-z0-9]+/g, "-")
      downloadBlob(blob, `agendamentos-${safeNumber}.xlsx`)
      toast.success("Planilha de agendamentos exportada.")
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Não foi possível exportar os agendamentos.")),
  })

  const busy = saveMutation.isPending || exportMutation.isPending
  const isPublished = Boolean(planQuery.data?.data.isPublished)
  const editingDisabled = busy || isPublished
  const hasIncompleteItems = items.some((item) => !item.date || !item.time)
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}>
      <DialogContent className="flex max-h-[92dvh] w-[min(96vw,1560px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,1560px)]">
        <DialogHeader className="px-6 pb-2 pt-5 pr-12">
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Agendamentos previstos
          </DialogTitle>
          <DialogDescription>
            Revise os agendamentos gerados a partir da assinatura. A primeira data respeita no mínimo três dias úteis.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 px-6 pb-4 pt-0">
          {planQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}
            </div>
          ) : planQuery.isError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
              {getApiErrorMessage(planQuery.error, "Não foi possível gerar a previsão de agendamentos.")}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhum agendamento foi gerado. Revise os serviços, unidades e responsáveis do contrato.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                  disabled={editingDisabled || contractServiceOptions.length === 0}
                  onClick={addItem}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar novo
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                  disabled={editingDisabled || generatedItems.length === 0}
                  onClick={() => setItems(cloneItems(generatedItems))}
                >
                  <RotateCcw className="h-4 w-4" />
                  Resetar
                </Button>
              </div>
              <div className="max-h-[min(56dvh,620px)] overflow-auto overscroll-contain">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow className="bg-muted/60 hover:bg-muted/60">
                      <TableHead className="min-w-[178px]">Data</TableHead>
                      <TableHead className="min-w-[140px]">Horário</TableHead>
                      <TableHead className="min-w-[250px]">Duração</TableHead>
                      <TableHead className="min-w-[220px]">Serviço</TableHead>
                      <TableHead className="min-w-[260px]">Equipes / Funcionários</TableHead>
                      <TableHead className="w-[72px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {items.map((item) => {
                    const times = availableTimes(item, item.date)
                    return (
                      <TableRow key={item.id} data-schedule-id={item.id} className="hover:bg-transparent">
                        <TableCell className="align-top">
                          <DatePicker
                            value={parseCivilDate(item.date)}
                            onChange={(date) => {
                              if (!date) return
                              const dateKey = toCivilDateKey(date)
                              const nextTimes = availableTimes(item, dateKey)
                              updateItem(item.id, { date: dateKey, time: nextTimes.includes(item.time) ? item.time : nextTimes[0] ?? item.time })
                            }}
                            placeholder="Selecionar data"
                            className="rounded-full bg-white hover:bg-white disabled:opacity-100 dark:bg-white"
                            disabled={editingDisabled}
                            disabledDates={(date) => {
                              const dateKey = toCivilDateKey(date)
                              return getDateAvailability(item, dateKey).availableTimes.length === 0
                            }}
                            dateTooltip={(date) => getDateTooltip(item, toCivilDateKey(date))}
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <Select
                            value={item.time}
                            onValueChange={(time) => updateItem(item.id, { time })}
                            disabled={editingDisabled || times.length === 0}
                          >
                            <SelectTrigger className="h-9 rounded-full bg-white disabled:opacity-100 dark:bg-white">
                              <Clock3 className="mr-2 h-4 w-4 text-muted-foreground" />
                              <SelectValue placeholder="Horário" />
                            </SelectTrigger>
                            <SelectContent>
                              {times.map((time) => <SelectItem key={time} value={time}>{time}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex min-w-[230px] gap-2">
                            <NumericInput
                              min={1}
                              step={1}
                              value={item.durationValue ?? 1}
                              disabled={editingDisabled}
                              className="h-9 w-24 rounded-full bg-white disabled:opacity-100 dark:bg-white"
                              aria-label={`Duração de ${item.serviceTypeName}`}
                              onValueChange={(durationValue) => {
                                const durationType = item.durationType ?? "hours"
                                const duration = normalizeAutomatedScheduleDuration(durationToMinutes(durationValue, durationType))
                                updateItem(item.id, {
                                  durationValue: duration.durationValue,
                                  durationType: duration.durationType,
                                  duration: duration.durationMinutes,
                                })
                              }}
                            />
                            <Select
                              value={item.durationType ?? "hours"}
                              disabled={editingDisabled}
                              onValueChange={(value: "minutes" | "hours" | "shift" | "days") => {
                                const durationValue = Number(item.durationValue ?? 1)
                                const duration = normalizeAutomatedScheduleDuration(durationToMinutes(durationValue, value))
                                updateItem(item.id, {
                                  durationType: duration.durationType,
                                  durationValue: duration.durationValue,
                                  duration: duration.durationMinutes,
                                  time: duration.durationType === "days" ? "08:00" : item.time,
                                })
                              }}
                            >
                              <SelectTrigger className="h-9 min-w-[126px] rounded-full bg-white disabled:opacity-100 dark:bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="minutes">Minutos</SelectItem>
                                <SelectItem value="hours">Horas</SelectItem>
                                <SelectItem value="shift">Turnos</SelectItem>
                                <SelectItem value="days">Dias</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex min-h-9 min-w-[220px] flex-wrap items-center gap-1.5">
                            {(item.contractServiceIds.length > 0 ? item.contractServiceIds : [item.contractServiceId ?? ""])
                              .filter(Boolean)
                              .map((contractServiceId) => {
                                const option = contractServiceOptions.find((candidate) => candidate.contractService.id === contractServiceId)
                                return (
                                  <Badge
                                    key={contractServiceId}
                                    variant="secondary"
                                    className="cursor-pointer px-3 py-1 text-xs"
                                    onClick={() => !editingDisabled && setEditingServicesId(item.id)}
                                  >
                                    {option?.serviceType?.name ?? contractServiceId}
                                  </Badge>
                                )
                              })}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              disabled={editingDisabled || contractServiceOptions.length === 0}
                              onClick={() => setEditingServicesId(item.id)}
                              aria-label={`Editar serviços de ${item.serviceTypeName}`}
                              title="Editar serviços"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex min-h-9 flex-wrap items-center gap-1.5">
                            {item.teams.map((team) => {
                              const color = getColorFromClass(team.color)
                              return (
                                <Badge
                                  key={team.id}
                                  variant="secondary"
                                  className="flex items-center gap-2 px-3 py-1 text-xs text-foreground/80"
                                  style={{ backgroundColor: `${color}1A` }}
                                >
                                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                                  {team.name}
                                </Badge>
                              )
                            })}
                            {item.additionalEmployees.map((employee) => (
                              <Badge key={employee.id} variant="outline" className="px-3 py-1 text-xs">
                                {employee.name}
                              </Badge>
                            ))}
                            {item.teams.length === 0 && item.additionalEmployees.length === 0 ? (
                              <span className="text-sm text-muted-foreground">Nenhum</span>
                            ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              disabled={editingDisabled}
                              onClick={() => setEditingAssigneeId(item.id)}
                              aria-label={`Adicionar equipes e funcionários ao agendamento de ${item.serviceTypeName}`}
                              title="Adicionar equipes e funcionários"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="align-top text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={editingDisabled || items.length <= 1}
                            aria-label={`Excluir ${item.serviceTypeName} do plano`}
                            title={items.length <= 1
                              ? "O plano deve manter ao menos um agendamento."
                              : `Excluir ${item.serviceTypeName} do plano`}
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={busy || items.length === 0 || hasIncompleteItems || planQuery.isLoading}
            onClick={() => exportMutation.mutate()}
          >
            {exportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exportar
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
              Voltar
            </Button>
            <Button
              type="button"
              className="gap-2"
              disabled={editingDisabled || items.length === 0 || hasIncompleteItems || planQuery.isLoading}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isPublished ? "Agendamentos enviados" : "Salvar agendamentos"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <Dialog
        open={Boolean(editingServices)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setEditingServicesId(null)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar serviços do agendamento</DialogTitle>
            <DialogDescription>
              A duração do pacote soma os serviços selecionados; visita de rotina é incluída sem acrescentar tempo.
            </DialogDescription>
          </DialogHeader>
          {editingServices ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>Serviços</Label>
                <MultiSelect
                  options={contractServiceOptions.map(({ contractService, serviceType }) => ({
                    id: contractService.id,
                    name: serviceType?.name ?? contractService.serviceTypeId,
                  }))}
                  selected={editingServices.contractServiceIds.length > 0
                    ? editingServices.contractServiceIds
                    : editingServices.contractServiceId ? [editingServices.contractServiceId] : []}
                  onChange={updateItemServices}
                  placeholder="Buscar e adicionar serviços..."
                  searchPlaceholder="Buscar serviço..."
                  emptyMessage="Nenhum serviço encontrado."
                  ariaLabel="Serviços do agendamento"
                  triggerClassName="bg-white hover:bg-white aria-expanded:bg-white data-[state=open]:bg-white dark:bg-white"
                  selectedBadgeVariant="secondary"
                  selectedBadgeClassName="text-secondary-foreground"
                />
              </div>
              <div className="rounded-lg bg-muted/30 px-4 py-3 text-sm">
                Duração total: <span className="font-medium">{formatConfiguredScheduleDuration(editingServices)}</span>
              </div>
              <div className="flex justify-end">
                <Button type="button" onClick={() => setEditingServicesId(null)}>Concluir</Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingAssignee)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setEditingAssigneeId(null)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Equipes e Funcionários</DialogTitle>
          </DialogHeader>
          {editingAssignee ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Equipes</Label>
                <MultiSelect
                  options={teams.map((team) => ({ id: team.id, name: team.name, color: team.color }))}
                  selected={editingTeamIds}
                  onChange={updateItemTeams}
                  placeholder="Buscar e adicionar equipes..."
                  searchPlaceholder="Buscar equipe..."
                  emptyMessage="Nenhuma equipe encontrada."
                  ariaLabel="Equipes do agendamento"
                  triggerClassName="bg-white hover:bg-white aria-expanded:bg-white data-[state=open]:bg-white dark:bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label>Funcionários Avulsos</Label>
                <MultiSelect
                  options={availableEmployeeOptions}
                  selected={editingEmployeeIds}
                  onChange={updateItemEmployees}
                  placeholder="Buscar e adicionar funcionários..."
                  searchPlaceholder="Buscar funcionário..."
                  emptyMessage="Nenhum funcionário encontrado."
                  ariaLabel="Funcionários avulsos do agendamento"
                  triggerClassName="bg-white hover:bg-white aria-expanded:bg-white data-[state=open]:bg-white dark:bg-white"
                />
              </div>
              <div className="flex justify-end">
                <Button type="button" onClick={() => setEditingAssigneeId(null)}>
                  Concluir
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
