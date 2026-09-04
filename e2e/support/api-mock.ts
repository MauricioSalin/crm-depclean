import type { Page, Route } from "@playwright/test"

import { E2E_USER } from "./session"

const API_PREFIX = "/api/v1"
const NOW = "2026-07-28T12:00:00.000Z"
const TODAY = "2026-07-28"
const TOMORROW = "2026-07-29"

export const clientFixture = {
  id: "client-e2e",
  financialCode: "115",
  companyName: "Condomínio E2E",
  cnpj: "00.000.000/0001-00",
  responsibleName: "Responsável E2E",
  responsibleCpf: "000.000.000-00",
  hasFepamCpf: true,
  hasFepamPassword: true,
  email: "cliente@depclean.test",
  phone: "(51) 99999-9999",
  clientTypeId: "client-type-e2e",
  assessor: {
    name: "Assessor E2E",
    cpf: "000.000.000-00",
    email: "assessor@depclean.test",
    phone: "(51) 98888-8888",
    receivesNotifications: true,
  },
  syndic: {
    name: "Síndico E2E",
    cpf: "000.000.000-00",
    email: "sindico@depclean.test",
    phone: "(51) 97777-7777",
    receivesNotifications: true,
  },
  responsibleReceivesNotifications: true,
  copyNotificationsToOwner: false,
  preferredServiceWeekday: 2,
  preferredServiceShift: "morning",
  isDelinquent: false,
  units: [{
    id: "unit-e2e",
    clientId: "client-e2e",
    name: "Unidade principal",
    isPrimary: true,
    unitCount: 24,
    address: {
      street: "Rua dos Testes",
      number: "100",
      complement: "",
      neighborhood: "Centro",
      city: "Canoas",
      state: "RS",
      zipCode: "92000-000",
    },
    createdAt: NOW,
  }],
  createdAt: NOW,
  updatedAt: NOW,
}

export const serviceFixture = {
  id: "service-e2e",
  name: "Controle de pragas E2E",
  description: "Serviço usado nos testes automatizados.",
  serviceKind: "standard",
  componentServiceIds: [],
  baseValue: 350,
  defaultDuration: 120,
  durationType: "minutes",
  defaultRecurrence: "monthly",
  dailyScheduleLimit: null,
  dailyScheduleLimitHours: null,
  defaultInformativeTemplateId: "",
  defaultCertificateTemplateId: "",
  autoSendInformative: false,
  generateCertificateRequest: false,
  recurrenceRules: [],
  teamIds: ["team-e2e"],
  employeeIds: [],
  clauses: ["Executar o serviço conforme as normas aplicáveis."],
  isActive: true,
  createdAt: NOW,
  updatedAt: NOW,
}

export const employeeFixture = {
  id: "employee-e2e",
  name: "Funcionário E2E",
  cpf: "000.000.000-00",
  email: "funcionario@depclean.test",
  phone: "(51) 96666-6666",
  role: "Técnico",
  status: "active",
  teamIds: ["team-e2e"],
  permissionProfileId: "profile-e2e-admin",
  userId: "user-e2e-admin",
  isSystemUser: true,
  createdAt: NOW,
  updatedAt: NOW,
}

export const teamFixture = {
  id: "team-e2e",
  name: "Equipe E2E",
  description: "Equipe dos testes automatizados.",
  color: "#84c700",
  memberIds: ["employee-e2e"],
  members: [{ id: "employee-e2e", name: "Funcionário E2E" }],
  isActive: true,
  createdAt: NOW,
  updatedAt: NOW,
}

export const scheduleFixture = {
  id: "schedule-e2e",
  contractId: "contract-e2e",
  contractServiceId: "contract-service-e2e",
  contractServiceIds: ["contract-service-e2e"],
  isManual: false,
  isClientDelinquent: false,
  clientId: clientFixture.id,
  clientName: clientFixture.companyName,
  unitId: "unit-e2e",
  unitName: "Unidade principal",
  address: "Rua dos Testes, 100 - Centro, Canoas/RS",
  serviceTypeId: serviceFixture.id,
  serviceTypeIds: [serviceFixture.id],
  serviceTypeName: serviceFixture.name,
  serviceDocumentSettings: [],
  informativeTemplateId: "",
  certificateTemplateId: "",
  autoSendInformative: false,
  generateCertificateRequest: false,
  teamId: teamFixture.id,
  teamName: teamFixture.name,
  teams: [{ id: teamFixture.id, name: teamFixture.name, color: teamFixture.color }],
  additionalEmployees: [{ id: employeeFixture.id, name: employeeFixture.name }],
  date: TODAY,
  time: "08:00",
  duration: 120,
  durationValue: 120,
  durationType: "minutes",
  status: "scheduled",
  recurrence: { type: "none", daysOfWeek: [], interval: 1 },
  billable: true,
  value: 350,
  billingDueDate: TODAY,
  billingStatus: "pending",
  effectiveBillingStatus: "pending",
  notes: "Agendamento de teste.",
  isEmergency: false,
  naAttachments: [],
  canStartAttendance: true,
  canAttachNa: true,
  createdAt: NOW,
  updatedAt: NOW,
}

