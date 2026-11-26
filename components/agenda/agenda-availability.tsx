"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Clock3, RotateCcw, UserRound, UsersRound, X } from "lucide-react"
import type { ScheduleRecord } from "@/lib/api/schedules"
import type { TeamRecord } from "@/lib/api/teams"
import type { EmployeeRecord } from "@/lib/api/employees"
import type { ClientRecord } from "@/lib/api/clients"
import { addCivilDaysKey, addCivilMonthsKey, parseCivilDate, toCivilDateKey } from "@/lib/date-utils"
import { combineAgendaAvailabilityResources, getAgendaMonthAvailability, type AgendaAvailabilityResource } from "@/lib/schedule-availability"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { MultiSelect } from "@/components/ui/multi-select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Props = {
  initialDate: string
  schedules: ScheduleRecord[]
  teams: TeamRecord[]
  employees: EmployeeRecord[]
  clients: ClientRecord[]
  loading: boolean
  error: boolean
  onRetry: () => void
  onSchedule: (selection: { date: string; time: string; duration: number; teamIds: string[]; employeeIds: string[]; clientId?: string }) => void
}

const tones = {
  free: { label: "Livre", classes: "border-emerald-200 bg-emerald-50 text-emerald-800", selection: "border-emerald-500 ring-emerald-500" },
  partial: { label: "Parcial", classes: "border-amber-200 bg-amber-50 text-amber-900", selection: "border-amber-500 ring-amber-500" },
  full: { label: "Lotado", classes: "border-rose-200 bg-rose-50 text-rose-800", selection: "border-rose-500 ring-rose-500" },
  closed: { label: "Sem expediente", classes: "border-transparent bg-muted/45 text-muted-foreground", selection: "border-muted-foreground/50 ring-muted-foreground/50" },
}
const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const longDate = (date: string) => parseCivilDate(date)!.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" })

