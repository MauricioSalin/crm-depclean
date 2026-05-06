import { api } from "@/lib/api/client"

export type ClientUnitRecord = {
  id: string
  clientId: string
  name: string
  isPrimary: boolean
  unitCount: number
  reservoirProfile?: {
    entries: Array<{ label: string; capacityLiters: string }>
    observations: string
    validityMonths: number
  }
  address: {
    street: string
    number: string
    complement?: string
    neighborhood: string
    city: string
    state: string
    zipCode: string
  }
  createdAt: string
}

export type ClientRecord = {
  id: string
  companyName: string
  cnpj: string
  responsibleName: string
  email: string
  phone: string
  clientTypeId: string
  assessor: {
    name: string
    email: string
    phone: string
  }
  copyNotificationsToOwner: boolean
  isActive: boolean
  units: ClientUnitRecord[]
  createdAt: string
  updatedAt: string
}

export type ClientAttachmentRecord = {
  id: string
  clientId: string
  scheduledServiceId?: string
  type: "service_na" | "certificate" | "informative" | "contract" | "other"
  title: string
  fileName: string
  documentUrl: string
  mimeType?: string
  fileSize?: number
  source: "agenda" | "contracts" | "manual" | "ai"
  uploadedAt: string
  description?: string
  metadata?: {
    templateId?: string
    serviceTypeName?: string
    scheduledDate?: string
    scheduledSendAt?: string
    sentAt?: string
    deliveryChannel?: string
    deliveryStatus?: string
    startTime?: string
    endTime?: string
    cancellationReason?: string
  }
}

export type ClientPayload = {
  companyName: string
  cnpj: string
  responsibleName: string
  phone?: string
  email: string
  clientTypeId: string
  assessorName?: string
  assessorEmail?: string
  assessorPhone?: string
  copyNotificationsToOwner?: boolean
  isActive?: boolean
  units: Array<{
    id?: string
    name: string
    isPrimary: boolean
    unitCount: number
    address: {
      street: string
      number: string
      complement?: string
      neighborhood: string
      city: string
      state: string
      zipCode: string
    }
  }>
}

const legacyClientIds: Record<string, string> = {
  client1: "client-condominio-eduardo-prado",
  client2: "client-residencial-solar",
  client3: "client-predio-comercial-centro",
}

export function resolveClientId(id: string) {
  return legacyClientIds[id] ?? id
}

export async function listClients(search = "") {
  const response = await api.get<{ success: true; data: ClientRecord[] }>("/clients", { params: { search } })
  return response.data
}

export async function getClientById(id: string) {
  const response = await api.get<{ success: true; data: ClientRecord }>(`/clients/${resolveClientId(id)}`)
  return response.data
}

export async function getClientAttachments(id: string) {
  const response = await api.get<{ success: true; data: ClientAttachmentRecord[] }>(`/clients/${resolveClientId(id)}/attachments`)
  return response.data
}

export async function uploadClientAttachment(id: string, file: File, title?: string, type = "other") {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("title", title?.trim() || file.name)
  formData.append("type", type)

  const response = await api.post<{ success: true; data: ClientAttachmentRecord }>(
    `/clients/${resolveClientId(id)}/attachments`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  )
  return response.data
}

export async function deleteClientAttachment(clientId: string, attachmentId: string) {
  const response = await api.delete<{ success: true; data: null }>(
    `/clients/${resolveClientId(clientId)}/attachments/${attachmentId}`,
  )
  return response.data
}

export async function createClient(payload: ClientPayload) {
  const response = await api.post<{ success: true; data: ClientRecord }>("/clients", payload)
  return response.data
}

export async function updateClient(id: string, payload: Partial<ClientPayload>) {
  const response = await api.patch<{ success: true; data: ClientRecord }>(`/clients/${resolveClientId(id)}`, payload)
  return response.data
}
