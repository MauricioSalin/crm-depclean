import { api } from "@/lib/api/client"

export type ScheduleRecord = {
  id: string
  contractId: string | null
  contractServiceId: string | null
  isManual: boolean
  clientId: string
  clientName: string
  unitId: string
  unitName: string
  address: string
  serviceTypeId: string
  serviceTypeName: string
  teamId?: string
  teamName?: string
  teams: Array<{ id: string; name: string; color: string }>
  additionalEmployees: Array<{ id: string; name: string }>
  date: string
  time: string
  duration: number
  status: "draft" | "scheduled" | "in_progress" | "completed" | "cancelled" | "rescheduled"
  recurrence: { type: "none"; daysOfWeek: number[]; interval: number }
  notes: string
  isEmergency: boolean
  cancellationReason?: string
  completionStartTime?: string
  completionEndTime?: string
  serviceReport?: string
  naFileName?: string
  naDocumentUrl?: string
  createdAt: string
  updatedAt: string
}

export type SchedulePayload = {
  clientId: string
  unitId: string
  serviceTypeId: string
  teamIds?: string[]
  additionalEmployeeIds?: string[]
  scheduledDate: string
  scheduledTime?: string
  estimatedDuration: number
  isEmergency?: boolean
  notes?: string
}

export async function listSchedules(params?: {
  search?: string
  status?: string
  dateFrom?: string
  dateTo?: string
  month?: string | number
  year?: string | number
}) {
  const response = await api.get<{ success: true; data: ScheduleRecord[] }>("/schedules", { params })
  return response.data
}

export async function createSchedule(payload: SchedulePayload) {
  const response = await api.post<{ success: true; data: ScheduleRecord }>("/schedules", payload)
  return response.data
}

export async function updateSchedule(id: string, payload: Partial<SchedulePayload>) {
  const response = await api.patch<{ success: true; data: ScheduleRecord }>(`/schedules/${id}`, payload)
  return response.data
}

export async function startSchedule(id: string, payload?: { startTime?: string }) {
  const response = await api.patch<{ success: true; data: ScheduleRecord }>(`/schedules/${id}/start`, payload ?? {})
  return response.data
}

export async function completeSchedule(
  id: string,
  payload: { startTime: string; endTime: string; serviceReport?: string },
) {
  const response = await api.patch<{ success: true; data: ScheduleRecord }>(`/schedules/${id}/complete`, payload)
  return response.data
}

export async function cancelSchedule(id: string, payload: { cancellationReason: string }) {
  const response = await api.patch<{ success: true; data: ScheduleRecord }>(`/schedules/${id}/cancel`, payload)
  return response.data
}

export async function deleteSchedule(id: string) {
  const response = await api.delete<{ success: true; data: null }>(`/schedules/${id}`)
  return response.data
}

export async function uploadScheduleNa(id: string, file: File) {
  const formData = new FormData()
  formData.append("file", file)
  const response = await api.post<{ success: true; data: ScheduleRecord }>(`/schedules/${id}/na`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  })
  return response.data
}
