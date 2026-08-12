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
      <DialogContent className="max-h-[80dvh] w-[80vw] max-w-[80vw] gap-4 p-4 sm:p-6 xl:max-w-[1500px]">
        <DialogHeader>
          <DialogTitle>Parcelas do período</DialogTitle>
          <DialogDescription>
            {periodLabel}{statusLabel ? ` · ${statusLabel}` : ""}
          </DialogDescription>
        </DialogHeader>

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
        />
      </DialogContent>
    </Dialog>
  )
}
