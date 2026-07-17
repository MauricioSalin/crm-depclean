"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, Clock, Database, Search, UserRound, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DataPagination } from "@/components/ui/data-pagination"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EmptyState, TableEmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { FilterSearchInput } from "@/components/ui/filter-search-input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, type TableSortState } from "@/components/ui/table"
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

const LOG_MODULE_OPTIONS = [
  { value: "analytics", label: "Relatórios" },
  { value: "auth", label: "Acesso" },
  { value: "certificates", label: "Certificados" },
  { value: "clicksign", label: "ClickSign" },
  { value: "clients", label: "Clientes" },
  { value: "contracts", label: "Contratos" },
  { value: "employees", label: "Funcionários" },
  { value: "notifications", label: "Notificações" },
  { value: "profile", label: "Perfil" },
  { value: "schedules", label: "Agendamentos" },
  { value: "services", label: "Serviços" },
  { value: "settings", label: "Configurações" },
  { value: "support", label: "Ajuda" },
  { value: "teams", label: "Equipes" },
  { value: "templates", label: "Templates" },
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

const AUDIT_LOG_TABLE_SORT_FIELDS = ["createdAt", "type", "title", "clientName", "actorName", "status"] as const

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

function getFailureReason(log: AuditLogRecord) {
  if (log.failureReason) return log.failureReason

  const error = log.metadata?.error
  if (typeof error === "string") return error
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message
    if (Array.isArray(message)) return message.filter(Boolean).join(" | ")
    if (typeof message === "string") return message
  }

  return ""
}

function formatLogJson(value: unknown) {
  if (!value || (typeof value === "object" && Object.keys(value as Record<string, unknown>).length === 0)) {
    return "{}"
  }

  return JSON.stringify(value, null, 2)
}

