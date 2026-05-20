import type { NotificationRecord } from "@/lib/api/notifications"

export function getNotificationHref(notification: NotificationRecord) {
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
    return `/contratos/${encodeURIComponent(notification.relatedContractId)}`
  }

  if (notification.relatedClientId) {
    return `/clientes/${encodeURIComponent(notification.relatedClientId)}`
  }

  return "/notificacoes"
}
