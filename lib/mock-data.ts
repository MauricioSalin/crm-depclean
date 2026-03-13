// ==========================================
// DEPCLEAN - Mock Data
// Dados estruturados para backend futuro
// ==========================================

import type {
  ClientType,
  Permission,
  Employee,
  Team,
  ServiceType,
  RecurrenceType,
  Client,
  ClientUnit,
  Contract,
  ContractService,
  Installment,
  ScheduledService,
  Notification,
  NotificationRule,
  DashboardStats,
  MonthlyRevenueData,
  ServicesByPeriodData,
  ServicesByTeamData,
  ClientGrowthData,
} from "./types"

// ==========================================
// CLIENT TYPES (Tipos de Cliente)
// ==========================================
export const clientTypes: ClientType[] = [
  { id: "ct1", name: "Condomínio", color: "bg-blue-500", createdAt: new Date("2024-01-01") },
  { id: "ct2", name: "Casa", color: "bg-green-500", createdAt: new Date("2024-01-01") },
  { id: "ct3", name: "Apartamento", color: "bg-purple-500", createdAt: new Date("2024-01-01") },
  { id: "ct4", name: "Prédio Comercial", color: "bg-amber-500", createdAt: new Date("2024-01-01") },
  { id: "ct5", name: "Indústria", color: "bg-red-500", createdAt: new Date("2024-01-01") },
  { id: "ct6", name: "Hospital", color: "bg-cyan-500", createdAt: new Date("2024-01-01") },
]

// ==========================================
// PERMISSIONS (Permissões)
// ==========================================
export const permissions: Permission[] = [
  {
    id: "perm1",
    name: "Administrador",
    canView: { dashboard: true, clients: true, contracts: true, services: true, teams: true, employees: true, calendar: true, financial: true, reports: true, settings: true },
    canEdit: { clients: true, contracts: true, services: true, teams: true, employees: true, calendar: true, financial: true, settings: true },
    canDelete: { clients: true, contracts: true, services: true, teams: true, employees: true, calendar: true },
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "perm2",
    name: "Gerente",
    canView: { dashboard: true, clients: true, contracts: true, services: true, teams: true, employees: true, calendar: true, financial: true, reports: true, settings: false },
    canEdit: { clients: true, contracts: true, services: true, teams: false, employees: false, calendar: true, financial: false, settings: false },
    canDelete: { clients: false, contracts: false, services: false, teams: false, employees: false, calendar: true },
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "perm3",
    name: "Financeiro",
    canView: { dashboard: true, clients: true, contracts: true, services: false, teams: false, employees: false, calendar: false, financial: true, reports: true, settings: false },
    canEdit: { clients: false, contracts: false, services: false, teams: false, employees: false, calendar: false, financial: true, settings: false },
    canDelete: { clients: false, contracts: false, services: false, teams: false, employees: false, calendar: false },
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "perm4",
    name: "Equipe Operacional",
    canView: { dashboard: true, clients: true, contracts: false, services: true, teams: false, employees: false, calendar: true, financial: false, reports: false, settings: false },
    canEdit: { clients: false, contracts: false, services: false, teams: false, employees: false, calendar: false, financial: false, settings: false },
    canDelete: { clients: false, contracts: false, services: false, teams: false, employees: false, calendar: false },
    createdAt: new Date("2024-01-01"),
  },
]

// ==========================================
// TEAMS (Equipes)
// ==========================================
export const teams: Team[] = [
  { id: "team1", name: "Equipe Desentupimento", description: "Especializada em desentupimento e hidrojateamento", permissionId: "perm4", employees: ["emp1", "emp2", "emp3"], color: "bg-blue-500", isActive: true, createdAt: new Date("2024-01-01") },
  { id: "team2", name: "Equipe Limpeza", description: "Limpeza de reservatórios e caixas d'água", permissionId: "perm4", employees: ["emp4", "emp5"], color: "bg-cyan-500", isActive: true, createdAt: new Date("2024-01-01") },
  { id: "team3", name: "Equipe Dedetização", description: "Dedetização e desratização", permissionId: "perm4", employees: ["emp6", "emp7", "emp8"], color: "bg-green-500", isActive: true, createdAt: new Date("2024-01-01") },
  { id: "team4", name: "Equipe Administrativa", description: "Gestão administrativa e comercial", permissionId: "perm2", employees: ["emp9", "emp10"], color: "bg-purple-500", isActive: true, createdAt: new Date("2024-01-01") },
]

// ==========================================
// EMPLOYEES (Funcionários)
// ==========================================
export const employees: Employee[] = [
  { id: "emp1", name: "Carlos Silva", phone: "(51) 99999-1111", email: "carlos@depclean.com", function: "Técnico Sênior", teamId: "team1", avatar: "/avatars/avatar-1.jpg", isActive: true, createdAt: new Date("2024-01-01") },
  { id: "emp2", name: "João Santos", phone: "(51) 99999-2222", email: "joao@depclean.com", function: "Técnico", teamId: "team1", avatar: "/avatars/avatar-2.jpg", isActive: true, createdAt: new Date("2024-01-01") },
  { id: "emp3", name: "Pedro Costa", phone: "(51) 99999-3333", email: "pedro@depclean.com", function: "Auxiliar", teamId: "team1", avatar: "/avatars/avatar-3.jpg", isActive: true, createdAt: new Date("2024-01-01") },
  { id: "emp4", name: "Ana Oliveira", phone: "(51) 99999-4444", email: "ana@depclean.com", function: "Técnica Sênior", teamId: "team2", avatar: "/avatars/avatar-4.jpg", isActive: true, createdAt: new Date("2024-01-01") },
  { id: "emp5", name: "Maria Souza", phone: "(51) 99999-5555", email: "maria@depclean.com", function: "Técnica", teamId: "team2", isActive: true, createdAt: new Date("2024-01-01") },
  { id: "emp6", name: "Lucas Ferreira", phone: "(51) 99999-6666", email: "lucas@depclean.com", function: "Técnico Sênior", teamId: "team3", isActive: true, createdAt: new Date("2024-01-01") },
  { id: "emp7", name: "Bruno Lima", phone: "(51) 99999-7777", email: "bruno@depclean.com", function: "Técnico", teamId: "team3", isActive: true, createdAt: new Date("2024-01-01") },
  { id: "emp8", name: "Rafael Alves", phone: "(51) 99999-8888", email: "rafael@depclean.com", function: "Auxiliar", teamId: "team3", isActive: true, createdAt: new Date("2024-01-01") },
  { id: "emp9", name: "Paula Santos", phone: "(51) 98989-4625", email: "paula@depclean.com", function: "Gestora de Contratos", teamId: "team4", isActive: true, createdAt: new Date("2024-01-01") },
  { id: "emp10", name: "Melina Costa", phone: "(51) 99999-0000", email: "melina@depclean.com", function: "Administradora", teamId: "team4", isActive: true, createdAt: new Date("2024-01-01") },
]

