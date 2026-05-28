"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, Clock, Database, Search, SlidersHorizontal, UserRound, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DataPagination } from "@/components/ui/data-pagination"
import { EmptyState, TableEmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TableSkeletonRows } from "@/components/ui/table-skeleton"
import { listClients } from "@/lib/api/clients"
import { listEmployees } from "@/lib/api/employees"
import { listAuditLogs, type AuditLogRecord } from "@/lib/api/logs"
import { getApiErrorMessage } from "@/lib/api/errors"
import { useMobileFiltersOpen } from "@/lib/hooks/use-mobile-filters"
import { cn } from "@/lib/utils"

const LOG_TYPE_OPTIONS = [
  { value: "create", label: "Criação" },
  { value: "update", label: "Atualização" },
  { value: "delete", label: "Exclusão" },
  { value: "deactivate", label: "Inativação" },
  { value: "cancel", label: "Cancelamento" },
  { value: "complete", label: "Conclusão" },
  { value: "start", label: "Início" },
  { value: "reactivate", label: "Reativação" },
  { value: "upload", label: "Upload" },
  { value: "download", label: "Download" },
  { value: "send", label: "Envio" },
  { value: "duplicate", label: "Duplicação" },
  { value: "revoke", label: "Revogação" },
  { value: "execute", label: "Execução" },
]

const TYPE_BADGE_CLASS: Record<string, string> = {
  cancel: "bg-orange-100 text-orange-700 hover:bg-orange-100",
  complete: "bg-green-100 text-green-700 hover:bg-green-100",
  create: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  deactivate: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  delete: "bg-red-100 text-red-700 hover:bg-red-100",
  download: "bg-indigo-100 text-indigo-700 hover:bg-indigo-100",
  duplicate: "bg-purple-100 text-purple-700 hover:bg-purple-100",
  execute: "bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
  reactivate: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  revoke: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  send: "bg-cyan-100 text-cyan-700 hover:bg-cyan-100",
  start: "bg-lime-100 text-lime-700 hover:bg-lime-100",
  update: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
  upload: "bg-pink-100 text-pink-700 hover:bg-pink-100",
}

function toApiDateTime(value: string) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function getLogStatusBadge(log: AuditLogRecord) {
  if (log.status === "error") {
    return (
      <Badge className="gap-1 bg-red-100 text-red-700 hover:bg-red-100">
        <AlertTriangle className="h-3 w-3" />
        Falhou
      </Badge>
    )
  }

  return (
    <Badge className="gap-1 bg-green-100 text-green-700 hover:bg-green-100">
      <CheckCircle2 className="h-3 w-3" />
      Sucesso
    </Badge>
  )
}

function getTypeBadge(log: AuditLogRecord) {
  return (
    <Badge className={cn("border-0", TYPE_BADGE_CLASS[log.type] ?? "bg-muted text-muted-foreground")}>
      {log.typeLabel}
    </Badge>
  )
}

