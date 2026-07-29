"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarClock, Clock3, Download, Loader2, Plus, RotateCcw, Save, Trash2, Users } from "lucide-react"
import { toast } from "sonner"

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
import type { ScheduleRecord } from "@/lib/api/schedules"
import type { ServiceRecord } from "@/lib/api/services"
import type { TeamRecord } from "@/lib/api/teams"
import { addCivilDaysKey, parseCivilDate, toCivilDateKey } from "@/lib/date-utils"
import { getAvailableRescheduleTimes } from "@/lib/schedule-availability"
import { formatContractNumber } from "@/lib/utils"

type ContractSchedulePlanDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contract: ContractRecord
  schedules: ScheduleRecord[]
  serviceTypes: ServiceRecord[]
  teams: TeamRecord[]
}

const WORKDAY_DURATION_MINUTES = 9 * 60
const SHIFT_DURATION_MINUTES = 4 * 60
const ADDED_PLAN_ITEM_PREFIX = "sched-added-"

const durationToMinutes = (value: number, type: "minutes" | "hours" | "shift" | "days") => {
  if (type === "minutes") return value
  if (type === "days") return value * WORKDAY_DURATION_MINUTES
  if (type === "shift") return value * SHIFT_DURATION_MINUTES
  return value * 60
}

const cloneItems = (items: ScheduleRecord[]) => items.map((item) => ({
  ...item,
  teams: [...item.teams],
  additionalEmployees: [...item.additionalEmployees],
  serviceTypeIds: [...item.serviceTypeIds],
  contractServiceIds: [...item.contractServiceIds],
}))

const isWeekendDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return weekday === 0 || weekday === 6
}

const nextBusinessDateKey = (dateKey: string) => {
  let nextDate = addCivilDaysKey(dateKey, 1)
  while (isWeekendDateKey(nextDate)) nextDate = addCivilDaysKey(nextDate, 1)
  return nextDate
}

const coveredDateKeys = (schedule: ScheduleRecord, dateKey = schedule.date) => {
  const durationDays = schedule.durationType === "days"
    ? Math.max(1, Number(schedule.durationValue ?? Math.ceil(Number(schedule.duration || 0) / WORKDAY_DURATION_MINUTES)))
    : 1
  const dates: string[] = []
  let currentDate = dateKey

  for (let index = 0; index < durationDays; index += 1) {
    dates.push(currentDate)
    currentDate = nextBusinessDateKey(currentDate)
  }

  return dates
}

