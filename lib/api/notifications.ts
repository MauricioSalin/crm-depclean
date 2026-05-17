import { api } from "@/lib/api/client"
import type { Notification } from "@/lib/types"

export type NotificationRecord = Omit<Notification, "sentAt" | "readAt" | "createdAt"> & {
  sentAt: string
  readAt?: string
  deliveryStatus: string
  createdAt: string
}

export type PushSubscriptionPayload = {
  endpoint: string
  expirationTime?: number | null
  keys: {
    p256dh: string
    auth: string
  }
}

export async function listNotifications() {
  const response = await api.get<{ success: true; data: NotificationRecord[] }>("/notifications")
  return response.data
}

export async function getPushPublicKey() {
  const response = await api.get<{ success: true; data: { enabled: boolean; publicKey: string } }>(
    "/notifications/push/public-key",
  )
  return response.data
}

export async function savePushSubscription(payload: PushSubscriptionPayload) {
  const response = await api.post<{ success: true; data: { subscribed: boolean } }>(
    "/notifications/push/subscribe",
    payload,
  )
  return response.data
}

export async function deletePushSubscription(endpoint: string) {
  const response = await api.post<{ success: true; data: { unsubscribed: boolean } }>(
    "/notifications/push/unsubscribe",
    { endpoint },
  )
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

