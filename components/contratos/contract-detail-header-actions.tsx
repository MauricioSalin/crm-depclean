"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getContractById } from "@/lib/api/contracts"
import {
  isContractEligibleForRenewal,
} from "@/lib/contract-status"
import { buildPathWithSearchParams, getSafeReturnTo, withReturnTo } from "@/lib/navigation"
import { useHasAnyPermission } from "@/hooks/use-permissions"

interface ContractDetailHeaderActionsProps {
  contractId: string
}

export function ContractDetailHeaderActions({ contractId }: ContractDetailHeaderActionsProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
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
  return (
    <>
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
    </>
  )
}
