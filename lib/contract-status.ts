import { parseCivilDate, toCivilDateKey } from "@/lib/date-utils"

export const CLICKSIGN_CONTRACT_STATUSES = ["draft", "running", "closed", "canceled"] as const

export type ClicksignContractStatus = (typeof CLICKSIGN_CONTRACT_STATUSES)[number]

const STATUS_ALIASES: Record<string, ClicksignContractStatus> = {
  draft: "draft",
  send_failed: "draft",
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
      return "Aguardando envio"
  }
}

function contractCivilDateKey(value?: string | Date | null) {
  const date = parseCivilDate(value)
  return date ? toCivilDateKey(date) : ""
}

export function isOperationallyActiveContract(contract: {
  status?: unknown
  startDate?: string | Date | null
  endDate?: string | Date | null
}, now = new Date()) {
  if (!isClosedClicksignContractStatus(contract.status) || !contract.startDate || !contract.endDate) return false
  const startDateKey = contractCivilDateKey(contract.startDate)
  const endDateKey = contractCivilDateKey(contract.endDate)
  if (!startDateKey || !endDateKey) return false
  const today = toCivilDateKey(now)
  return startDateKey <= today && endDateKey >= today
}

export function isContractExpiredByValidity(contract: {
  status?: unknown
  endDate?: string | Date | null
}, now = new Date()) {
  if (!isClosedClicksignContractStatus(contract.status) || !contract.endDate) return false
  const endDateKey = contractCivilDateKey(contract.endDate)
  return Boolean(endDateKey) && endDateKey < toCivilDateKey(now)
}