// ==========================================
// SERVICE TYPES (Tipos de Serviço)
// ==========================================
export const serviceTypes: ServiceType[] = [
  {
    id: "srv1",
    name: "Desentupimento e Hidrojateamento",
    baseValue: 15000,
    clauses: [
      "Execução de sucção de resíduos provenientes de caixas de gordura, fossa e rede de esgoto",
      "Hidrojateamento geral da rede de esgoto cloacal",
      "Retirada de 02 (duas) cargas anuais, cada uma com capacidade de até 14 m³",
      "Cobertura de trabalho para demanda de entupimento 24 horas",
      "Descarte de resíduos conforme legislação ambiental vigente",
    ],
    defaultRecurrence: "semiannual",
    recurrenceRules: [
      { type: "range", minUnits: 1, maxUnits: 100, recurrence: "semiannual" },
      { type: "range", minUnits: 101, maxUnits: 200, recurrence: "quarterly" },
      { type: "above", minUnits: 200, maxUnits: Infinity, recurrence: "monthly" },
    ],
    defaultTeamIds: ["team1"],
    description: "Serviço completo de desentupimento com sucção e hidrojateamento",
    isActive: true,
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "srv2",
    name: "Limpeza de Reservatórios",
    baseValue: 8000,
    clauses: [
      "Limpeza dos reservatórios de água 02 (duas) vezes por ano",
      "Aviso prévio de 48 horas aos condôminos",
      "Fornecimento de circular para fixação",
      "Não inclui reparo de danos pré-existentes em registros, boias, tampas",
    ],
    defaultRecurrence: "semiannual",
    recurrenceRules: [
      { type: "range", minUnits: 1, maxUnits: 100, recurrence: "semiannual" },
      { type: "range", minUnits: 101, maxUnits: 200, recurrence: "quarterly" },
      { type: "above", minUnits: 200, maxUnits: Infinity, recurrence: "monthly" },
    ],
    defaultTeamIds: ["team2"],
    description: "Limpeza completa de caixas d'água e reservatórios",
    isActive: true,
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "srv3",
    name: "Dedetização",
    baseValue: 6000,
    clauses: [
      "Dedetização geral nas áreas internas e externas",
      "Inclui blocos, corredores, escadarias, hall de entrada, salão de festas, portaria, estacionamentos",
      "Contempla insetos de pequeno porte (exceto cupim, mosca, mosquitos e marimbondos)",
      "Realizada a cada 03 (três) meses",
    ],
    defaultRecurrence: "quarterly",
    recurrenceRules: [
      { type: "range", minUnits: 1, maxUnits: 100, recurrence: "semiannual" },
      { type: "range", minUnits: 101, maxUnits: 200, recurrence: "quarterly" },
      { type: "above", minUnits: 200, maxUnits: Infinity, recurrence: "monthly" },
    ],
    defaultTeamIds: ["team3"],
    description: "Dedetização profissional para controle de pragas",
    isActive: true,
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "srv4",
    name: "Desratização",
    baseValue: 4000,
    clauses: [
      "Distribuição de porta iscas com iscas extrusadas",
      "Vistoria, higienização e reabastecimento semestral",
      "Controle e monitoramento de roedores",
    ],
    defaultRecurrence: "semiannual",
    recurrenceRules: [
      { type: "range", minUnits: 1, maxUnits: 100, recurrence: "semiannual" },
      { type: "range", minUnits: 101, maxUnits: 200, recurrence: "quarterly" },
      { type: "above", minUnits: 200, maxUnits: Infinity, recurrence: "monthly" },
    ],
    defaultTeamIds: ["team3"],
    description: "Controle e prevenção de roedores",
    isActive: true,
    createdAt: new Date("2024-01-01"),
  },
]

// ==========================================
// CLIENTS (Clientes)
// ==========================================
const clientUnits1: ClientUnit[] = [
  {
    id: "unit1-1",
    clientId: "client1",
    name: "Matriz",
    isPrimary: true,
    unitCount: 80,
    address: { street: "Rua Atilio Supertti", number: "1430", neighborhood: "Vila Nova", city: "Porto Alegre", state: "RS", zipCode: "91750-200" },
    createdAt: new Date("2024-01-15"),
  },
]

const clientUnits2: ClientUnit[] = [
  {
    id: "unit2-1",
    clientId: "client2",
    name: "Matriz",
    isPrimary: true,
    unitCount: 150,
    address: { street: "Av. Independência", number: "500", neighborhood: "Centro", city: "Porto Alegre", state: "RS", zipCode: "90035-000" },
    createdAt: new Date("2024-02-01"),
  },
  {
    id: "unit2-2",
    clientId: "client2",
    name: "Filial 1",
    isPrimary: false,
    unitCount: 120,
    address: { street: "Av. Independência", number: "520", neighborhood: "Centro", city: "Porto Alegre", state: "RS", zipCode: "90035-000" },
    createdAt: new Date("2024-02-01"),
  },
]

const clientUnits3: ClientUnit[] = [
  {
    id: "unit3-1",
    clientId: "client3",
    name: "Matriz",
    isPrimary: true,
    unitCount: 45,
    address: { street: "Rua Voluntários da Pátria", number: "800", neighborhood: "Centro", city: "Canoas", state: "RS", zipCode: "92010-000" },
    createdAt: new Date("2024-03-10"),
  },
]

const clientUnits4: ClientUnit[] = [
  {
    id: "unit4-1",
    clientId: "client4",
    name: "Matriz",
    isPrimary: true,
    unitCount: 60,
    address: { street: "Rua das Flores", number: "123", neighborhood: "Jardim", city: "Porto Alegre", state: "RS", zipCode: "91000-000" },
    createdAt: new Date("2024-04-01"),
  },
  {
    id: "unit4-2",
    clientId: "client4",
    name: "Filial 1",
    isPrimary: false,
    unitCount: 90,
    address: { street: "Rua das Rosas", number: "456", neighborhood: "Jardim", city: "Porto Alegre", state: "RS", zipCode: "91000-100" },
    createdAt: new Date("2024-04-01"),
  },
]

