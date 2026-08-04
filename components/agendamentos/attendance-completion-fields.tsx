"use client"

import { DatePicker } from "@/components/ui/date-picker"
import { Label } from "@/components/ui/label"
import { MultiSelect } from "@/components/ui/multi-select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Textarea } from "@/components/ui/textarea"
import { TimeInput } from "@/components/ui/time-input"
import type { ScheduleCompletionEmployee } from "@/lib/api/schedules"
import { parseCivilDate, toCivilDateKey } from "@/lib/date-utils"

type AttendanceCompletionFieldsProps = {
  idPrefix: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  driverEmployeeId: string
  helperEmployeeIds: string[]
  serviceReport: string
  employees: ScheduleCompletionEmployee[]
  disabled?: boolean
  onStartDateChange: (value: string) => void
  onStartTimeChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onEndTimeChange: (value: string) => void
  onDriverEmployeeIdChange: (value: string) => void
  onHelperEmployeeIdsChange: (value: string[]) => void
  onServiceReportChange: (value: string) => void
}

export function AttendanceCompletionFields({
  idPrefix,
  startDate,
  startTime,
  endDate,
  endTime,
  driverEmployeeId,
  helperEmployeeIds,
  serviceReport,
  employees,
  disabled = false,
  onStartDateChange,
  onStartTimeChange,
  onEndDateChange,
  onEndTimeChange,
  onDriverEmployeeIdChange,
  onHelperEmployeeIdsChange,
  onServiceReportChange,
}: AttendanceCompletionFieldsProps) {
  const driverOptions = [
    { value: "none", label: "Sem motorista" },
    ...employees.map((employee) => ({
      value: employee.id,
      label: employee.name,
    })),
  ]
  const helperOptions = employees
    .filter((employee) => employee.id !== driverEmployeeId)
    .map((employee) => ({
      id: employee.id,
      name: employee.name,
    }))

  return (
    <fieldset className="min-w-0 space-y-5" disabled={disabled}>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Data de início *</Label>
          <DatePicker
            value={parseCivilDate(startDate)}
            onChange={(date) => onStartDateChange(date ? toCivilDateKey(date) : "")}
            placeholder="Selecionar data"
            disabled
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-start-time`}>Horário de início *</Label>
          <TimeInput
            id={`${idPrefix}-start-time`}
            value={startTime}
            onChange={(event) => onStartTimeChange(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Data de fim *</Label>
          <DatePicker
            value={parseCivilDate(endDate)}
            onChange={(date) => onEndDateChange(date ? toCivilDateKey(date) : "")}
            placeholder="Selecionar data"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-end-time`}>Horário de fim *</Label>
          <TimeInput
            id={`${idPrefix}-end-time`}
            value={endTime}
            onChange={(event) => onEndTimeChange(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-driver`}>Motorista</Label>
        <SearchableSelect
          id={`${idPrefix}-driver`}
          value={driverEmployeeId}
          onValueChange={(value) => {
            const nextDriverEmployeeId = value === "none" ? "" : value
            onDriverEmployeeIdChange(nextDriverEmployeeId)
            if (nextDriverEmployeeId && helperEmployeeIds.includes(nextDriverEmployeeId)) {
              onHelperEmployeeIdsChange(helperEmployeeIds.filter((employeeId) => employeeId !== nextDriverEmployeeId))
            }
          }}
          options={driverOptions}
          includeAll={false}
          placeholder="Selecione o motorista"
          searchPlaceholder="Buscar funcionário..."
          emptyMessage="Nenhum funcionário encontrado."
          className="w-full"
          disabled={disabled}
        />
      </div>

      <div className="space-y-2">
        <Label>Ajudantes</Label>
        <MultiSelect
          options={helperOptions}
          selected={helperEmployeeIds.filter((employeeId) => employeeId !== driverEmployeeId)}
          onChange={onHelperEmployeeIdsChange}
          placeholder="Selecionar ajudantes"
          searchPlaceholder="Buscar funcionário..."
          emptyMessage="Nenhum funcionário encontrado."
          ariaLabel="Selecionar ajudantes"
          selectedBadgeVariant="secondary"
          selectedBadgeClassName="text-secondary-foreground"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-observations`}>Observações</Label>
        <Textarea
          id={`${idPrefix}-observations`}
          value={serviceReport}
          maxLength={4000}
          rows={4}
          placeholder="Registre ocorrências, condições do local ou informações relevantes do atendimento."
          onChange={(event) => onServiceReportChange(event.target.value)}
        />
        <p className="text-right text-xs text-muted-foreground">{serviceReport.length}/4000</p>
      </div>
    </fieldset>
  )
}
