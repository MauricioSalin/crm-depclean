import { api } from "@/lib/api/client"

export type ScheduleNaAttachmentRecord = {
  type?: string
  title?: string
  fileName: string
  mimeType?: string
  fileSize?: number
  documentUrl: string
  uploadedAt?: string
}

export type ScheduleRecord = {
  id: string
  contractId: string | null
  contractServiceId: string | null
  contractServiceIds: string[]
  isManual: boolean
  isClientDelinquent: boolean
  clientId: string
  clientName: string
  unitId: string
  unitName: string
  address: string
  serviceTypeId: string
  serviceTypeIds: string[]
  serviceTypeName: string
  informativeTemplateId: string
  certificateTemplateId: string
  autoSendInformative: boolean
  generateCertificateRequest: boolean
  teamId?: string
  teamName?: string
  teams: Array<{ id: string; name: string; color: string }>
  additionalEmployees: Array<{ id: string; name: string }>
  date: string
  time: string
  duration: number
  durationValue?: number
  durationType?: "hours" | "shift" | "days"
  status: "draft" | "scheduled" | "in_progress" | "completed" | "cancelled" | "rescheduled"
  recurrence: { type: "none"; daysOfWeek: number[]; interval: number }
  billable: boolean
  value: number
  billingStatus: "pending" | "paid" | "overdue" | "cancelled"
  paidDate?: string
  paidValue?: number
  paymentMethod?: string
  billingNotes?: string
  notes: string
  isEmergency: boolean
  cancellationReason?: string
  completionStartDate?: string
  completionStartTime?: string
  completionEndDate?: string
  completionEndTime?: string
  serviceReport?: string
  naFileName?: string
  naDocumentUrl?: string
  naAttachments: ScheduleNaAttachmentRecord[]
  canStartAttendance?: boolean
  createdAt: string
  updatedAt: string
}

export type SchedulePayload = {
  clientId: string
  unitId: string
  contractId?: string
  contractServiceId?: string
  contractServiceIds?: string[]
  serviceTypeId: string
  serviceTypeIds?: string[]
  informativeTemplateId?: string
  certificateTemplateId?: string
  autoSendInformative?: boolean
  generateCertificateRequest?: boolean
  teamIds?: string[]
  additionalEmployeeIds?: string[]
  scheduledDate: string
  scheduledTime?: string
  estimatedDuration: number
  durationValue?: number
  durationType?: "hours" | "shift" | "days"
  isEmergency?: boolean
  isLegacyImport?: boolean
  billable?: boolean
  value?: number
  billingStatus?: "pending" | "paid" | "overdue" | "cancelled"
  paidDate?: string
  paidValue?: number
  paymentMethod?: string
  billingNotes?: string
  notes?: string
}

export type ScheduleRescheduleOption = {
  date: string
  time: string
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

export async function getScheduleById(id: string) {
  const response = await api.get<{ success: true; data: ScheduleRecord }>(`/schedules/${id}`)
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

export async function updateScheduleStatus(id: string, status: ScheduleRecord["status"]) {
  const response = await api.patch<{ success: true; data: ScheduleRecord }>(`/schedules/${id}/status`, { status })
  return response.data
}

export async function updateScheduleBilling(
  id: string,
  payload: Pick<SchedulePayload, "billingStatus" | "paidDate" | "paidValue" | "paymentMethod" | "billingNotes">,
) {
  const response = await api.patch<{ success: true; data: ScheduleRecord }>(`/schedules/${id}/billing`, payload)
  return response.data
}

export async function getScheduleRescheduleOptions(id: string) {
  const response = await api.get<{ success: true; data: ScheduleRescheduleOption[] }>(`/schedules/${id}/reschedule-options`)
  return response.data
}

export async function rescheduleSchedule(id: string, payload: { scheduledDate: string; scheduledTime?: string }) {
  const response = await api.patch<{ success: true; data: ScheduleRecord }>(`/schedules/${id}/reschedule`, payload)
  return response.data
}

export async function startSchedule(id: string, payload?: { startTime?: string }) {
  const response = await api.patch<{ success: true; data: ScheduleRecord }>(`/schedules/${id}/start`, payload ?? {})
  return response.data
}

export async function completeSchedule(
  id: string,
  payload: { startDate?: string; startTime: string; endDate?: string; endTime: string; serviceReport?: string },
) {
  const response = await api.patch<{ success: true; data: ScheduleRecord }>(`/schedules/${id}/complete`, payload)
  return response.data
}

export async function cancelSchedule(id: string, payload: { cancellationReason: string }) {
  const response = await api.patch<{ success: true; data: ScheduleRecord }>(`/schedules/${id}/cancel`, payload)
  return response.data
}

export async function reactivateSchedule(id: string) {
  const response = await api.patch<{ success: true; data: ScheduleRecord }>(`/schedules/${id}/reactivate`)
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