const clientUnits5: ClientUnit[] = [
  {
    id: "unit5-1",
    clientId: "client5",
    name: "Matriz",
    isPrimary: true,
    unitCount: 250,
    address: { street: "Av. Ipiranga", number: "6681", neighborhood: "Partenon", city: "Porto Alegre", state: "RS", zipCode: "90619-900" },
    createdAt: new Date("2024-05-01"),
  },
  {
    id: "unit5-2",
    clientId: "client5",
    name: "Filial 1",
    isPrimary: false,
    unitCount: 180,
    address: { street: "Av. Ipiranga", number: "6700", complement: "Bloco B", neighborhood: "Partenon", city: "Porto Alegre", state: "RS", zipCode: "90619-901" },
    createdAt: new Date("2024-05-01"),
  },
]

export const clients: Client[] = [
  {
    id: "client1",
    companyName: "Condomínio Eduardo Prado",
    cnpj: "09.579.109/0001-08",
    responsibleName: "Cristiano Luiz Rodrigues Seabra",
    phone: "(51) 99999-1234",
    email: "condominioeduardoprado2024@gmail.com",
    clientTypeId: "ct1",
    units: clientUnits1,
    isActive: true,
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-15"),
  },
  {
    id: "client2",
    companyName: "Condomínio Residencial Solar",
    cnpj: "12.345.678/0001-90",
    responsibleName: "Maria Aparecida Silva",
    phone: "(51) 99888-5555",
    email: "sindico@residencialsolar.com.br",
    clientTypeId: "ct1",
    units: clientUnits2,
    isActive: true,
    createdAt: new Date("2024-02-01"),
    updatedAt: new Date("2024-02-01"),
  },
  {
    id: "client3",
    companyName: "Edifício Comercial Centro",
    cnpj: "23.456.789/0001-12",
    responsibleName: "Roberto Fernandes",
    phone: "(51) 99777-4444",
    email: "admin@edificiocentro.com.br",
    clientTypeId: "ct4",
    units: clientUnits3,
    isActive: true,
    createdAt: new Date("2024-03-10"),
    updatedAt: new Date("2024-03-10"),
  },
  {
    id: "client4",
    companyName: "Residencial Parque Verde",
    cnpj: "34.567.890/0001-23",
    responsibleName: "Fernanda Costa",
    phone: "(51) 99666-3333",
    email: "sindico@parqueverde.com.br",
    clientTypeId: "ct1",
    units: clientUnits4,
    isActive: true,
    createdAt: new Date("2024-04-01"),
    updatedAt: new Date("2024-04-01"),
  },
  {
    id: "client5",
    companyName: "Hospital São Lucas",
    cnpj: "45.678.901/0001-34",
    responsibleName: "Dr. Paulo Mendes",
    phone: "(51) 99555-2222",
    email: "manutencao@saolucas.com.br",
    clientTypeId: "ct6",
    units: clientUnits5,
    isActive: true,
    createdAt: new Date("2024-05-01"),
    updatedAt: new Date("2024-05-01"),
  },
]

// ==========================================
// CONTRACTS (Contratos)
// ==========================================
// Client1: 80 unidades (Matriz) → regra ≤100 = semestral
const contractServices1: ContractService[] = [
  { id: "cs1-1", contractId: "contract1", serviceTypeId: "srv1", value: 15000, teamIds: ["team1"], unitIds: ["unit1-1"], clauses: serviceTypes[0].clauses, isActive: true },
  { id: "cs1-2", contractId: "contract1", serviceTypeId: "srv2", value: 8000, teamIds: ["team2"], unitIds: ["unit1-1"], clauses: serviceTypes[1].clauses, isActive: true },
  { id: "cs1-3", contractId: "contract1", serviceTypeId: "srv3", value: 6000, teamIds: ["team3"], unitIds: ["unit1-1"], clauses: serviceTypes[2].clauses, isActive: true },
  { id: "cs1-4", contractId: "contract1", serviceTypeId: "srv4", value: 4000, teamIds: ["team3"], unitIds: ["unit1-1"], clauses: serviceTypes[3].clauses, isActive: true },
]

const installments1: Installment[] = Array.from({ length: 12 }, (_, i) => ({
  id: `inst1-${i + 1}`,
  contractId: "contract1",
  number: i + 1,
  value: 3875.45,
  dueDate: new Date(2026, 2 + i, 7), // Starting March 7, 2026
  paidDate: i < 2 ? new Date(2026, 2 + i, 5) : undefined,
  paidValue: i < 2 ? 3875.45 : undefined,
  status: i < 2 ? "paid" : i === 2 ? "pending" : "pending",
  createdAt: new Date("2026-02-25"),
}))

