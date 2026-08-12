"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Calendar, DollarSign, MoreHorizontal } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DataPagination } from "@/components/ui/data-pagination"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EmptyState, TableEmptyState } from "@/components/ui/empty-state"
import { FilterSearchInput } from "@/components/ui/filter-search-input"
import { SearchableSelect } from "@/components/ui/searchable-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CardSkeletonGrid, TableSkeletonRows } from "@/components/ui/table-skeleton"
import type { FinancialInstallmentRecord } from "@/lib/api/analytics"
import { updateClientExtraStatus } from "@/lib/api/clients"
import { updateInstallment } from "@/lib/api/contracts"
import { getApiErrorMessage } from "@/lib/api/errors"
import { updateScheduleBilling } from "@/lib/api/schedules"
import { hasAnyPermission } from "@/lib/auth/permissions"
import { getStoredUser } from "@/lib/auth/session"
import { formatCivilDate, parseCivilDate, toCivilDateKey } from "@/lib/date-utils"
import { buildPathWithSearchParams, withReturnTo } from "@/lib/navigation"
import { invalidateInstallmentRelatedQueries } from "@/lib/query-invalidation"
import { formatContractNumber } from "@/lib/utils"

export type PaymentStatusFilter = FinancialInstallmentRecord["status"] | "all"

interface FinancialInstallmentsTableProps {
  installments: FinancialInstallmentRecord[]
  isLoading: boolean
  viewMode: "table" | "cards"
  viewToggle?: React.ReactNode
  searchTerm: string
  onSearchTermChange: (value: string) => void
  statusFilter: PaymentStatusFilter
  onStatusFilterChange: (value: PaymentStatusFilter) => void
  collapseByClient?: boolean
  showFilters?: boolean
}

type InstallmentStatusAction = "pending" | "paid" | "overdue"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function civilDateTime(value: string | Date) {
  return parseCivilDate(value)?.getTime() ?? 0
}

function selectCurrentInstallment(installments: FinancialInstallmentRecord[]) {
  const today = civilDateTime(toCivilDateKey(new Date()))
  const sorted = [...installments].sort((left, right) => civilDateTime(left.dueDate) - civilDateTime(right.dueDate))
  const dueOrPast = sorted
    .filter((installment) => civilDateTime(installment.dueDate) <= today)
    .at(-1)

  return dueOrPast ?? sorted[0]
}

function statusBadge(status: FinancialInstallmentRecord["status"]) {
  switch (status) {
    case "paid":
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Paga</Badge>
    case "pending":
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pendente</Badge>
    case "late":
      return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Atrasada</Badge>
    case "overdue":
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Vencida</Badge>
    case "cancelled":
      return <Badge variant="secondary">Cancelada</Badge>
  }
}

