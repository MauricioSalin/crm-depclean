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
  responsibleCpf: string
  hasFepamCpf?: boolean
  hasFepamPassword?: boolean
  email: string
  phone: string
  clientTypeId: string
  assessor: {
    name: string
    cpf: string
    email: string
    phone: string
    receivesNotifications: boolean
  }
  syndic: {
    name: string
    cpf: string
    email: string
    phone: string
    receivesNotifications: boolean
  }
  responsibleReceivesNotifications: boolean
  copyNotificationsToOwner: boolean
  preferredServiceWeekday: number | null
  preferredServiceShift: "" | "morning" | "afternoon"
  isDelinquent: boolean
  units: ClientUnitRecord[]
  createdAt: string
  updatedAt: string
}

export type ClientCnpjLookupRecord = {
  cnpj: string
  companyName: string
  tradeName: string
  responsibleName: string
  phone: string
  email: string
  status: string
  address: {
    street: string
    number: string
    complement?: string
    neighborhood: string
    city: string
    state: string
    zipCode: string
  }
}

export type ClientTypeOptionRecord = {
  id: string
  name: string
  color: string
  contractSignerRole: "owner" | "assessor" | "syndic"
}

export type ClientAttachmentRecord = {
  id: string
  clientId: string
  scheduledServiceId?: string
  parentId?: string | null
  type: ClientAttachmentType
  title: string
  fileName: string
  documentUrl: string
  mimeType?: string
  fileSize?: number
  source: "agenda" | "contracts" | "manual" | "ai"
  uploadedAt: string
  description?: string
  metadata?: {
    originKind?: string
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
    contractId?: string
  }
}

export type ClientExtraStatus = "pending" | "paid" | "late" | "overdue" | "cancelled"

export type ClientExtraRecord = {
  id: string
  clientId: string
  description: string
  value: number
  createdDate: string
  dueDate: string
  status: ClientExtraStatus
  paidDate?: string
  paidValue?: number
  createdAt: string
  updatedAt: string
}

export type ClientServiceRecord = {
  id: string
  contractId: string | null
  isEmergency: boolean
  isManual: boolean
  serviceTypeName: string
  teams: Array<{ id: string; name: string; color: string }>
  additionalEmployees: Array<{ id: string; name: string }>
  date: string
  duration: number
  durationValue?: number
  durationType?: "minutes" | "hours" | "shift" | "days"
  status: "scheduled" | "in_progress" | "completed" | "cancelled" | "rescheduled"
}

export const clientAttachmentTypes = [
  "contract",
  "schedule",
  "meeting_minutes",
  "bait_stations",
  "checklist",
  "other",
] as const

export type ClientAttachmentType = (typeof clientAttachmentTypes)[number]

export type ClientAttachmentFolderRecord = {
  id: string
  parentId: string | null
  name: string
  systemKind: string
  scheduledServiceId?: string
  createdAt: string
}

export type ClientAttachmentWorkspace = {
  folders: ClientAttachmentFolderRecord[]
  files: ClientAttachmentRecord[]
}

export type ClientFepamCredentialsRecord = {
  fepamCpf: string
  fepamPassword: string
}

export type CreateClientExtraPayload = {
  description: string
  value: number
  createdDate: string
  dueDate: string
  status: ClientExtraStatus
}

