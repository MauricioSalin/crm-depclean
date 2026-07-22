import { toCivilDateKey } from "@/lib/date-utils"

export const CLICKSIGN_CONTRACT_STATUSES = ["draft", "running", "closed", "canceled"] as const

export type ClicksignContractStatus = (typeof CLICKSIGN_CONTRACT_STATUSES)[number]

const STATUS_ALIASES: Record<string, ClicksignContractStatus> = {
  draft: "draft",
  pending: "running",
  pending_signature: "running",
  waiting_signature: "running",
  awaiting_signature: "running",
  running: "running",
  signed: "closed",
  active: "closed",
  overdue: "closed",
  expired: "closed",
  closed: "closed",
  finished: "closed",
  completed: "closed",
  done: "closed",
  cancelled: "canceled",
  canceled: "canceled",
  refused: "canceled",
  deadline_expired: "canceled",
}

export function normalizeClicksignContractStatus(value: unknown): ClicksignContractStatus {
  return STATUS_ALIASES[String(value ?? "").trim().toLowerCase()] ?? "draft"
}

export function isClosedClicksignContractStatus(value: unknown) {
  return normalizeClicksignContractStatus(value) === "closed"
}

export function getClicksignContractStatusLabel(value: unknown) {
  switch (normalizeClicksignContractStatus(value)) {
    case "running":
      return "Aguardando assinatura"
    case "closed":
      return "Assinado"
    case "canceled":
      return "Cancelado"
    default:
      return "Rascunho"
  }
}

export function isOperationallyActiveContract(contract: {
  status?: string
  startDate?: string
  endDate?: string
}) {
  if (!isClosedClicksignContractStatus(contract.status) || !contract.startDate || !contract.endDate) return false
  const today = toCivilDateKey(new Date())
  return toCivilDateKey(new Date(contract.startDate)) <= today && toCivilDateKey(new Date(contract.endDate)) >= today
}
