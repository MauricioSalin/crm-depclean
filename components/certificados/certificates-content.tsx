"use client"

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Award, Calendar, Clock, Eye, FileText, MoreHorizontal, RotateCcw, Search, Trash2 } from "lucide-react"

import { buildApiFileUrl } from "@/lib/api/client"
import { deleteCertificate, listCertificates, type CertificateQueueRecord } from "@/lib/api/certificates"
import { listClients } from "@/lib/api/clients"
import { getApiErrorMessage } from "@/lib/api/errors"
import { listSchedules, type ScheduleRecord } from "@/lib/api/schedules"
import { getStoredUser } from "@/lib/auth/session"
import { formatCivilDate } from "@/lib/date-utils"
import { useMobileFiltersOpen } from "@/lib/hooks/use-mobile-filters"
import { AssignmentBadges } from "@/components/ui/assignment-badges"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog"
import { DataPagination } from "@/components/ui/data-pagination"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState, TableEmptyState } from "@/components/ui/empty-state"
import { CardSkeletonGrid, TableSkeletonRows } from "@/components/ui/table-skeleton"
import { Input } from "@/components/ui/input"
import { FilterSearchInput } from "@/components/ui/filter-search-input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface CertificatesContentProps {
  viewMode: "table" | "cards"
  viewToggle?: ReactNode
  createOpen?: boolean
  onCreateOpenChange?: (open: boolean) => void
}

function formatDate(value: string) {
  return formatCivilDate(value)
}

function getStatusBadge(status: CertificateQueueRecord["status"]) {
  if (status === "sent") {
    return <Badge className="bg-green-100 text-green-800">Enviado</Badge>
  }

  return <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>
}

function hasResponsible(record: CertificateQueueRecord) {
  return record.teams.length > 0 || record.additionalEmployees.length > 0
}

function formatScheduleOption(schedule: ScheduleRecord) {
  const time = schedule.time || "--:--"
  const unit = schedule.unitName || "Unidade principal"
  return `${time} - ${schedule.serviceTypeName} (${unit})`
}

function getCertificateUrl(record: CertificateQueueRecord) {
  return record.certificateUrl ? buildApiFileUrl(record.certificateUrl) : ""
}