export function LogsContent() {
  const mobileFiltersOpen = useMobileFiltersOpen()
  const [search, setSearch] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [clientId, setClientId] = useState("all")
  const [employeeId, setEmployeeId] = useState("all")
  const [type, setType] = useState("all")
  const [status, setStatus] = useState<"all" | "success" | "error">("all")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const logsQuery = useQuery({
    queryKey: ["audit-logs", search, from, to, clientId, employeeId, type, status, page, pageSize],
    queryFn: () => listAuditLogs({
      search: search.trim() || undefined,
      from: toApiDateTime(from),
      to: toApiDateTime(to),
      clientId,
      employeeId,
      type,
      status,
      page,
      limit: pageSize,
    }),
  })

  const clientsQuery = useQuery({
    queryKey: ["clients", "logs-filter"],
    queryFn: () => listClients(""),
  })

  const employeesQuery = useQuery({
    queryKey: ["employees", "logs-filter"],
    queryFn: () => listEmployees(""),
  })

  const logs = logsQuery.data?.data.items ?? []
  const totalItems = logsQuery.data?.data.total ?? 0
  const totalPages = Math.max(1, logsQuery.data?.data.totalPages ?? 1)
  const hasActiveFilters = Boolean(search || from || to || clientId !== "all" || employeeId !== "all" || type !== "all" || status !== "all")
  const clientOptions = useMemo(
    () => (clientsQuery.data?.data ?? []).map((client) => ({ value: client.id, label: client.companyName })),
    [clientsQuery.data?.data],
  )
  const employeeOptions = useMemo(
    () => (employeesQuery.data?.data ?? []).map((employee) => ({ value: employee.id, label: employee.name })),
    [employeesQuery.data?.data],
  )

  const resetPage = () => setPage(1)
  const clearFilters = () => {
    setSearch("")
    setFrom("")
    setTo("")
    setClientId("all")
    setEmployeeId("all")
    setType("all")
    setStatus("all")
    setPage(1)
  }

  const filters = (
    <Card className="overflow-visible">
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 font-semibold">
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.2fr)_minmax(170px,0.8fr)_minmax(170px,0.8fr)_minmax(180px,1fr)_minmax(180px,1fr)_150px_130px_auto]">
          <div className="space-y-1.5 sm:col-span-2 xl:col-span-1">
            <Label>Busca</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  resetPage()
                }}
                placeholder="Buscar ação, usuário, cliente..."
                className="pl-10"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>De</Label>
            <Input
              type="datetime-local"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value)
                resetPage()
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Até</Label>
            <Input
              type="datetime-local"
              value={to}
              onChange={(event) => {
                setTo(event.target.value)
                resetPage()
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <SearchableSelect
              value={clientId}
              onValueChange={(value) => {
                setClientId(value)
                resetPage()
              }}
              options={clientOptions}
              allLabel="Todos os clientes"
              placeholder="Cliente"
              searchPlaceholder="Buscar cliente..."
              className="w-full"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Funcionário</Label>
            <SearchableSelect
              value={employeeId}
              onValueChange={(value) => {
                setEmployeeId(value)
                resetPage()
              }}
              options={employeeOptions}
              allLabel="Todos"
              placeholder="Funcionário"
              searchPlaceholder="Buscar funcionário..."
              className="w-full"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(value) => { setType(value); resetPage() }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {LOG_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(value) => { setStatus(value as "all" | "success" | "error"); resetPage() }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="success">Sucesso</SelectItem>
                <SelectItem value="error">Falha</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="button" variant="outline" className="w-full gap-2" onClick={clearFilters} disabled={!hasActiveFilters}>
              <X className="h-4 w-4" />
              Limpar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  if (logsQuery.isError) {
    return (
      <Card className="p-6 text-sm text-destructive">
        {getApiErrorMessage(logsQuery.error, "Não foi possível carregar os logs.")}
      </Card>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-visible md:overflow-hidden">
      <div className={`${mobileFiltersOpen ? "block" : "hidden"} sm:block`}>
        {filters}
      </div>

      <div className="md:min-h-0 md:flex-1 md:overflow-hidden">
        <div className="hidden rounded-md md:block md:h-full">
          <Table containerClassName="md:h-full">
            <TableHeader>
              <TableRow>
                <TableHead>Data e hora</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Funcionário</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsQuery.isLoading ? (
                <TableSkeletonRows
                  rows={8}
                  columns={[
                    { width: "w-32" },
                    { width: "w-24" },
                    { width: "w-64" },
                    { width: "w-40" },
                    { width: "w-40" },
                    { width: "w-24" },
                  ]}
                />
              ) : logs.length === 0 ? (
                <TableEmptyState colSpan={6} icon={Database} title="Nenhum log encontrado." />
              ) : logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(log.createdAt)}
                  </TableCell>
                  <TableCell>{getTypeBadge(log)}</TableCell>
                  <TableCell>
                    <div className="max-w-xl">
                      <p className="font-medium">{log.title}</p>
                      <p className="text-xs text-muted-foreground">{log.description}</p>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">{log.method} {log.path}</p>
                    </div>
                  </TableCell>
                  <TableCell>{log.clientName || "-"}</TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <p>{log.actorName || "-"}</p>
                      {log.targetEmployeeName && log.targetEmployeeName !== log.actorName ? (
                        <p className="text-xs text-muted-foreground">Alvo: {log.targetEmployeeName}</p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{getLogStatusBadge(log)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-3 md:hidden">
          {logsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className="h-36 animate-pulse bg-muted/40" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <EmptyState icon={Database} title="Nenhum log encontrado." />
          ) : logs.map((log) => (
            <Card key={log.id}>
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{log.title}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDateTime(log.createdAt)}
                    </p>
                  </div>
                  {getLogStatusBadge(log)}
                </div>
                <div className="flex flex-wrap gap-2">
                  {getTypeBadge(log)}
                  <Badge variant="outline">{log.moduleLabel}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{log.description}</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {log.clientName ? <p>Cliente: {log.clientName}</p> : null}
                  <p className="flex items-center gap-1">
                    <UserRound className="h-3.5 w-3.5" />
                    {log.actorName || "-"}
                  </p>
                  <p className="font-mono">{log.method} {log.path}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <DataPagination
        currentPage={page}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={totalItems}
        pageSizeOptions={[10, 20, 50, 100]}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
      />
    </div>
  )
}
