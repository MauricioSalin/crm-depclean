// ==========================================
// DEPCLEAN - Sistema de Gestão Operacional
// Data Types & Interfaces
// ==========================================

// Client Types (Tipos de Cliente)
export interface ClientType {
  id: string
  name: string // Condomínio, Casa, Apartamento, Prédio, etc.
  color: string // Badge color
  createdAt: Date
}

// Permission Roles (Permissões)
export interface Permission {
  id: string
  name: string // Administrador, Financeiro, Gerente, Equipe Operacional
  canView: {
    dashboard: boolean
    clients: boolean
    contracts: boolean
    services: boolean
    teams: boolean
    employees: boolean
    calendar: boolean
    financial: boolean
    reports: boolean
    settings: boolean
  }
  canEdit: {
    clients: boolean
    contracts: boolean
    services: boolean
    teams: boolean
    employees: boolean
    calendar: boolean
    financial: boolean
    settings: boolean
  }
  canDelete: {
    clients: boolean
    contracts: boolean
    services: boolean
    teams: boolean
    employees: boolean
    calendar: boolean
  }
  createdAt: Date
}

// Employee (Funcionário)
export interface Employee {
  id: string
  name: string
  phone: string
  email: string
  function: string // Função
  teamId: string
  avatar?: string
  isActive: boolean
  createdAt: Date
}

// Team (Equipe)
export interface Team {
  id: string
  name: string
  description?: string
  permissionId: string
  employees: string[] // Employee IDs
  color: string
  isActive: boolean
  createdAt: Date
}

// Service Type (Tipo de Serviço)
export type RecurrenceType = 
  | "weekly" 
  | "biweekly" 
  | "monthly" 
  | "bimonthly" 
  | "quarterly" 
  | "semiannual" 
  | "annual" 
  | "custom"

// Regra de recorrência baseada no número de unidades da filial
export type RecurrenceRuleType = "range" | "above"

export interface RecurrenceRule {
  type: RecurrenceRuleType
  minUnits: number // Para "range": início do intervalo; Para "above": acima de X
  maxUnits: number // Para "range": fim do intervalo; Para "above": Infinity
  recurrence: RecurrenceType
}

export interface ServiceType {
  id: string
  name: string // Desentupimento, Hidrojateamento, Limpeza de Reservatórios, etc.
  baseValue: number // Valor base
  clauses: string[] // Cláusulas do contrato
  defaultRecurrence: RecurrenceType
  recurrenceRules: RecurrenceRule[] // Regras de recorrência por nº de unidades (ordenadas por maxUnits)
  defaultTeamIds: string[] // Equipes responsáveis
  description?: string
  isActive: boolean
  createdAt: Date
}

// Client Branch (Filial do Cliente)
export interface ClientUnit {
  id: string
  clientId: string
  name: string // Ex: Matriz, Filial 1, Filial 2
  isPrimary: boolean // true = Matriz
  unitCount: number // Número de unidades (apartamentos, salas, etc.)
  address: {
    street: string
    number: string
    complement?: string
    neighborhood: string
    city: string
    state: string
    zipCode: string
  }
  createdAt: Date
}

