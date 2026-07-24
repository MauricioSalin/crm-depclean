import { api } from "@/lib/api/client"

export type CertificateQueueRecord = {
  id: string
  scheduleId: string
  clientId: string
  clientName: string
  unitId: string
  unitName: string
  serviceTypeId: string
  serviceTypeName: string
  teams: Array<{ id: string; name: string; color: string }>
  additionalEmployees: Array<{ id: string; name: string }>
  date: string
  time: string
  status: "pending" | "sent"
  naFileName?: string
  naFileNames: string[]
  naCount: number
  certificateFileName?: string
  certificateUrl?: string
  sentAt?: string
  createdAt: string
  updatedAt: string
}

export type CertificateContextRecord = {
  scheduleId: string
  variables: Record<string, unknown>
  schedule: {
    id: string
    serviceTypeId: string
    date: string
    time: string
    startTime: string
    endTime: string
    certificateTemplateId: string
    serviceReport: string
    naAttachment: {
      fileName: string
      documentUrl: string
      mimeType: string
      fileSize: number
    } | null
    naAttachments: Array<{
      fileName: string
      documentUrl: string
      mimeType: string
      fileSize: number
    }>
  }
  client: {
    id: string
    companyName: string
    cnpj: string
    email: string
    phone: string
  }
  unit: {
    id: string
    name: string
    address: string
  }
  service: {
    id: string
    name: string
    defaultCertificateTemplateId: string
  }
}

export async function listCertificates() {
  const response = await api.get<{ success: true; data: CertificateQueueRecord[] }>("/certificates")
  return response.data
}

export async function getCertificateContext(scheduleId: string, serviceTypeId?: string) {
  const response = await api.get<{ success: true; data: CertificateContextRecord }>(
    `/certificates/${scheduleId}/context`,
    { params: { serviceTypeId } },
  )
  return response.data
}

export async function sendCertificate(scheduleId: string, file: File, templateId?: string, serviceTypeId?: string) {
  const formData = new FormData()
  formData.append("file", file)

  const response = await api.post<{ success: true; data: CertificateQueueRecord }>(
    `/certificates/${scheduleId}/send`,
    formData,
    {
      params: { templateId, serviceTypeId },
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  )
  return response.data
}

export async function resendCertificate(scheduleId: string, serviceTypeId?: string) {
  const response = await api.post<{ success: true; data: CertificateQueueRecord }>(
    `/certificates/${scheduleId}/resend`,
    undefined,
    { params: { serviceTypeId } },
  )
  return response.data
}

export async function deleteCertificate(scheduleId: string, serviceTypeId?: string) {
  const response = await api.delete<{ success: true; data: CertificateQueueRecord }>(
    `/certificates/${scheduleId}`,
    { params: { serviceTypeId } },
  )
  return response.data
}