export function CertificatesContent({ viewMode, viewToggle, createOpen = false, onCreateOpenChange }: CertificatesContentProps) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const mobileFiltersOpen = useMobileFiltersOpen()
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getStoredUser>>(null)
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [certificateToDelete, setCertificateToDelete] = useState<CertificateQueueRecord | null>(null)
  const [manualClientId, setManualClientId] = useState("")
  const [manualDate, setManualDate] = useState("")
  const [manualScheduleId, setManualScheduleId] = useState("")

  useEffect(() => {
    setMounted(true)
    const sync = () => setCurrentUser(getStoredUser())
    sync()
    window.addEventListener("storage", sync)
    window.addEventListener("depclean:session", sync)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("depclean:session", sync)
    }
  }, [])

  const canView = Boolean(
    currentUser?.permissions.includes("certificates_view") ||
      currentUser?.permissions.includes("certificates_manage") ||
      currentUser?.permissions.includes("settings_manage"),
  )
  const canManage = Boolean(
    currentUser?.permissions.includes("certificates_manage") || currentUser?.permissions.includes("settings_manage"),
  )

  const certificatesQuery = useQuery({
    queryKey: ["certificates", "list"],
    queryFn: () => listCertificates(),
    enabled: mounted && canView,
  })

  const clientsQuery = useQuery({
    queryKey: ["clients", "certificate-manual"],
    queryFn: () => listClients(),
    enabled: mounted && canManage && createOpen,
  })

  const manualSchedulesQuery = useQuery({
    queryKey: ["schedules", "certificate-manual", manualDate],
    queryFn: () => listSchedules({ status: "completed", dateFrom: manualDate, dateTo: manualDate }),
    enabled: mounted && canManage && createOpen && Boolean(manualDate),
  })

  const records = certificatesQuery.data?.data ?? []
  const manualClients = clientsQuery.data?.data ?? []
  const completedSchedulesForManualCertificate = (manualSchedulesQuery.data?.data ?? []).filter(
    (schedule) =>
      schedule.status === "completed" &&
      schedule.clientId === manualClientId &&
      schedule.date === manualDate,
  )
  const manualClientOptions = manualClients.map((client) => ({
    value: client.id,
    label: client.companyName,
  }))
  const manualScheduleOptions = completedSchedulesForManualCertificate.map((schedule) => ({
    value: schedule.id,
    label: formatScheduleOption(schedule),
  }))

  const invalidateCertificates = async (clientId?: string) => {
    await queryClient.invalidateQueries({ queryKey: ["certificates"] })
    await queryClient.invalidateQueries({ queryKey: ["notifications"] })
    if (clientId) {
      await queryClient.invalidateQueries({ queryKey: ["client-attachments", clientId] })
    }
  }

  const deleteMutation = useMutation({
    mutationFn: (record: CertificateQueueRecord) => deleteCertificate(record.scheduleId),
    onMutate: () => {
      const toastId = toast.loading("Excluindo certificado...")
      return { toastId }
    },
    onSuccess: async (_response, record, context) => {
      await invalidateCertificates(record.clientId)
      setCertificateToDelete(null)
      toast.success("Certificado excluído.", {
        id: context?.toastId,
        description: "O arquivo também foi removido dos anexos do cliente.",
      })
    },
    onError: (error, _record, context) => {
      toast.error(getApiErrorMessage(error, "Não foi possível excluir o certificado."), {
        id: context?.toastId,
      })
    },
  })

  const filteredRecords = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return records.filter((record) => {
      const matchesStatus = statusFilter === "all" || record.status === statusFilter
      const matchesSearch =
        !term ||
        record.clientName.toLowerCase().includes(term) ||
        record.unitName.toLowerCase().includes(term) ||
        record.serviceTypeName.toLowerCase().includes(term) ||
        record.teams.some((team) => team.name.toLowerCase().includes(term)) ||
        record.additionalEmployees.some((employee) => employee.name.toLowerCase().includes(term))

      return matchesStatus && matchesSearch
    })
  }, [records, searchTerm, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / itemsPerPage))
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredRecords.slice(start, start + itemsPerPage)
  }, [currentPage, filteredRecords, itemsPerPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, itemsPerPage])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  useEffect(() => {
    setManualScheduleId("")
  }, [manualClientId, manualDate])

  const canIssueCertificate = (record: CertificateQueueRecord) => canManage && record.status === "pending"

  const openCertificateIssue = (record: CertificateQueueRecord) => {
    if (!canIssueCertificate(record)) return
    router.push(`/certificados/${record.scheduleId}`)
  }

  const closeCreateDialog = () => {
    onCreateOpenChange?.(false)
    setManualClientId("")
    setManualDate("")
    setManualScheduleId("")
  }

  const handleManualCertificateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!manualScheduleId) return
    closeCreateDialog()
    router.push(`/certificados/${manualScheduleId}`)
  }

  if (mounted && !canView) {
    return (
      <Card>
        <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-center">
          <Award className="h-10 w-10 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold">Acesso restrito</h2>
            <p className="text-sm text-muted-foreground">
              Seu perfil não possui permissão para visualizar certificados.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (open) {
            onCreateOpenChange?.(true)
            return
          }

          closeCreateDialog()
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="pr-6">
            <DialogTitle>Criar certificado avulso</DialogTitle>
            <DialogDescription>
              Selecione um cliente, a data da visita e um agendamento concluído para emitir o certificado.
            </DialogDescription>
          </DialogHeader>

          <form autoComplete="off" onSubmit={handleManualCertificateSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <SearchableSelect
                value={manualClientId}
                onValueChange={setManualClientId}
                options={manualClientOptions}
                includeAll={false}
                placeholder={clientsQuery.isLoading ? "Carregando clientes..." : "Selecione um cliente"}
                searchPlaceholder="Buscar cliente..."
                emptyMessage="Nenhum cliente encontrado."
                className="w-full"
                disabled={!canManage || clientsQuery.isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-certificate-date">Data da visita</Label>
              <Input
                id="manual-certificate-date"
                type="date"
                value={manualDate}
                onChange={(event) => setManualDate(event.target.value)}
                className="text-base md:text-sm"
                disabled={!canManage || !manualClientId}
              />
            </div>

            {manualClientId && manualDate ? (
              <div className="space-y-2">
                <Label>Agendamento concluído</Label>
                <SearchableSelect
                  value={manualScheduleId}
                  onValueChange={setManualScheduleId}
                  options={manualScheduleOptions}
                  includeAll={false}
                  placeholder={manualSchedulesQuery.isLoading ? "Carregando agendamentos..." : "Selecione um agendamento"}
                  searchPlaceholder="Buscar agendamento..."
                  emptyMessage="Nenhum agendamento concluído nessa data."
                  className="w-full"
                  disabled={!canManage || manualSchedulesQuery.isLoading || manualScheduleOptions.length === 0}
                />
                {!manualSchedulesQuery.isLoading && manualScheduleOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhum agendamento concluído encontrado para esse cliente nessa data.
                  </p>
                ) : null}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeCreateDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!manualScheduleId}>
                Emitir certificado
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className={`${mobileFiltersOpen ? "grid" : "hidden"} -m-1 shrink-0 grid-cols-2 gap-2 overflow-visible p-1 sm:flex sm:items-center`}>
          <FilterSearchInput
            wrapperClassName="col-span-2 sm:w-80"
            value={searchTerm}
            spellCheck={false}
            onValueChange={(value) => {
              setSearchTerm(value)
              setCurrentPage(1)
            }}
            placeholder="Buscar cliente, serviço, equipe..."
          />
          <SearchableSelect
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value)
              setCurrentPage(1)
            }}
            allLabel="Todos os status"
            placeholder="Status"
            searchPlaceholder="Buscar status..."
            className="col-span-2 sm:w-[160px]"
            options={[
              { value: "pending", label: "Pendentes" },
              { value: "sent", label: "Enviados" },
            ]}
          />
          {viewToggle ? <div className="hidden shrink-0 sm:block">{viewToggle}</div> : null}
        </div>

        {viewMode === "table" ? (
          <div className="rounded-md md:min-h-0 md:flex-1 md:overflow-hidden">
            <Table containerClassName="md:h-full" onSortChange={() => setCurrentPage(1)}>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[190px]">Cliente</TableHead>
                  <TableHead className="hidden min-w-[220px] sm:table-cell">Serviço</TableHead>
                  <TableHead className="hidden lg:table-cell">Equipe / Funcionários</TableHead>
                  <TableHead className="hidden md:table-cell">Data/Hora</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody page={!certificatesQuery.isLoading && filteredRecords.length > 0 ? currentPage : undefined} pageSize={!certificatesQuery.isLoading && filteredRecords.length > 0 ? itemsPerPage : undefined}>
                {certificatesQuery.isLoading ? (
                  <TableSkeletonRows
                    rows={5}
                    columns={[
                      { withIcon: true, width: "w-36" },
                      { className: "hidden sm:table-cell", width: "w-40" },
                      { className: "hidden lg:table-cell", width: "w-32" },
                      { className: "hidden md:table-cell", width: "w-24" },
                      { className: "hidden sm:table-cell", width: "w-20" },
                      { align: "right", width: "w-16" },
                    ]}
                  />
                ) : filteredRecords.length === 0 ? (
                  <TableEmptyState colSpan={6} icon={Award} title="Nenhum certificado encontrado." />
                ) : (
                  filteredRecords.map((record) => {
                    const canIssue = canIssueCertificate(record)
                    const certificateUrl = getCertificateUrl(record)

                    return (
                    <TableRow
                      key={record.id}
                      className={canIssue ? "cursor-pointer" : undefined}
                      tabIndex={canIssue ? 0 : undefined}
                      aria-label={canIssue ? `Emitir certificado de ${record.clientName}` : undefined}
                      onClick={() => openCertificateIssue(record)}
                      onKeyDown={(event) => {
                        if (!canIssue || (event.key !== "Enter" && event.key !== " ")) return
                        event.preventDefault()
                        openCertificateIssue(record)
                      }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <Award className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">{record.clientName}</p>
                            <p className="truncate text-xs text-muted-foreground">{record.unitName || "Unidade principal"}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground sm:hidden">
                              {record.serviceTypeName} • {formatDate(record.date)}
                            </p>
                            <div className="mt-1 sm:hidden">{getStatusBadge(record.status)}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden min-w-[220px] sm:table-cell">
                        <div>
                          <p>{record.serviceTypeName}</p>
                          {record.naFileName ? (
                            <p className="mt-1 hidden items-center gap-1 text-xs text-muted-foreground md:flex">
                              <FileText className="h-3 w-3" />
                              {record.naCount > 1 ? `${record.naCount} NAs anexadas` : record.naFileName}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <AssignmentBadges
                          teams={record.teams}
                          employees={record.additionalEmployees}
                          emptyLabel="Sem responsável"
                          className="justify-center"
                        />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="space-y-1 text-sm">
                          <p className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatDate(record.date)}
                          </p>
                          <p className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            {record.time || "--:--"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{getStatusBadge(record.status)}</TableCell>
                      <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {canManage && record.status === "pending" ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  asChild
                                  size="sm"
                                  className="h-9 rounded-full bg-primary px-3 text-primary-foreground hover:bg-primary/90"
                                >
                                  <Link href={`/certificados/${record.scheduleId}`} aria-label="Emitir certificado" className="gap-2">
                                    <Award className="h-4 w-4" />
                                    <span>Emitir</span>
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Emitir certificado</TooltipContent>
                            </Tooltip>
                          ) : null}

                          {certificateUrl || (canManage && record.status === "sent") ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Ações do certificado">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {certificateUrl ? (
                                  <DropdownMenuItem asChild className="cursor-pointer">
                                    <a href={certificateUrl} target="_blank" rel="noreferrer">
                                      <Eye className="mr-2 h-4 w-4" />
                                      Visualizar
                                    </a>
                                  </DropdownMenuItem>
                                ) : null}
                                {canManage && record.status === "sent" ? (
                                  <>
                                    <DropdownMenuItem
                                      className="cursor-pointer"
                                      onClick={() => router.push(`/certificados/${record.scheduleId}`)}
                                    >
                                      <RotateCcw className="mr-2 h-4 w-4" />
                                      Reemitir
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="cursor-pointer"
                                      disabled={deleteMutation.isPending}
                                      onClick={() => setCertificateToDelete(record)}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Excluir
                                    </DropdownMenuItem>
                                  </>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}

                          {!canManage && !certificateUrl ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" className="h-9 w-9 rounded-full" disabled aria-label="Emitir certificado">
                                  <Award className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Emitir certificado</TooltipContent>
                            </Tooltip>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="md:min-h-0 md:flex-1 md:overflow-y-auto md:pr-1">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {certificatesQuery.isLoading ? (
              <CardSkeletonGrid cards={4} />
            ) : paginatedRecords.length === 0 ? (
              <EmptyState icon={Award} title="Nenhum certificado encontrado." className="sm:col-span-2" />
            ) : (
              paginatedRecords.map((record) => {
                const canIssue = canIssueCertificate(record)
                const certificateUrl = getCertificateUrl(record)

                return (
                <Card
                  key={record.id}
                  className={`h-full overflow-hidden py-4 ${canIssue ? "cursor-pointer" : ""}`}
                  tabIndex={canIssue ? 0 : undefined}
                  aria-label={canIssue ? `Emitir certificado de ${record.clientName}` : undefined}
                  onClick={() => openCertificateIssue(record)}
                  onKeyDown={(event) => {
                    if (!canIssue || (event.key !== "Enter" && event.key !== " ")) return
                    event.preventDefault()
                    openCertificateIssue(record)
                  }}
                >
                  <CardContent className="flex h-full flex-col px-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Award className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-foreground">{record.clientName}</h3>
                          <p className="truncate text-xs text-muted-foreground">{record.unitName || "Unidade principal"}</p>
                        </div>
                      </div>
                      {getStatusBadge(record.status)}
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-foreground/80">{record.serviceTypeName}</p>
                          {record.naFileName ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {record.naCount > 1 ? `${record.naCount} NAs anexadas` : record.naFileName}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4 shrink-0" />
                        <span>{formatDate(record.date)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4 shrink-0" />
                        <span>{record.time || "--:--"}</span>
                      </div>
                    </div>

                    {hasResponsible(record) ? (
                      <AssignmentBadges
                        teams={record.teams}
                        employees={record.additionalEmployees}
                        className="mt-3"
                      />
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">Sem responsável vinculado.</p>
                    )}

                    <div className="mt-auto flex gap-2 pt-4" onClick={(event) => event.stopPropagation()}>
                      {certificateUrl ? (
                        <Button asChild variant="outline" className="h-9 min-w-0 flex-1 text-sm">
                          <a href={certificateUrl} target="_blank" rel="noreferrer" aria-label="Visualizar certificado">
                            <Eye className="mr-2 h-4 w-4 shrink-0" />
                            Visualizar
                          </a>
                        </Button>
                      ) : null}

                      {canManage ? (
                        <>
                        {record.status === "pending" ? (
                          <Button asChild className="h-9 flex-1 text-sm">
                            <Link href={`/certificados/${record.scheduleId}`}>
                              <Award className="mr-2 h-4 w-4" />
                              Emitir
                            </Link>
                          </Button>
                        ) : (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-9 flex-1 text-sm"
                              onClick={() => router.push(`/certificados/${record.scheduleId}`)}
                            >
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Reemitir
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 shrink-0"
                              disabled={deleteMutation.isPending}
                              onClick={() => setCertificateToDelete(record)}
                              aria-label="Excluir certificado"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        </>
                      ) : !certificateUrl ? (
                        <Button className="h-9 flex-1 text-sm" disabled>
                          <Award className="mr-2 h-4 w-4" />
                          Emitir
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
                )
              })
            )}
            </div>
          </div>
        )}

        {!certificatesQuery.isLoading ? (
          <DataPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={itemsPerPage}
            totalItems={filteredRecords.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setItemsPerPage(size)
              setCurrentPage(1)
            }}
          />
        ) : null}
      </div>

      <ConfirmActionDialog
        open={!!certificateToDelete}
        title="Excluir certificado"
        description={
          certificateToDelete
            ? `Tem certeza que deseja excluir o certificado de ${certificateToDelete.clientName}? Esta ação também remove o arquivo dos anexos do cliente.`
            : "Tem certeza que deseja excluir este certificado?"
        }
        confirmLabel="Excluir"
        onOpenChange={(open) => {
          if (!open) setCertificateToDelete(null)
        }}
        onConfirm={() => {
          if (certificateToDelete) {
            deleteMutation.mutate(certificateToDelete)
          }
        }}
        busy={deleteMutation.isPending}
      />
    </>
  )
}
