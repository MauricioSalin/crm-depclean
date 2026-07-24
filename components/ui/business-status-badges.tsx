import { Badge } from "@/components/ui/badge"
import type { ContractRecord } from "@/lib/api/contracts"

type BusinessStatusBadgeProps = {
  status: "delinquent" | "awaiting-schedules"
}

export function BusinessStatusBadge({ status }: BusinessStatusBadgeProps) {
  const isDelinquent = status === "delinquent"
  return (
    <Badge
      className={
        isDelinquent
          ? "shrink-0 bg-red-100 text-red-700 hover:bg-red-100"
          : "shrink-0 bg-amber-100 text-amber-700 hover:bg-amber-100"
      }
    >
      {isDelinquent ? "Inadimplente" : "Aguardando agendamentos"}
    </Badge>
  )
}

export function isContractAwaitingSchedules(
  contract: Pick<ContractRecord, "isAwaitingSchedules">,
) {
  return contract.isAwaitingSchedules
}
