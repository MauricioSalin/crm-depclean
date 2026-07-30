"use client"

import Link from "next/link"
import { useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, CheckCircle2, Edit, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { getApiErrorMessage } from "@/lib/api/errors"
import { getContractById, markContractAsRenewed, type ContractRecord } from "@/lib/api/contracts"
import {
  isClosedClicksignContractStatus,
  isContractEligibleForRenewal,
} from "@/lib/contract-status"
import { buildPathWithSearchParams, getSafeReturnTo, withReturnTo } from "@/lib/navigation"
import { useHasAnyPermission } from "@/hooks/use-permissions"

interface ContractDetailHeaderActionsProps {
  contractId: string
}

const isContractSigned = (contract?: Pick<ContractRecord, "status" | "clicksign"> | null) => {
  if (!contract) return false
  return (
    isClosedClicksignContractStatus(contract.status) ||
    isClosedClicksignContractStatus(contract.clicksign?.status)
  )
}

export function ContractDetailHeaderActions({ contractId }: ContractDetailHeaderActionsProps) {
  const queryClient = useQueryClient()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [confirmRenewedOpen, setConfirmRenewedOpen] = useState(false)
  const canEditContracts = useHasAnyPermission(["contracts_edit"])
  const canCreateContracts = useHasAnyPermission(["contracts_create"])
  const contractQuery = useQuery({
    queryKey: ["contract", contractId],
    queryFn: () => getContractById(contractId),
  })
  const contract = contractQuery.data?.data
  const backHref = getSafeReturnTo(searchParams.get("returnTo"), "/contratos")
  const currentHref = buildPathWithSearchParams(pathname, searchParams)
  const isRenewalAvailable = Boolean(
    canCreateContracts &&
    contract &&
    isContractEligibleForRenewal(contract),
  )
  const markAsRenewedMutation = useMutation({
    mutationFn: () => markContractAsRenewed(contractId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["contract", contractId] }),
        queryClient.invalidateQueries({ queryKey: ["contracts"] }),
        queryClient.invalidateQueries({ queryKey: ["analytics"] }),
      ])
      setConfirmRenewedOpen(false)
      toast.success("Contrato marcado como renovado.")
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, "Não foi possível marcar o contrato como renovado."))
    },
  })

  return (
    <>
      <ConfirmActionDialog
        open={confirmRenewedOpen}
        title="Marcar contrato como renovado?"
        description="Use esta opção quando a renovação foi criada fora deste fluxo. O contrato deixará de aparecer como vencido e as ações de renovação serão ocultadas."
        confirmLabel="Marcar como renovado"
        confirmVariant="default"
        confirmClassName="bg-primary hover:bg-primary/90"
        busy={markAsRenewedMutation.isPending}
        onOpenChange={(open) => {
          if (!markAsRenewedMutation.isPending) setConfirmRenewedOpen(open)
        }}
        onConfirm={() => markAsRenewedMutation.mutate()}
      />
      <Link href={backHref} className="flex-1 sm:flex-initial">
        <Button variant="outline" className="w-full h-9 text-sm bg-transparent">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </Link>
      <span id="contract-detail-schedule-actions" className="contents" />
      {contractQuery.isLoading ? (
        <Skeleton className="h-9 flex-1 rounded-full sm:w-[150px] sm:flex-initial" />
      ) : null}
      {canEditContracts && contract && !isContractSigned(contract) ? (
        <Link href={withReturnTo(`/contratos/${contractId}/editar`, currentHref)} className="flex-1 sm:flex-initial">
          <Button className="w-full bg-primary hover:bg-primary/90">
            <Edit className="mr-2 h-4 w-4" />
            Editar Contrato
          </Button>
        </Link>
      ) : null}
      {isRenewalAvailable ? (
        <Link
          href={withReturnTo(
            `/contratos/novo?renewFrom=${encodeURIComponent(contractId)}`,
            currentHref,
          )}
          className="flex-1 sm:flex-initial"
        >
          <Button className="h-9 w-full bg-primary text-sm hover:bg-primary/90">
            <RefreshCw className="mr-2 h-4 w-4" />
            Renovar
          </Button>
        </Link>
      ) : null}
      {isRenewalAvailable ? (
        <Button
          type="button"
          variant="outline"
          className="h-9 flex-1 text-sm sm:flex-initial"
          onClick={() => setConfirmRenewedOpen(true)}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Marcar como renovado
        </Button>
      ) : null}
    </>
  )
}
