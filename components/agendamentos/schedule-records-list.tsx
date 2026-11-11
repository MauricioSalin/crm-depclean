"use client"

import { useId, useState } from "react"
import { ChevronDown } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { FilterSearchInput } from "@/components/ui/filter-search-input"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { ScheduleRecord } from "@/lib/api/schedules"
import { formatCivilDate, toCivilDateKey } from "@/lib/date-utils"
import { formatConfiguredScheduleDuration } from "@/lib/schedule-duration"
import { SCHEDULE_STATUS_FILTER_OPTIONS } from "@/lib/schedule-status"
import { resolveScheduleDisplayPeriod } from "@/lib/schedule-display-period"

const STATUS_COLORS: Record<ScheduleRecord["status"], string> = {
  draft: "bg-slate-100 text-slate-700",
  scheduled: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  partially_completed: "bg-amber-100 text-amber-800",
  cancelled: "bg-red-100 text-red-800",
  rescheduled: "bg-purple-100 text-purple-800",
  awaiting_schedule: "bg-orange-100 text-orange-700",
  not_completed: "bg-red-100 text-red-800",
}

export function ScheduleRecordStatus({ status }: { status: ScheduleRecord["status"] }) {
  return <Badge className={STATUS_COLORS[status]}>{SCHEDULE_STATUS_FILTER_OPTIONS.find((option) => option.value === status)?.label ?? status}</Badge>
}

export function ScheduleRecordsList({
  schedules,
  onInsert,
  getDisabledReason,
  currentScheduleId,
  showFilters = false,
}: {
  schedules: ScheduleRecord[]
  onInsert?: (schedule: ScheduleRecord) => void
  getDisabledReason?: (schedule: ScheduleRecord) => string | undefined
  currentScheduleId?: string
  showFilters?: boolean
}) {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [dateRange, setDateRange] = useState<DateRange>()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const filtersId = useId()
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  const query = normalize(search.trim())
  const from = dateRange?.from ? toCivilDateKey(dateRange.from) : ""
  const to = dateRange?.to ? toCivilDateKey(dateRange.to) : ""
  const filtered = showFilters ? schedules.filter((schedule) => {
    const period = resolveScheduleDisplayPeriod(schedule)
    return (status === "all" || schedule.status === status) &&
      (!from || period.endDate >= from) && (!to || period.date <= to) &&
      normalize([schedule.clientName, schedule.serviceTypeName, schedule.unitName, formatCivilDate(schedule.date), schedule.time,
        ...schedule.teams.map((team) => team.name), ...schedule.additionalEmployees.map((employee) => employee.name)].join(" ")).includes(query)
  }) : schedules
  const action = (schedule: ScheduleRecord) => {
    const reason = getDisabledReason?.(schedule)
    return onInsert ? (
      <Button type="button" size="sm" disabled={Boolean(reason)} onClick={() => onInsert(schedule)}>Inserir</Button>
    ) : schedule.id === currentScheduleId ? <Badge variant="outline">Atual</Badge> : null
  }

  return (
    <div className="space-y-4 p-1">
      {showFilters ? (
        <div className="space-y-3">
          <div className="flex justify-end sm:hidden">
            <Button type="button" variant="ghost" size="sm" className="h-9 shrink-0 text-muted-foreground"
              aria-expanded={mobileFiltersOpen} aria-controls={filtersId}
              onClick={() => setMobileFiltersOpen((open) => !open)}>
              Filtros
              <ChevronDown className={`ml-1 h-4 w-4 transition-transform duration-200 ${mobileFiltersOpen ? "rotate-180" : ""}`} />
            </Button>
          </div>
          <div id={filtersId} className={`${mobileFiltersOpen ? "grid" : "hidden"} -m-1 w-full min-w-0 grid-cols-2 gap-2 overflow-visible p-1 sm:flex sm:items-center`}>
            <FilterSearchInput aria-label="Buscar agendamentos" wrapperClassName="col-span-2 sm:w-80"
              placeholder="Buscar cliente, serviço, equipe..." spellCheck={false}
              value={search} onValueChange={setSearch} />
            <SearchableSelect ariaLabel="Filtrar por status" value={status} onValueChange={setStatus} options={SCHEDULE_STATUS_FILTER_OPTIONS}
              placeholder="Status" searchPlaceholder="Buscar status..." allLabel="Todos os status"
              className="col-span-2 w-full sm:w-[160px]" />
            <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Filtrar data"
              className="col-span-2 w-full min-w-0 sm:w-[360px]" />
          </div>
        </div>
      ) : null}
      {filtered.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum agendamento encontrado.</p> : (
        <>
          <div className="hidden sm:block">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data e horário</TableHead><TableHead>Serviço</TableHead><TableHead>Unidade</TableHead>
                <TableHead>Duração</TableHead><TableHead>Status</TableHead><TableHead className="text-right">{onInsert ? "Ações" : ""}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((schedule) => <TableRow key={schedule.id} data-schedule-record={schedule.id}>
                  <TableCell className="whitespace-nowrap">{formatCivilDate(schedule.date)}<p className="text-sm text-muted-foreground">{schedule.time}</p></TableCell>
                  <TableCell>{schedule.serviceTypeName}</TableCell><TableCell>{schedule.unitName}</TableCell>
                  <TableCell>{formatConfiguredScheduleDuration(schedule)}</TableCell>
                  <TableCell><ScheduleRecordStatus status={schedule.status} /></TableCell><TableCell className="text-right">{action(schedule)}</TableCell>
                </TableRow>)}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-3 sm:hidden">
            {filtered.map((schedule) => <div key={schedule.id} data-schedule-record={schedule.id} className="space-y-3 rounded-xl border p-4">
              <div className="flex items-start justify-between gap-2"><p className="font-medium">{schedule.serviceTypeName}</p><ScheduleRecordStatus status={schedule.status} /></div>
              <p className="text-sm">{formatCivilDate(schedule.date)} às {schedule.time} · {formatConfiguredScheduleDuration(schedule)}</p>
              <p className="text-sm text-muted-foreground">{schedule.unitName}</p>
              {onInsert || schedule.id === currentScheduleId ? <div className="flex justify-end">{action(schedule)}</div> : null}
            </div>)}
          </div>
        </>
      )}
    </div>
  )
}
