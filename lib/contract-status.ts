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

const CONTRACT_RENEWAL_LEAD_MONTHS = 2

function subtractCivilMonths(dateKey: string, months: number) {
  const [year = 0, month = 1, day = 1] = dateKey.split("-").map((value) => Number(value))
  const targetMonthIndex = year * 12 + month - 1 - months
  const targetYear = Math.floor(targetMonthIndex / 12)
  const targetMonthIndexInYear = ((targetMonthIndex % 12) + 12) % 12
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonthIndexInYear + 1, 0)).getUTCDate()
  const targetDay = Math.min(day, lastDayOfTargetMonth)

  return [
    targetYear,
    String(targetMonthIndexInYear + 1).padStart(2, "0"),
    String(targetDay).padStart(2, "0"),
  ].join("-")
}

export function isOperationallyActiveContract(contract: {
  status?: unknown
  renewalStatus?: unknown
  startDate?: string | Date | null
  endDate?: string | Date | null
}, now = new Date()) {
  if (!isClosedClicksignContractStatus(contract.status)) return false
  if (isContractRenewed(contract)) return false
  if (!contract.startDate || !contract.endDate) return false
  const startDateKey = contractCivilDateKey(contract.startDate)
  const endDateKey = contractCivilDateKey(contract.endDate)
  if (!startDateKey || !endDateKey) return false
  const today = toCivilDateKey(now)
  return startDateKey <= today && endDateKey >= today
}

export function isContractRenewed(contract: { renewalStatus?: unknown }) {
  return contract.renewalStatus === "renewed"
}

export function isContractExpiredByValidity(contract: {
  status?: unknown
  renewalStatus?: unknown
  endDate?: string | Date | null
}, now = new Date()) {
  if (
    !isClosedClicksignContractStatus(contract.status) ||
    isContractRenewed(contract) ||
    !contract.endDate
  ) return false
  const endDateKey = contractCivilDateKey(contract.endDate)
  return Boolean(endDateKey) && endDateKey < toCivilDateKey(now)
}

export function isContractEligibleForRenewal(contract: {
  status?: unknown
  renewalStatus?: unknown
  endDate?: string | Date | null
}, now = new Date()) {
  if (
    !isClosedClicksignContractStatus(contract.status) ||
    isContractRenewed(contract) ||
    !contract.endDate
  ) return false
  const endDateKey = contractCivilDateKey(contract.endDate)
  return Boolean(endDateKey) && toCivilDateKey(now) >= subtractCivilMonths(
    endDateKey,
    CONTRACT_RENEWAL_LEAD_MONTHS,
  )
}
