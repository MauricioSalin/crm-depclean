import { api } from "@/lib/api/client"
import type { ScheduleRecord } from "@/lib/api/schedules"
import type { ServiceRecurrenceRuleRecord } from "@/lib/api/services"

export type ContractServicePayload = {
  id?: string
  serviceTypeId: string
  value?: number
  teamIds?: string[]
  additionalEmployeeIds?: string[]
  unitIds: string[]
  clauses?: string[]
  informativeTemplateId?: string
  certificateTemplateId?: string
  autoSendInformative?: boolean
  generateCertificateRequest?: boolean
  recurrence?: string
  duration?: number
  durationType?: "minutes" | "hours" | "shift" | "days"
  isActive?: boolean
  isRecurrenceService?: boolean
}

export type ContractPayload = {
  clientId: string
  templateId: string
  automationCreateSchedules?: boolean
  automationCreateInformatives?: boolean
  automationInformativeTemplateId?: string
  automationCreateCertificates?: boolean
  automationCertificateTemplateId?: string
  contractNumber?: string
  unitIds?: string[]
  totalValue?: number
  downPaymentValue?: number
  duration: number
  startDate: string
  firstDueDate: string
  endDate?: string
  firstVisitDate?: string
  firstVisitTime?: string
  paymentDay: number
  installmentsCount: number
  recurrence?: string
  recurrenceRules?: ServiceRecurrenceRuleRecord[]
  recurrenceServiceTypeId?: string
  services: ContractServicePayload[]
  status?: string
  renderedHtml?: string
  signatureUrl?: string
  notes?: string
}

export type ContractInstallmentRecord = {
  id: string
  number: number
  value: number
  dueDate: string
  paidDate?: string
  paidValue?: number
  status: "pending" | "paid" | "late" | "overdue" | "cancelled"
  overdueMarkedAt?: string
  lastOverdueReminderAt?: string
  paymentMethod?: string
  notes?: string
  createdAt: string
}

export type ContractRecord = {
  id: string
  contractNumber: string
  clientId: string
  clientCompanyName?: string | null
  templateId: string
  templateName?: string | null
  automationCreateSchedules?: boolean
  automationCreateInformatives?: boolean
  automationInformativeTemplateId?: string
  automationCreateCertificates?: boolean
  automationCertificateTemplateId?: string
  automationSchedulePlanCount?: number
  automationSchedulePlanSavedAt?: string
  automationSchedulePlanPublishedAt?: string
  unitIds: string[]
  totalValue: number
  downPaymentValue: number
  duration: number
  creationDate: string
  startDate?: string
  endDate?: string
  firstVisitDate: string
  firstVisitTime: string
  paymentDay: number
  installmentsCount: number
  recurrence: string
  recurrenceRules: ServiceRecurrenceRuleRecord[]
  recurrenceServiceTypeId: string
  services: Array<{
    id: string
    serviceTypeId: string
    value: number
    teamIds: string[]
    additionalEmployeeIds: string[]
    unitIds: string[]
    clauses: string[]
    informativeTemplateId: string
    certificateTemplateId: string
    autoSendInformative: boolean
    generateCertificateRequest: boolean
    recurrence: string
    duration: number
    durationType: "minutes" | "hours" | "shift" | "days"
    isActive: boolean
    isRecurrenceService: boolean
  }>
  installments: ContractInstallmentRecord[]
  status: string
  signatureUrl?: string
  signedAt?: string
  documentUrl?: string
  documentFileName?: string
  clicksign?: {
    envelopeId: string
    documentKey: string
    documentId: string
    folderId?: string
    webhookId: string
    status: string
    managementUrl?: string
    signers: Array<{
      signerId: string
      requestId: string
      name: string
      email: string
      phone?: string
      role: string
      status: string
      signUrl: string
      signedAt?: string
    }>
    lastSyncedAt?: string
  }
  renderedHtml: string
  notes?: string
  generatedAt?: string
  createdAt: string
  updatedAt: string
}

export type ContractPreviewRecord = {
  contractNumber: string
  renderedHtml: string
  totalValue: number
  downPaymentValue: number
  recurrence: string
  endDate: string
  firstDueDate: string
}

export type ContractSchedulePlanRecord = {
  items: ScheduleRecord[]
  generatedItems: ScheduleRecord[]
  anchorDate: string
  endDate: string
  isSaved: boolean
  savedAt?: string
  isPublished: boolean
  publishedAt?: string
}

export type PublishedContractSchedulePlanRecord = {
  count: number
  publishedAt: string
  alreadyPublished: boolean
}

export type ContractSchedulePlanPayload = {
  items: Array<{
    id: string
    date: string
    time: string
    durationValue: number
    durationType: "minutes" | "hours" | "shift" | "days"
  }>
}