export const contracts: Contract[] = [
  {
    id: "contract1",
    clientId: "client1",
    contractNumber: "DEP-2026-001",
    totalValue: 46505.40,
    duration: 12,
    startDate: new Date("2026-02-25"),
    endDate: new Date("2027-02-25"),
    paymentDay: 7,
    installmentsCount: 12,
    recurrence: "semiannual",
    recurrenceRules: [
      { type: "range", minUnits: 1, maxUnits: 100, recurrence: "semiannual" },
      { type: "range", minUnits: 101, maxUnits: 200, recurrence: "quarterly" },
      { type: "above", minUnits: 200, maxUnits: Infinity, recurrence: "monthly" },
    ],
    services: contractServices1,
    installments: installments1,
    status: "active",
    signatureUrl: "https://clicksign.com/doc/3e939d09-5bc7-4f5e-a035-756952de9fb7",
    signedAt: new Date("2026-02-25"),
    documentUrl: "/contracts/DEP-2026-001.pdf",
    createdAt: new Date("2026-02-25"),
    updatedAt: new Date("2026-02-25"),
  },
  {
    // Client2: Matriz 150 + Filial 1 120 = 270 unidades → regra >200 = mensal
    id: "contract2",
    clientId: "client2",
    contractNumber: "DEP-2026-002",
    totalValue: 38400.00,
    duration: 12,
    startDate: new Date("2026-01-15"),
    endDate: new Date("2027-01-15"),
    paymentDay: 10,
    installmentsCount: 12,
    recurrence: "monthly",
    recurrenceRules: [
      { type: "range", minUnits: 1, maxUnits: 100, recurrence: "semiannual" },
      { type: "range", minUnits: 101, maxUnits: 200, recurrence: "quarterly" },
      { type: "above", minUnits: 200, maxUnits: Infinity, recurrence: "monthly" },
    ],
    services: [
      { id: "cs2-1", contractId: "contract2", serviceTypeId: "srv1", value: 18000, teamIds: ["team1"], unitIds: ["unit2-1", "unit2-2"], clauses: serviceTypes[0].clauses, isActive: true },
      { id: "cs2-2", contractId: "contract2", serviceTypeId: "srv3", value: 8400, teamIds: ["team3"], unitIds: ["unit2-1", "unit2-2"], clauses: serviceTypes[2].clauses, isActive: true },
    ],
    installments: Array.from({ length: 12 }, (_, i) => ({
      id: `inst2-${i + 1}`,
      contractId: "contract2",
      number: i + 1,
      value: 3200,
      dueDate: new Date(2026, i, 10),
      paidDate: i < 3 ? new Date(2026, i, 8) : undefined,
      paidValue: i < 3 ? 3200 : undefined,
      status: i < 3 ? "paid" as const : "pending" as const,
      createdAt: new Date("2026-01-10"),
    })),
    status: "active",
    signedAt: new Date("2026-01-15"),
    createdAt: new Date("2026-01-10"),
    updatedAt: new Date("2026-01-15"),
  },
  {
    // Client3: 45 unidades → regra ≤100 = semestral
    id: "contract3",
    clientId: "client3",
    contractNumber: "DEP-2026-003",
    totalValue: 24000.00,
    duration: 12,
    startDate: new Date("2026-02-01"),
    endDate: new Date("2027-02-01"),
    paymentDay: 15,
    installmentsCount: 12,
    recurrence: "semiannual",
    recurrenceRules: [
      { type: "range", minUnits: 1, maxUnits: 100, recurrence: "semiannual" },
      { type: "range", minUnits: 101, maxUnits: 200, recurrence: "quarterly" },
      { type: "above", minUnits: 200, maxUnits: Infinity, recurrence: "monthly" },
    ],
    services: [
      { id: "cs3-1", contractId: "contract3", serviceTypeId: "srv2", value: 12000, teamIds: ["team2"], unitIds: ["unit3-1"], clauses: serviceTypes[1].clauses, isActive: true },
      { id: "cs3-2", contractId: "contract3", serviceTypeId: "srv3", value: 12000, teamIds: ["team3"], unitIds: ["unit3-1"], clauses: serviceTypes[2].clauses, isActive: true },
    ],
    installments: Array.from({ length: 12 }, (_, i) => ({
      id: `inst3-${i + 1}`,
      contractId: "contract3",
      number: i + 1,
      value: 2000,
      dueDate: new Date(2026, 1 + i, 15),
      paidDate: i < 2 ? new Date(2026, 1 + i, 14) : undefined,
      paidValue: i < 2 ? 2000 : undefined,
      status: i < 2 ? "paid" as const : i === 2 ? "overdue" as const : "pending" as const,
      createdAt: new Date("2026-02-01"),
    })),
    status: "active",
    createdAt: new Date("2026-02-01"),
    updatedAt: new Date("2026-02-01"),
  },
  {
    // Client4: Matriz 60 + Filial 1 90 = 150 unidades → regra 101-200 = trimestral
    id: "contract4",
    clientId: "client4",
    contractNumber: "DEP-2026-004",
    totalValue: 29000.00,
    duration: 12,
    startDate: new Date("2026-03-01"),
    endDate: new Date("2027-03-01"),
    paymentDay: 5,
    installmentsCount: 12,
    recurrence: "quarterly",
    recurrenceRules: [
      { type: "range", minUnits: 1, maxUnits: 100, recurrence: "semiannual" },
      { type: "range", minUnits: 101, maxUnits: 200, recurrence: "quarterly" },
      { type: "above", minUnits: 200, maxUnits: Infinity, recurrence: "monthly" },
    ],
    services: [
      { id: "cs4-1", contractId: "contract4", serviceTypeId: "srv1", value: 15000, teamIds: ["team1"], unitIds: ["unit4-1", "unit4-2"], clauses: serviceTypes[0].clauses, isActive: true },
      { id: "cs4-2", contractId: "contract4", serviceTypeId: "srv2", value: 8000, teamIds: ["team2"], unitIds: ["unit4-1", "unit4-2"], clauses: serviceTypes[1].clauses, isActive: true },
      { id: "cs4-3", contractId: "contract4", serviceTypeId: "srv4", value: 6000, teamIds: ["team3"], unitIds: ["unit4-1", "unit4-2"], clauses: serviceTypes[3].clauses, isActive: true },
    ],
    installments: Array.from({ length: 12 }, (_, i) => ({
      id: `inst4-${i + 1}`,
      contractId: "contract4",
      number: i + 1,
      value: 2416.67,
      dueDate: new Date(2026, 2 + i, 5),
      paidDate: i < 1 ? new Date(2026, 2 + i, 4) : undefined,
      paidValue: i < 1 ? 2416.67 : undefined,
      status: i < 1 ? "paid" as const : "pending" as const,
      createdAt: new Date("2026-03-01"),
    })),
    status: "active",
    signedAt: new Date("2026-03-01"),
    createdAt: new Date("2026-03-01"),
    updatedAt: new Date("2026-03-01"),
  },
  {
    // Client5: Matriz 250 + Filial 1 180 = 430 unidades → regra >200 = mensal
    id: "contract5",
    clientId: "client5",
    contractNumber: "DEP-2026-005",
    totalValue: 52000.00,
    duration: 12,
    startDate: new Date("2026-02-10"),
    endDate: new Date("2027-02-10"),
    paymentDay: 20,
    installmentsCount: 12,
    recurrence: "monthly",
    recurrenceRules: [
      { type: "range", minUnits: 1, maxUnits: 100, recurrence: "semiannual" },
      { type: "range", minUnits: 101, maxUnits: 200, recurrence: "quarterly" },
      { type: "above", minUnits: 200, maxUnits: Infinity, recurrence: "monthly" },
    ],
    services: [
      { id: "cs5-1", contractId: "contract5", serviceTypeId: "srv1", value: 22000, teamIds: ["team1"], unitIds: ["unit5-1", "unit5-2"], clauses: serviceTypes[0].clauses, isActive: true },
      { id: "cs5-2", contractId: "contract5", serviceTypeId: "srv2", value: 12000, teamIds: ["team2"], unitIds: ["unit5-1", "unit5-2"], clauses: serviceTypes[1].clauses, isActive: true },
      { id: "cs5-3", contractId: "contract5", serviceTypeId: "srv3", value: 10000, teamIds: ["team3"], unitIds: ["unit5-1", "unit5-2"], clauses: serviceTypes[2].clauses, isActive: true },
      { id: "cs5-4", contractId: "contract5", serviceTypeId: "srv4", value: 8000, teamIds: ["team3"], unitIds: ["unit5-1", "unit5-2"], clauses: serviceTypes[3].clauses, isActive: true },
    ],
    installments: Array.from({ length: 12 }, (_, i) => ({
      id: `inst5-${i + 1}`,
      contractId: "contract5",
      number: i + 1,
      value: 4333.33,
      dueDate: new Date(2026, 1 + i, 20),
      paidDate: i < 2 ? new Date(2026, 1 + i, 18) : undefined,
      paidValue: i < 2 ? 4333.33 : undefined,
      status: i < 2 ? "paid" as const : "pending" as const,
      createdAt: new Date("2026-02-10"),
    })),
    status: "active",
    signedAt: new Date("2026-02-10"),
    createdAt: new Date("2026-02-10"),
    updatedAt: new Date("2026-02-10"),
  },
]