export function LogsContent() {
  const mobileFiltersOpen = useMobileFiltersOpen()
  const [selectedLog, setSelectedLog] = useState<AuditLogRecord | null>(null)
  const [logDetailsOpen, setLogDetailsOpen] = useState(false)
  const logDetailsCloseTimeoutRef = useRef<number | null>(null)
  const [search, setSearch] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [clientId, setClientId] = useState("all")
  const [employeeId, setEmployeeId] = useState("all")
  const [type, setType] = useState("all")
  const [module, setModule] = useState("all")
  const [status, setStatus] = useState<"all" | "success" | "error">("all")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [tableSort, setTableSort] = useState<TableSortState>(null)

  const clearLogDetailsCloseTimeout = useCallback(() => {
    if (logDetailsCloseTimeoutRef.current === null) return
    window.clearTimeout(logDetailsCloseTimeoutRef.current)
    logDetailsCloseTimeoutRef.current = null
  }, [])

  const openLogDetails = (log: AuditLogRecord) => {
    clearLogDetailsCloseTimeout()
    setSelectedLog(log)
    setLogDetailsOpen(true)
  }

  const closeLogDetails = useCallback(() => {
    setLogDetailsOpen(false)
    clearLogDetailsCloseTimeout()
    logDetailsCloseTimeoutRef.current = window.setTimeout(() => {
      setSelectedLog(null)
      logDetailsCloseTimeoutRef.current = null
    }, 220)
  }, [clearLogDetailsCloseTimeout])

  useEffect(() => {
    return () => clearLogDetailsCloseTimeout()
  }, [clearLogDetailsCloseTimeout])

  const handleLogDetailsOpenChange = (open: boolean) => {
    if (open) {
      setLogDetailsOpen(true)
      return
    }

    closeLogDetails()
  }

  const logsQuery = useQuery({
    queryKey: ["audit-logs", search, from, to, clientId, employeeId, type, module, status, page, pageSize, tableSort?.columnIndex, tableSort?.direction],
    queryFn: () => listAuditLogs({
      search: search.trim() || undefined,
      from: toApiDateTime(from),
      to: toApiDateTime(to),
      clientId,
      employeeId,
      type,
      module,
      status,
      page,
      limit: pageSize,
      sortBy: tableSort ? AUDIT_LOG_TABLE_SORT_FIELDS[tableSort.columnIndex] : undefined,
      sortDirection: tableSort?.direction,
    }),
  })

  const clientsQuery = useQuery({
    queryKey: ["clients", "logs-filter"],
    queryFn: () => listClients(""),
  })

  const employeesQuery = useQuery({
    queryKey: ["employees", "catalog"],
    queryFn: () => listEmployees(""),
  })

  const logs = logsQuery.data?.data.items ?? []
  const totalItems = logsQuery.data?.data.total ?? 0
  const totalPages = Math.max(1, logsQuery.data?.data.totalPages ?? 1)
  const hasActiveFilters = Boolean(search || from || to || clientId !== "all" || employeeId !== "all" || type !== "all" || module !== "all" || status !== "all")
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
    setModule("all")
    setStatus("all")
    setPage(1)
  }

  const filters = (
    <div className="-m-1 overflow-visible p-1">
      <div className="flex flex-wrap items-end gap-x-2 gap-y-5">
        <div className="w-full space-y-1 sm:w-[280px]">
          <Label>Busca</Label>
          <FilterSearchInput
            value={search}
            onValueChange={(value) => {
              setSearch(value)
              resetPage()
            }}
            placeholder="Buscar ação, usuário, cliente..."
          />
        </div>
        <div className="w-full space-y-1 sm:w-[190px]">
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
        <div className="w-full space-y-1 sm:w-[190px]">
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
        <div className="w-full space-y-1 sm:w-[230px]">
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
        <div className="w-full space-y-1 sm:w-[230px]">
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
        <div className="flex w-full flex-wrap items-end gap-x-2 gap-y-5 sm:w-auto">
          <div className="w-[176px] shrink-0 space-y-1">
            <Label>Funcionalidade</Label>
            <Select value={module} onValueChange={(value) => { setModule(value); resetPage() }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {LOG_MODULE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[152px] shrink-0 space-y-1">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(value) => { setType(value); resetPage() }}>
              <SelectTrigger className="w-full">
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
          <div className="w-[124px] shrink-0 space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={(value) => { setStatus(value as "all" | "success" | "error"); resetPage() }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="success">Sucesso</SelectItem>
                <SelectItem value="error">Falha</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" className="w-[112px] shrink-0 gap-2" onClick={clearFilters} disabled={!hasActiveFilters}>
            <X className="h-4 w-4" />
            Limpar
          </Button>
        </div>
      </div>
    </div>
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
          <Table
            containerClassName="md:h-full"
            manualSorting
            onSortChange={(sort) => {
              setTableSort(sort)
              setPage(1)
            }}
          >
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
                <TableRow
                  key={log.id}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => openLogDetails(log)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      openLogDetails(log)
                    }
                  }}
                >
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
            <Card
              key={log.id}
              role="button"
              tabIndex={0}
              className="cursor-pointer transition-colors hover:bg-muted/30"
              onClick={() => openLogDetails(log)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  openLogDetails(log)
                }
              }}
            >
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

      <Dialog open={logDetailsOpen} onOpenChange={handleLogDetailsOpenChange}>
        <DialogContent className="flex max-h-[min(90dvh,760px)] min-w-0 flex-col gap-0 overflow-hidden p-0 max-sm:left-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-none max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0 max-sm:[&_[data-slot=dialog-close]]:right-5 max-sm:[&_[data-slot=dialog-close]]:top-[calc(env(safe-area-inset-top)+1rem)] sm:max-w-3xl">
          <DialogHeader className="min-w-0 px-6 pb-3 pt-6 max-sm:px-5 max-sm:pt-[calc(env(safe-area-inset-top)+1.75rem)]">
            <DialogTitle>Detalhes do log</DialogTitle>
            <DialogDescription>
              {selectedLog?.title ?? "Registro de auditoria"}
            </DialogDescription>
          </DialogHeader>

          {selectedLog ? (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-6 max-sm:px-5 max-sm:pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
              {selectedLog.status === "error" ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <p className="font-semibold">Motivo da falha</p>
                  <p className="mt-1">{getFailureReason(selectedLog) || "Motivo não registrado para este log."}</p>
                </div>
              ) : null}

              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Data e hora</p>
                  <p>{formatDateTime(selectedLog.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Status</p>
                  <div className="mt-1">{getLogStatusBadge(selectedLog)}</div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Tipo</p>
                  <div className="mt-1">{getTypeBadge(selectedLog)}</div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Módulo</p>
                  <p>{selectedLog.moduleLabel || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Usuário</p>
                  <p>{selectedLog.actorName || "-"}</p>
                  {selectedLog.actorEmail ? <p className="text-xs text-muted-foreground">{selectedLog.actorEmail}</p> : null}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Cliente</p>
                  <p>{selectedLog.clientName || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Rota</p>
                  <p className="break-all font-mono text-xs">{selectedLog.method} {selectedLog.path}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">HTTP</p>
                  <p>{selectedLog.statusCode || "-"} · {selectedLog.durationMs} ms</p>
                </div>
              </div>

              <div className="space-y-1 text-sm">
                <p className="text-xs font-medium text-muted-foreground">Descrição</p>
                <p>{selectedLog.description || "-"}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Detalhes técnicos</p>
                <pre className="max-h-[260px] max-w-full overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed text-foreground">
                  {formatLogJson(selectedLog.metadata)}
                </pre>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