export const clientServiceFixture = {
  id: scheduleFixture.id,
  contractId: scheduleFixture.contractId,
  isManual: scheduleFixture.isManual,
  isEmergency: scheduleFixture.isEmergency,
  serviceTypeName: scheduleFixture.serviceTypeName,
  teams: scheduleFixture.teams,
  additionalEmployees: scheduleFixture.additionalEmployees,
  date: scheduleFixture.date,
  duration: scheduleFixture.duration,
  durationValue: scheduleFixture.durationValue,
  durationType: scheduleFixture.durationType,
  status: scheduleFixture.status,
}

export const contractFixture = {
  id: "contract-e2e",
  contractNumber: "E2E-0001",
  financialCode: clientFixture.financialCode,
  clientId: clientFixture.id,
  clientCompanyName: clientFixture.companyName,
  templateId: "",
  templateName: "",
  internalStatus: "ready",
  formDraft: {},
  automationCreateSchedules: false,
  automationCreateInformatives: false,
  automationCreateCertificates: false,
  automationSchedulePlanCount: 0,
  isAwaitingSchedules: false,
  isClientDelinquent: false,
  unitIds: ["unit-e2e"],
  totalValue: 4_200,
  downPaymentValue: 0,
  downPayments: [],
  duration: 12,
  creationDate: TODAY,
  startDate: TODAY,
  endDate: "2027-07-28",
  firstVisitDate: TODAY,
  firstVisitTime: "08:00",
  paymentDay: 10,
  installmentsCount: 12,
  recurrence: "monthly",
  recurrenceRules: [],
  recurrenceServiceTypeId: serviceFixture.id,
  services: [{
    id: "contract-service-e2e",
    serviceTypeId: serviceFixture.id,
    value: 350,
    teamIds: [teamFixture.id],
    additionalEmployeeIds: [employeeFixture.id],
    unitIds: ["unit-e2e"],
    clauses: serviceFixture.clauses,
    informativeTemplateId: "",
    certificateTemplateId: "",
    autoSendInformative: false,
    generateCertificateRequest: false,
    recurrence: "monthly",
    duration: 120,
    durationType: "minutes",
    isActive: true,
    isRecurrenceService: true,
  }],
  installments: [],
  status: "running",
  signatureUrl: "",
  renderedHtml: "<p>Contrato E2E</p>",
  notes: "",
  generatedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
}

const certificateFixture = {
  id: "certificate-e2e",
  scheduleId: scheduleFixture.id,
  clientId: clientFixture.id,
  clientName: clientFixture.companyName,
  serviceTypeId: serviceFixture.id,
  serviceTypeName: serviceFixture.name,
  scheduledDate: TODAY,
  status: "pending",
  documentUrl: "",
  fileName: "",
  createdAt: NOW,
  updatedAt: NOW,
}

const emptyStats = {
  totalClients: 94,
  currentContracts: 90,
  expiredContracts: 3,
  contractStatusCounts: {
    awaitingSend: 1,
    awaitingSignature: 2,
    signed: 1,
    current: 90,
    expired: 3,
    renewed: 1,
    canceled: 1,
  },
  currentContractsGlobalValue: 4_200,
  globalValue: 4_200,
  globalValueMode: "contractual",
  generalGlobalValue: 4_200,
  contractualGlobalValue: 4_200,
  monthlyRevenue: 350,
  monthlyRevenueChange: 0,
  monthlyRevenueMonthLabel: "Julho de 2026",
  scheduledServices: 1,
  scheduledServicesChange: 0,
  completedServices: 0,
  completedServicesChange: 0,
  cancelledServices: 0,
  emergencyServices: 0,
  completionRate: 0,
  overdueInstallments: 0,
  overdueInstallmentsValue: 0,
  teamProductivity: [],
  employeeProductivity: [],
}

const financialSummary = {
  totalPaid: 0,
  totalReceivable: 350,
  totalPending: 350,
  totalLate: 0,
  totalOverdue: 0,
  paidCount: 0,
  pendingCount: 1,
  lateCount: 0,
  overdueCount: 0,
  totalCount: 1,
  adherenceRate: 0,
}

export const clientTypeFixture = {
  id: "client-type-e2e",
  name: "Condomínio",
  description: "Tipo de cliente para testes.",
  color: "#84c700",
  contractSignerRole: "syndic",
  createdAt: NOW,
  updatedAt: NOW,
}