// ==========================================
// SCHEDULED SERVICES (Agendamentos)
// ==========================================
export const scheduledServices: ScheduledService[] = [
  {
    id: "sched1",
    contractId: "contract1",
    contractServiceId: "cs1-1",
    clientId: "client1",
    unitId: "unit1-1",
    serviceTypeId: "srv1",
    teamIds: ["team1"],
    additionalEmployeeIds: ["emp3"],
    scheduledDate: new Date("2026-03-15"),
    scheduledTime: "08:00",
    estimatedDuration: 240,
    status: "scheduled",
    isEmergency: false,
    isManual: false,
    createdAt: new Date("2026-02-25"),
    updatedAt: new Date("2026-02-25"),
  },
  {
    id: "sched2",
    contractId: "contract1",
    contractServiceId: "cs1-3",
    clientId: "client1",
    unitId: "unit1-1",
    serviceTypeId: "srv3",
    teamIds: ["team3"],
    additionalEmployeeIds: ["emp5", "emp6"],
    scheduledDate: new Date("2026-03-10"),
    scheduledTime: "09:00",
    estimatedDuration: 180,
    status: "completed",
    isEmergency: false,
    isManual: false,
    completedAt: new Date("2026-03-10"),
    createdAt: new Date("2026-02-25"),
    updatedAt: new Date("2026-03-10"),
  },
  {
    id: "sched3",
    contractId: "contract2",
    contractServiceId: "cs2-1",
    clientId: "client2",
    unitId: "unit2-1",
    serviceTypeId: "srv1",
    teamIds: ["team1"],
    scheduledDate: new Date("2026-03-12"),
    scheduledTime: "08:00",
    estimatedDuration: 300,
    status: "scheduled",
    isEmergency: false,
    isManual: false,
    createdAt: new Date("2026-01-15"),
    updatedAt: new Date("2026-01-15"),
  },
  {
    id: "sched4",
    clientId: "client3",
    unitId: "unit3-1",
    serviceTypeId: "srv1",
    teamIds: ["team1"],
    scheduledDate: new Date("2026-03-09"),
    scheduledTime: "14:00",
    estimatedDuration: 120,
    status: "in_progress",
    isEmergency: true,
    isManual: true,
    notes: "Entupimento emergencial na cozinha",
    createdAt: new Date("2026-03-09"),
    updatedAt: new Date("2026-03-09"),
  },
  {
    id: "sched5",
    contractId: "contract1",
    contractServiceId: "cs1-2",
    clientId: "client1",
    unitId: "unit1-1",
    serviceTypeId: "srv2",
    teamIds: ["team2"],
    scheduledDate: new Date("2026-03-20"),
    scheduledTime: "08:00",
    estimatedDuration: 480,
    status: "scheduled",
    isEmergency: false,
    isManual: false,
    createdAt: new Date("2026-02-25"),
    updatedAt: new Date("2026-02-25"),
  },
  {
    id: "sched6",
    contractId: "contract2",
    contractServiceId: "cs2-1",
    clientId: "client2",
    unitId: "unit2-2",
    serviceTypeId: "srv1",
    teamIds: ["team1"],
    scheduledDate: new Date("2026-03-10"),
    scheduledTime: "08:00",
    estimatedDuration: 240,
    status: "scheduled",
    isEmergency: false,
    isManual: false,
    createdAt: new Date("2026-03-01"),
    updatedAt: new Date("2026-03-01"),
  },
  {
    id: "sched7",
    contractId: "contract1",
    contractServiceId: "cs1-2",
    clientId: "client1",
    unitId: "unit1-1",
    serviceTypeId: "srv2",
    teamIds: ["team2"],
    scheduledDate: new Date("2026-03-10"),
    scheduledTime: "13:00",
    estimatedDuration: 360,
    status: "in_progress",
    isEmergency: false,
    isManual: false,
    createdAt: new Date("2026-03-02"),
    updatedAt: new Date("2026-03-10"),
  },
  {
    id: "sched8",
    contractId: "contract2",
    contractServiceId: "cs2-2",
    clientId: "client2",
    unitId: "unit2-1",
    serviceTypeId: "srv3",
    teamIds: ["team3"],
    scheduledDate: new Date("2026-03-11"),
    scheduledTime: "09:30",
    estimatedDuration: 150,
    status: "scheduled",
    isEmergency: false,
    isManual: false,
    createdAt: new Date("2026-03-03"),
    updatedAt: new Date("2026-03-03"),
  },
  {
    id: "sched9",
    contractId: "contract3",
    contractServiceId: "cs3-1",
    clientId: "client3",
    unitId: "unit3-1",
    serviceTypeId: "srv2",
    teamIds: ["team2"],
    scheduledDate: new Date("2026-03-11"),
    scheduledTime: "14:30",
    estimatedDuration: 240,
    status: "scheduled",
    isEmergency: false,
    isManual: false,
    createdAt: new Date("2026-03-04"),
    updatedAt: new Date("2026-03-04"),
  },
  {
    id: "sched10",
    contractId: "contract3",
    contractServiceId: "cs3-2",
    clientId: "client3",
    unitId: "unit3-1",
    serviceTypeId: "srv3",
    teamIds: ["team3"],
    scheduledDate: new Date("2026-03-12"),
    scheduledTime: "11:00",
    estimatedDuration: 180,
    status: "scheduled",
    isEmergency: false,
    isManual: false,
    createdAt: new Date("2026-03-05"),
    updatedAt: new Date("2026-03-05"),
  },
  {
    id: "sched11",
    clientId: "client4",
    unitId: "unit4-1",
    serviceTypeId: "srv1",
    teamIds: ["team1"],
    scheduledDate: new Date("2026-03-12"),
    scheduledTime: "16:00",
    estimatedDuration: 120,
    status: "scheduled",
    isEmergency: true,
    isManual: true,
    notes: "Chamado emergencial: retorno de esgoto no térreo",
    createdAt: new Date("2026-03-12"),
    updatedAt: new Date("2026-03-12"),
  },
  {
    id: "sched12",
    contractId: "contract1",
    contractServiceId: "cs1-1",
    clientId: "client1",
    unitId: "unit1-1",
    serviceTypeId: "srv1",
    teamIds: ["team1"],
    scheduledDate: new Date("2026-03-13"),
    scheduledTime: "08:30",
    estimatedDuration: 210,
    status: "scheduled",
    isEmergency: false,
    isManual: false,
    createdAt: new Date("2026-03-05"),
    updatedAt: new Date("2026-03-05"),
  },
  {
    id: "sched13",
    contractId: "contract2",
    contractServiceId: "cs2-1",
    clientId: "client2",
    unitId: "unit2-1",
    serviceTypeId: "srv1",
    teamIds: ["team1"],
    scheduledDate: new Date("2026-03-13"),
    scheduledTime: "13:30",
    estimatedDuration: 180,
    status: "cancelled",
    isEmergency: false,
    isManual: false,
    notes: "Cancelado pelo cliente (reagendar)",
    createdAt: new Date("2026-03-06"),
    updatedAt: new Date("2026-03-13"),
  },
  {
    id: "sched14",
    contractId: "contract1",
    contractServiceId: "cs1-4",
    clientId: "client1",
    unitId: "unit1-1",
    serviceTypeId: "srv4",
    teamIds: ["team3"],
    scheduledDate: new Date("2026-03-14"),
    scheduledTime: "10:00",
    estimatedDuration: 120,
    status: "scheduled",
    isEmergency: false,
    isManual: false,
    createdAt: new Date("2026-03-06"),
    updatedAt: new Date("2026-03-06"),
  },
  {
    id: "sched15",
    contractId: "contract3",
    contractServiceId: "cs3-1",
    clientId: "client3",
    unitId: "unit3-1",
    serviceTypeId: "srv2",
    teamIds: ["team2"],
    scheduledDate: new Date("2026-03-15"),
    scheduledTime: "13:00",
    estimatedDuration: 300,
    status: "scheduled",
    isEmergency: false,
    isManual: false,
    createdAt: new Date("2026-03-07"),
    updatedAt: new Date("2026-03-07"),
  },
  {
    id: "sched16",
    contractId: "contract2",
    contractServiceId: "cs2-2",
    clientId: "client2",
    unitId: "unit2-2",
    serviceTypeId: "srv3",
    teamIds: ["team3"],
    scheduledDate: new Date("2026-03-16"),
    scheduledTime: "09:00",
    estimatedDuration: 180,
    status: "scheduled",
    isEmergency: false,
    isManual: false,
    createdAt: new Date("2026-03-08"),
    updatedAt: new Date("2026-03-08"),
  },
  {
    id: "sched17",
    clientId: "client5",
    unitId: "unit5-1",
    serviceTypeId: "srv2",
    teamIds: ["team2"],
    scheduledDate: new Date("2026-03-18"),
    scheduledTime: "07:30",
    estimatedDuration: 360,
    status: "scheduled",
    isEmergency: false,
    isManual: true,
    notes: "Serviço avulso - hospital (entrada de serviço pela portaria 2)",
    createdAt: new Date("2026-03-10"),
    updatedAt: new Date("2026-03-10"),
  },
  {
    id: "sched18",
    contractId: "contract1",
    contractServiceId: "cs1-3",
    clientId: "client1",
    unitId: "unit1-1",
    serviceTypeId: "srv3",
    teamIds: ["team3"],
    scheduledDate: new Date("2026-03-19"),
    scheduledTime: "15:00",
    estimatedDuration: 150,
    status: "scheduled",
    isEmergency: false,
    isManual: false,
    createdAt: new Date("2026-03-09"),
    updatedAt: new Date("2026-03-09"),
  },
  {
    id: "sched19",
    contractId: "contract2",
    contractServiceId: "cs2-1",
    clientId: "client2",
    unitId: "unit2-1",
    serviceTypeId: "srv1",
    teamIds: ["team1"],
    scheduledDate: new Date("2026-03-21"),
    scheduledTime: "09:00",
    estimatedDuration: 240,
    status: "scheduled",
    isEmergency: false,
    isManual: false,
    createdAt: new Date("2026-03-10"),
    updatedAt: new Date("2026-03-10"),
  },
  {
    id: "sched20",
    contractId: "contract3",
    contractServiceId: "cs3-2",
    clientId: "client3",
    unitId: "unit3-1",
    serviceTypeId: "srv3",
    teamIds: ["team3"],
    scheduledDate: new Date("2026-03-24"),
    scheduledTime: "08:00",
    estimatedDuration: 180,
    status: "scheduled",
    isEmergency: false,
    isManual: false,
    createdAt: new Date("2026-03-10"),
    updatedAt: new Date("2026-03-10"),
  },
  {
    id: "sched21",
    contractId: "contract1",
    contractServiceId: "cs1-2",
    clientId: "client1",
    unitId: "unit1-1",
    serviceTypeId: "srv2",
    teamIds: ["team2"],
    scheduledDate: new Date("2026-03-26"),
    scheduledTime: "08:00",
    estimatedDuration: 420,
    status: "scheduled",
    isEmergency: false,
    isManual: false,
    createdAt: new Date("2026-03-11"),
    updatedAt: new Date("2026-03-11"),
  },
  {
    id: "sched22",
    contractId: "contract2",
    contractServiceId: "cs2-2",
    clientId: "client2",
    unitId: "unit2-1",
    serviceTypeId: "srv3",
    teamIds: ["team3"],
    scheduledDate: new Date("2026-03-28"),
    scheduledTime: "10:30",
    estimatedDuration: 180,
    status: "scheduled",
    isEmergency: false,
    isManual: false,
    createdAt: new Date("2026-03-12"),
    updatedAt: new Date("2026-03-12"),
  },
]