// Client (Cliente)
export interface Client {
  id: string
  companyName: string // Razão Social
  cnpj: string
  responsibleName: string // Responsável
  phone: string
  email: string
  clientTypeId: string
  units: ClientUnit[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// Contract Service (Serviço do Contrato)
export interface ContractService {
  id: string
  contractId: string
  serviceTypeId: string
  value: number // Valor do serviço (pode ser diferente do valor base)
  teamIds: string[] // Equipes responsáveis
  additionalEmployeeIds?: string[] // Funcionários avulsos
  unitIds: string[] // Unidades que receberão o serviço
  clauses: string[] // Cláusulas específicas
  isActive: boolean
}

// Installment (Parcela)
export type InstallmentStatus = "pending" | "paid" | "overdue" | "cancelled"

export interface Installment {
  id: string
  contractId: string
  number: number // Número da parcela
  value: number
  dueDate: Date
  paidDate?: Date
  paidValue?: number
  status: InstallmentStatus
  paymentMethod?: string
  notes?: string
  createdAt: Date
}

// Contract (Contrato)
export type ContractStatus = "draft" | "pending_signature" | "active" | "expired" | "cancelled"

export interface Contract {
  id: string
  clientId: string
  contractNumber: string
  totalValue: number
  duration: number // Em meses
  startDate: Date
  endDate: Date
  paymentDay: number // Dia do vencimento (ex: 7)
  installmentsCount: number
  recurrence: RecurrenceType // Recorrência das visitas (calculada pelas regras)
  recurrenceRules: RecurrenceRule[] // Regras de recorrência por nº de unidades (1 por contrato)
  services: ContractService[]
  installments: Installment[]
  status: ContractStatus
  signatureUrl?: string // Link do ClickSign
  signedAt?: Date
  documentUrl?: string // PDF do contrato
  notes?: string
  createdAt: Date
  updatedAt: Date
}

// Scheduled Service (Agendamento de Serviço)
export type ScheduleStatus = "scheduled" | "in_progress" | "completed" | "cancelled" | "rescheduled"

export interface ScheduledService {
  id: string
  contractId?: string // Pode ser nulo para serviços avulsos
  contractServiceId?: string
  clientId: string
  unitId: string
  serviceTypeId: string
  teamIds: string[]
  additionalEmployeeIds?: string[]
  scheduledDate: Date
  scheduledTime?: string // Horário
  estimatedDuration?: number // Em minutos
  status: ScheduleStatus
  isEmergency: boolean
  isManual: boolean // Se foi criado manualmente
  completedAt?: Date
  notes?: string
  serviceReport?: string // Relatório do serviço
  createdAt: Date
  updatedAt: Date
}

// Service History (Histórico de Atendimentos)
export interface ServiceHistory {
  id: string
  scheduledServiceId: string
  clientId: string
  unitId: string
  serviceTypeId: string
  teamId: string
  employeeIds: string[]
  executedAt: Date
  duration: number // Em minutos
  report: string
  photos?: string[]
  signature?: string
  rating?: number
  feedback?: string
  createdAt: Date
}

// Notification Type
export type NotificationType = 
  | "new_schedule" 
  | "schedule_change" 
  | "schedule_cancel" 
  | "emergency" 
  | "daily_services"
  | "payment_due"
  | "payment_overdue"
  | "contract_expiring"

export type NotificationChannel = "system" | "whatsapp" | "email"

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  channels: NotificationChannel[]
  recipientTeamIds?: string[]
  recipientEmployeeIds?: string[]
  relatedScheduleId?: string
  relatedContractId?: string
  relatedClientId?: string
  isRead: boolean
  sentAt: Date
  readAt?: Date
  createdAt: Date
}

// Notification Rule (Regra de Notificação)
export interface NotificationRule {
  id: string
  name: string
  type: NotificationType
  daysBefore?: number // Dias antes para enviar (ex: 1 dia antes do agendamento)
  time?: string // Horário de envio
  channels: NotificationChannel[]
  targetTeamIds: string[] // Equipes que receberão
  isActive: boolean
  createdAt: Date
}

// Dashboard Stats
export interface DashboardStats {
  activeClients: number
  activeClientsChange: number
  monthlyRevenue: number
  monthlyRevenueChange: number
  scheduledServices: number
  scheduledServicesChange: number
  completedServices: number
  completedServicesChange: number
  overdueInstallments: number
  overdueInstallmentsValue: number
  teamProductivity: {
    teamId: string
    teamName: string
    completedServices: number
    scheduledServices: number
  }[]
}

// Permission Profile Types for Settings
export type PermissionKey =
  | "clients_view" | "clients_create" | "clients_edit" | "clients_delete"
  | "contracts_view" | "contracts_create" | "contracts_edit" | "contracts_delete"
  | "employees_view" | "employees_create" | "employees_edit" | "employees_delete"
  | "teams_view" | "teams_manage"
  | "services_view" | "services_manage"
  | "agenda_view" | "agenda_manage"
  | "financial_view" | "financial_manage"
  | "reports_view" | "reports_export"
  | "settings_view" | "settings_manage"
  | "templates_view" | "templates_manage"
  | "logs_view" | "logs_manage"

export interface PermissionProfile {
  id: string
  name: string
  description?: string
  permissions: PermissionKey[]
  createdAt: string
}

export interface User {
  id: string
  name: string
  email: string
  permissionProfileId: string
  isActive: boolean
  createdAt: string
}

// Add "none" to RecurrenceType for scheduled services
export type ScheduledServiceRecurrence = RecurrenceType | "none" | "daily"

// Chart Data Types
export interface MonthlyRevenueData {
  month: string
  value: number
}

export interface ServicesByPeriodData {
  period: string
  completed: number
  scheduled: number
}

export interface ServicesByTeamData {
  team: string
  services: number
  color: string
}

export interface ClientGrowthData {
  month: string
  clients: number
}