const profileFixture = {
  id: "profile-e2e-admin",
  name: "Administrador",
  description: "Acesso integral.",
  permissions: E2E_USER.permissions,
  createdAt: NOW,
  updatedAt: NOW,
}

const organizationFixture = {
  id: "organization-e2e",
  legalName: "Depclean E2E",
  cnpj: "00.000.000/0001-00",
  address: {
    street: "Rua dos Testes",
    number: "100",
    complement: "",
    neighborhood: "Centro",
    city: "Canoas",
    state: "RS",
    zipCode: "92000-000",
  },
  phone: "(51) 99999-9999",
  email: "contato@depclean.test",
  financialSettings: {
    installmentOverdueGraceDays: 5,
    firstInstallmentOverdueGraceDays: 12,
  },
  createdAt: NOW,
  updatedAt: NOW,
}

function success(data: unknown, message = "Operação de teste concluída.") {
  return {
    success: true,
    message,
    data,
    meta: { version: "e2e", timestamp: NOW },
  }
}

function paginated(items: unknown[]) {
  return { items, total: items.length, page: 1, limit: 10, totalPages: 1 }
}

function analyticsResponse(path: string) {
  if (path === "/analytics/dashboard") {
    return {
      stats: emptyStats,
      monthlyRevenueData: [],
      servicesByPeriodData: [],
      servicesByStatusData: [],
      servicesByTeamData: [],
      servicesSummaryData: [],
      contractExpirationsData: [
        { period: "2026-07", label: "Jul/26", contracts: 2, totalValue: 8_400 },
        { period: "2026-08", label: "Ago/26", contracts: 1, totalValue: 4_200 },
        { period: "2026-09", label: "Set/26", contracts: 0, totalValue: 0 },
        { period: "2026-10", label: "Out/26", contracts: 1, totalValue: 5_000 },
        { period: "2026-11", label: "Nov/26", contracts: 0, totalValue: 0 },
        { period: "2026-12", label: "Dez/26", contracts: 2, totalValue: 10_000 },
      ],
      recentClients: [],
      upcomingServices: [
        {
          id: "schedule-dashboard-today",
          clientId: clientFixture.id,
          clientName: clientFixture.companyName,
          serviceTypeName: "Limpeza de rede",
          status: "in_progress",
          time: "09:00",
          neighborhood: "Centro",
          date: TODAY,
        },
        {
          id: "schedule-dashboard-tomorrow",
          clientId: clientFixture.id,
          clientName: clientFixture.companyName,
          serviceTypeName: "Limpeza de caixa d'água",
          status: "rescheduled",
          time: "08:00",
          neighborhood: "Vila Vista Alegre",
          date: TOMORROW,
        },
      ],
      teamsWithActivity: [],
    }
  }
  if (path === "/analytics/financial") {
    return {
      summary: financialSummary,
      installments: [],
      monthlyRevenueData: [],
      financeHealthData: [],
    }
  }
  return {
    dashboardStats: emptyStats,
    financialSummary,
    monthlyRevenueData: [],
    servicesByPeriodData: [],
    servicesByTeamData: [],
    servicesSummaryData: [],
    servicesParticipationData: [],
    financialEntries: [],
    scheduleDetails: [],
    serviceClientSummary: [],
    clients: [clientFixture],
    contracts: [contractFixture],
    teams: [teamFixture],
    employees: [employeeFixture],
    services: [serviceFixture],
  }
}

