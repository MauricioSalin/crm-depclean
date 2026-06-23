import { api } from "@/lib/api/client"

export type AuditLogStatus = "success" | "error"

export type AuditLogRecord = {
  id: string
  type: string
  typeLabel: string
  status: AuditLogStatus
  module: string
  moduleLabel: string
  title: string
  description: string
  failureReason: string
  method: string
  path: string
  statusCode: number
  durationMs: number
  actorUserId: string
  actorEmployeeId: string
  actorName: string
  actorEmail: string
  clientId: string
  clientName: string
  targetEmployeeId: string
  targetEmployeeName: string
  entityType: string
  entityId: string
  entityName: string
  metadata: Record<string, unknown>
  createdAt: string
}

export type AuditLogsResponse = {
  items: AuditLogRecord[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type AuditLogsQuery = {
  search?: string
  from?: string
  to?: string
  clientId?: string
  employeeId?: string
  type?: string
  module?: string
  status?: "all" | AuditLogStatus
  page?: number
  limit?: number
}

export async function listAuditLogs(query: AuditLogsQuery = {}) {
  const response = await api.get<{ success: true; data: AuditLogsResponse }>("/logs", {
    params: query,
  })
  return response.data
}
