import type { TemplateKind } from "@/lib/api/templates"

export type TemplateVariable = {
  description?: string
  kinds?: TemplateKind[]
  label: string
  path: string
}

export type TemplateVariableGroup = {
  id: string
  label: string
  variables: TemplateVariable[]
}

export const TEMPLATE_VARIABLE_GROUPS: TemplateVariableGroup[] = [
  {
    id: "client",
    label: "Cliente",
    variables: [
      { path: "client.companyName", label: "Nome do cliente" },
      { path: "client.cnpj", label: "CNPJ" },
      { path: "client.address", label: "Endereço principal" },
      { path: "client.responsibleName", label: "Responsável" },
      { path: "client.email", label: "E-mail" },
      { path: "client.phone", label: "Telefone" },
    ],
  },
  {
    id: "unit",
    label: "Unidade / local",
    variables: [
      { path: "unit.name", label: "Nome da unidade" },
      { path: "unit.address.full", label: "Endereço completo" },
      { path: "unit.address.street", label: "Rua" },
      { path: "unit.address.number", label: "Número" },
      { path: "unit.address.neighborhood", label: "Bairro" },
      { path: "unit.address.city", label: "Cidade" },
      { path: "unit.address.state", label: "UF" },
      { path: "unit.address.cityState", label: "Cidade / UF" },
      { path: "unit.address.zipCode", label: "CEP" },
      { path: "unit.reservoirProfile.validityMonths", label: "Validade dos reservatórios" },
      { path: "unit.reservoirProfile.observations", label: "Observações dos reservatórios" },
    ],
  },
  {
    id: "contract",
    label: "Contrato",
    variables: [
      { path: "contract.number", label: "Número do contrato", kinds: ["contract"] },
      { path: "contract.startDate", label: "Data de início", kinds: ["contract"] },
      { path: "contract.endDate", label: "Data de término", kinds: ["contract"] },
      { path: "contract.durationMonths", label: "Duração em meses", kinds: ["contract"] },
      { path: "contract.recurrence", label: "Recorrência", kinds: ["contract"] },
      { path: "contract.recurrenceTable", label: "Tabela de recorrência das visitas", kinds: ["contract"] },
      { path: "contract.totalValue", label: "Valor total", kinds: ["contract"] },
      { path: "contract.installmentsCount", label: "Quantidade de parcelas", kinds: ["contract"] },
      { path: "contract.installmentValue", label: "Valor da parcela", kinds: ["contract"] },
      { path: "contract.paymentDay", label: "Dia de vencimento", kinds: ["contract"] },
      { path: "contract.firstDueDate", label: "Primeiro vencimento", kinds: ["contract"] },
      { path: "contract.createdAt", label: "Data de criação", kinds: ["contract"] },
    ],
  },
  {
    id: "service",
    label: "Serviço",
    variables: [
      { path: "service.name", label: "Nome do serviço" },
      { path: "service.description", label: "Descrição do serviço" },
      { path: "services.summary", label: "Resumo dos serviços", kinds: ["contract"] },
      { path: "services.names", label: "Nomes dos serviços", kinds: ["contract"] },
      { path: "services.sectionsText", label: "Cláusulas dos serviços", kinds: ["contract"] },
    ],
  },
  {
    id: "schedule",
    label: "Agendamento",
    variables: [
      { path: "schedule.date", label: "Data da visita", kinds: ["informative", "certificate"] },
      { path: "schedule.time", label: "Horário da visita", kinds: ["informative", "certificate"] },
      { path: "schedule.duration", label: "Duração da visita", kinds: ["informative", "certificate"] },
    ],
  },
  {
    id: "certificate",
    label: "Certificado",
    variables: [
      { path: "certificate.executionDatesText", label: "Datas de execução", kinds: ["certificate"] },
      { path: "certificate.validityText", label: "Validade do certificado", kinds: ["certificate"] },
      { path: "certificate.observations", label: "Observações", kinds: ["certificate"] },
      { path: "certificate.reservoirRow1Label", label: "Reservatório 1", kinds: ["certificate"] },
      { path: "certificate.reservoirRow1Capacity", label: "Capacidade 1", kinds: ["certificate"] },
      { path: "certificate.reservoirRow2Label", label: "Reservatório 2", kinds: ["certificate"] },
      { path: "certificate.reservoirRow2Capacity", label: "Capacidade 2", kinds: ["certificate"] },
      { path: "certificate.reservoirRow3Label", label: "Reservatório 3", kinds: ["certificate"] },
      { path: "certificate.reservoirRow3Capacity", label: "Capacidade 3", kinds: ["certificate"] },
      { path: "certificate.reservoirRow4Label", label: "Reservatório 4", kinds: ["certificate"] },
      { path: "certificate.reservoirRow4Capacity", label: "Capacidade 4", kinds: ["certificate"] },
      { path: "certificate.reservoirRow5Label", label: "Reservatório 5", kinds: ["certificate"] },
      { path: "certificate.reservoirRow5Capacity", label: "Capacidade 5", kinds: ["certificate"] },
    ],
  },
  {
    id: "contractor",
    label: "Depclean",
    variables: [
      { path: "contractor.legalName", label: "Razão social" },
      { path: "contractor.cnpj", label: "CNPJ" },
      { path: "contractor.address", label: "Endereço" },
      { path: "contractor.phone", label: "Telefone" },
      { path: "contractor.email", label: "E-mail" },
      { path: "contractor.signerName", label: "Assinante" },
      { path: "contractor.signerRole", label: "Cargo do assinante" },
    ],
  },
  {
    id: "document",
    label: "Documento",
    variables: [
      { path: "document.generatedDate", label: "Data de geração" },
      { path: "document.generatedDateLong", label: "Data por extenso" },
    ],
  },
]

export function getTemplateVariableGroups(kind: TemplateKind) {
  return TEMPLATE_VARIABLE_GROUPS.map((group) => ({
    ...group,
    variables: group.variables.filter((variable) => !variable.kinds || variable.kinds.includes(kind)),
  })).filter((group) => group.variables.length > 0)
}

export function getTemplateVariableLabelMap(kind: TemplateKind) {
  return Object.fromEntries(
    getTemplateVariableGroups(kind).flatMap((group) =>
      group.variables.map((variable) => [variable.path, `${group.label}: ${variable.label}`]),
    ),
  )
}
