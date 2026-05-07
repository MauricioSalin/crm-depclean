"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Edit } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getContractById, type ContractRecord } from "@/lib/api/contracts"

interface ContractDetailHeaderActionsProps {
  contractId: string
}

const isContractSigned = (contract?: Pick<ContractRecord, "status" | "clicksign"> | null) => {
  if (!contract) return false
  const clicksignStatus = contract.clicksign?.status?.toLowerCase() ?? ""
  return ["signed", "active"].includes(contract.status) || ["closed", "finished", "completed", "done"].includes(clicksignStatus)
}

export function ContractDetailHeaderActions({ contractId }: ContractDetailHeaderActionsProps) {
  const contractQuery = useQuery({
    queryKey: ["contract", contractId],
    queryFn: () => getContractById(contractId),
  })
  const contract = contractQuery.data?.data

  return (
    <>
      <Link href="/contratos" className="flex-1 sm:flex-initial">
        <Button variant="outline" className="w-full h-9 text-sm bg-transparent">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </Link>
      {contract && !isContractSigned(contract) ? (
        <Link href={`/contratos/${contractId}/editar`} className="flex-1 sm:flex-initial">
          <Button className="w-full bg-primary hover:bg-primary/90">
            <Edit className="mr-2 h-4 w-4" />
            Editar Contrato
          </Button>
        </Link>
      ) : null}
    </>
  )
}