export type ContractImportRow = {
  contractNumber: string
  clientId: string
  templateId: string
  unitIds?: string
  serviceTypeIds: string
  serviceValues?: string
  totalValue: string
  downPaymentValue?: string
  duration: string
  startDate: string
  firstDueDate: string
  endDate?: string
  firstVisitDate?: string
  firstVisitTime?: string
  paymentDay: string
  installmentsCount: string
  recurrence?: string
  status?: string
  signedAt?: string
  paidInstallmentsThroughDate?: string
  signatureUrl?: string
  documentUrl?: string
  documentFileName?: string
  clicksignEnvelopeId?: string
  clicksignDocumentKey?: string
  clicksignDocumentId?: string
  clicksignWebhookId?: string
  clicksignStatus?: string
  clicksignLastSyncedAt?: string
  clicksignSigners?: string
  notes?: string
}

export type ContractUpdatePayload = Partial<ContractPayload> & {
  deferClicksignReplacement?: boolean
}

export type ContractImportResult = {
  importedCount: number
  contracts: ContractRecord[]
}

const legacyContractIds: Record<string, string> = {
  contract1: "contract-dep-2026-001",
  contract2: "contract-dep-2026-002",
  contract3: "contract-dep-2026-003",
}

export function resolveContractId(id: string) {
  return legacyContractIds[id] ?? id
}

export async function listContracts(search = "") {
  const response = await api.get<{ success: true; data: ContractRecord[] }>("/contracts", { params: { search } })
  return response.data
}

export async function getContractById(id: string) {
  const response = await api.get<{ success: true; data: ContractRecord }>(`/contracts/${resolveContractId(id)}`)
  return response.data
}

export async function previewContract(payload: ContractPayload) {
  const response = await api.post<{ success: true; data: ContractPreviewRecord }>("/contracts/preview", payload)
  return response.data
}

export async function createContract(payload: ContractPayload) {
  const response = await api.post<{ success: true; data: ContractRecord }>("/contracts", payload)
  return response.data
}

export async function importSignedContracts(contracts: ContractImportRow[]) {
  const response = await api.post<{ success: true; data: ContractImportResult }>("/contracts/import", { contracts })
  return response.data
}

export async function updateContract(id: string, payload: ContractUpdatePayload) {
  const response = await api.patch<{ success: true; data: ContractRecord }>(`/contracts/${resolveContractId(id)}`, payload)
  return response.data
}

export async function uploadContractDocument(id: string, file: File) {
  const formData = new FormData()
  formData.append("file", file)

  const response = await api.post<{ success: true; data: ContractRecord }>(
    `/contracts/${resolveContractId(id)}/document`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  )
  return response.data
}

export async function getContractSchedulePlan(id: string) {
  const response = await api.get<{ success: true; data: ContractSchedulePlanRecord }>(
    `/contracts/${resolveContractId(id)}/schedule-plan`,
  )
  return response.data
}

export async function saveContractSchedulePlan(id: string, payload: ContractSchedulePlanPayload) {
  const response = await api.patch<{ success: true; data: ContractSchedulePlanRecord }>(
    `/contracts/${resolveContractId(id)}/schedule-plan`,
    payload,
  )
  return response.data
}

export async function exportContractSchedulePlan(id: string, payload: ContractSchedulePlanPayload) {
  const response = await api.post<Blob>(
    `/contracts/${resolveContractId(id)}/schedule-plan/export`,
    payload,
    { responseType: "blob" },
  )
  return response.data
}

export async function publishContractSchedulePlan(id: string) {
  const response = await api.post<{ success: true; data: PublishedContractSchedulePlanRecord }>(
    `/contracts/${resolveContractId(id)}/schedule-plan/publish`,
  )
  return response.data
}

export async function sendContractToClicksign(id: string) {
  const response = await api.post<{ success: true; data: unknown }>(`/clicksign/contracts/${resolveContractId(id)}/send`)
  return response.data
}

export async function replaceContractInClicksign(id: string) {
  const response = await api.post<{ success: true; data: unknown }>(
    `/clicksign/contracts/${resolveContractId(id)}/replace`,
  )
  return response.data
}

export async function syncContractClicksign(id: string) {
  const response = await api.post<{ success: true; data: unknown }>(`/clicksign/contracts/${resolveContractId(id)}/sync`)
  return response.data
}

export async function remindContractSigner(contractId: string, signerId: string) {
  const response = await api.post<{ success: true; data: unknown }>(
    `/clicksign/contracts/${resolveContractId(contractId)}/signers/${encodeURIComponent(signerId)}/reminder`,
  )
  return response.data
}

export async function deleteContract(id: string) {
  const response = await api.delete<{ success: true; data: null }>(`/contracts/${resolveContractId(id)}`)
  return response.data
}

export async function updateInstallment(
  contractId: string,
  installmentId: string,
  payload: {
    status: "pending" | "paid" | "late" | "overdue" | "cancelled"
    paidDate?: string
    paidValue?: number
    paymentMethod?: string
    notes?: string
  },
) {
  const response = await api.patch<{ success: true; data: ContractRecord }>(
    `/contracts/${resolveContractId(contractId)}/installments/${installmentId}`,
    payload,
  )
  return response.data
}