// ==========================================
// NOTIFICATIONS (Notificações)
// ==========================================
export const notifications: Notification[] = [
  {
    id: "notif1",
    type: "new_schedule",
    title: "Novo Agendamento",
    message: "Serviço de Desentupimento agendado para Condomínio Eduardo Prado em 15/03/2026",
    channels: ["system", "whatsapp"],
    recipientTeamIds: ["team1"],
    relatedScheduleId: "sched1",
    relatedClientId: "client1",
    isRead: false,
    sentAt: new Date("2026-02-25"),
    createdAt: new Date("2026-02-25"),
  },
  {
    id: "notif2",
    type: "emergency",
    title: "Serviço Emergencial",
    message: "Entupimento emergencial no Edifício Comercial Centro - Atendimento imediato necessário",
    channels: ["system", "whatsapp"],
    recipientTeamIds: ["team1"],
    relatedScheduleId: "sched4",
    relatedClientId: "client3",
    isRead: true,
    sentAt: new Date("2026-03-09"),
    readAt: new Date("2026-03-09"),
    createdAt: new Date("2026-03-09"),
  },
  {
    id: "notif3",
    type: "payment_overdue",
    title: "Parcela Vencida",
    message: "Parcela 3 do contrato DEP-2026-003 está vencida desde 15/03/2026",
    channels: ["system"],
    relatedContractId: "contract3",
    relatedClientId: "client3",
    isRead: false,
    sentAt: new Date("2026-03-16"),
    createdAt: new Date("2026-03-16"),
  },
  {
    id: "notif4",
    type: "daily_services",
    title: "Serviços do Dia",
    message: "Você tem 2 serviços agendados para hoje",
    channels: ["system", "whatsapp"],
    recipientTeamIds: ["team1"],
    isRead: true,
    sentAt: new Date("2026-03-09"),
    readAt: new Date("2026-03-09"),
    createdAt: new Date("2026-03-09"),
  },
]

