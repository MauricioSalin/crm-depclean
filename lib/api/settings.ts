import { api } from "@/lib/api/client"
import type { AuthenticatedUser } from "@/lib/auth/types"

export type ClientTypeRecord = {
  id: string
  name: string
  description: string
  color: string
  createdAt: string
  updatedAt: string
}

export type PermissionProfileRecord = {
  id: string
  name: string
  description: string
  permissions: string[]
  createdAt: string
  updatedAt: string
}

export type UserRecord = {
  id: string
  name: string
  email: string
  phone: string
  cpf: string
  role: string
  avatar: string
  temporaryPassword?: string | null
  permissionProfileId: string
  permissionProfileName: string
  permissions: string[]
  isActive: boolean
  isSystemUser: boolean
  mustChangePassword: boolean
  employeeId: string
  employeeStatus: "active" | "inactive"
  createdAt: string
  updatedAt: string
}

export type NotificationRuleRecord = {
  id: string
  name: string
  type: string
  daysBefore: number
  time: string
  channels: string[]
  targetTeamIds: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export async function getSettings() {
  const response = await api.get<{
    success: true
    data: {
      clientTypes: ClientTypeRecord[]
      permissionProfiles: PermissionProfileRecord[]
      users: UserRecord[]
      notificationRules: NotificationRuleRecord[]
      permissions: Array<{ key: string; label: string; description: string }>
      notificationTypes: Array<{ value: string; label: string }>
      notificationChannels: Array<{ value: string; label: string }>
    }
  }>("/settings")
  return response.data
}

export async function listClientTypes(search = "") {
  const response = await api.get<{ success: true; data: { items: ClientTypeRecord[]; total: number; page: number; limit: number; totalPages: number } }>("/settings/client-types", {
    params: { search },
  })
  return response.data
}

export async function createClientType(payload: Pick<ClientTypeRecord, "name" | "description" | "color">) {
  const response = await api.post<{ success: true; data: ClientTypeRecord }>("/settings/client-types", payload)
  return response.data
}

export async function updateClientType(id: string, payload: Partial<Pick<ClientTypeRecord, "name" | "description" | "color">>) {
  const response = await api.patch<{ success: true; data: ClientTypeRecord }>(`/settings/client-types/${id}`, payload)
  return response.data
}

export async function deleteClientType(id: string) {
  const response = await api.delete<{ success: true; data: null }>(`/settings/client-types/${id}`)
  return response.data
}

export async function listPermissionProfiles(search = "") {
  const response = await api.get<{ success: true; data: { items: PermissionProfileRecord[]; total: number; page: number; limit: number; totalPages: number } }>("/settings/permission-profiles", {
    params: { search },
  })
  return response.data
}

export async function createPermissionProfile(payload: Pick<PermissionProfileRecord, "name" | "description" | "permissions">) {
  const response = await api.post<{ success: true; data: PermissionProfileRecord }>("/settings/permission-profiles", payload)
  return response.data
}

export async function updatePermissionProfile(id: string, payload: Partial<Pick<PermissionProfileRecord, "name" | "description" | "permissions">>) {
  const response = await api.patch<{ success: true; data: PermissionProfileRecord }>(`/settings/permission-profiles/${id}`, payload)
  return response.data
}

export async function deletePermissionProfile(id: string) {
  const response = await api.delete<{ success: true; data: null }>(`/settings/permission-profiles/${id}`)
  return response.data
}

export async function listUsers(search = "") {
  const response = await api.get<{ success: true; data: { items: UserRecord[]; total: number; page: number; limit: number; totalPages: number } }>("/settings/users", {
    params: { search },
  })
  return response.data
}

export async function createUser(payload: {
  name: string
  email: string
  phone?: string
  cpf: string
  role?: string
  password: string
  permissionProfileId: string
  isActive?: boolean
}) {
  const response = await api.post<{ success: true; data: UserRecord }>("/settings/users", payload)
  return response.data
}

export async function updateUser(id: string, payload: Partial<{
  name: string
  email: string
  phone: string
  cpf: string
  role: string
  password: string
  permissionProfileId: string
  isActive: boolean
}>) {
  const response = await api.patch<{ success: true; data: UserRecord }>(`/settings/users/${id}`, payload)
  return response.data
}

export async function deleteUser(id: string) {
  const response = await api.delete<{ success: true; data: null }>(`/settings/users/${id}`)
  return response.data
}

export async function resetUserPassword(id: string) {
  const response = await api.post<{ success: true; data: UserRecord }>(`/settings/users/${id}/reset-password`)
  return response.data
}

export async function listNotificationRules(search = "") {
  const response = await api.get<{ success: true; data: { items: NotificationRuleRecord[]; total: number; page: number; limit: number; totalPages: number } }>("/settings/notification-rules", {
    params: { search },
  })
  return response.data
}

export async function createNotificationRule(payload: Partial<NotificationRuleRecord> & {
  name: string
  type: string
}) {
  const response = await api.post<{ success: true; data: NotificationRuleRecord }>("/settings/notification-rules", payload)
  return response.data
}

export async function updateNotificationRule(id: string, payload: Partial<NotificationRuleRecord>) {
  const response = await api.patch<{ success: true; data: NotificationRuleRecord }>(`/settings/notification-rules/${id}`, payload)
  return response.data
}

export async function deleteNotificationRule(id: string) {
  const response = await api.delete<{ success: true; data: null }>(`/settings/notification-rules/${id}`)
  return response.data
}
