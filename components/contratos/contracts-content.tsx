"use client"

import { useDeferredValue, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Building2,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Edit,
  ExternalLink,
  Eye,
  FileText,
  MoreHorizontal,
  RefreshCw,
  Search,
} from "lucide-react"

import { DataPagination } from "@/components/ui/data-pagination"
import { EmptyState, TableEmptyState } from "@/components/ui/empty-state"
import { CardSkeletonGrid, TableSkeletonRows } from "@/components/ui/table-skeleton"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Badge } from "@/components/ui/badge"
import {
  BusinessStatusBadge,
  isContractAwaitingSchedules,
} from "@/components/ui/business-status-badges"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog"
import { Input } from "@/components/ui/input"
import { FilterSearchInput } from "@/components/ui/filter-search-input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CsvImportDialog, type CsvImportField } from "@/components/ui/csv-import-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getApiErrorMessage } from "@/lib/api/errors"
import {
  importSignedContracts,
  listContracts,
  markContractAsRenewed,
  type ContractImportRow,
  type ContractRecord,
} from "@/lib/api/contracts"
import { getContractClicksignUrl } from "@/lib/clicksign"
import {
  getClicksignContractStatusLabel,
  isClosedClicksignContractStatus,
  isContractEligibleForRenewal,
  isContractEligibleToMarkAsRenewed,
  isContractExpiredByValidity,
  isContractRenewed,
  isOperationallyActiveContract,
  normalizeClicksignContractStatus,
} from "@/lib/contract-status"
import { formatCivilDate } from "@/lib/date-utils"
import { formatContractNumber } from "@/lib/utils"
import { useMobileFiltersOpen } from "@/lib/hooks/use-mobile-filters"
import { useUrlQueryState } from "@/lib/hooks/use-url-query-state"
import { buildPathWithSearchParams, withReturnTo } from "@/lib/navigation"
import { useHasAnyPermission } from "@/hooks/use-permissions"

interface ContractsContentProps {
  viewMode: "table" | "cards"
  viewToggle?: React.ReactNode
  openImport?: boolean
  onImportChange?: (open: boolean) => void
}

const CONTRACT_IMPORT_FIELDS: CsvImportField[] = [
  { key: "contractNumber", label: "Número do contrato", required: true },
  { key: "clientId", label: "ID do cliente", required: true },
  { key: "templateId", label: "ID do template", required: true },
  { key: "unitIds", label: "IDs das unidades (vírgula)" },
  { key: "serviceTypeIds", label: "IDs dos serviços (vírgula)", required: true },
  { key: "serviceValues", label: "Valores dos serviços (vírgula)" },
  { key: "totalValue", label: "Valor total", required: true },
  { key: "downPaymentValue", label: "Valor de entrada" },
  { key: "duration", label: "Duração em meses", required: true },
  { key: "startDate", label: "Data de criação", required: true },
  { key: "firstDueDate", label: "Data da primeira parcela", required: true },
  { key: "endDate", label: "Data final" },
  { key: "firstVisitDate", label: "Data da primeira visita" },
  { key: "firstVisitTime", label: "Horário da primeira visita" },
  { key: "paymentDay", label: "Dia de pagamento", required: true },
  { key: "installmentsCount", label: "Parcelas", required: true },
  { key: "recurrence", label: "Recorrência" },
  { key: "status", label: "Status" },
  { key: "signedAt", label: "Assinado em" },
  { key: "paidInstallmentsThroughDate", label: "Parcelas pagas até" },
  { key: "signatureUrl", label: "URL de assinatura" },
  { key: "documentUrl", label: "URL do documento" },
  { key: "documentFileName", label: "Nome do documento" },
  { key: "clicksignEnvelopeId", label: "Clicksign envelope ID" },
  { key: "clicksignDocumentKey", label: "Clicksign document key" },
  { key: "clicksignDocumentId", label: "Clicksign document ID" },
  { key: "clicksignWebhookId", label: "Clicksign webhook ID" },
  { key: "clicksignStatus", label: "Clicksign status" },
  { key: "clicksignLastSyncedAt", label: "Clicksign sincronizado em" },
  { key: "clicksignSigners", label: "Clicksign assinantes" },
  { key: "notes", label: "Observações" },
]

const isContractSigned = (contract: Pick<ContractRecord, "status" | "clicksign">) => {
  return isClosedClicksignContractStatus(contract.status)
}

const CONTRACT_STATUS_FILTER_VALUES = new Set([
  "all",
  "filling",
  "draft",
  "running",
  "closed",
  "canceled",
  "expired",
  "renewed",
])