export function FinancialInstallmentsTable({
  installments,
  isLoading,
  viewMode,
  viewToggle,
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onStatusFilterChange,
  collapseByClient = true,
  showFilters = true,
}: FinancialInstallmentsTableProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentHref = buildPathWithSearchParams(pathname, searchParams)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getStoredUser>>(null)
  const queryClient = useQueryClient()
  const canManageFinancial = hasAnyPermission(currentUser, ["financial_manage"])

  useEffect(() => {
    const sync = () => setCurrentUser(getStoredUser())
    sync()
    window.addEventListener("storage", sync)
    window.addEventListener("depclean:session", sync)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("depclean:session", sync)
    }
  }, [])

  const installmentStatusMutation = useMutation<
    unknown,
    Error,
    { installment: FinancialInstallmentRecord; status: InstallmentStatusAction },
    { toastId: string | number }
  >({
    mutationFn: ({ installment, status }) => {
      const paidDate = status === "paid" ? new Date().toISOString() : undefined

      if (installment.source === "schedule") {
        return updateScheduleBilling(installment.scheduleId ?? installment.id.replace(/^schedule-/, ""), {
          billingStatus: status,
          paidDate,
          paidValue: status === "paid" ? installment.value : undefined,
        })
      }

      if (installment.source === "extra") {
        return updateClientExtraStatus(
          installment.clientId,
          installment.extraId ?? installment.id.replace(/^extra-/, ""),
          status,
        )
      }

      return updateInstallment(installment.contractId, installment.id, { status, paidDate })
    },
    onMutate: () => ({ toastId: toast.loading("Atualizando parcela...") }),
    onSuccess: async (_data, variables, context) => {
      if (variables.installment.source === "contract") {
        await invalidateInstallmentRelatedQueries(queryClient)
      } else {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["analytics"] }),
          queryClient.invalidateQueries({ queryKey: ["client-extras"] }),
          queryClient.invalidateQueries({ queryKey: ["schedules"] }),
        ])
      }
      toast.success("Parcela atualizada.", { id: context?.toastId })
    },
    onError: (error, _variables, context) => {
      toast.error(getApiErrorMessage(error, "Não foi possível atualizar a parcela."), { id: context?.toastId })
    },
  })

  const setInstallmentStatus = (installment: FinancialInstallmentRecord, status: InstallmentStatusAction) => {
    if (!canManageFinancial || installmentStatusMutation.isPending) return
    installmentStatusMutation.mutate({ installment, status })
  }

  const visibleInstallments = useMemo(() => {
    if (!collapseByClient) return installments

    const grouped = new Map<string, FinancialInstallmentRecord[]>()

    installments.forEach((installment) => {
      const existing = grouped.get(installment.clientId) ?? []
      existing.push(installment)
      grouped.set(installment.clientId, existing)
    })

    return Array.from(grouped.values())
      .map(selectCurrentInstallment)
      .filter((installment): installment is FinancialInstallmentRecord => Boolean(installment))
  }, [collapseByClient, installments])

  const filteredInstallments = useMemo(() => {
    const normalizedSearch = searchTerm.toLocaleLowerCase("pt-BR")
    return visibleInstallments
      .filter((installment) => {
        const companyName = installment.clientCompanyName ?? ""
        const matchesSearch =
          installment.contractNumber.toLocaleLowerCase("pt-BR").includes(normalizedSearch)
          || companyName.toLocaleLowerCase("pt-BR").includes(normalizedSearch)
        const matchesStatus = statusFilter === "all" || installment.status === statusFilter
        return matchesSearch && matchesStatus
      })
      .sort((left, right) => civilDateTime(left.dueDate) - civilDateTime(right.dueDate))
  }, [searchTerm, statusFilter, visibleInstallments])

  const totalPages = Math.max(1, Math.ceil(filteredInstallments.length / pageSize))
  const paginatedInstallments = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredInstallments.slice(start, start + pageSize)
  }, [currentPage, filteredInstallments, pageSize])

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  const updateSearch = (value: string) => {
    onSearchTermChange(value)
    setCurrentPage(1)
  }

  const updateStatus = (value: string) => {
    onStatusFilterChange(value as PaymentStatusFilter)
    setCurrentPage(1)
  }

  const statusActions = (installment: FinancialInstallmentRecord, card = false) => canManageFinancial ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={card ? "outline" : "ghost"}
          size={card ? "sm" : "icon"}
          className={card ? "w-full" : undefined}
          disabled={installmentStatusMutation.isPending}
          aria-label={card ? undefined : "Alterar status da parcela"}
        >
          <MoreHorizontal className={card ? "mr-1 h-4 w-4" : "h-4 w-4"} />
          {card ? "Alterar status" : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setInstallmentStatus(installment, "paid")}>Marcar como paga</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setInstallmentStatus(installment, "overdue")}>Marcar como vencida</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setInstallmentStatus(installment, "pending")}>Marcar como pendente</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null

  return (
    <div className="space-y-4">
      {showFilters ? (
        <div className="-mx-1 -mt-1 mb-4 grid grid-cols-2 gap-2 overflow-visible p-1 sm:flex sm:items-center">
          <FilterSearchInput
            wrapperClassName="sm:w-80 sm:flex-none"
            placeholder="Buscar por contrato ou cliente..."
            value={searchTerm}
            spellCheck={false}
            onValueChange={updateSearch}
          />
          <SearchableSelect
            value={statusFilter}
            onValueChange={updateStatus}
            options={[
              { value: "pending", label: "Pendentes" },
              { value: "late", label: "Atrasadas" },
              { value: "overdue", label: "Vencidas" },
              { value: "paid", label: "Pagas" },
              { value: "cancelled", label: "Canceladas" },
            ]}
            placeholder="Status"
            searchPlaceholder="Buscar status..."
            allLabel="Todas"
            className="sm:w-[140px] sm:flex-none"
          />
          {viewToggle ? <div className="hidden shrink-0 sm:block">{viewToggle}</div> : null}
        </div>
      ) : null}

      {viewMode === "table" ? (
        <div className="overflow-x-auto rounded-md">
          <Table onSortChange={() => setCurrentPage(1)}>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Contrato</TableHead>
                <TableHead className="hidden sm:table-cell">Parcela</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead className="hidden sm:table-cell">Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody
              page={!isLoading && filteredInstallments.length > 0 ? currentPage : undefined}
              pageSize={!isLoading && filteredInstallments.length > 0 ? pageSize : undefined}
            >
              {isLoading ? (
                <TableSkeletonRows
                  rows={5}
                  columns={[
                    { width: "w-40" },
                    { className: "hidden md:table-cell", width: "w-28" },
                    { className: "hidden sm:table-cell", width: "w-20" },
                    { width: "w-24" },
                    { className: "hidden sm:table-cell", width: "w-24" },
                    { width: "w-20" },
                    { align: "right", width: "w-10" },
                  ]}
                />
              ) : filteredInstallments.length === 0 ? (
                <TableEmptyState colSpan={7} icon={DollarSign} title="Nenhuma parcela encontrada." />
              ) : filteredInstallments.map((installment) => (
                <TableRow key={installment.id}>
                  <TableCell>
                    <Link href={withReturnTo(`/clientes/${installment.clientId}`, currentHref)} className="hover:text-primary">
                      <p className="max-w-[140px] truncate font-medium sm:max-w-[280px]">{installment.clientCompanyName}</p>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    <Link
                      href={installment.source === "schedule"
                        ? "/agendamentos"
                        : installment.source === "extra"
                          ? withReturnTo(`/clientes/${installment.clientId}?tab=extras`, currentHref)
                          : withReturnTo(`/contratos/${installment.contractId}`, currentHref)}
                      className="hover:text-primary"
                    >
                      {formatContractNumber(installment.contractNumber)}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="text-sm">
                      {installment.source === "schedule" ? "Avulsa" : installment.source === "extra" ? "Extra" : installment.number}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{formatCurrency(installment.value)}</TableCell>
                  <TableCell className="hidden text-sm sm:table-cell">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {formatCivilDate(installment.dueDate)}
                    </div>
                  </TableCell>
                  <TableCell>{statusBadge(installment.status)}</TableCell>
                  <TableCell className="text-right">{statusActions(installment)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {isLoading ? (
            <CardSkeletonGrid cards={4} />
          ) : paginatedInstallments.length === 0 ? (
            <EmptyState icon={DollarSign} title="Nenhuma parcela encontrada." className="sm:col-span-2" />
          ) : paginatedInstallments.map((installment) => (
            <Card key={installment.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  {statusBadge(installment.status)}
                </div>
                <h3 className="mb-1 truncate font-semibold">{installment.clientCompanyName}</h3>
                <p className="mb-3 text-sm text-muted-foreground">
                  {installment.source === "schedule" || installment.source === "extra"
                    ? formatContractNumber(installment.contractNumber)
                    : `${formatContractNumber(installment.contractNumber)} - Parcela ${installment.number}`}
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Valor:</span>
                    <span className="font-medium">{formatCurrency(installment.value)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Vencimento:</span>
                    <span>{formatCivilDate(installment.dueDate)}</span>
                  </div>
                </div>
                <div className="mt-4 border-t pt-4">{statusActions(installment, true)}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading ? (
        <DataPagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredInstallments.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1) }}
          className="md:static md:bottom-auto md:z-auto"
        />
      ) : null}
    </div>
  )
}
