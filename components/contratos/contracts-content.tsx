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
  Edit,
  ExternalLink,
  Eye,
  FileText,
  MoreHorizontal,
  Search,
} from "lucide-react"

import { DataPagination } from "@/components/ui/data-pagination"
import { EmptyState, TableEmptyState } from "@/components/ui/empty-state"
import { CardSkeletonGrid, TableSkeletonRows } from "@/components/ui/table-skeleton"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { importSignedContracts, listContracts, type ContractImportRow, type ContractRecord } from "@/lib/api/contracts"
import { getContractClicksignUrl } from "@/lib/clicksign"
import {
  getClicksignContractStatusLabel,
  isClosedClicksignContractStatus,
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
  "draft",
  "running",
  "closed",
  "canceled",
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

function formatDate(value: string) {
  return formatCivilDate(value)
}

export function ContractsContent({ viewMode, viewToggle, openImport = false, onImportChange }: ContractsContentProps) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const mobileFiltersOpen = useMobileFiltersOpen()
  const canEditContracts = useHasAnyPermission(["contracts_edit"])
  const [searchTerm, setSearchTerm] = useUrlQueryState("q")
  const [statusFilterParam, setStatusFilter] = useUrlQueryState("status", "all", { debounceMs: 0 })
  const statusFilter = normalizeContractStatusFilter(statusFilterParam)
  const validityFilter = searchParams.get("validity")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
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

  const contracts = contractsQuery.data?.data ?? []
  const currentHref = buildPathWithSearchParams(pathname, searchParams)
  const getContractProfileHref = (contractId: string) => withReturnTo(`/contratos/${contractId}`, currentHref)
  const getContractEditHref = (contractId: string) => withReturnTo(`/contratos/${contractId}/editar`, getContractProfileHref(contractId))
  const filteredContracts = useMemo(() => {
    return contracts.filter((contract) => {
      if (statusFilter === "all") return true
      return normalizeClicksignContractStatus(contract.status) === statusFilter
    }).filter((contract) => {
      if (validityFilter === "active") return isOperationallyActiveContract(contract)
      if (validityFilter === "inactive") return !isOperationallyActiveContract(contract)
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

  const getStatusBadge = (status: string) => {
    const normalized = normalizeClicksignContractStatus(status)
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
            { value: "draft", label: "Rascunho" },
            { value: "running", label: "Em processo" },
            { value: "closed", label: "Finalizado" },
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
                <TableHead className="w-[300px] min-w-[300px]">Contrato</TableHead>
                <TableHead className="hidden w-[420px] min-w-[380px] sm:table-cell">Cliente</TableHead>
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
                  return (
                    <TableRow
                      key={contract.id}
                      role="link"
                      tabIndex={0}
                      className="cursor-pointer"
                      aria-label={`Abrir contrato ${formatContractNumber(contract.contractNumber)}`}
                      onClick={() => router.push(getContractProfileHref(contract.id))}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return
                        event.preventDefault()
                        router.push(getContractProfileHref(contract.id))
                      }}
                    >
                      <TableCell className="w-[300px] max-w-[300px]">
                        <div className="flex items-center gap-3">
                          <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:flex">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{formatContractNumber(contract.contractNumber)}</p>
                            <p className="text-xs text-muted-foreground sm:hidden">{contract.clientCompanyName}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden w-[420px] max-w-[420px] sm:table-cell">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="max-w-[360px] truncate">{contract.clientCompanyName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div>
                          <p className="font-medium">{formatCurrency(contract.totalValue)}</p>
                          <p className="text-xs text-muted-foreground">
                            {paidInstallments}/{contract.installmentsCount} parcelas
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-sm lg:table-cell">
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
                      </TableCell>
                      <TableCell>{getStatusBadge(contract.status)}</TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={getContractProfileHref(contract.id)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Ver Detalhes
                              </Link>
                            </DropdownMenuItem>
                            {canEditContracts && !isContractSigned(contract) ? (
                              <DropdownMenuItem asChild>
                                <Link href={getContractEditHref(contract.id)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Editar
                                </Link>
                              </DropdownMenuItem>
                            ) : null}
                            {clicksignUrl ? (
                              <DropdownMenuItem asChild>
                                <a href={clicksignUrl} target="_blank" rel="noreferrer">
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  Ver no ClickSign
                                </a>
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

              return (
                <Card
                  key={contract.id}
                  role="link"
                  tabIndex={0}
                  className="h-full cursor-pointer overflow-hidden"
                  aria-label={`Abrir contrato ${formatContractNumber(contract.contractNumber)}`}
                  onClick={() => router.push(getContractProfileHref(contract.id))}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return
                    event.preventDefault()
                    router.push(getContractProfileHref(contract.id))
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
                            <span className="inline-flex shrink-0">
                              {getStatusBadge(contract.status)}
                            </span>
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{contract.clientCompanyName}</p>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <p className="font-medium text-foreground">{formatCurrency(contract.totalValue)}</p>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {formatDate(contract.startDate)} - {formatDate(contract.endDate)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-auto space-y-3 pt-3">
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
                      <div
                        className="flex gap-2"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        {canEditContracts && !isContractSigned(contract) ? (
                          <Button variant="outline" size="sm" className="flex-1" asChild>
                            <Link href={getContractEditHref(contract.id)}>
                              <Edit className="mr-1 h-4 w-4" />
                              Editar
                            </Link>
                          </Button>
                        ) : null}
                        <Button size="sm" className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                          <Link href={getContractProfileHref(contract.id)}>
                            <Eye className="mr-1 h-4 w-4" />
                            Ver
                          </Link>
                        </Button>
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