function normalizeContractStatusFilter(value: string) {
  return CONTRACT_STATUS_FILTER_VALUES.has(value) ? value : "all"
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function hasDefinedContractValue(contract: ContractRecord) {
  return Number.isFinite(contract.totalValue) && contract.totalValue > 0
}

function formatDate(value?: string) {
  return formatCivilDate(value)
}

export function ContractsContent({ viewMode, viewToggle, openImport = false, onImportChange }: ContractsContentProps) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const mobileFiltersOpen = useMobileFiltersOpen()
  const canEditContracts = useHasAnyPermission(["contracts_edit"])
  const canCreateContracts = useHasAnyPermission(["contracts_create"])
  const [searchTerm, setSearchTerm] = useUrlQueryState("q")
  const [statusFilterParam, setStatusFilter] = useUrlQueryState("status", "all", { debounceMs: 0 })
  const statusFilter = normalizeContractStatusFilter(statusFilterParam)
  const validityFilter = searchParams.get("validity")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [contractToMarkRenewed, setContractToMarkRenewed] = useState<ContractRecord | null>(null)
  const deferredSearchTerm = useDeferredValue(searchTerm)

  const contractsQuery = useQuery({
    queryKey: ["contracts", deferredSearchTerm],
    queryFn: () => listContracts(deferredSearchTerm),
  })

  const importContractsMutation = useMutation({
    mutationFn: (rows: ContractImportRow[]) => importSignedContracts(rows),
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["contracts"] }),
        queryClient.invalidateQueries({ queryKey: ["financial"] }),
        queryClient.invalidateQueries({ queryKey: ["analytics"] }),
      ])
      onImportChange?.(false)
      toast.success("Contratos importados.", {
        description: `${response.data.importedCount} registro(s) assinados foram inseridos no banco de dados.`,
      })
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, "Não foi possível importar os contratos."))
    },
  })

  const markAsRenewedMutation = useMutation({
    mutationFn: (contractId: string) => markContractAsRenewed(contractId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["contracts"] }),
        queryClient.invalidateQueries({ queryKey: ["analytics"] }),
      ])
      setContractToMarkRenewed(null)
      toast.success("Contrato marcado como renovado.")
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, "Não foi possível marcar o contrato como renovado."))
    },
  })

  const contracts = contractsQuery.data?.data ?? []
  const currentHref = buildPathWithSearchParams(pathname, searchParams)
  const getContractProfileHref = (contractId: string) => withReturnTo(`/contratos/${contractId}`, currentHref)
  const getContractEditHref = (contractId: string) => withReturnTo(`/contratos/${contractId}/editar`, getContractProfileHref(contractId))
  const getContractPrimaryHref = (contract: ContractRecord) => (
    contract.internalStatus === "filling"
      ? withReturnTo(`/contratos/${contract.id}/editar`, currentHref)
      : getContractProfileHref(contract.id)
  )
  const getContractRenewHref = (contractId: string) => (
    withReturnTo(`/contratos/novo?renewFrom=${encodeURIComponent(contractId)}`, currentHref)
  )
  const filteredContracts = useMemo(() => {
    return contracts.filter((contract) => {
      if (statusFilter === "all") return true
      if (statusFilter === "filling") return contract.internalStatus === "filling"
      if (contract.internalStatus === "filling") return false
      if (statusFilter === "renewed") return isContractRenewed(contract)
      if (statusFilter === "expired") return isContractExpiredByValidity(contract)
      if (isContractRenewed(contract)) return false
      return normalizeClicksignContractStatus(contract.status) === statusFilter
    }).filter((contract) => {
      if (validityFilter === "active" || validityFilter === "current") return isOperationallyActiveContract(contract)
      if (validityFilter === "inactive" || validityFilter === "expired") return isContractExpiredByValidity(contract)
      return true
    })
  }, [contracts, statusFilter, validityFilter])

  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, validityFilter])

  const totalPages = Math.max(1, Math.ceil(filteredContracts.length / pageSize))
  const paginatedContracts = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredContracts.slice(start, start + pageSize)
  }, [currentPage, filteredContracts, pageSize])

  const getStatusBadge = (contract: ContractRecord) => {
    if (contract.internalStatus === "filling") {
      return <Badge className="shrink-0 bg-amber-100 text-amber-700 hover:bg-amber-100">Em preenchimento</Badge>
    }
    if (isContractRenewed(contract)) {
      return <Badge className="shrink-0 bg-blue-100 text-blue-700 hover:bg-blue-100">Renovado</Badge>
    }
    if (isContractExpiredByValidity(contract)) {
      return <Badge className="shrink-0 bg-red-100 text-red-700 hover:bg-red-100">Vencido</Badge>
    }
    if (isContractAwaitingSchedules(contract)) {
      return null
    }
    const normalized = normalizeClicksignContractStatus(contract.status)
    const className = normalized === "closed"
      ? "bg-green-100 text-green-700 hover:bg-green-100"
      : normalized === "running"
        ? "bg-amber-100 text-amber-700 hover:bg-amber-100"
        : normalized === "canceled"
          ? "bg-red-100 text-red-700 hover:bg-red-100"
          : "bg-gray-100 text-gray-700 hover:bg-gray-100"
    return <Badge className={`shrink-0 ${className}`}>{getClicksignContractStatusLabel(normalized)}</Badge>
  }

  const importContracts = async (rows: Array<Record<string, string>>) => {
    const contracts = rows.map((row) => ({
      contractNumber: row.contractNumber,
      clientId: row.clientId,
      templateId: row.templateId,
      unitIds: row.unitIds,
      serviceTypeIds: row.serviceTypeIds,
      serviceValues: row.serviceValues,
      totalValue: row.totalValue,
      downPaymentValue: row.downPaymentValue,
      duration: row.duration,
      startDate: row.startDate,
      firstDueDate: row.firstDueDate,
      endDate: row.endDate,
      firstVisitDate: row.firstVisitDate,
      firstVisitTime: row.firstVisitTime,
      paymentDay: row.paymentDay,
      installmentsCount: row.installmentsCount,
      recurrence: row.recurrence,
      status: row.status,
      signedAt: row.signedAt,
      paidInstallmentsThroughDate: row.paidInstallmentsThroughDate,
      signatureUrl: row.signatureUrl,
      documentUrl: row.documentUrl,
      documentFileName: row.documentFileName,
      clicksignEnvelopeId: row.clicksignEnvelopeId,
      clicksignDocumentKey: row.clicksignDocumentKey,
      clicksignDocumentId: row.clicksignDocumentId,
      clicksignWebhookId: row.clicksignWebhookId,
      clicksignStatus: row.clicksignStatus,
      clicksignLastSyncedAt: row.clicksignLastSyncedAt,
      clicksignSigners: row.clicksignSigners,
      notes: row.notes,
    }))

    await importContractsMutation.mutateAsync(contracts)
  }

  return (
    <>
      <ConfirmActionDialog
        open={Boolean(contractToMarkRenewed)}
        title="Marcar contrato como renovado?"
        description="Use esta opção quando a renovação foi criada fora deste fluxo. O contrato continuará assinado e manterá suas datas de vigência, mas deixará de receber alertas de vencimento."
        confirmLabel="Marcar como renovado"
        confirmVariant="default"
        confirmClassName="bg-primary hover:bg-primary/90"
        busy={markAsRenewedMutation.isPending}
        onOpenChange={(open) => {
          if (!open && !markAsRenewedMutation.isPending) setContractToMarkRenewed(null)
        }}
        onConfirm={() => {
          if (contractToMarkRenewed) {
            markAsRenewedMutation.mutate(contractToMarkRenewed.id)
          }
        }}
      />
      <CsvImportDialog
        open={openImport}
        onOpenChange={(open) => onImportChange?.(open)}
        title="Importar contratos assinados"
        description="Anexe um CSV com contrato, parcelas, documento e dados Clicksign para registrar contratos já assinados."
        fields={CONTRACT_IMPORT_FIELDS}
        onImport={importContracts}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className={`${mobileFiltersOpen ? "grid" : "hidden"} -m-1 shrink-0 grid-cols-2 gap-2 overflow-visible p-1 sm:flex sm:items-center`}>
        <FilterSearchInput
          wrapperClassName="sm:w-80 sm:flex-none"
          placeholder="Buscar por número ou cliente..."
          value={searchTerm}
          spellCheck={false}
          onValueChange={(value) => {
            setSearchTerm(value)
            setCurrentPage(1)
          }}
        />

        <SearchableSelect
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value)
            setCurrentPage(1)
          }}
          options={[
            { value: "filling", label: "Em preenchimento" },
            { value: "draft", label: "Aguardando envio" },
            { value: "running", label: "Aguardando assinatura" },
            { value: "closed", label: "Assinado" },
            { value: "expired", label: "Vencido" },
            { value: "renewed", label: "Renovado" },
            { value: "canceled", label: "Cancelado" },
          ]}
          placeholder="Status"
          searchPlaceholder="Buscar status..."
          allLabel="Todos os status"
          className="sm:w-[160px] sm:flex-none"
        />

        {viewToggle ? <div className="hidden shrink-0 sm:block">{viewToggle}</div> : null}
      </div>

      {viewMode === "table" ? (
        <div className="rounded-xl md:min-h-0 md:flex-1 md:overflow-hidden">
          <Table containerClassName="md:h-full" onSortChange={() => setCurrentPage(1)}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[220px] min-w-[220px]">Contrato</TableHead>
                <TableHead className="hidden w-[500px] min-w-[440px] sm:table-cell">Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Valor</TableHead>
                <TableHead className="hidden lg:table-cell">Vigência</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody page={!contractsQuery.isLoading && filteredContracts.length > 0 ? currentPage : undefined} pageSize={!contractsQuery.isLoading && filteredContracts.length > 0 ? pageSize : undefined}>
              {contractsQuery.isLoading ? (
                <TableSkeletonRows
                  rows={5}
                  columns={[
                    { withIcon: true, width: "w-32" },
                    { className: "hidden sm:table-cell", width: "w-48" },
                    { className: "hidden md:table-cell", width: "w-24" },
                    { className: "hidden lg:table-cell", width: "w-32" },
                    { width: "w-28" },
                    { align: "right", width: "w-10" },
                  ]}
                />
              ) : filteredContracts.length === 0 ? (
                <TableEmptyState colSpan={6} icon={FileText} title="Nenhum contrato encontrado." />
              ) : (
                filteredContracts.map((contract) => {
                  const paidInstallments = contract.installments.filter((item) => item.status === "paid").length
                  const clicksignUrl = getContractClicksignUrl(contract)
                  const hasEffectiveValidity = isClosedClicksignContractStatus(contract.status)
                    && Boolean(contract.startDate)
                    && Boolean(contract.endDate)
                  return (
                    <TableRow
                      key={contract.id}
                      role="link"
                      tabIndex={0}
                      className="cursor-pointer"
                      aria-label={`Abrir contrato ${formatContractNumber(contract.contractNumber)}`}
                      onClick={() => router.push(getContractPrimaryHref(contract))}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return
                        event.preventDefault()
                        router.push(getContractPrimaryHref(contract))
                      }}
                    >
                      <TableCell className="w-[220px] max-w-[220px]">
                        <div className="flex items-center gap-3">
                          <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:flex">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{formatContractNumber(contract.contractNumber)}</p>
                            <div className="flex min-w-0 items-center gap-1.5 sm:hidden">
                              <p className="min-w-0 truncate text-xs text-muted-foreground">{contract.clientCompanyName}</p>
                              {contract.isClientDelinquent ? <BusinessStatusBadge status="delinquent" /> : null}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden w-[500px] max-w-[500px] sm:table-cell">
                        <div className="flex min-w-0 items-center gap-2">
                          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 truncate">{contract.clientCompanyName}</span>
                          {contract.isClientDelinquent ? <BusinessStatusBadge status="delinquent" /> : null}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {hasDefinedContractValue(contract) ? (
                          <div>
                            <p className="font-medium">{formatCurrency(contract.totalValue)}</p>
                            <p className="text-xs text-muted-foreground">
                              {paidInstallments}/{contract.installmentsCount} parcelas
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Ainda não definido</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-sm lg:table-cell">
                        {hasEffectiveValidity ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(contract.startDate)}</span>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <CalendarCheck className="h-3 w-3" />
                              <span>{formatDate(contract.endDate)}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>-</span>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <CalendarCheck className="h-3 w-3" />
                              <span>-</span>
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {getStatusBadge(contract)}
                          {isContractAwaitingSchedules(contract) ? (
                            <BusinessStatusBadge status="awaiting-schedules" />
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Abrir ações do contrato ${contract.contractNumber}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {contract.internalStatus !== "filling" ? (
                              <DropdownMenuItem asChild>
                                <Link href={getContractPrimaryHref(contract)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Ver Detalhes
                                </Link>
                              </DropdownMenuItem>
                            ) : null}
                            {canEditContracts && !isContractSigned(contract) ? (
                              <DropdownMenuItem asChild>
                                <Link href={contract.internalStatus === "filling"
                                  ? getContractPrimaryHref(contract)
                                  : getContractEditHref(contract.id)}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Editar
                                </Link>
                              </DropdownMenuItem>
                            ) : null}
                            {contract.internalStatus !== "filling" && clicksignUrl ? (
                              <DropdownMenuItem asChild>
                                <a href={clicksignUrl} target="_blank" rel="noreferrer">
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  Ver no ClickSign
                                </a>
                              </DropdownMenuItem>
                            ) : null}
                            {canCreateContracts && isContractEligibleForRenewal(contract) ? (
                              <DropdownMenuItem asChild>
                                <Link href={getContractRenewHref(contract.id)}>
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  Renovar
                                </Link>
                              </DropdownMenuItem>
                            ) : null}
                            {canCreateContracts && isContractEligibleToMarkAsRenewed(contract) ? (
                              <DropdownMenuItem onSelect={() => setContractToMarkRenewed(contract)}>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Marcar como renovado
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
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
            {contractsQuery.isLoading ? (
              <CardSkeletonGrid cards={4} />
            ) : paginatedContracts.length === 0 ? (
              <EmptyState icon={FileText} title="Nenhum contrato encontrado." className="sm:col-span-2" />
            ) : paginatedContracts.map((contract) => {
              const paidInstallments = contract.installments.filter((item) => item.status === "paid").length
              const progress = contract.installmentsCount > 0 ? (paidInstallments / contract.installmentsCount) * 100 : 0
              const hasEffectiveValidity = isClosedClicksignContractStatus(contract.status)
                && Boolean(contract.startDate)
                && Boolean(contract.endDate)

              return (
                <Card
                  key={contract.id}
                  role="link"
                  tabIndex={0}
                  className="h-full cursor-pointer overflow-hidden"
                  aria-label={`Abrir contrato ${formatContractNumber(contract.contractNumber)}`}
                  onClick={() => router.push(getContractPrimaryHref(contract))}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return
                    event.preventDefault()
                    router.push(getContractPrimaryHref(contract))
                  }}
                >
                  <CardContent className="flex h-full flex-col px-6">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <h3 className="min-w-0 break-words text-sm font-semibold">{formatContractNumber(contract.contractNumber)}</h3>
                            {getStatusBadge(contract)}
                            {isContractAwaitingSchedules(contract) ? (
                              <BusinessStatusBadge status="awaiting-schedules" />
                            ) : null}
                          </div>
                          <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
                            <p className="min-w-0 truncate text-xs text-muted-foreground">{contract.clientCompanyName}</p>
                            {contract.isClientDelinquent ? <BusinessStatusBadge status="delinquent" /> : null}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <p className="font-medium text-foreground">
                            {hasDefinedContractValue(contract)
                              ? formatCurrency(contract.totalValue)
                              : "Dados financeiros ainda não definidos"}
                          </p>
                        </div>
                        {hasEffectiveValidity ? (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {formatDate(contract.startDate)} - {formatDate(contract.endDate)}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-auto space-y-3 pt-3">
                      {contract.internalStatus !== "filling" ? (
                        <div>
                          <div className="mb-2 flex justify-between text-xs">
                            <span>
                              {paidInstallments}/{contract.installmentsCount} parcelas pagas
                            </span>
                            <span>{Math.round(progress)}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                      ) : null}
                      <div
                        className="flex flex-wrap gap-2"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        {canEditContracts && !isContractSigned(contract) ? (
                          <Button variant="outline" size="sm" className="flex-1" asChild>
                            <Link href={contract.internalStatus === "filling"
                              ? getContractPrimaryHref(contract)
                              : getContractEditHref(contract.id)}
                            >
                              <Edit className="mr-1 h-4 w-4" />
                              Editar
                            </Link>
                          </Button>
                        ) : null}
                        {canCreateContracts && isContractEligibleForRenewal(contract) ? (
                          <Button variant="outline" size="sm" className="min-w-[110px] flex-1" asChild>
                            <Link href={getContractRenewHref(contract.id)}>
                              <RefreshCw className="mr-1 h-4 w-4" />
                              Renovar
                            </Link>
                          </Button>
                        ) : null}
                        {canCreateContracts && isContractEligibleToMarkAsRenewed(contract) ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-w-[180px] flex-1"
                            onClick={() => setContractToMarkRenewed(contract)}
                          >
                            <CheckCircle2 className="mr-1 h-4 w-4" />
                            Marcar como renovado
                          </Button>
                        ) : null}
                        {contract.internalStatus !== "filling" ? (
                          <Button size="sm" className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                            <Link href={getContractPrimaryHref(contract)}>
                              <Eye className="mr-1 h-4 w-4" />
                              Ver
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {!contractsQuery.isLoading ? (
        <DataPagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredContracts.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setCurrentPage(1)
          }}
        />
      ) : null}

      </div>
    </>
  )
}
