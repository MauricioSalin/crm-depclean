import { api } from "@/lib/api/client"

export type EmployeeRecord = {
  id: string
  name: string
  email: string
  phone: string
  cpf: string
  role: string
  avatar: string
  status: "active" | "inactive"
  isSystemUser: boolean
  userId?: string | null
  permissionProfileId?: string | null
  permissionProfileName?: string | null
  permissions?: string[]
  createdAt: string
  updatedAt: string
}

export type EmployeePayload = {
  name: string
  email: string
  phone?: string
  cpf: string
  role?: string
  status?: "active" | "inactive"
}

export type CreateSystemUserPayload = {
  password: string
  permissionProfileId: string
}

export async function listEmployees(search = "") {
  const response = await api.get<{ success: true; data: EmployeeRecord[] }>("/employees", { params: { search } })
  return response.data
}

export async function createEmployee(payload: EmployeePayload) {
  const response = await api.post<{ success: true; data: EmployeeRecord }>("/employees", payload)
  return response.data
}

export async function updateEmployee(id: string, payload: Partial<EmployeePayload>) {
  const response = await api.patch<{ success: true; data: EmployeeRecord }>(`/employees/${id}`, payload)
  return response.data
}

export async function deactivateEmployee(id: string) {
  const response = await api.delete<{ success: true; data: null }>(`/employees/${id}`)
  return response.data
}

export async function makeEmployeeSystemUser(id: string, payload: CreateSystemUserPayload) {
  const response = await api.post<{ success: true; data: EmployeeRecord }>(`/employees/${id}/system-user`, payload)
  return response.data
}

export async function revokeEmployeeSystemUser(id: string) {
  const response = await api.delete<{ success: true; data: EmployeeRecord }>(`/employees/${id}/system-user`)
  return response.data
}
