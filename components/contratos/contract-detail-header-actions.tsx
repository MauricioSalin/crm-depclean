"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Edit } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getContractById, type ContractRecord } from "@/lib/api/contracts"
import { buildPathWithSearchParams, getSafeReturnTo, withReturnTo } from "@/lib/navigation"
import { useHasAnyPermission } from "@/hooks/use-permissions"

interface ContractDetailHeaderActionsProps {
  contractId: string
}

const isContractSigned = (contract?: Pick<ContractRecord, "status" | "clicksign"> | null) => {
  if (!contract) return false
  const clicksignStatus = contract.clicksign?.status?.toLowerCase() ?? ""
  return ["signed", "active"].includes(contract.status) || ["closed", "finished", "completed", "done"].includes(clicksignStatus)
}

export function ContractDetailHeaderActions({ contractId }: ContractDetailHeaderActionsProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const canEditContracts = useHasAnyPermission(["contracts_edit"])
  const contractQuery = useQuery({
    queryKey: ["contract", contractId],
    queryFn: () => getContractById(contractId),
  })
  const contract = contractQuery.data?.data
  const backHref = getSafeReturnTo(searchParams.get("returnTo"), "/contratos")
  const currentHref = buildPathWithSearchParams(pathname, searchParams)

  return (
    <>
      <Link href={backHref} className="flex-1 sm:flex-initial">
        <Button variant="outline" className="w-full h-9 text-sm bg-transparent">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </Link>
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
    </>
  )
}
