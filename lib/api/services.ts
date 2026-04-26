import { api } from "@/lib/api/client"

export type ServiceRecurrenceRuleRecord = {
  type: "range" | "above"
  minUnits: number
  maxUnits: number
  recurrence: string
}

export type ServiceRecord = {
  id: string
  name: string
  description: string
  baseValue: number
  defaultDuration: number
  durationType: "hours" | "shift" | "days"
  defaultRecurrence: string
  recurrenceRules: ServiceRecurrenceRuleRecord[]
  teamIds: string[]
  employeeIds: string[]
  clauses: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type ServicePayload = {
  name: string
  description?: string
  baseValue?: number
  defaultDuration: number
  durationType: "hours" | "shift" | "days"
  defaultRecurrence: string
  recurrenceRules?: ServiceRecurrenceRuleRecord[]
  teamIds?: string[]
  employeeIds?: string[]
  clauses: string[]
  isActive?: boolean
}

export async function listServices(search = "") {
  const response = await api.get<{ success: true; data: ServiceRecord[] }>("/services", { params: { search } })
  return response.data
}

export async function getServiceById(id: string) {
  const response = await api.get<{ success: true; data: ServiceRecord }>(`/services/${id}`)
  return response.data
}

export async function createService(payload: ServicePayload) {
  const response = await api.post<{ success: true; data: ServiceRecord }>("/services", payload)
  return response.data
}

export async function updateService(id: string, payload: Partial<ServicePayload>) {
  const response = await api.patch<{ success: true; data: ServiceRecord }>(`/services/${id}`, payload)
  return response.data
}

export async function deleteService(id: string) {
  const response = await api.delete<{ success: true; data: null }>(`/services/${id}`)
  return response.data
}
