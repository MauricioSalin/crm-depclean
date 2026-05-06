import { api } from "@/lib/api/client"
import type { Notification } from "@/lib/types"

export type NotificationRecord = Omit<Notification, "sentAt" | "readAt" | "createdAt"> & {
  sentAt: string
  readAt?: string
  deliveryStatus: string
  createdAt: string
}

export async function listNotifications() {
  const response = await api.get<{ success: true; data: NotificationRecord[] }>("/notifications")
  return response.data
}

export async function markNotificationAsRead(id: string) {
  const response = await api.post<{ success: true; data: NotificationRecord }>(`/notifications/${id}/read`)
  return response.data
}

export async function markAllNotificationsAsRead() {
  const response = await api.post<{ success: true; data: { updated: number } }>("/notifications/read-all")
  return response.data
}

export async function deleteNotification(id: string) {
  const response = await api.delete<{ success: true; data: null }>(`/notifications/${id}`)
  return response.data
}

