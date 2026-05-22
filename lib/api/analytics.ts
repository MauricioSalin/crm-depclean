import { api } from "@/lib/api/client"

export type MonthlyRevenuePoint = {
  month: string
  value: number
}

export type ServicesByPeriodPoint = {
  period: string
  completed: number
  scheduled: number
  cancelled: number
  emergency: number
}

export type ServicesByTeamPoint = {
  team: string
  services: number
  color?: string
}

export type ServicesSummaryPoint = {
  serviceId: string
  serviceName: string
  completed: number
  scheduled: number
  cancelled: number
  emergency: number
  total: number
  completionRate: number
  averageDurationMinutes: number
}

export type DashboardStatsRecord = {
  activeClients: number
  activeClientsChange: number
  activeContracts: number
  inactiveContracts: number
  activeContractsGlobalValue: number
  monthlyRevenue: number
  monthlyRevenueChange: number
  scheduledServices: number
  scheduledServicesChange: number
  completedServices: number
  completedServicesChange: number
  emergencyServices: number
  completionRate: number
  overdueInstallments: number
  overdueInstallmentsValue: number
  teamProductivity: Array<{
    teamId: string
    teamName: string
    completedServices: number
    scheduledServices: number
    cancelledServices: number
  }>
}

export type FinancialInstallmentRecord = {
  id: string
  contractId: string
  contractNumber: string
  clientId: string
  clientCompanyName: string
  source: "contract" | "schedule"
  scheduleId?: string
  number: number
  value: number
  dueDate: string
  paidDate?: string
  paidValue?: number
  status: "pending" | "paid" | "late" | "overdue" | "cancelled"
}

export type FinancialSummaryRecord = {
  totalPaid: number
  totalPending: number
  totalLate?: number
  totalOverdue: number
  paidCount: number
  pendingCount: number
  lateCount?: number
  overdueCount: number
  totalCount: number
  adherenceRate: number
}

export type FinancialAnalyticsRecord = {
  summary: FinancialSummaryRecord
  installments: FinancialInstallmentRecord[]
  monthlyRevenueData: MonthlyRevenuePoint[]
  financeHealthData: Array<{ name: string; value: number }>
}

export type DashboardAnalyticsRecord = {
  stats: DashboardStatsRecord
  monthlyRevenueData: MonthlyRevenuePoint[]
  servicesByPeriodData: ServicesByPeriodPoint[]
  servicesByTeamData: ServicesByTeamPoint[]
  servicesSummaryData: ServicesSummaryPoint[]
  recentClients: Array<{
    id: string
    companyName: string
    responsibleName: string
    clientTypeId: string
    clientTypeName: string
    clientTypeColor: string
    activeContracts: number
  }>
  upcomingServices: Array<{
    id: string
    clientId: string
    clientName: string
    serviceTypeName: string
    status: "scheduled" | "in_progress" | "rescheduled"
    time: string
    neighborhood: string
    date: string
  }>
  teamsWithActivity: Array<{
    id: string
    name: string
    color: string
    currentService: string | null
    nextService: string | null
    servicesCount: number
  }>
}

export type ReportsAnalyticsRecord = {
  dashboardStats: DashboardStatsRecord
  financialSummary: FinancialSummaryRecord
  monthlyRevenueData: MonthlyRevenuePoint[]
  servicesByPeriodData: ServicesByPeriodPoint[]
  servicesByTeamData: ServicesByTeamPoint[]
  servicesSummaryData: ServicesSummaryPoint[]
  clients: Array<{
    id: string
    companyName: string
    responsibleName: string
    phone: string
    isActive: boolean
    clientTypeName: string
  }>
  contracts: Array<{
    id: string
    contractNumber: string
    clientId: string
    clientCompanyName: string
    totalValue: number
    status: string
  }>
  teams: Array<{ id: string; name: string; color: string }>
  services: Array<{ id: string; name: string; isActive: boolean }>
}

export type DashboardAnalyticsParams = {
  days?: number
  dateFrom?: string
  dateTo?: string
}

export async function getFinancialAnalytics(params?: { dateFrom?: string; dateTo?: string }) {
  const response = await api.get<{ success: true; data: FinancialAnalyticsRecord }>("/analytics/financial", { params })
  return response.data
}

export async function getDashboardAnalytics(params?: DashboardAnalyticsParams) {
  const response = await api.get<{ success: true; data: DashboardAnalyticsRecord }>("/analytics/dashboard", { params })
  return response.data
}

export async function getReportsAnalytics(params?: { dateFrom?: string; dateTo?: string; teamId?: string; teamIds?: string; serviceId?: string; serviceIds?: string }) {
  const response = await api.get<{ success: true; data: ReportsAnalyticsRecord }>("/analytics/reports", { params })
  return response.data
}
