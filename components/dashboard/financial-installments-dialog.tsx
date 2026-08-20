"use client"

import { useMemo } from "react"

import {
  FinancialInstallmentsTable,
  type PaymentStatusFilter,
} from "@/components/financeiro/financial-installments-table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { FinancialInstallmentRecord, MonthlyRevenuePoint } from "@/lib/api/analytics"
import { formatCivilDate, parseCivilDate, toCivilDateKey } from "@/lib/date-utils"

const STATUS_LABELS: Partial<Record<PaymentStatusFilter, string>> = {
  paid: "Pagas",
  pending: "A receber",
  late: "Em atraso",
  overdue: "Vencidas",
  cancelled: "Canceladas",
}

const ignoreFilterChange = () => undefined

export type FinancialChartSelection = {
  period: MonthlyRevenuePoint
  status: PaymentStatusFilter
}

interface FinancialInstallmentsDialogProps {
  selection: FinancialChartSelection | null
  installments: FinancialInstallmentRecord[]
  onClose: () => void
}

export function FinancialInstallmentsDialog({
  selection,
  installments,
  onClose,
}: FinancialInstallmentsDialogProps) {
  const dateFrom = selection?.period.dateFrom
  const dateTo = selection?.period.dateTo

  const periodInstallments = useMemo(() => {
    if (!dateFrom || !dateTo) return []

    return installments.filter((installment) => {
      const parsedDueDate = parseCivilDate(installment.dueDate)
      if (!parsedDueDate) return false
      const dueDate = toCivilDateKey(parsedDueDate)
      return dueDate >= dateFrom && dueDate <= dateTo
    })
  }, [dateFrom, dateTo, installments])

  if (!selection || !dateFrom || !dateTo) return null

  const periodLabel = dateFrom === dateTo
    ? formatCivilDate(dateFrom)
    : `${formatCivilDate(dateFrom)} a ${formatCivilDate(dateTo)}`
  const statusLabel = selection.status === "all" ? "" : STATUS_LABELS[selection.status] ?? "Status selecionado"

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[80dvh] w-[80vw] max-w-[80vw] min-w-0 flex-col gap-0 overflow-hidden p-0 max-sm:left-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-none max-sm:w-screen max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0 max-sm:[&_[data-slot=dialog-close]]:right-5 max-sm:[&_[data-slot=dialog-close]]:top-[calc(env(safe-area-inset-top)+1rem)] xl:max-w-[1500px]">
        <DialogHeader className="px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] text-left sm:px-6 sm:pt-6">
          <DialogTitle>Parcelas do período</DialogTitle>
          <DialogDescription>
            {periodLabel}{statusLabel ? ` · ${statusLabel}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-6 sm:pb-6">
          <FinancialInstallmentsTable
            installments={periodInstallments}
            isLoading={false}
            viewMode="table"
            searchTerm=""
            onSearchTermChange={ignoreFilterChange}
            statusFilter={selection.status}
            onStatusFilterChange={ignoreFilterChange}
            collapseByClient={false}
            showFilters={false}
            preserveColumnsOnMobile
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