const toPayload = (items: ScheduleRecord[]) => ({
  items: items.map((item) => ({
    id: item.id,
    contractServiceId: item.contractServiceId ?? "",
    date: item.date,
    time: item.time,
    durationValue: Number(item.durationValue ?? 1),
    durationType: item.durationType ?? "hours",
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
}: ContractSchedulePlanDialogProps) {
  const queryClient = useQueryClient()
  const [items, setItems] = useState<ScheduleRecord[]>([])
  const [generatedItems, setGeneratedItems] = useState<ScheduleRecord[]>([])

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

  const updateItem = (id: string, changes: Partial<ScheduleRecord>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item))
  }

  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }

  const getServiceTemplate = (contractServiceId: string, unitId?: string) => {
    const candidates = [...generatedItems, ...items].filter(
      (item) => item.contractServiceId === contractServiceId || item.contractServiceIds.includes(contractServiceId),
    )
    return candidates.find((item) => item.unitId === unitId) ?? candidates[0]
  }

  const hasDailyServiceCapacity = (item: ScheduleRecord, date: string) => {
    const dailyLimit = serviceTypeMap.get(item.serviceTypeId)?.dailyScheduleLimit
    if (!dailyLimit) return true

    return coveredDateKeys(item, date).every((coveredDate) => {
      const usage = availabilitySchedules.filter((schedule) => (
        schedule.id !== item.id &&
        !["cancelled", "completed"].includes(schedule.status) &&
        (schedule.serviceTypeId === item.serviceTypeId || schedule.serviceTypeIds.includes(item.serviceTypeId)) &&
        coveredDateKeys(schedule).includes(coveredDate)
      )).length

      return usage < dailyLimit
    })
  }

  const getDateBlockReason = (item: ScheduleRecord, date: string) => {
    const endDate = planQuery.data?.data.endDate ?? ""
    if (isWeekendDateKey(date)) return "Fim de semana"
    const minimumDate = item.id.startsWith(ADDED_PLAN_ITEM_PREFIX) ? todayDateKey : anchorDate
    if (minimumDate && date < minimumDate) return "Data anterior ao início permitido"
    if (endDate && date >= endDate) return "Fora da vigência do contrato"
    if (!hasDailyServiceCapacity(item, date)) return "Limite atingido"
    return undefined
  }

  const getDateAvailableTimes = (item: ScheduleRecord, date: string) =>
    getAvailableRescheduleTimes({
      schedules: availabilitySchedules,
      teams,
      schedule: item,
      date,
    })

  const availableTimes = (item: ScheduleRecord, date: string) => {
    if (getDateBlockReason(item, date)) return []
    return getDateAvailableTimes(item, date)
  }

  const getDateTooltip = (item: ScheduleRecord, date: string) => {
    const blockReason = getDateBlockReason(item, date)
    if (blockReason) return blockReason
    return getDateAvailableTimes(item, date).length === 0
      ? "Horário indisponível"
      : undefined
  }

  const changeItemService = (item: ScheduleRecord, contractServiceId: string) => {
    const template = getServiceTemplate(contractServiceId, item.unitId)
    if (!template) {
      toast.error("Não foi possível carregar a configuração desse serviço no contrato.")
      return
    }

    const inherited = cloneItems([template])[0]
    const changedItem: ScheduleRecord = {
      ...inherited,
      id: item.id,
      date: item.date,
      time: item.time,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }
    const times = availableTimes(changedItem, changedItem.date)
    changedItem.time = times.includes(changedItem.time) ? changedItem.time : times[0] ?? changedItem.time
    updateItem(item.id, changedItem)
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
  const anchorDate = planQuery.data?.data.anchorDate ?? ""

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
                      <TableHead className="min-w-[220px]">Técnico / equipe</TableHead>
                      <TableHead className="w-[72px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {items.map((item) => {
                    const times = availableTimes(item, item.date)
                    const responsible = [
                      ...item.teams.map((team) => team.name),
                      ...item.additionalEmployees.map((employee) => employee.name),
                    ].join(", ")

                    return (
                      <TableRow key={item.id} data-schedule-id={item.id}>
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
                            className="rounded-full"
                            disabled={editingDisabled}
                            disabledDates={(date) => {
                              const dateKey = toCivilDateKey(date)
                              return Boolean(getDateBlockReason(item, dateKey)) || availableTimes(item, dateKey).length === 0
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
                            <SelectTrigger className="h-9 rounded-full">
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
                              allowDecimal
                              min="0.5"
                              step="0.5"
                              value={item.durationValue ?? 1}
                              disabled={editingDisabled}
                              className="h-9 w-24 rounded-full"
                              aria-label={`Duração de ${item.serviceTypeName}`}
                              onValueChange={(durationValue) => {
                                const durationType = item.durationType ?? "hours"
                                updateItem(item.id, {
                                  durationValue,
                                  durationType,
                                  duration: durationToMinutes(durationValue, durationType),
                                })
                              }}
                            />
                            <Select
                              value={item.durationType ?? "hours"}
                              disabled={editingDisabled}
                              onValueChange={(value: "minutes" | "hours" | "shift" | "days") => {
                                const durationValue = Number(item.durationValue ?? 1)
                                updateItem(item.id, {
                                  durationType: value,
                                  durationValue,
                                  duration: durationToMinutes(durationValue, value),
                                  time: value === "days" ? "08:00" : item.time,
                                })
                              }}
                            >
                              <SelectTrigger className="h-9 min-w-[126px] rounded-full">
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
                          <Select
                            value={item.contractServiceId ?? ""}
                            disabled={editingDisabled || contractServiceOptions.length === 0}
                            onValueChange={(contractServiceId) => changeItemService(item, contractServiceId)}
                          >
                            <SelectTrigger
                              className="h-9 min-w-[220px] rounded-full"
                              aria-label={`Serviço de ${item.serviceTypeName}`}
                            >
                              <SelectValue placeholder="Selecionar serviço" />
                            </SelectTrigger>
                            <SelectContent>
                              {contractServiceOptions.map(({ contractService, serviceType }) => (
                                <SelectItem key={contractService.id} value={contractService.id}>
                                  {serviceType?.name ?? item.serviceTypeName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="align-top">
                          {responsible ? (
                            <div className="flex items-start gap-2 text-sm">
                              <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                              <span>{responsible}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
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
    </Dialog>
  )
}