export type ClientPayload = {
  companyName: string
  cnpj: string
  responsibleName: string
  responsibleCpf: string
  fepamCpf?: string
  fepamPassword?: string
  phone: string
  email?: string
  clientTypeId: string
  assessorName?: string
  assessorCpf?: string
  assessorEmail?: string
  assessorPhone?: string
  assessorReceivesNotifications?: boolean
  syndicName?: string
  syndicCpf?: string
  syndicEmail?: string
  syndicPhone?: string
  syndicReceivesNotifications?: boolean
  responsibleReceivesNotifications?: boolean
  copyNotificationsToOwner?: boolean
  preferredServiceWeekday?: number | null
  preferredServiceShift?: "" | "morning" | "afternoon"
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

export async function lookupClientCnpj(cnpj: string) {
  const digits = cnpj.replace(/\D/g, "")
  const response = await api.get<{ success: true; data: ClientCnpjLookupRecord }>(
    `/clients/cnpj/${digits}`,
  )
  return response.data
}

export async function listClients(search = "") {
  const response = await api.get<{ success: true; data: ClientRecord[] }>("/clients", { params: { search } })
  return response.data
}

export async function listClientTypeOptions() {
  const response = await api.get<{ success: true; data: ClientTypeOptionRecord[] }>("/clients/catalog/types")
  return response.data
}

export async function getClientById(id: string) {
  const response = await api.get<{ success: true; data: ClientRecord }>(`/clients/${resolveClientId(id)}`)
  return response.data
}

export async function getClientFepamCredentials(id: string) {
  const response = await api.get<{ success: true; data: ClientFepamCredentialsRecord }>(
    `/clients/${resolveClientId(id)}/fepam-credentials`,
  )
  return response.data
}

export async function getClientAttachments(id: string) {
  const response = await api.get<{ success: true; data: ClientAttachmentRecord[] }>(`/clients/${resolveClientId(id)}/attachments`)
  return response.data
}

export async function getClientAttachmentWorkspace(id: string) {
  const response = await api.get<{ success: true; data: ClientAttachmentWorkspace }>(
    `/clients/${resolveClientId(id)}/attachments/workspace`,
  )
  return response.data
}

export async function listClientServices(id: string) {
  const response = await api.get<{ success: true; data: ClientServiceRecord[] }>(`/clients/${resolveClientId(id)}/services`)
  return response.data
}

export async function listClientExtras(id: string) {
  const response = await api.get<{ success: true; data: ClientExtraRecord[] }>(`/clients/${resolveClientId(id)}/extras`)
  return response.data
}

export async function createClientExtra(id: string, payload: CreateClientExtraPayload) {
  const response = await api.post<{ success: true; data: ClientExtraRecord }>(`/clients/${resolveClientId(id)}/extras`, payload)
  return response.data
}

export async function updateClientExtraStatus(id: string, extraId: string, status: ClientExtraStatus) {
  const response = await api.patch<{ success: true; data: ClientExtraRecord }>(
    `/clients/${resolveClientId(id)}/extras/${extraId}/status`,
    { status },
  )
  return response.data
}

export async function uploadClientAttachment(
  id: string,
  file: File,
  options: {
    title?: string
    type?: ClientAttachmentType
    parentId?: string | null
    scheduledServiceId?: string
  } = {},
) {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("title", options.title?.trim() || file.name)
  formData.append("type", options.type ?? "other")
  if (options.parentId) formData.append("parentId", options.parentId)
  if (options.scheduledServiceId) formData.append("scheduledServiceId", options.scheduledServiceId)

  const response = await api.post<{ success: true; data: ClientAttachmentRecord }>(
    `/clients/${resolveClientId(id)}/attachments`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  )
  return response.data
}

export async function createClientAttachmentFolder(id: string, payload: { name: string; parentId: string | null }) {
  const response = await api.post<{ success: true; data: ClientAttachmentFolderRecord }>(
    `/clients/${resolveClientId(id)}/attachments/folders`,
    payload,
  )
  return response.data
}

export async function updateClientAttachmentFolder(
  id: string,
  folderId: string,
  payload: { name?: string; parentId?: string | null },
) {
  const response = await api.patch<{ success: true; data: ClientAttachmentFolderRecord }>(
    `/clients/${resolveClientId(id)}/attachments/folders/${folderId}`,
    payload,
  )
  return response.data
}

export async function deleteClientAttachmentFolder(id: string, folderId: string) {
  const response = await api.delete<{ success: true; data: null }>(
    `/clients/${resolveClientId(id)}/attachments/folders/${folderId}`,
  )
  return response.data
}

export async function updateClientAttachment(
  id: string,
  attachmentId: string,
  payload: { name?: string; type?: ClientAttachmentType; parentId?: string | null },
) {
  const response = await api.patch<{ success: true; data: ClientAttachmentRecord }>(
    `/clients/${resolveClientId(id)}/attachments/files/${attachmentId}`,
    payload,
  )
  return response.data
}

export async function deleteWorkspaceClientAttachment(clientId: string, attachmentId: string) {
  const response = await api.delete<{ success: true; data: null }>(
    `/clients/${resolveClientId(clientId)}/attachments/files/${attachmentId}`,
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

export async function deleteClient(id: string) {
  const response = await api.delete<{ success: true; data: null }>(`/clients/${resolveClientId(id)}`)
  return response.data
}
