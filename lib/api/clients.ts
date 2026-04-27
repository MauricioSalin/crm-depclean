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

export async function listClients(search = "") {
  const response = await api.get<{ success: true; data: ClientRecord[] }>("/clients", { params: { search } })
  return response.data
}

export async function getClientById(id: string) {
  const response = await api.get<{ success: true; data: ClientRecord }>(`/clients/${id}`)
  return response.data
}

export async function getClientAttachments(id: string) {
  const response = await api.get<{ success: true; data: ClientAttachmentRecord[] }>(`/clients/${id}/attachments`)
  return response.data
}

export async function createClient(payload: ClientPayload) {
  const response = await api.post<{ success: true; data: ClientRecord }>("/clients", payload)
  return response.data
}

export async function updateClient(id: string, payload: Partial<ClientPayload>) {
  const response = await api.patch<{ success: true; data: ClientRecord }>(`/clients/${id}`, payload)
  return response.data
}