export function AgendaAvailability({ open, onOpenChange, ...props }: Props & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="block h-dvh max-h-dvh w-full max-w-none space-y-5 overflow-y-auto rounded-none border-0 p-0 sm:h-auto sm:max-h-[92dvh] sm:w-[calc(100%-1.5rem)] sm:max-w-5xl sm:rounded-lg sm:border">
        {open ? <AvailabilityContent {...props} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
}

function AvailabilityContent({ initialDate, schedules, teams, employees, clients, loading, error, onRetry, onSchedule, onClose }: Props & { onClose: () => void }) {
  const [mode, setMode] = useState("employees")
  const [selectedClientId, setSelectedClientId] = useState("")
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [month, setMonth] = useState(`${initialDate.slice(0, 7)}-01`)
  const [duration, setDuration] = useState("")
  const durationMinutes = Number(duration)
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([])
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  const today = toCivilDateKey(now)
  const employeeOptions = useMemo(() => employees.filter((employee) => employee.status === "active")
    .map((employee) => ({ id: employee.id, name: employee.name, kind: "employee" as const, teamIds: [] as string[], employeeIds: [employee.id] }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) satisfies AgendaAvailabilityResource[], [employees])
  const teamOptions = useMemo(() => teams.filter((team) => team.isActive)
    .map((team) => ({ id: `team:${team.id}`, name: team.name, kind: "team" as const, teamIds: [team.id], employeeIds: [] as string[] }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [teams])
  const selectedEmployees = employeeOptions.filter((employee) => selectedEmployeeIds.includes(employee.id))
  const selectedTeams = teamOptions.filter((team) => selectedTeamIds.includes(team.id))
  const clientOptions = useMemo(() => clients.map((client) => ({ value: client.id, label: client.companyName }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")), [clients])
  const hasResponsible = selectedEmployees.length > 0 || selectedTeams.length > 0
  const hasTarget = mode === "clients" ? Boolean(selectedClientId) : hasResponsible
  const missingFilters = !hasTarget && !duration
    ? mode === "clients" ? "Selecione um cliente e a duração para ver a disponibilidade." : "Selecione uma equipe ou funcionário e a duração para ver a disponibilidade."
    : !hasTarget ? mode === "clients" ? "Selecione um cliente para ver a disponibilidade." : "Selecione uma equipe ou funcionário para ver a disponibilidade."
    : !duration ? "Selecione a duração para ver a disponibilidade." : null
  const resources = useMemo<AgendaAvailabilityResource[]>(() => {
    if (mode === "clients") return selectedClientId ? [{ id: `client:${selectedClientId}`, name: "", kind: "client", clientId: selectedClientId, teamIds: [], employeeIds: [] }] : []
    const selected = [...employeeOptions.filter((employee) => selectedEmployeeIds.includes(employee.id)), ...teamOptions.filter((team) => selectedTeamIds.includes(team.id))]
    const combined = combineAgendaAvailabilityResources(selected, teams)
    return combined ? [combined, ...selected] : selected
  }, [employeeOptions, selectedEmployeeIds, selectedTeamIds, teamOptions, teams, mode, selectedClientId])
  const dates = useMemo(() => {
    const end = addCivilMonthsKey(month, 1)
    const values: string[] = []
    for (let date = month; date < end; date = addCivilDaysKey(date, 1)) values.push(date)
    return values
  }, [month])
  const days = useMemo(() => getAgendaMonthAvailability({
    schedules, teams, resources,
    dates, durationMinutes, includeWeekends: true, now,
  }), [schedules, teams, resources, dates, durationMinutes, now])
  const selected = days.find((day) => day.date === selectedDate)
  const results = selected?.resources.filter((resource) => resource.times.length || resource.kind === "combined") ?? []
  const padding = new Date(`${month}T12:00:00Z`).getUTCDay()
  const monthLabel = parseCivilDate(month)!.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", month: "long", year: "numeric" })
  const selectMonth = (offset: number) => {
    const next = addCivilMonthsKey(month, offset)
    setMonth(next)
    setSelectedDate(next.slice(0, 7) === today.slice(0, 7) ? today : next)
  }

  return <>
    <DialogHeader className="px-5 pt-6 sm:px-7">
      <DialogTitle className="text-xl">Disponibilidade da agenda</DialogTitle>
      <DialogDescription>Encontre uma data livre sem consultar dia por dia.</DialogDescription>
    </DialogHeader>
    <Tabs value={mode} onValueChange={setMode} className="gap-5">
    <div className="px-5 sm:px-7"><TabsList aria-label="Consultar disponibilidade por"><TabsTrigger value="employees" className="px-4">Funcionários</TabsTrigger><TabsTrigger value="clients" className="px-4">Clientes</TabsTrigger></TabsList></div>
    <TabsContent value={mode} className="mt-0 space-y-5">
    <div className="px-5 sm:px-7">
      <div className={cn("grid grid-cols-[minmax(0,1fr)_auto] gap-3 sm:grid-cols-2", mode === "clients" ? "lg:grid-cols-[minmax(0,1fr)_140px_auto]" : "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_auto]")}>
        {mode === "clients" ? <SearchableSelect ariaLabel="Cliente" placeholder="Cliente" searchPlaceholder="Buscar cliente..." className="col-span-2 min-w-0 w-full lg:col-span-1" includeAll={false} value={selectedClientId} onValueChange={setSelectedClientId} options={clientOptions} /> : <>
        <MultiSelect ariaLabel="Funcionário" placeholder={selectedEmployees.length ? `${selectedEmployees.length} ${selectedEmployees.length === 1 ? "funcionário selecionado" : "funcionários selecionados"}` : "Funcionários"} className="col-span-2 min-w-0 sm:col-span-1" triggerClassName="h-9" selected={selectedEmployeeIds} onChange={setSelectedEmployeeIds} options={employeeOptions} showSelectedTags={false} searchPlaceholder="Buscar funcionário..." emptyMessage="Nenhum funcionário encontrado." />
        <MultiSelect ariaLabel="Equipes" placeholder={selectedTeams.length ? `${selectedTeams.length} ${selectedTeams.length === 1 ? "equipe selecionada" : "equipes selecionadas"}` : "Equipes"} className="col-span-2 min-w-0 sm:col-span-1" triggerClassName="h-9" selected={selectedTeamIds} onChange={setSelectedTeamIds} options={teamOptions} showSelectedTags={false} searchPlaceholder="Buscar equipe..." emptyMessage="Nenhuma equipe encontrada." />
        </>}
        <SearchableSelect ariaLabel="Duração do atendimento" placeholder="Duração" className="w-full" includeAll={false} value={duration} onValueChange={setDuration} options={[{ value: "30", label: "30 minutos" }, { value: "60", label: "1 hora" }, { value: "120", label: "2 horas" }, { value: "240", label: "4 horas" }, { value: "480", label: "8 horas" }]} />
        <Button type="button" variant="ghost" className="h-9 justify-self-end gap-1.5 px-2 text-xs text-muted-foreground has-[>svg]:px-2 sm:gap-2 sm:px-3 sm:text-sm sm:has-[>svg]:px-3" disabled={!selectedEmployeeIds.length && !selectedTeamIds.length && !selectedClientId && !duration} onClick={() => { setSelectedEmployeeIds([]); setSelectedTeamIds([]); setSelectedClientId(""); setDuration("") }}>
          <RotateCcw className="h-4 w-4" />
          Limpar filtros
        </Button>
      </div>
      {mode === "employees" && selectedEmployees.length ? <div role="group" aria-label="Funcionários selecionados" className="mt-3 flex flex-wrap gap-2">
        {selectedEmployees.map((employee) => <Badge key={employee.id} variant="outline" className="max-w-full gap-2 whitespace-normal py-1 pl-3 pr-1">
          <span className="min-w-0 break-words">{employee.name}</span>
          <Button type="button" variant="ghost" size="icon" className="h-5 w-5 shrink-0 rounded-full p-0 text-muted-foreground" aria-label={`Remover ${employee.name} do filtro`} onClick={() => setSelectedEmployeeIds((ids) => ids.filter((id) => id !== employee.id))}>
            <X className="h-3 w-3" />
          </Button>
        </Badge>)}
      </div> : null}
      {mode === "employees" && selectedTeams.length ? <div role="group" aria-label="Equipes selecionadas" className="mt-3 flex flex-wrap gap-2">
        {selectedTeams.map((team) => <Badge key={team.id} variant="outline" className="max-w-full gap-2 whitespace-normal py-1 pl-3 pr-1">
          <UsersRound className="h-3 w-3 shrink-0" /><span className="min-w-0 break-words">{team.name}</span>
          <Button type="button" variant="ghost" size="icon" className="h-5 w-5 shrink-0 rounded-full p-0 text-muted-foreground" aria-label={`Remover equipe ${team.name} do filtro`} onClick={() => setSelectedTeamIds((ids) => ids.filter((id) => id !== team.id))}>
            <X className="h-3 w-3" />
          </Button>
        </Badge>)}
      </div> : null}
    </div>
    {loading ? <div role="status" className="px-7 py-16 text-center text-sm text-muted-foreground">Carregando agenda e responsáveis...</div>
      : error ? <div role="alert" className="space-y-3 px-7 py-12 text-center"><p>Não foi possível consultar a disponibilidade.</p><Button variant="outline" onClick={onRetry}>Tentar novamente</Button></div>
      : <div className="grid min-h-0 gap-5 px-5 pb-5 sm:px-7 md:grid-cols-[1.25fr_1fr]">
        <div aria-label="Calendário de disponibilidade" className="min-w-0 space-y-4 rounded-2xl border p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" aria-label="Mês anterior da disponibilidade" onClick={() => selectMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <h3 className="text-sm font-semibold capitalize">{monthLabel}</h3>
            <Button variant="ghost" size="icon" aria-label="Próximo mês da disponibilidade" onClick={() => selectMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {weekdays.map((day) => <span key={day} className="pb-2 text-center text-[11px] font-medium text-muted-foreground">{day}</span>)}
            {Array.from({ length: padding }, (_, index) => <span key={`pad-${index}`} />)}
            {days.map((day) => <button key={day.date} type="button" aria-label={`${longDate(day.date)}: ${day.date < today ? "Data passada" : missingFilters ? "Selecione os filtros" : tones[day.status as keyof typeof tones].label}`} aria-pressed={selectedDate === day.date} aria-current={day.date === today ? "date" : undefined}
              data-availability-date={day.date} data-availability-status={day.status}
              onClick={() => setSelectedDate(day.date)}
              className={cn("flex min-h-[64px] min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border p-1 transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current", (missingFilters ? "border-transparent bg-muted/45 text-muted-foreground" : tones[day.status as keyof typeof tones].classes), selectedDate === day.date && ["ring-2 ring-offset-2", missingFilters ? tones.closed.selection : tones[day.status as keyof typeof tones].selection])}>
              <span className={cn("text-sm font-medium", day.date === today && "font-bold")}>{Number(day.date.slice(8))}</span>
              <span className="text-[9px] leading-tight sm:text-[10px]">{day.date < today ? <><span className="sm:hidden">—</span><span className="hidden sm:inline">Passado</span></> : missingFilters || day.status === "closed" ? "—" : tones[day.status as keyof typeof tones].label}</span>
            </button>)}
          </div>
        </div>
        <section aria-label="Horários disponíveis" className="min-w-0 rounded-2xl bg-muted/20 p-4">
          {missingFilters ? <p role="status" className="py-10 text-center text-sm text-muted-foreground">{missingFilters}</p> : <>
          <div className="mb-4 flex items-start justify-between gap-2"><h3 className="text-sm font-semibold capitalize">{longDate(selectedDate)}</h3><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /></div>
          <div className="-m-1 space-y-4 p-1 md:max-h-[340px] md:overflow-y-auto">
            {results.length ? results.map((resource) => <div key={resource.id} data-availability-employee={resource.kind === "employee" ? resource.employeeIds[0] : undefined} data-availability-team={resource.kind === "team" ? resource.teamIds[0] : undefined} data-availability-combined={resource.kind === "combined" ? "true" : undefined} className={resource.kind === "client" ? "" : "rounded-xl bg-background p-3"}>
              {resource.kind !== "client" ? <p className="mb-2 flex items-start gap-2 text-sm font-medium">{resource.kind === "employee" ? <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <UsersRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}<span className="min-w-0 break-words">{resource.name}</span></p> : null}
              <div className="flex flex-wrap gap-1.5">{resource.times.map((time) => <Button key={time} variant="outline" size="sm" disabled={resource.pastTimes.includes(time)} title={resource.pastTimes.includes(time) ? "Horário já passou" : undefined} className="h-8 rounded-lg px-2.5 text-xs hover:border-primary hover:bg-primary/10" aria-label={resource.kind === "client" ? `Agendar em ${selectedDate} às ${time}` : `Agendar ${resource.name} em ${selectedDate} às ${time}`} onClick={() => {
                onClose()
                onSchedule({ date: selectedDate, time, duration: durationMinutes, teamIds: resource.teamIds, employeeIds: resource.employeeIds, ...(resource.clientId ? { clientId: resource.clientId } : {}) })
              }}>{time}</Button>)}</div>
              {resource.kind === "combined" && !resource.times.length ? <p className="text-xs leading-relaxed text-muted-foreground">{selectedDate < today ? "Selecione uma data atual ou futura." : "Nenhum horário em comum para a duração selecionada."}</p> : null}
            </div>) : <div className="py-10 text-center text-sm text-muted-foreground">{selectedDate < today ? "Selecione uma data atual ou futura." : selected?.status === "closed" ? "Sem horários restantes neste dia." : "Nenhum horário comporta a duração selecionada. Experimente outra data ou ajuste os filtros."}</div>}
          </div>
          </>}
        </section>
      </div>}
    </TabsContent>
    </Tabs>
  </>
}
