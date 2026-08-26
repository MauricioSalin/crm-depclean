"use client"

import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MultiSelect } from "@/components/ui/multi-select"
import { NumericInput } from "@/components/ui/numeric-input"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Textarea } from "@/components/ui/textarea"
import { TimeInput } from "@/components/ui/time-input"
import type { ScheduleCompletionEmployee } from "@/lib/api/schedules"
import { parseCivilDate, toCivilDateKey } from "@/lib/date-utils"
import {
  formatScheduleDisposalCurrency,
  SCHEDULE_DISPOSAL_STATIONS,
  scheduleDisposalTotal,
  type ScheduleDisposalType,
} from "@/lib/schedule-disposal"

type AttendanceCompletionFieldsProps = {
  idPrefix: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  canEditStart: boolean
  driverEmployeeId: string
  helperEmployeeIds: string[]
  serviceReport: string
  vehiclePlate: string
  disposalMtrNumber: string
  disposalType: ScheduleDisposalType | ""
  disposalStationId: string
  disposalQuantityM3: number | null
  employees: ScheduleCompletionEmployee[]
  disabled?: boolean
  onStartDateChange: (value: string) => void
  onStartTimeChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onEndTimeChange: (value: string) => void
  onDriverEmployeeIdChange: (value: string) => void
  onHelperEmployeeIdsChange: (value: string[]) => void
  onServiceReportChange: (value: string) => void
  onVehiclePlateChange: (value: string) => void
  onDisposalMtrNumberChange: (value: string) => void
  onDisposalTypeChange: (value: ScheduleDisposalType | "") => void
  onDisposalStationIdChange: (value: string) => void
  onDisposalQuantityM3Change: (value: number | null) => void
}

export function AttendanceCompletionFields({
  idPrefix,
  startDate,
  startTime,
  endDate,
  endTime,
  canEditStart,
  driverEmployeeId,
  helperEmployeeIds,
  serviceReport,
  vehiclePlate,
  disposalMtrNumber,
  disposalType,
  disposalStationId,
  disposalQuantityM3,
  employees,
  disabled = false,
  onStartDateChange,
  onStartTimeChange,
  onEndDateChange,
  onEndTimeChange,
  onDriverEmployeeIdChange,
  onHelperEmployeeIdsChange,
  onServiceReportChange,
  onVehiclePlateChange,
  onDisposalMtrNumberChange,
  onDisposalTypeChange,
  onDisposalStationIdChange,
  onDisposalQuantityM3Change,
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
  const disposalStations = disposalType ? SCHEDULE_DISPOSAL_STATIONS[disposalType] : []
  const disposalTotal = scheduleDisposalTotal(disposalType, disposalStationId, disposalQuantityM3)

  return (
    <fieldset className="min-w-0 space-y-5" disabled={disabled}>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Data de início *</Label>
          <DatePicker
            value={parseCivilDate(startDate)}
            onChange={(date) => onStartDateChange(date ? toCivilDateKey(date) : "")}
            placeholder="Selecionar data"
            disabled={disabled}
            readOnly={!canEditStart}
          />
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor={`${idPrefix}-start-time`}>Horário de início *</Label>
          <TimeInput
            id={`${idPrefix}-start-time`}
            value={startTime}
            readOnly={!canEditStart}
            aria-readonly={!canEditStart}
            className="read-only:bg-muted/40 read-only:text-muted-foreground"
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
        <div className="min-w-0 space-y-2">
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
        <Label htmlFor={`${idPrefix}-vehicle-plate`}>Placa do veículo</Label>
        <Input
          id={`${idPrefix}-vehicle-plate`}
          value={vehiclePlate}
          maxLength={15}
          placeholder="ABC1D23"
          className="uppercase"
          onChange={(event) => onVehiclePlateChange(event.target.value.toUpperCase())}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-disposal-mtr-number`}>N° de MTR</Label>
        <Input
          id={`${idPrefix}-disposal-mtr-number`}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          value={disposalMtrNumber}
          maxLength={30}
          placeholder="001234567890"
          onChange={(event) => onDisposalMtrNumberChange(event.target.value.replace(/\D/g, ""))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-disposal-type`}>Descarte</Label>
        <SearchableSelect
          id={`${idPrefix}-disposal-type`}
          value={disposalType || "none"}
          onValueChange={(value) => {
            const nextType = value === "none" ? "" : value as ScheduleDisposalType
            onDisposalTypeChange(nextType)
            onDisposalStationIdChange("")
            onDisposalQuantityM3Change(null)
            if (!nextType) onDisposalMtrNumberChange("")
          }}
          options={[
            { value: "none", label: "Sem descarte" },
            { value: "fossa", label: "Fossa" },
            { value: "gordura", label: "Gordura" },
          ]}
          includeAll={false}
          placeholder="Selecione o tipo de descarte"
          searchPlaceholder="Buscar tipo..."
          emptyMessage="Nenhum tipo encontrado."
          className="w-full"
          disabled={disabled}
        />
      </div>

      {disposalType ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-disposal-station`}>Estação *</Label>
            <SearchableSelect
              id={`${idPrefix}-disposal-station`}
              value={disposalStationId}
              onValueChange={onDisposalStationIdChange}
              options={disposalStations.map((station) => ({
                value: station.id,
                label: `${station.name} (${formatScheduleDisposalCurrency(station.unitPrice)})`,
              }))}
              includeAll={false}
              placeholder="Selecione a estação"
              searchPlaceholder="Buscar estação..."
              emptyMessage="Nenhuma estação encontrada."
              className="w-full"
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-disposal-quantity`}>Quantidade (M³) *</Label>
            <NumericInput
              id={`${idPrefix}-disposal-quantity`}
              value={disposalQuantityM3 === null ? null : String(disposalQuantityM3).replace(".", ",")}
              min={0.001}
              allowDecimal
              allowEmpty
              placeholder="2,5"
              onEmpty={() => onDisposalQuantityM3Change(null)}
              onValueChange={onDisposalQuantityM3Change}
            />
          </div>
          <div className="rounded-2xl bg-primary/[0.05] p-4 text-sm">
            <span className="text-muted-foreground">Valor: </span>
            <span className="font-semibold text-foreground">{formatScheduleDisposalCurrency(disposalTotal)}</span>
          </div>
        </div>
      ) : null}

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
