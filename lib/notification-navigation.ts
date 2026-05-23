import type { NotificationRecord } from "@/lib/api/notifications"
import { withReturnTo } from "@/lib/navigation"

export function getNotificationHref(notification: NotificationRecord, returnTo?: string) {
  if (notification.type === "certificate_ready") {
    return "/certificados"
  }

  if (notification.type === "certificate" && notification.relatedScheduleId) {
    return `/certificados/${encodeURIComponent(notification.relatedScheduleId)}`
  }

  if (notification.relatedScheduleId) {
    return `/agenda?scheduleId=${encodeURIComponent(notification.relatedScheduleId)}`
  }

  if (notification.relatedContractId) {
    return withReturnTo(`/contratos/${encodeURIComponent(notification.relatedContractId)}`, returnTo)
  }

  if (notification.relatedClientId) {
    return withReturnTo(`/clientes/${encodeURIComponent(notification.relatedClientId)}`, returnTo)
  }

  return "/notificacoes"
}
