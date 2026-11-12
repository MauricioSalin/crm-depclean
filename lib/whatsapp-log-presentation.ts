import type { AuditLogRecord } from "./api/logs"

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function text(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && Boolean(value.trim()))?.trim() ?? ""
}

export function whatsAppLogPresentation(log: Pick<AuditLogRecord, "metadata" | "status">) {
  const metadata = record(log.metadata)
  const message = record(metadata.messageMetadata)
  const nested = record(metadata.metadata)
  const deliveryStatus = text(metadata.deliveryStatus, message.deliveryStatus, nested.deliveryStatus)
  const wasSkipped = log.status === "skipped" || /^skipped_/i.test(deliveryStatus)
  const messages = [message, metadata, nested].flatMap((source) => Array.isArray(source.whatsappMessages) ? source.whatsappMessages.map(record) : [])
  // Audit statusCode is an internal code; only preserved provider responses identify Meta's HTTP status.
  const providerCode = [metadata.providerStatusCode, message.providerStatusCode, nested.providerStatusCode,
    ...messages.map((item) => item.providerStatusCode).reverse()].map(Number)
    .find((code) => Number.isInteger(code) && code >= 100 && code <= 599)
  const reasons: Record<string, string> = {
    skipped_past_schedule: "Envio bloqueado porque a data do agendamento já passou.",
    skipped_notifications_suppressed: "Envio automático desativado para este registro retroativo.",
  }
  return {
    wasSkipped,
    nonDeliveryReason: text(metadata.nonDeliveryReason, message.nonDeliveryReason, nested.nonDeliveryReason) ||
      reasons[deliveryStatus.toLowerCase()] || text(metadata.deliveryError, message.deliveryError) || "O envio foi ignorado por uma regra do sistema.",
    providerStatusCode: providerCode ? String(providerCode) : "",
    providerStatusLabel: providerCode ? String(providerCode) : wasSkipped || deliveryStatus === "dry_run" ? "Não acionada" : "Sem retorno registrado",
    queueAttemptLabel: metadata.notificationId ? "Processamentos da fila" : "Tentativas",
  }
}