// ==========================================
// NOTIFICATION RULES (Regras de Notificação)
// ==========================================
export const notificationRules: NotificationRule[] = [
  {
    id: "rule1",
    name: "Lembrete 1 dia antes",
    type: "new_schedule",
    daysBefore: 1,
    time: "08:00",
    channels: ["system", "whatsapp"],
    targetTeamIds: ["team1", "team2", "team3"],
    isActive: true,
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "rule2",
    name: "Serviços do dia",
    type: "daily_services",
    daysBefore: 0,
    time: "07:00",
    channels: ["system", "whatsapp"],
    targetTeamIds: ["team1", "team2", "team3"],
    isActive: true,
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "rule3",
    name: "Parcela vencendo",
    type: "payment_due",
    daysBefore: 3,
    time: "09:00",
    channels: ["system", "email"],
    targetTeamIds: ["team4"],
    isActive: true,
    createdAt: new Date("2024-01-01"),
  },
]

// ==========================================
// DASHBOARD DATA
// ==========================================
export const dashboardStats: DashboardStats = {
  activeClients: 5,
  activeClientsChange: 25,
  monthlyRevenue: 58370.90,
  monthlyRevenueChange: 12.5,
  scheduledServices: 12,
  scheduledServicesChange: 15,
  completedServices: 28,
  completedServicesChange: 8,
  overdueInstallments: 1,
  overdueInstallmentsValue: 2000,
  teamProductivity: [
    { teamId: "team1", teamName: "Equipe Desentupimento", completedServices: 12, scheduledServices: 5 },
    { teamId: "team2", teamName: "Equipe Limpeza", completedServices: 6, scheduledServices: 3 },
    { teamId: "team3", teamName: "Equipe Dedetização", completedServices: 6, scheduledServices: 2 },
  ],
}

export const monthlyRevenueData: MonthlyRevenueData[] = [
  { month: "Jan", value: 42500 },
  { month: "Fev", value: 38900 },
  { month: "Mar", value: 45620 },
  { month: "Abr", value: 0 },
  { month: "Mai", value: 0 },
  { month: "Jun", value: 0 },
]

export const servicesByPeriodData: ServicesByPeriodData[] = [
  { period: "Semana 1", completed: 5, scheduled: 2 },
  { period: "Semana 2", completed: 8, scheduled: 3 },
  { period: "Semana 3", completed: 6, scheduled: 4 },
  { period: "Semana 4", completed: 5, scheduled: 3 },
]

export const servicesByTeamData: ServicesByTeamData[] = [
  { team: "Desentupimento", services: 12, color: "var(--chart-1)" },
  { team: "Limpeza", services: 6, color: "var(--chart-2)" },
  { team: "Dedetização", services: 6, color: "var(--chart-3)" },
]

export const clientGrowthData: ClientGrowthData[] = [
  { month: "Jan", clients: 3 },
  { month: "Fev", clients: 4 },
  { month: "Mar", clients: 5 },
  { month: "Abr", clients: 5 },
  { month: "Mai", clients: 5 },
  { month: "Jun", clients: 5 },
]

// ==========================================
// SIMPLIFIED EXPORTS FOR COMPONENTS
// ==========================================
export const mockClients = clients
const colorMap: Record<string, string> = {
  'bg-blue-500': '#3B82F6',
  'bg-cyan-500': '#06B6D4',
  'bg-green-500': '#22C55E',
  'bg-purple-500': '#A855F7',
  'bg-amber-500': '#F59E0B',
  'bg-red-500': '#EF4444',
}

