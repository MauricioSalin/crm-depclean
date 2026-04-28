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
    date: string
    time: string
    startTime: string
    endTime: string
    serviceReport: string
    naAttachment: {
      fileName: string
      documentUrl: string
      mimeType: string
      fileSize: number
    } | null
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
  }
}

export async function listCertificates() {
  const response = await api.get<{ success: true; data: CertificateQueueRecord[] }>("/certificates")
  return response.data
}

export async function getCertificateContext(scheduleId: string) {
  const response = await api.get<{ success: true; data: CertificateContextRecord }>(
    `/certificates/${scheduleId}/context`,
  )
  return response.data
}

export async function sendCertificate(scheduleId: string, file: File, templateId?: string) {
  const formData = new FormData()
  formData.append("file", file)

  const response = await api.post<{ success: true; data: CertificateQueueRecord }>(
    `/certificates/${scheduleId}/send`,
    formData,
    {
      params: { templateId },
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  )
  return response.data
}
