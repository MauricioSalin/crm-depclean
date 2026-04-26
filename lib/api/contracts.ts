import { api } from "@/lib/api/client"
import type { ServiceRecurrenceRuleRecord } from "@/lib/api/services"

export type ContractServicePayload = {
  id?: string
  serviceTypeId: string
  value?: number
  teamIds?: string[]
  additionalEmployeeIds?: string[]
  unitIds: string[]
  clauses?: string[]
  isActive?: boolean
}

export type ContractPayload = {
  clientId: string
  templateId: string
  contractNumber?: string
  unitIds?: string[]
  totalValue?: number
  duration: number
  startDate: string
  endDate?: string
  paymentDay: number
  installmentsCount: number
  recurrence?: string
  recurrenceRules?: ServiceRecurrenceRuleRecord[]
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
  status: "pending" | "paid" | "overdue" | "cancelled"
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
  unitIds: string[]
  totalValue: number
  duration: number
  startDate: string
  endDate: string
  paymentDay: number
  installmentsCount: number
  recurrence: string
  recurrenceRules: ServiceRecurrenceRuleRecord[]
  services: Array<{
    id: string
    serviceTypeId: string
    value: number
    teamIds: string[]
    additionalEmployeeIds: string[]
    unitIds: string[]
    clauses: string[]
    isActive: boolean
  }>
  installments: ContractInstallmentRecord[]
  status: string
  signatureUrl?: string
  signedAt?: string
  documentUrl?: string
  documentFileName?: string
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
  recurrence: string
  endDate: string
  firstDueDate: string
}

export async function listContracts(search = "") {
  const response = await api.get<{ success: true; data: ContractRecord[] }>("/contracts", { params: { search } })
  return response.data
}

export async function getContractById(id: string) {
  const response = await api.get<{ success: true; data: ContractRecord }>(`/contracts/${id}`)
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

export async function updateContract(id: string, payload: Partial<ContractPayload>) {
  const response = await api.patch<{ success: true; data: ContractRecord }>(`/contracts/${id}`, payload)
  return response.data
}

export async function deleteContract(id: string) {
  const response = await api.delete<{ success: true; data: null }>(`/contracts/${id}`)
  return response.data
}

export async function updateInstallment(
  contractId: string,
  installmentId: string,
  payload: {
    status: "pending" | "paid" | "overdue" | "cancelled"
    paidDate?: string
    paidValue?: number
    paymentMethod?: string
    notes?: string
  },
) {
  const response = await api.patch<{ success: true; data: ContractRecord }>(
    `/contracts/${contractId}/installments/${installmentId}`,
    payload,
  )
  return response.data
}