const employeeCpfs: Record<string, string> = {
  emp1: "031.456.789-01",
  emp2: "042.567.890-12",
  emp3: "053.678.901-23",
  emp4: "064.789.012-34",
  emp5: "075.890.123-45",
  emp6: "086.901.234-56",
  emp7: "097.012.345-67",
  emp8: "108.123.456-78",
  emp9: "119.234.567-89",
  emp10: "120.345.678-90",
}
const employeeRgs: Record<string, string> = {
  emp1: "12.345.678-9",
  emp2: "23.456.789-0",
  emp3: "",
  emp4: "34.567.890-1",
  emp5: "",
  emp6: "45.678.901-2",
  emp7: "56.789.012-3",
  emp8: "",
  emp9: "67.890.123-4",
  emp10: "45.678.901-2",
}
const employeePermissions: Record<string, string> = {
  emp1: "profile-operacional",
  emp2: "profile-operacional",
  emp3: "profile-operacional",
  emp4: "profile-operacional",
  emp5: "profile-operacional",
  emp6: "profile-operacional",
  emp7: "profile-operacional",
  emp8: "profile-operacional",
  emp9: "profile-gerente",
  emp10: "profile-admin",
}
export const mockTeams = teams.map(t => ({
  ...t,
  color: colorMap[t.color] || '#9ACD32',
  members: employees.filter(e => e.teamId === t.id).map(e => ({
    id: e.id,
    name: e.name,
    avatar: e.avatar || "/avatars/avatar-1.jpg",
    role: e.function,
    email: e.email,
    phone: e.phone,
    cpf: employeeCpfs[e.id] || "000.000.000-00",
    permissionProfileId: employeePermissions[e.id] || "profile-operacional",
    status: e.isActive ? "active" as const : "inactive" as const,
    createdAt: e.createdAt?.toISOString() || "2024-01-01",
  })),
}))
export const mockEmployees = employees.map(e => ({
  id: e.id,
  name: e.name,
  email: e.email,
  phone: e.phone,
  cpf: employeeCpfs[e.id] || "000.000.000-00",
  rg: employeeRgs[e.id] || "",
  role: e.function,
  permissionProfileId: employeePermissions[e.id] || "profile-operacional",
  status: e.isActive ? "active" as const : "inactive" as const,
  avatar: e.avatar || "/avatars/avatar-1.jpg",
  createdAt: e.createdAt?.toISOString() || "2024-01-01",
}))
export const mockServiceTypes = serviceTypes.map(s => ({
  id: s.id,
  name: s.name,
  description: s.description || "",
  defaultDuration: 60,
  pricePerHour: s.baseValue ? s.baseValue / 12 : 0,
  baseValue: s.baseValue,
  teamIds: s.defaultTeamIds || [],
  clauses: s.clauses || [],
  recurrence: s.defaultRecurrence || "monthly",
  recurrenceRules: s.recurrenceRules || [],
  isActive: s.isActive,
}))
export const mockScheduledServices = scheduledServices.map(s => {
  const client = clients.find(c => c.id === s.clientId)
  const unit = client?.units.find(u => u.id === s.unitId)
  const serviceType = serviceTypes.find(st => st.id === s.serviceTypeId)
  const team = teams.find(t => s.teamIds?.includes(t.id))
  const serviceTeams = teams.filter(t => s.teamIds?.includes(t.id))
  const additionalEmployees = (s.additionalEmployeeIds || []).map(id => employees.find(e => e.id === id)).filter(Boolean) as typeof employees
  const address = unit?.address
    ? `${unit.address.street}, ${unit.address.number}${unit.address.complement ? ` - ${unit.address.complement}` : ""} - ${unit.address.neighborhood}, ${unit.address.city}`
    : ""
  return {
    id: s.id,
    contractId: s.contractId || null,
    isManual: s.isManual ?? false,
    clientId: s.clientId,
    clientName: client?.companyName || "Cliente",
    unitName: unit?.name || "",
    address,
    serviceTypeId: s.serviceTypeId,
    serviceTypeName: serviceType?.name || "Serviço",
    teamId: team?.id,
    teamName: team?.name,
    teams: serviceTeams.map(t => ({ id: t.id, name: t.name, color: colorMap[t.color] || '#9ACD32' })),
    additionalEmployees: additionalEmployees.map(e => ({ id: e.id, name: e.name })),
    date: s.scheduledDate.toISOString().split("T")[0],
    time: s.scheduledTime,
    duration: s.estimatedDuration || 60,
    status: s.status,
    recurrence: { type: "none" as const, daysOfWeek: [], interval: 1 },
    notes: s.notes || "",
    createdAt: s.createdAt.toISOString(),
  }
})
export const mockContracts = contracts
export const mockClientTypes = clientTypes.map(ct => ({
  id: ct.id,
  name: ct.name,
  description: "",
  color: ({ "bg-blue-500": "#3B82F6", "bg-green-500": "#22C55E", "bg-purple-500": "#A855F7", "bg-amber-500": "#F59E0B", "bg-red-500": "#EF4444", "bg-cyan-500": "#06B6D4" } as Record<string, string>)[ct.color] || "#9ACD32",
}))
export const mockPermissionProfiles = [
  {
    id: "profile-admin",
    name: "Administrador",
    description: "Acesso total ao sistema",
    permissions: [
      "clients_view", "clients_create", "clients_edit", "clients_delete",
      "contracts_view", "contracts_create", "contracts_edit", "contracts_delete",
      "employees_view", "employees_create", "employees_edit", "employees_delete",
      "teams_view", "teams_manage",
      "services_view", "services_manage",
      "agenda_view", "agenda_manage",
      "financial_view", "financial_manage",
      "reports_view", "reports_export",
      "settings_view", "settings_manage",
      "templates_view", "templates_manage",
      "logs_view", "logs_manage",
    ] as const,
    createdAt: "2024-01-01",
  },
  {
    id: "profile-gerente",
    name: "Gerente",
    description: "Acesso gerencial sem configurações",
    permissions: [
      "clients_view", "clients_create", "clients_edit",
      "contracts_view", "contracts_create", "contracts_edit",
      "employees_view",
      "teams_view",
      "services_view", "services_manage",
      "agenda_view", "agenda_manage",
      "financial_view",
      "reports_view", "reports_export",
    ] as const,
    createdAt: "2024-01-01",
  },
  {
    id: "profile-operacional",
    name: "Equipe Operacional",
    description: "Acesso apenas à agenda e serviços",
    permissions: [
      "clients_view",
      "services_view",
      "agenda_view",
    ] as const,
    createdAt: "2024-01-01",
  },
]
export const mockUsers = [
  {
    id: "user-1",
    name: "Admin Depclean",
    email: "admin@depclean.com",
    permissionProfileId: "profile-admin",
    isActive: true,
    createdAt: "2024-01-01",
  },
  {
    id: "user-2",
    name: "Paula Santos",
    email: "paula@depclean.com",
    permissionProfileId: "profile-gerente",
    isActive: true,
    createdAt: "2024-01-01",
  },
  {
    id: "user-3",
    name: "Carlos Silva",
    email: "carlos@depclean.com",
    permissionProfileId: "profile-operacional",
    isActive: true,
    createdAt: "2024-01-01",
  },
]

// ==========================================
// HELPER FUNCTIONS
// ==========================================
export function getClientById(id: string): Client | undefined {
  return clients.find(c => c.id === id)
}

export function getContractsByClientId(clientId: string): Contract[] {
  return contracts.filter(c => c.clientId === clientId)
}

export function getTeamById(id: string): Team | undefined {
  return teams.find(t => t.id === id)
}

export function getEmployeeById(id: string): Employee | undefined {
  return employees.find(e => e.id === id)
}

export function getServiceTypeById(id: string): ServiceType | undefined {
  return serviceTypes.find(s => s.id === id)
}

export function getClientTypeById(id: string): ClientType | undefined {
  return clientTypes.find(ct => ct.id === id)
}

export function getRecurrenceForUnits(serviceTypeId: string, unitCount: number): RecurrenceType | undefined {
  const st = serviceTypes.find(s => s.id === serviceTypeId)
  if (!st?.recurrenceRules?.length) return st?.defaultRecurrence
  for (const rule of st.recurrenceRules) {
    if (rule.type === "range" && unitCount >= rule.minUnits && unitCount <= rule.maxUnits) {
      return rule.recurrence
    }
    if (rule.type === "above" && unitCount > rule.minUnits) {
      return rule.recurrence
    }
  }
  return st.defaultRecurrence
}

export function getSchedulesByDate(date: Date): ScheduledService[] {
  return scheduledServices.filter(s => 
    s.scheduledDate.toDateString() === date.toDateString()
  )
}

export function getSchedulesByTeam(teamId: string): ScheduledService[] {
  return scheduledServices.filter(s => s.teamIds.includes(teamId))
}

export function getOverdueInstallments(): Installment[] {
  const today = new Date()
  return contracts.flatMap(c => 
    c.installments.filter(i => i.status === "overdue" || (i.status === "pending" && i.dueDate < today))
  )
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR").format(date)
}

export function formatCNPJ(cnpj: string): string {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
}