function resolveGet(path: string, url: URL, currentUser = E2E_USER): unknown {
  if (path === "/profile/me") return { ...currentUser, profileDescription: "Perfil dos testes E2E." }
  if (path === "/support/contact") {
    return { name: "Suporte Depclean", whatsapp: "51999999999", email: "suporte@depclean.test" }
  }
  if (path.startsWith("/analytics/")) return analyticsResponse(path)
  if (path === "/clients/catalog/types") return [clientTypeFixture]
  if (path === "/clients/client-e2e/services") return [clientServiceFixture]
  if (path === "/clients/client-e2e/attachments") return []
  if (path === "/clients/client-e2e/extras") return []
  if (path === "/clients/client-e2e") return clientFixture
  if (path === "/clients") return [clientFixture]
  if (path === "/services/service-e2e") return serviceFixture
  if (path === "/services") return [serviceFixture]
  if (path === "/teams") return [teamFixture]
  if (path === "/employees/catalog/permissions") {
    return E2E_USER.permissions.map((key) => ({ key, label: key, description: "" }))
  }
  if (path === "/employees") {
    return url.searchParams.has("page") ? paginated([employeeFixture]) : [employeeFixture]
  }
  if (path === "/contracts/contract-e2e/schedule-plan") {
    return {
      items: [scheduleFixture],
      generatedItems: [scheduleFixture],
      anchorDate: TODAY,
      endDate: "2027-07-28",
      isSaved: true,
      savedAt: NOW,
      isPublished: false,
    }
  }
  if (path === "/contracts/contract-e2e") return contractFixture
  if (path === "/contracts") return [contractFixture]
  if (path === "/schedules/schedule-e2e/reschedule-options") {
    return [{ date: TODAY, time: "10:00" }]
  }
  if (path === "/schedules/schedule-e2e") return scheduleFixture
  if (path === "/schedules") return [scheduleFixture]
  if (path === "/certificates/schedule-e2e/context") {
    return {
      schedule: scheduleFixture,
      client: clientFixture,
      service: {
        ...serviceFixture,
        defaultCertificateTemplateId: "",
      },
      variables: {
        client: clientFixture,
        schedule: scheduleFixture,
        service: serviceFixture,
        certificate: {},
      },
    }
  }
  if (path === "/certificates") return [certificateFixture]
  if (path === "/templates") return []
  if (path === "/notifications/push/public-key") return { enabled: false, publicKey: "" }
  if (path === "/notifications") return []
  if (path === "/depai/conversations") return { conversations: [] }
  if (path === "/logs") return paginated([])
  if (path === "/settings") {
    return {
      clientTypes: [clientTypeFixture],
      permissionProfiles: [profileFixture],
      users: [{ ...E2E_USER, permissionProfileName: "Administrador" }],
      notificationRules: [],
      permissions: E2E_USER.permissions.map((key) => ({ key, label: key, description: "" })),
      notificationTypes: [],
      notificationChannels: [],
    }
  }
  if (path === "/settings/client-types") return paginated([clientTypeFixture])
  if (path === "/settings/permission-profiles") return paginated([profileFixture])
  if (path === "/settings/users") return paginated([{ ...E2E_USER, permissionProfileName: "Administrador" }])
  if (path === "/settings/notification-rules") return paginated([])
  if (path === "/settings/organization") return organizationFixture
  return []
}

function resolveMutation(path: string) {
  if (path === "/auth/login/identify") {
    return success({ authMode: "password", codeDeliveryChannel: null })
  }
  if (path === "/auth/login" || path === "/auth/login-code/confirm") {
    return success({
      accessToken: "e2e-access-token",
      refreshToken: "e2e-refresh-token",
      user: E2E_USER,
    })
  }
  if (path === "/auth/login-code/request") return success({ deliveryChannel: "email" })
  if (path.startsWith("/auth/password-reset/")) return success(null)
  if (path === "/depai/chat") {
    return success({
      message: {
        id: "message-e2e",
        role: "assistant",
        content: "Resposta automatizada da DepAI.",
        createdAt: NOW,
        artifacts: [],
      },
      conversation: {
        id: "conversation-e2e",
        title: "Teste E2E",
        updatedAt: NOW,
        messages: [],
      },
      model: "gpt-5.4",
      contextUpdatedAt: NOW,
    })
  }
  if (path.startsWith("/clients")) return success(clientFixture)
  if (path.startsWith("/services")) return success(serviceFixture)
  if (path.startsWith("/teams")) return success(teamFixture)
  if (path.startsWith("/employees")) return success(employeeFixture)
  if (path.startsWith("/contracts")) return success(contractFixture)
  if (path.startsWith("/schedules")) return success(scheduleFixture)
  if (path.startsWith("/settings/organization")) return success(organizationFixture)
  if (path.startsWith("/notifications")) return success(null)
  if (path.startsWith("/support")) return success({ sent: true, attachments: 0 })
  return success(null)
}

async function handleApiRoute(route: Route, currentUser = E2E_USER) {
  const request = route.request()
  const url = new URL(request.url())
  const path = url.pathname.startsWith(API_PREFIX)
    ? url.pathname.slice(API_PREFIX.length) || "/"
    : url.pathname

  if (request.method() === "GET") {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(success(resolveGet(path, url, currentUser))),
    })
    return
  }

  await route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(resolveMutation(path)),
  })
}

export async function installApiMock(page: Page, currentUser: typeof E2E_USER = E2E_USER) {
  const handleRoute = (route: Route) => handleApiRoute(route, currentUser)
  await page.route("http://localhost:3333/api/v1/**", handleRoute)
  await page.route("http://127.0.0.1:3333/api/v1/**", handleRoute)
  await page.route("**/api/v1/**", handleRoute)
  await page.route("https://viacep.com.br/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        logradouro: "Rua dos Testes",
        bairro: "Centro",
        localidade: "Canoas",
        uf: "RS",
      }),
    })
  })
}
