"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ContractRichEditor } from "@/components/contratos/contract-rich-editor"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import {
  Plus,
  Trash2,
  Save,
  FileText,
  Building2,
  Briefcase,
  Users,
  Check,
  ChevronsUpDown,
  X,
  ArrowLeft,
  CheckCircle2,
  Upload,
  Download,
  RefreshCw
} from "lucide-react"
import { cn, getColorFromClass } from "@/lib/utils"
import {
  formatCurrency,
  getClientTypeById,
  formatDate,
} from "@/lib/mock-data"
import type { RecurrenceRule, RecurrenceRuleType, RecurrenceType } from "@/lib/types"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { listClients } from "@/lib/api/clients"
import {
  createContract,
  getContractById,
  previewContract,
  updateContract,
  type ContractPayload,
} from "@/lib/api/contracts"
import { listServices } from "@/lib/api/services"
import { listTemplates } from "@/lib/api/templates"
import { listTeams } from "@/lib/api/teams"
import { listEmployees } from "@/lib/api/employees"

interface ContractFormProps {
  contractId?: string
  isEditing?: boolean
}

interface ContractService {
  id: string
  serviceTypeId: string
  teamIds: string[]
  employeeIds: string[]
}

export function ContractForm({ contractId, isEditing = false }: ContractFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const clientsQuery = useQuery({
    queryKey: ["clients", "contract-form"],
    queryFn: () => listClients(),
  })
  const servicesQuery = useQuery({
    queryKey: ["services", "contract-form"],
    queryFn: () => listServices(),
  })
  const templatesQuery = useQuery({
    queryKey: ["templates", "contract-form"],
    queryFn: () => listTemplates("", "contract"),
  })
  const informativeTemplatesQuery = useQuery({
    queryKey: ["templates", "contract-form", "informative"],
    queryFn: () => listTemplates("", "informative"),
  })
  const certificateTemplatesQuery = useQuery({
    queryKey: ["templates", "contract-form", "certificate"],
    queryFn: () => listTemplates("", "certificate"),
  })
  const teamsQuery = useQuery({
    queryKey: ["teams", "contract-form"],
    queryFn: () => listTeams(),
  })
  const employeesQuery = useQuery({
    queryKey: ["employees", "contract-form"],
    queryFn: () => listEmployees(),
  })
  const contractQuery = useQuery({
    queryKey: ["contract", contractId],
    queryFn: () => getContractById(contractId!),
    enabled: Boolean(contractId),
  })

  const clients = clientsQuery.data?.data ?? []
  const serviceTypes = servicesQuery.data?.data ?? []
  const templates = templatesQuery.data?.data ?? []
  const informativeTemplates = informativeTemplatesQuery.data?.data ?? []
  const certificateTemplates = certificateTemplatesQuery.data?.data ?? []
  const teams = teamsQuery.data?.data ?? []
  const employees = employeesQuery.data?.data ?? []
  const contract = contractQuery.data?.data
  const client = contract ? clients.find((c) => c.id === contract.clientId) : undefined

  type CreateStep = "form" | "editor" | "done"

  const [step, setStep] = useState<CreateStep>("form")
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false)
  const [draftMeta, setDraftMeta] = useState<{ contractNumber: string; createdAt: Date } | null>(null)
  const [createdContractId, setCreatedContractId] = useState<string | null>(null)
  const [draftInitialHtml, setDraftInitialHtml] = useState("")
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const [editorView, setEditorView] = useState<"edit" | "preview" | "pdf">("edit")
  const [draftHtml, setDraftHtml] = useState("")
  const [previewBusy, setPreviewBusy] = useState(false)
  const [previewPages, setPreviewPages] = useState<number | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewDocHeight, setPreviewDocHeight] = useState<number>(0)
  const [importedPdfUrl, setImportedPdfUrl] = useState<string | null>(null)
  const [importNoticeOpen, setImportNoticeOpen] = useState(false)
  const [importNoticeText, setImportNoticeText] = useState<string>("")

  const initialUnitIds = useMemo(() => {
    const direct = (contract as unknown as { unitIds?: string[] })?.unitIds ?? []
    if (direct.length > 0) return direct
    const fromServices = contract?.services?.flatMap((s: any) => s.unitIds ?? []) ?? []
    return Array.from(new Set(fromServices))
  }, [contract])

  const [selectedClientId, setSelectedClientId] = useState(contract?.clientId || "")
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [createAutomatedSchedules, setCreateAutomatedSchedules] = useState(false)
  const [createAutomatedInformatives, setCreateAutomatedInformatives] = useState(false)
  const [selectedInformativeTemplateId, setSelectedInformativeTemplateId] = useState("")
  const [createAutomatedCertificates, setCreateAutomatedCertificates] = useState(false)
  const [selectedCertificateTemplateId, setSelectedCertificateTemplateId] = useState("")
  const [startDate, setStartDate] = useState(
    contract?.startDate ? String(contract.startDate).split("T")[0] : ""
  )
  const [installmentsCount, setInstallmentsCount] = useState(contract?.installmentsCount || 1)
  const endDate = useMemo(() => {
    if (!startDate) return ""
    const start = new Date(`${startDate}T00:00:00`)
    start.setMonth(start.getMonth() + installmentsCount)
    return start.toISOString().split("T")[0]
  }, [startDate, installmentsCount])
  const [dueDay, setDueDay] = useState(((contract as any)?.dueDay ?? (contract as any)?.paymentDay ?? 10) as number)
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>(initialUnitIds)
  const [services, setServices] = useState<ContractService[]>(
    contract?.services.map(s => ({
      id: s.id,
      serviceTypeId: s.serviceTypeId,
      teamIds: (s as any).teamIds ?? (s as any).teamId ? [(s as any).teamId] : [],
      employeeIds: [],
    })) || []
  )
  const [contractValue, setContractValue] = useState(contract?.totalValue ? Math.round(contract.totalValue * 100) : 0)

  // Contract-level recurrence rules
  const [contractRecurrenceRules, setContractRecurrenceRules] = useState<RecurrenceRule[]>(
    (contract as any)?.recurrenceRules ?? [
      { type: "range", minUnits: 1, maxUnits: 100, recurrence: "semiannual" as RecurrenceType },
      { type: "range", minUnits: 101, maxUnits: 200, recurrence: "quarterly" as RecurrenceType },
      { type: "above", minUnits: 200, maxUnits: Infinity, recurrence: "monthly" as RecurrenceType },
    ]
  )
  const [contractRecurrence, setContractRecurrence] = useState<string>(
    (contract as any)?.recurrence || "semiannual"
  )
  const [addRulePopoverOpen, setAddRulePopoverOpen] = useState(false)

  // Service edit dialog
  const [editServiceDialogOpen, setEditServiceDialogOpen] = useState(false)
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [teamsPopoverOpen, setTeamsPopoverOpen] = useState(false)
  const [employeesPopoverOpen, setEmployeesPopoverOpen] = useState(false)
  const [teamSearchTerm, setTeamSearchTerm] = useState("")
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("")

  const selectedClient = clients.find(c => c.id === selectedClientId)
  const totalValue = contractValue / 100
  const activeInformativeTemplates = useMemo(
    () => informativeTemplates.filter((template) => template.isActive && template.format === "docx"),
    [informativeTemplates],
  )
  const activeCertificateTemplates = useMemo(
    () => certificateTemplates.filter((template) => template.isActive && template.format === "docx"),
    [certificateTemplates],
  )
  const editingService = services.find(s => s.id === editingServiceId)

  useEffect(() => {
    if (!contract) return

    const directUnitIds = contract.unitIds ?? []
    const serviceUnitIds = contract.services?.flatMap((service) => service.unitIds ?? []) ?? []
    const initialServiceList = (contract.services ?? []).map((service) => ({
      id: service.id,
      serviceTypeId: service.serviceTypeId,
      teamIds: service.teamIds ?? [],
      employeeIds: service.additionalEmployeeIds ?? [],
    }))

    setSelectedClientId(contract.clientId ?? "")
    setSelectedTemplateId(contract.templateId ?? "")
    setCreateAutomatedSchedules(contract.automationCreateSchedules ?? true)
    setCreateAutomatedInformatives(contract.automationCreateInformatives ?? true)
    setSelectedInformativeTemplateId(contract.automationInformativeTemplateId ?? "")
    setCreateAutomatedCertificates(contract.automationCreateCertificates ?? true)
    setSelectedCertificateTemplateId(contract.automationCertificateTemplateId ?? "")
    setStartDate(contract.startDate ? String(contract.startDate).split("T")[0] : "")
    setInstallmentsCount(contract.installmentsCount ?? 1)
    setDueDay(contract.paymentDay ?? 10)
    setSelectedUnitIds(Array.from(new Set([...directUnitIds, ...serviceUnitIds])))
    setServices(initialServiceList)
    setContractValue(Math.round((contract.totalValue ?? 0) * 100))
    setContractRecurrenceRules(
      contract.recurrenceRules?.length
        ? contract.recurrenceRules.map((rule) => ({
            type: rule.type,
            minUnits: rule.minUnits,
            maxUnits: rule.maxUnits,
            recurrence: rule.recurrence as RecurrenceType,
          }))
        : [
            { type: "range", minUnits: 1, maxUnits: 100, recurrence: "semiannual" },
            { type: "range", minUnits: 101, maxUnits: 200, recurrence: "quarterly" },
            { type: "above", minUnits: 200, maxUnits: Infinity, recurrence: "monthly" },
          ],
    )
    setContractRecurrence(contract.recurrence || "semiannual")
    setDraftHtml(contract.renderedHtml || "")
    setDraftInitialHtml(contract.renderedHtml || "")
  }, [contract])

  useEffect(() => {
    if (!createAutomatedSchedules) {
      setCreateAutomatedInformatives(false)
      setCreateAutomatedCertificates(false)
      setSelectedInformativeTemplateId("")
      setSelectedCertificateTemplateId("")
    }
  }, [createAutomatedSchedules])

  useEffect(() => {
    if (!createAutomatedInformatives) {
      setSelectedInformativeTemplateId("")
      return
    }
    if (!selectedInformativeTemplateId && activeInformativeTemplates.length > 0) {
      setSelectedInformativeTemplateId(activeInformativeTemplates[0].id)
    }
  }, [activeInformativeTemplates, createAutomatedInformatives, selectedInformativeTemplateId])

  useEffect(() => {
    if (!createAutomatedCertificates) {
      setSelectedCertificateTemplateId("")
      return
    }
    if (!selectedCertificateTemplateId && activeCertificateTemplates.length > 0) {
      setSelectedCertificateTemplateId(activeCertificateTemplates[0].id)
    }
  }, [activeCertificateTemplates, createAutomatedCertificates, selectedCertificateTemplateId])

  // Total de unidades das filiais selecionadas (para regras de recorrência)
  const selectedTotalUnitCount = useMemo(() => {
    if (!selectedClient?.units?.length || selectedUnitIds.length === 0) return 0
    return selectedClient.units
      .filter(u => selectedUnitIds.includes(u.id))
      .reduce((sum, u) => sum + (u.unitCount ?? 0), 0)
  }, [selectedClient?.units, selectedUnitIds])

  const selectedUnitsForDraft = useMemo(() => {
    const units = selectedClient?.units ?? []
    if (units.length === 0) return []
    const selected = units.filter((u) => selectedUnitIds.includes(u.id))
    if (selected.length > 0) return selected
    const primary = units.find((u) => u.isPrimary) ?? units[0]
    return primary ? [primary] : []
  }, [selectedClient?.units, selectedUnitIds])

  // Auto-select all filiais when client changes
  useEffect(() => {
    if (!selectedClient?.units?.length) {
      setSelectedUnitIds([])
      return
    }
    if (!isEditing) {
      setSelectedUnitIds(selectedClient.units.map(u => u.id))
    }
  }, [selectedClientId])

  // Re-apply contract recurrence when selected unit count or rules change
  useEffect(() => {
    if (selectedTotalUnitCount === 0 || contractRecurrenceRules.length === 0) return
    for (const rule of contractRecurrenceRules) {
      if (rule.type === "range" && selectedTotalUnitCount >= rule.minUnits && selectedTotalUnitCount <= rule.maxUnits) {
        setContractRecurrence(rule.recurrence)
        return
      }
      if (rule.type === "above" && selectedTotalUnitCount > rule.minUnits) {
        setContractRecurrence(rule.recurrence)
        return
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTotalUnitCount, contractRecurrenceRules])

  const getRecurrenceLabel = (recurrence: string) => {
    const labels: Record<string, string> = {
      weekly: "Semanal",
      biweekly: "Quinzenal",
      monthly: "Mensal",
      bimonthly: "Bimestral",
      quarterly: "Trimestral",
      semiannual: "Semestral",
      annual: "Anual"
    }
    return labels[recurrence] || recurrence
  }

  const updateContractRule = (ruleIndex: number, field: keyof RecurrenceRule, value: number | string) => {
    setContractRecurrenceRules(prev => {
      const rules = [...prev]
      rules[ruleIndex] = { ...rules[ruleIndex], [field]: value }
      return rules
    })
  }

  const addContractRule = (ruleType: RecurrenceRuleType) => {
    const newRule: RecurrenceRule = ruleType === "range"
      ? { type: "range", minUnits: 1, maxUnits: 100, recurrence: "monthly" as RecurrenceType }
      : { type: "above", minUnits: 100, maxUnits: Infinity, recurrence: "monthly" as RecurrenceType }
    setContractRecurrenceRules(prev => [...prev, newRule])
    setAddRulePopoverOpen(false)
  }

  const removeContractRule = (ruleIndex: number) => {
    setContractRecurrenceRules(prev => prev.filter((_, i) => i !== ruleIndex))
  }

  const createDraftContractNumber = () => {
    const year = new Date().getFullYear()
    const seq = String(Date.now()).slice(-3)
    return `DEP-${year}-${seq}`
  }

  const buildContractPayload = (renderedHtml?: string): ContractPayload => ({
    clientId: selectedClientId,
    templateId: selectedTemplateId,
    automationCreateSchedules: createAutomatedSchedules,
    automationCreateInformatives: createAutomatedInformatives,
    automationInformativeTemplateId: createAutomatedInformatives ? selectedInformativeTemplateId : "",
    automationCreateCertificates: createAutomatedCertificates,
    automationCertificateTemplateId: createAutomatedCertificates ? selectedCertificateTemplateId : "",
    unitIds: selectedUnitIds,
    totalValue,
    duration: installmentsCount,
    startDate,
    paymentDay: dueDay,
    installmentsCount,
    recurrence: contractRecurrence,
    recurrenceRules: contractRecurrenceRules.map((rule) => ({
      type: rule.type,
      minUnits: Number(rule.minUnits),
      maxUnits: Number.isFinite(rule.maxUnits) ? Number(rule.maxUnits) : Number.MAX_SAFE_INTEGER,
      recurrence: rule.recurrence,
    })),
    services: services
      .filter((service) => service.serviceTypeId)
      .map((service) => {
        const serviceType = serviceTypes.find((item) => item.id === service.serviceTypeId)
        return {
          id: service.id.startsWith("temp-") ? undefined : service.id,
          serviceTypeId: service.serviceTypeId,
          value: serviceType?.baseValue ?? 0,
          teamIds: service.teamIds,
          additionalEmployeeIds: service.employeeIds,
          unitIds: selectedUnitIds,
          clauses: serviceType?.clauses ?? [],
          isActive: true,
        }
      }),
    renderedHtml,
  })

  const previewMutation = useMutation({
    mutationFn: previewContract,
  })

  const createMutation = useMutation({
    mutationFn: createContract,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contracts"] })
      await queryClient.invalidateQueries({ queryKey: ["contracts", "list"] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ContractPayload> }) => updateContract(id, payload),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["contract", response.data.id] })
      await queryClient.invalidateQueries({ queryKey: ["contracts"] })
      await queryClient.invalidateQueries({ queryKey: ["contracts", "list"] })
    },
  })

  const buildDraftHtml = (contractNumber: string, createdAt: Date) => {
    const clientName = selectedClient?.companyName || "Cliente"
    const clientCnpj = selectedClient?.cnpj ? `, CNPJ nº ${selectedClient.cnpj}` : ""
    const unit = selectedUnitsForDraft[0]
    const address = unit?.address
      ? `${unit.address.street}, nº ${unit.address.number} - ${unit.address.neighborhood} – ${unit.address.city}/${unit.address.state}, CEP ${unit.address.zipCode}`
      : "Endereço não informado"

    const start = startDate ? new Date(`${startDate}T00:00:00`) : createdAt
    const end = endDate ? new Date(`${endDate}T00:00:00`) : createdAt

    const selectedTypeIds = Array.from(new Set(services.map((s) => s.serviceTypeId).filter(Boolean)))
    const selectedTypes = selectedTypeIds
      .map((id) => serviceTypes.find((st) => st.id === id))
      .filter(Boolean)

    const hasDedetizacao = selectedTypeIds.includes("srv3")
    const hasDesratizacao = selectedTypeIds.includes("srv4")
    const mergedTypes = selectedTypes
      .filter((t: any) => t.id !== "srv3" && t.id !== "srv4")
      .concat(
        hasDedetizacao && hasDesratizacao
          ? [
            {
              id: "srv3-srv4",
              name: "Dedetização e Desratização",
              clauses: [
                ...(serviceTypes.find((x) => x.id === "srv3")?.clauses ?? []),
                ...(serviceTypes.find((x) => x.id === "srv4")?.clauses ?? []),
              ],
            } as any,
          ]
          : []
      )
      .concat(hasDedetizacao && !hasDesratizacao ? [serviceTypes.find((x) => x.id === "srv3")] : [])
      .concat(hasDesratizacao && !hasDedetizacao ? [serviceTypes.find((x) => x.id === "srv4")] : [])
      .filter(Boolean) as any[]

    const objectServicesText =
      mergedTypes.length > 0
        ? mergedTypes
          .map((t) => (t.name as string).toLowerCase())
          .join(", ")
        : "serviços"

    const serviceSectionsHtml = mergedTypes
      .map((t, index) => {
        const clauses: string[] = (t.clauses ?? []).filter(Boolean)
        const head = `${index + 1}. ${t.name}`
        const clausesHtml =
          clauses.length > 0
            ? clauses
              .map((c, j) => `<p><strong>${index + 1}.${j + 1}.</strong> ${c}</p>`)
              .join("")
            : `<p><strong>${index + 1}.1.</strong> Cláusulas específicas não informadas para este serviço.</p>`
        return `
          <p><strong>${head}</strong></p>
          ${clausesHtml}
        `
      })
      .join("")

    const firstDueDate = new Date(start)
    firstDueDate.setDate(Math.min(dueDay, 28))

    const representativeName = selectedClient?.responsibleName || "Representante"

    return `
      <h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h1>
      <p></p>

      <p><strong>CONTRATANTE:</strong> <strong>${clientName}</strong>, pessoa jurídica de direito privado${clientCnpj}, estabelecido na ${address}, neste ato representado por seu síndico, Sr(a). <strong>${representativeName}</strong>, brasileiro(a), <strong>RG nº ________</strong>, <strong>CPF nº ________</strong>, residente e domiciliado na cidade de <strong>${unit?.address?.city ?? "Porto Alegre"}</strong>, denominado <u><strong>CONTRATANTE</strong></u>.</p>

      <p></p>

      <p><strong>CONTRATADA:</strong> <strong>DEPCLEAN SOLUÇÕES AMBIENTAIS EIRELI</strong>, pessoa jurídica de direito privado, CNPJ nº 21.602.658/0001-43, com sede na Rua Um, nº 23, Brigadeira – Canoas/RS, CEP 92.425-692, neste ato representada por sua sócia administradora, <strong>Melina da Costa</strong>, brasileira, solteira, RG nº <strong>[RG]</strong>, CPF nº <strong>[CPF]</strong>, domiciliada na cidade de Canoas/RS, doravante denominada <u><strong>CONTRATADA</strong></u>.</p>

      <p></p>

      <p>Acordam as partes, pelo presente <strong>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</strong>, em comum acordo, e por força da livre manifestação de vontade, que a relação se regerá nos termos das seguintes cláusulas:</p>

      <p></p>

      <p class="clause-title">CLÁUSULA PRIMEIRA – OBJETO DO CONTRATO</p>

      <p>O presente contrato tem por objeto a prestação de serviços profissionais de ${objectServicesText} nas instalações do Condomínio <u><strong>CONTRATANTE</strong></u>.</p>

      <p><strong>Caberá a CONTRATADA atender os seguintes itens:</strong></p>

      ${serviceSectionsHtml || "<p><strong>1.</strong> [Adicionar serviço]</p>"}

      <p></p>
      <hr />

      <p class="clause-title">CLÁUSULA SEGUNDA – VALOR DO CONTRATO</p>

      <p>O CONTRATANTE pagará à CONTRATADA pelos serviços objeto do presente contrato o valor total de <strong>${formatCurrency(totalValue)}</strong>, correspondente à vigência de <strong>${installmentsCount}</strong> (doze) meses do contrato.</p>

      <p>O faturamento será realizado da seguinte forma: 80% (oitenta por cento) do valor total será emitido por fatura de locação, enquanto os 20% (vinte por cento) restantes serão emitidos por nota fiscal referente ao custeio da mão de obra.</p>

      <p><strong>Parágrafo Primeiro:</strong> O valor global do contrato poderá ser parcelado em até <strong>${installmentsCount}</strong> (doze) parcelas idênticas, mensais e sucessivas, com vencimento sempre no dia <strong>${String(dueDay).padStart(2, "0")}</strong> de cada mês. A primeira parcela deverá ser paga em <strong>${formatDate(firstDueDate)}</strong>, e as demais parcelas terão vencimento no mesmo dia nos meses subsequentes.</p>

      <p><strong>Parágrafo Segundo:</strong> Em caso de atraso no pagamento de qualquer parcela, incidirá sobre o valor devido multa de 2% (dois por cento), atualização monetária pelo IPCA (pro rata die) acrescida de juros calculados pela taxa Selic.</p>

      <p><strong>Parágrafo Terceiro:</strong> Convencionam as partes que, após quinze dias do vencimento da fatura, em caso de falta de pagamento, a mesma poderá ser enviada ao cartório de protestos, onde correrá por conta do CONTRATANTE todas as despesas de cobrança e custas cartoriais.</p>

      <p><strong>Parágrafo Quarto:</strong> Ocorrendo falta de pagamento, a CONTRATADA poderá suspender os atendimentos de emergência, enquanto perdurar a inadimplência.</p>

      <p></p>
      <hr class="page-break" />

      <p class="clause-title">CLÁUSULA TERCEIRA – RESCISÃO</p>

      <p>Constituem causas de rescisão antecipada do presente contrato, em qualquer época, independentemente de interpelação judicial ou extrajudicial, o descumprimento de quaisquer das cláusulas ora pactuadas, especialmente a inexecução total ou parcial dos serviços descritos na Cláusula Primeira pela CONTRATADA, bem como o inadimplemento dos pagamentos devidos pela CONTRATANTE.</p>

      <p><strong>Parágrafo Único:</strong> Se a rescisão ocorrer por culpa da CONTRATANTE, haverá incidência de multa equivalente a 40% (quarenta por cento) do valor total das parcelas que ainda deveriam ser cumpridas do momento da rescisão até o término previsto.</p>

      <p></p>

      <p class="clause-title">CLÁUSULA QUARTA – SERVIÇOS ADICIONAIS</p>
      <p>As partes estabelecem ainda que, se na vigência do presente contrato houver necessidade de execução de serviços não constantes neste contrato, estes serão realizados e cobrados mediante orçamento prévio aprovado pela CONTRATANTE.</p>

      <p></p>

      <p class="clause-title">CLÁUSULA QUINTA – OBRIGAÇÕES DA CONTRATADA</p>
      <p><strong>5.1.</strong> Fornecer técnicos qualificados, nas quantidades necessárias, à execução dos serviços.</p>
      <p><strong>5.2.</strong> Executar os serviços dentro de um procedimento eficiente e cuidadoso, de acordo com os melhores padrões profissionais.</p>
      <p><strong>5.3.</strong> Obedecer aos regulamentos e normas de segurança da legislação vigente, sendo de sua exclusiva responsabilidade o fornecimento de EPIs e a aplicação das normas.</p>
      <p><strong>5.4.</strong> A CONTRATADA é a única responsável por todos os encargos trabalhistas, previdenciários, sociais e securitários da mão de obra alocada para execução deste contrato.</p>
      <p><strong>5.5.</strong> A CONTRATADA deverá fornecer todos os materiais, equipamentos, veículos, insumos e ferramentas para execução do objeto deste contrato.</p>

      <p></p>

      <p class="clause-title">CLÁUSULA SEXTA – OBRIGAÇÕES DA CONTRATANTE</p>
      <p><strong>6.1.</strong> Exigir sempre a identificação dos técnicos e funcionários da CONTRATADA, visando preservar sua própria segurança.</p>
      <p><strong>6.2.</strong> Cumprir fielmente o contratado, quanto aos valores e prazos de pagamentos.</p>
      <p><strong>6.3.</strong> Comunicar imediatamente a CONTRATADA qualquer irregularidade, dúvida ou ocorrência observada, no decorrer ou após a prestação dos serviços.</p>

      <p></p>

      <p class="clause-title">CLÁUSULA SÉTIMA – LIMITES DE RESPONSABILIDADE</p>
      <p>A CONTRATADA se responsabiliza, como se seus fossem, por todos os atos, fatos, ações e omissões decorrentes de seu comportamento e/ou de seus empregados que resultem em infração ao presente contrato, nos termos da legislação vigente.</p>

      <p></p>

      <p class="clause-title">CLÁUSULA OITAVA – NOTIFICAÇÕES</p>
      <p>As partes se comprometem a realizar as notificações através dos endereços de e-mail <strong>${selectedClient?.email ?? "[e-mail da contratante]"}</strong> (CONTRATANTE) e <strong>contato@depcleanrs.com.br</strong> (CONTRATADA), única e exclusivamente para fins fiscais, financeiros e de rescisão.</p>
      <p>A partir da assinatura deste contrato, a CONTRATANTE concorda em utilizar o gestor de contratos como canal de comunicação com a empresa para assuntos relacionados a serviços, agendamentos, implantação e demandas emergenciais.</p>

      <p></p>

      <p class="clause-title">CLÁUSULA NONA – PRAZO DO CONTRATO</p>
      <p>Este contrato terá o prazo de <strong>${Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)))}</strong> (doze) meses a partir de sua assinatura.</p>

      <p></p>

      <p class="clause-title">CLÁUSULA DÉCIMA – DA LGPD</p>
      <p>A Lei Geral de Proteção de Dados será obedecida, em todos os seus termos, pela CONTRATADA, obrigando-se ela a tratar os dados da CONTRATANTE que forem eventualmente coletados, conforme sua necessidade ou obrigatoriedade.</p>

      <p></p>

      <p class="clause-title">CLÁUSULA DÉCIMA PRIMEIRA – DISPOSIÇÕES FINAIS</p>
      <p>Fica eleito, com expressa renúncia de qualquer outro, por mais privilégio que seja, o Foro da Cidade de Porto Alegre para dirimir quaisquer dúvidas e/ou questões resultantes da interpretação e/ou execução deste contrato.</p>

      <p></p>
      <hr />

      <p style="text-align:right;">Canoas, ${formatDate(createdAt)}.</p>
      <p></p>

      <p><strong>CONTRATANTE:</strong> ${clientName}</p>
      <p><strong>[Nome do representante]</strong> – CPF: <strong>[CPF]</strong></p>

      <p></p>

      <p><strong>CONTRATADA:</strong> DEPCLEAN SOLUÇÕES AMBIENTAIS EIRELI</p>
      <p><strong>Melina da Costa</strong> – CPF: <strong>[CPF]</strong></p>
    `
  }

  useEffect(() => {
    return () => {
      if (importedPdfUrl) URL.revokeObjectURL(importedPdfUrl)
    }
  }, [importedPdfUrl])

  useEffect(() => {
    if (step !== "editor") return
    // Evita o texto do cabeçalho ficar “selecionado” ao entrar na etapa do editor
    requestAnimationFrame(() => {
      try {
        globalThis.getSelection?.()?.removeAllRanges?.()
      } catch {
        // noop
      }
    })

    // Ao entrar na etapa do editor, manter o scroll no início
    requestAnimationFrame(() => {
      try {
        globalThis.scrollTo?.(0, 0)
      } catch {
        // noop
      }
    })
  }, [step])

  useEffect(() => {
    if (step !== "editor") return
    // Ao alternar entre Editar / Prévia, voltar para o topo
    requestAnimationFrame(() => {
      try {
        globalThis.scrollTo?.(0, 0)
      } catch {
        // noop
      }
    })
  }, [editorView, step])

  const openImport = () => importInputRef.current?.click()

  const downloadPdf = () => {
    const html = (draftHtml || draftInitialHtml || "").trim()
    if (!html) return

    const iframe = document.createElement("iframe")
    iframe.style.position = "fixed"
    iframe.style.right = "0"
    iframe.style.bottom = "0"
    iframe.style.width = "0"
    iframe.style.height = "0"
    iframe.style.border = "0"
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument
    if (!doc) return

    const css = `
      @page { size: A4; margin: 18mm 16mm; }
      html, body { background: #fff; }
      body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.6; color: #000; }
      p { margin: 0 0 10px 0; text-align: justify; min-height: 1em; }
      p:empty { min-height: 1.6em; }
      h1 { margin: 0 0 14px 0; text-align: center; text-transform: uppercase; font-weight: 700; font-style: italic; text-decoration: underline; font-size: 12pt; }
      .clause-title { text-align: left; font-weight: 700; font-style: italic; margin: 18px 0 10px 0; }
      hr { border: 0; border-top: 1px solid rgba(0,0,0,.25); margin: 14px 0; }
      hr.page-break { border-top: 0; margin: 16px 0; break-after: page; }
      strong { font-weight: 700; }
    `

    doc.open()
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8"/><title>Contrato</title><style>${css}</style></head><body>${html}</body></html>`
    )
    doc.close()

    const w = iframe.contentWindow
    if (!w) return

    setTimeout(() => {
      w.focus()
      // No browser, baixar PDF = abrir o diálogo "Salvar como PDF".
      // Aqui o conteúdo é isolado (somente o contrato), sem a página inteira.
      w.print()
      setTimeout(() => iframe.remove(), 250)
    }, 50)
  }

  const handleImportFile = async (file: File) => {
    const name = file.name.toLowerCase()

    if (name.endsWith(".pdf") || file.type === "application/pdf") {
      setImportedPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(file)
      })
      setImportNoticeText("PDF importado como referência. Para editar mantendo formatação, o ideal é importar um DOCX.")
      setImportNoticeOpen(true)
      setEditorView("edit")
      return
    }

    if (
      name.endsWith(".docx") ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      try {
        const mammoth = await import("mammoth")
        const arrayBuffer = await file.arrayBuffer()
        const result = await (mammoth as any).convertToHtml({ arrayBuffer })
        const html = (result?.value as string) || ""
        if (!html.trim()) {
          setImportNoticeText("Não foi possível extrair conteúdo do DOCX.")
          setImportNoticeOpen(true)
          return
        }
        setDraftInitialHtml(html)
        setDraftHtml(html)
        setImportedPdfUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return null
        })
        setEditorView("edit")
      } catch {
        setImportNoticeText("Falha ao importar DOCX. Tente novamente.")
        setImportNoticeOpen(true)
      }
      return
    }

    setImportNoticeText("Formato não suportado. Importação aceita: PDF ou DOCX.")
    setImportNoticeOpen(true)
  }

  useEffect(() => {
    if (step !== "editor") return
    setDraftHtml((prev) => (prev.trim().length > 0 ? prev : draftInitialHtml))
  }, [draftInitialHtml, step])

  useEffect(() => {
    if (step !== "editor" || editorView !== "preview") return

    const iframe = previewIframeRef.current
    if (!iframe) return

    const html = ((draftHtml || draftInitialHtml || "") as string).trim()
      ? (draftHtml || draftInitialHtml)
      : ""

    setPreviewBusy(true)
    setPreviewPages(null)
    setPreviewError(null)
    setPreviewDocHeight(0)

    let cancelled = false
    const onMessage = (event: MessageEvent) => {
      if (cancelled) return
      if (!event.data || event.data?.type !== "paged-preview") return
      if (event.source !== iframe.contentWindow) return
      if (typeof event.data.total === "number") setPreviewPages(event.data.total)
      if (typeof event.data.error === "string" && event.data.error.trim().length > 0) {
        setPreviewError(event.data.error)
      }
      setPreviewBusy(false)

      // Scroll no topo dentro do iframe
      try {
        iframe.contentWindow?.scrollTo?.(0, 0)
      } catch {
        // noop
      }

      // Ajusta a altura do iframe para o conteúdo (scroll no container pai)
      try {
        const h = iframe.contentDocument?.documentElement?.scrollHeight ?? 0
        if (h > 0) setPreviewDocHeight(h)
      } catch {
        // noop
      }
    }
    window.addEventListener("message", onMessage)

    const doc = iframe.contentDocument
    if (!doc) return

    const payloadHtml = JSON.stringify(html)
    const pageCss = `
      @page { size: A4; margin: 18mm 16mm; }
      html, body { background: transparent; }
      body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.6; color: #000; }
      p { margin: 0 0 10px 0; text-align: justify; min-height: 1em; }
      p:empty { min-height: 1.6em; }
      h1 { margin: 0 0 14px 0; text-align: center; text-transform: uppercase; font-weight: 700; font-style: italic; text-decoration: underline; font-size: 12pt; }
      .clause-title { text-align: left; font-weight: 700; font-style: italic; margin: 18px 0 10px 0; }
      hr { border: 0; border-top: 1px solid rgba(0,0,0,.25); margin: 14px 0; }
      hr.page-break { border-top: 0; margin: 16px 0; break-after: page; }
      strong { font-weight: 700; }
      .pagedjs_pages { width: 100%; }
      .pagedjs_page { background: white; margin: 0 auto 14px; box-shadow: 0 8px 28px rgba(0,0,0,.10); border-radius: 10px; overflow: hidden; }
      .pagedjs_pagebox { padding: 0; }
    `

    doc.open()
    doc.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Prévia do contrato</title>
    <style>${pageCss}</style>
  </head>
  <body>
    <script src="https://cdn.jsdelivr.net/npm/pagedjs@0.4.3/dist/paged.js"></script>
    <script>
      (async function () {
        try {
          const html = ${payloadHtml};
          const source = document.createElement("div");
          source.innerHTML = html;
          // Alguns casos precisam do source no DOM para medir layout corretamente
          source.style.position = "absolute";
          source.style.left = "-99999px";
          source.style.top = "0";
          source.style.width = "210mm";
          source.style.visibility = "hidden";
          document.body.appendChild(source);
          const Previewer = (window.Paged && window.Paged.Previewer) ? window.Paged.Previewer : null;
          if (!Previewer) throw new Error("Paged.js não carregou");
          const previewer = new Previewer();
          const flow = await previewer.preview(source, [], document.body);
          try { source.remove(); } catch (e) {}
          window.parent && window.parent.postMessage({ type: "paged-preview", total: flow && flow.total ? flow.total : null, error: "" }, "*");
        } catch (e) {
          try {
            // fallback: mostra o HTML sem paginação
            document.body.innerHTML = ${payloadHtml};
          } catch (e2) {}
          const msg = (e && e.message) ? e.message : "Falha ao gerar prévia";
          window.parent && window.parent.postMessage({ type: "paged-preview", total: null, error: msg }, "*");
        }
      })();
    </script>
  </body>
</html>`)
    doc.close()

    // fallback: mede altura depois de carregar
    setTimeout(() => {
      try {
        const h = iframe.contentDocument?.documentElement?.scrollHeight ?? 0
        if (h > 0) setPreviewDocHeight(h)
      } catch {
        // noop
      }
    }, 400)

    return () => {
      cancelled = true
      window.removeEventListener("message", onMessage)
    }
  }, [draftHtml, draftInitialHtml, editorView, step])

  const addService = () => {
    setServices([
      ...services,
      {
        id: `temp-${Date.now()}`,
        serviceTypeId: "",
        teamIds: [],
        employeeIds: [],
      }
    ])
  }

  const removeService = (id: string) => {
    setServices(services.filter(s => s.id !== id))
  }

  const updateService = (id: string, field: keyof ContractService, value: string | number | string[]) => {
    setServices(services.map(s => {
      if (s.id !== id) return s
      if (field === "serviceTypeId") {
        const serviceType = serviceTypes.find(st => st.id === value)
        return {
          ...s,
          [field]: value as string,
          teamIds: serviceType?.teamIds || [],
        }
      }
      return { ...s, [field]: value }
    }))
  }

  const openEditServiceDialog = (serviceId: string) => {
    setEditingServiceId(serviceId)
    setEditServiceDialogOpen(true)
  }

  const toggleTeamForService = (teamId: string) => {
    if (!editingService) return
    const newTeamIds = editingService.teamIds.includes(teamId)
      ? editingService.teamIds.filter(id => id !== teamId)
      : [...editingService.teamIds, teamId]
    updateService(editingService.id, "teamIds", newTeamIds)
  }

  const toggleEmployeeForService = (employeeId: string) => {
    if (!editingService) return
    const newEmployeeIds = editingService.employeeIds.includes(employeeId)
      ? editingService.employeeIds.filter(id => id !== employeeId)
      : [...editingService.employeeIds, employeeId]
    updateService(editingService.id, "employeeIds", newEmployeeIds)
  }

  const filteredTeams = teams.filter(t =>
    t.name.toLowerCase().includes(teamSearchTerm.toLowerCase())
  )

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
    e.role.toLowerCase().includes(employeeSearchTerm.toLowerCase())
  )

  const toggleUnit = (unitId: string) => {
    setSelectedUnitIds(prev =>
      prev.includes(unitId)
        ? prev.filter(id => id !== unitId)
        : [...prev, unitId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedClientId) {
      toast.error("Selecione um cliente para continuar.")
      return
    }

    if (!selectedTemplateId) {
      toast.error("Selecione um template para continuar.")
      return
    }

    if (createAutomatedInformatives && !selectedInformativeTemplateId) {
      toast.error("Selecione o template de informativo automatizado.")
      return
    }

    if (createAutomatedCertificates && !selectedCertificateTemplateId) {
      toast.error("Selecione o template de certificado automatizado.")
      return
    }

    if (!startDate) {
      toast.error("Preencha a data de início do contrato.")
      return
    }

    if (services.filter((service) => service.serviceTypeId).length === 0) {
      toast.error("Adicione ao menos um serviço ao contrato.")
      return
    }

    const payload = buildContractPayload()

    if (isEditing) {
      if (!contractId) return
      try {
        await updateMutation.mutateAsync({ id: contractId, payload })
        toast.success("Contrato atualizado com sucesso.")
        router.push("/contratos")
      } catch (error) {
        toast.error("Não foi possível atualizar o contrato.")
      }
      return
    }

    try {
      const preview = await previewMutation.mutateAsync(payload)
      const createdAt = new Date()
      setDraftMeta({ contractNumber: preview.data.contractNumber, createdAt })
      setDraftInitialHtml(preview.data.renderedHtml || buildDraftHtml(preview.data.contractNumber, createdAt))
      setDraftHtml(preview.data.renderedHtml || buildDraftHtml(preview.data.contractNumber, createdAt))
      setStep("editor")
    } catch (error) {
      toast.error("Não foi possível gerar a prévia do contrato.")
    }
  }

  const finalizeCreate = async () => {
    try {
      const response = await createMutation.mutateAsync(buildContractPayload(draftHtml || draftInitialHtml))
      setCreatedContractId(response.data.id)
      setDraftMeta((current) =>
        current ?? { contractNumber: response.data.contractNumber, createdAt: new Date(response.data.createdAt) }
      )
      setConfirmCreateOpen(false)
      setStep("done")
    } catch (error) {
      toast.error("Não foi possível criar o contrato.")
    }
  }

  if (!isEditing && step === "editor") {
    const contractNumber = draftMeta?.contractNumber ?? createDraftContractNumber()
    return (
      <div className="space-y-3">
        <input
          ref={importInputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleImportFile(file)
            e.currentTarget.value = ""
          }}
        />

        <Tabs value={editorView} onValueChange={(v) => setEditorView(v as typeof editorView)} className="w-full">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="edit">Editar</TabsTrigger>
              <TabsTrigger value="preview">Prévia</TabsTrigger>
              {importedPdfUrl ? <TabsTrigger value="pdf">PDF importado</TabsTrigger> : null}
            </TabsList>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("form")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao formulário
              </Button>
              <Button type="button" variant="outline" onClick={openImport}>
                <Upload className="w-4 h-4 mr-2" />
                Importar
              </Button>
              <Button
                type="button"
                className="bg-primary hover:bg-primary/90"
                onClick={() => setConfirmCreateOpen(true)}
              >
                <Save className="w-4 h-4 mr-2" />
                Concluir e criar contrato
              </Button>
            </div>
          </div>

          <TabsContent value="edit" className="mt-4">
            <ContractRichEditor valueHtml={draftHtml || draftInitialHtml} onChangeHtml={setDraftHtml} />
          </TabsContent>

          <TabsContent value="preview" className="mt-4" forceMount style={{ display: editorView === "preview" ? undefined : "none" }}>
            {previewError ? (
              <div className="mb-2 rounded-md border bg-destructive/5 text-destructive px-3 py-2 text-xs">
                Não foi possível paginar automaticamente. Mostrando o conteúdo sem paginação. ({previewError})
              </div>
            ) : null}
            <div className="rounded-lg border bg-muted/20 h-[76vh] overflow-auto p-4">
              <iframe
                ref={previewIframeRef}
                title="Prévia paginada do contrato"
                className="w-full bg-white rounded-md"
                style={{ height: previewDocHeight > 0 ? `${previewDocHeight}px` : "100%" }}
              />
            </div>
          </TabsContent>

          {importedPdfUrl ? (
            <TabsContent value="pdf" className="mt-4">
              <div className="rounded-lg border bg-muted/20 overflow-hidden max-h-[76vh]">
                <iframe
                  src={importedPdfUrl ?? undefined}
                  title="PDF importado"
                  className="w-full h-[76vh] bg-white"
                />
              </div>
            </TabsContent>
          ) : null}
        </Tabs>

        <AlertDialog open={importNoticeOpen} onOpenChange={setImportNoticeOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Importação</AlertDialogTitle>
              <AlertDialogDescription>{importNoticeText}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setImportNoticeOpen(false)} className="bg-primary hover:bg-primary/90">
                Entendi
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={confirmCreateOpen} onOpenChange={setConfirmCreateOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Tem certeza que deseja criar este contrato?</AlertDialogTitle>
              <AlertDialogDescription>
                Após assinado no ClickSign, <span className="font-medium text-foreground">não será possível alterá-lo</span>.
                Revise as cláusulas e os dados antes de continuar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar e revisar</AlertDialogCancel>
              <AlertDialogAction onClick={finalizeCreate} className="bg-primary hover:bg-primary/90">
                Criar e enviar para assinatura
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  if (!isEditing && step === "done") {
    const contractNumber = draftMeta?.contractNumber ?? createDraftContractNumber()
    return (
      <Card className="p-4 sm:p-8">
        <div className="flex flex-col items-center text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold mt-4">Contrato criado</h3>
          <p className="text-sm text-muted-foreground mt-1">
            O contrato <span className="font-medium text-foreground">{contractNumber}</span> foi gerado e seguirá para assinatura no ClickSign.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 mt-6 w-full justify-center">
            <Button variant="outline" onClick={() => router.push("/contratos")} className="w-full sm:w-auto">
              Voltar para contratos
            </Button>
            <Button
              onClick={() => router.push(createdContractId ? `/contratos/${createdContractId}` : "/contratos")}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90"
            >
              Ver contrato
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Client Selection */}
      <Card className="p-4 sm:p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          Cliente
        </h3>
        <div className="flex flex-col md:flex-row gap-5">
          <div className="space-y-2 md:w-[340px] shrink-0">
            <Label>Selecionar Cliente *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                  disabled={isEditing}
                >
                  {selectedClientId
                    ? clients.find(c => c.id === selectedClientId)?.companyName
                    : "Selecione um cliente"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar cliente..." />
                  <CommandList>
                    <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                    <CommandGroup>
                      {clients.map((c) => {
                        const totalUnits = c.units?.reduce((sum, u) => sum + (u.unitCount ?? 0), 0) ?? 0
                        return (
                          <CommandItem
                            key={c.id}
                            value={c.companyName}
                            onSelect={() => setSelectedClientId(c.id)}
                            className="cursor-pointer"
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedClientId === c.id ? "opacity-100" : "opacity-0")} />
                            <span>{c.companyName}</span>
                            {totalUnits > 0 && (
                              <span className="text-xs text-muted-foreground ml-1">({totalUnits} unidades)</span>
                            )}
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          {selectedClient && (() => {
            const clientType = getClientTypeById(selectedClient.clientTypeId)
            return (
              <div className="p-3 rounded-lg bg-muted/50 flex items-start gap-3 shrink-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${getColorFromClass(clientType?.color || '')}1A` }}
                >
                  <Building2 className="w-5 h-5" style={{ color: getColorFromClass(clientType?.color || '') }} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{selectedClient.companyName}</p>
                    <Badge
                      style={{ backgroundColor: getColorFromClass(clientType?.color || '') }}
                      className="text-white border-0 hover:opacity-90"
                    >
                      {clientType?.name}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{selectedClient.cnpj}</p>
                  <p className="text-sm text-muted-foreground">{selectedClient.email}</p>
                </div>
              </div>
            )
          })()}
        </div>

        {/* Branch Selection */}
        {selectedClient && selectedClient.units && selectedClient.units.length > 0 && (
          <div className="mt-4">
            <Label className="mb-2 block">Filiais do Contrato</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {selectedClient.units.map((unit) => (
                <label
                  key={unit.id}
                  htmlFor={`unit-${unit.id}`}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedUnitIds.includes(unit.id) ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                >
                  <Checkbox
                    id={`unit-${unit.id}`}
                    checked={selectedUnitIds.includes(unit.id)}
                    onCheckedChange={() => toggleUnit(unit.id)}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{unit.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {unit.address.street}, {unit.address.number} - {unit.address.neighborhood}
                    </p>
                    {unit.unitCount > 0 && (
                      <p className="text-xs text-muted-foreground">{unit.unitCount} unidades</p>
                    )}
                  </div>
                  {unit.isPrimary && (
                    <Badge variant="outline">Matriz</Badge>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Automation Settings */}
      <Card className="p-4 sm:p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Configuração de automatização
        </h3>
        <div className="flex flex-col xl:flex-row gap-5">
          <div className="space-y-2 md:w-[340px] shrink-0">
            <Label>Template do contrato *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  {selectedTemplateId
                    ? templates.find(t => t.id === selectedTemplateId)?.name
                    : "Selecione um template"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar template..." />
                  <CommandList>
                    <CommandEmpty>Nenhum template encontrado.</CommandEmpty>
                    <CommandGroup>
                      {templates.filter(t => t.isActive).map((t) => (
                        <CommandItem
                          key={t.id}
                          value={t.name}
                          onSelect={() => setSelectedTemplateId(t.id)}
                          className="cursor-pointer"
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedTemplateId === t.id ? "opacity-100" : "opacity-0")} />
                          <span>{t.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          {selectedTemplateId && (() => {
            const template = templates.find(t => t.id === selectedTemplateId)
            if (!template) return null
            return (
              <div className="p-3 rounded-lg bg-muted/50 flex items-start gap-3 shrink-0">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{template.name}</p>
                    <Badge className="bg-green-100 text-green-700 border-0 hover:bg-green-100">Ativo</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Atualizado em {new Date(template.updatedAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            )
          })()}
        </div>

        <div className="mt-6 flex max-w-[520px] flex-col gap-4">
          <div className="flex flex-col gap-3">
            <label className={cn(
              "flex min-h-[66px] cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors",
              createAutomatedSchedules ? "border-primary/30 bg-[#eef7e8]" : "border-transparent bg-[#f6faf2] hover:bg-[#eef7e8]"
            )}>
              <Checkbox
                className="mt-0.5"
                checked={createAutomatedSchedules}
                onCheckedChange={(checked) => setCreateAutomatedSchedules(Boolean(checked))}
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-5">Criar agendamentos automatizados</span>
                <span className="block text-xs leading-5 text-muted-foreground">
                  Agendamentos serão criados pela recorrência do contrato.
                </span>
              </span>
            </label>

            <label className={cn(
              "flex min-h-[66px] items-start gap-3 rounded-2xl border px-4 py-3 transition-colors",
              createAutomatedSchedules ? "cursor-pointer" : "cursor-not-allowed opacity-60",
              createAutomatedInformatives ? "border-primary/30 bg-[#eef7e8]" : "border-transparent bg-[#f6faf2] hover:bg-[#eef7e8]"
            )}>
              <Checkbox
                className="mt-0.5"
                checked={createAutomatedInformatives}
                disabled={!createAutomatedSchedules}
                onCheckedChange={(checked) => setCreateAutomatedInformatives(Boolean(checked))}
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-5">Criar informativos automatizados</span>
                <span className="block text-xs leading-5 text-muted-foreground">
                  Um informativo será gerado para cada agendamento.
                </span>
              </span>
            </label>

            <label className={cn(
              "flex min-h-[66px] items-start gap-3 rounded-2xl border px-4 py-3 transition-colors",
              createAutomatedSchedules ? "cursor-pointer" : "cursor-not-allowed opacity-60",
              createAutomatedCertificates ? "border-primary/30 bg-[#eef7e8]" : "border-transparent bg-[#f6faf2] hover:bg-[#eef7e8]"
            )}>
              <Checkbox
                className="mt-0.5"
                checked={createAutomatedCertificates}
                disabled={!createAutomatedSchedules}
                onCheckedChange={(checked) => setCreateAutomatedCertificates(Boolean(checked))}
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-5">Criar certificados automatizados</span>
                <span className="block text-xs leading-5 text-muted-foreground">
                  Um certificado será gerado ao concluir o atendimento.
                </span>
              </span>
            </label>
          </div>

          {(createAutomatedInformatives || createAutomatedCertificates) && (
            <div className="flex flex-col gap-4">
              {createAutomatedInformatives && (
                <div className="space-y-2">
                  <Label>Template do informativo automatizado *</Label>
                  <Select
                    value={selectedInformativeTemplateId || undefined}
                    onValueChange={setSelectedInformativeTemplateId}
                    disabled={activeInformativeTemplates.length === 0}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={activeInformativeTemplates.length > 0 ? "Selecione um template" : "Nenhum template ativo"} />
                    </SelectTrigger>
                    <SelectContent>
                      {activeInformativeTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {createAutomatedCertificates && (
                <div className="space-y-2">
                  <Label>Template do certificado automatizado *</Label>
                  <Select
                    value={selectedCertificateTemplateId || undefined}
                    onValueChange={setSelectedCertificateTemplateId}
                    disabled={activeCertificateTemplates.length === 0}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={activeCertificateTemplates.length > 0 ? "Selecione um template" : "Nenhum template ativo"} />
                    </SelectTrigger>
                    <SelectContent>
                      {activeCertificateTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Contract Details */}
      <Card className="p-4 sm:p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Dados do Contrato
        </h3>
        <div className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <Label>Data Início *</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2 w-[130px]">
            <Label>Nº de Parcelas *</Label>
            <Input
              type="number"
              value={installmentsCount}
              onChange={(e) => setInstallmentsCount(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              required
            />
          </div>
          <div className="space-y-2 w-[130px]">
            <Label>Dia Vencimento *</Label>
            <Input
              type="number"
              value={dueDay}
              onChange={(e) => setDueDay(Math.min(28, Math.max(1, parseInt(e.target.value) || 1)))}
              min={1}
              max={28}
              required
            />
          </div>
          <div className="space-y-2 w-[180px]">
            <Label>Valor do Contrato *</Label>
            <CurrencyInput
              value={contractValue}
              onChange={setContractValue}
            />
          </div>
        </div>
        {startDate && installmentsCount > 0 && (
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <span>Vigência: <strong className="text-foreground">{new Date(`${startDate}T00:00:00`).toLocaleDateString("pt-BR")}</strong> até <strong className="text-foreground">{new Date(`${endDate}T00:00:00`).toLocaleDateString("pt-BR")}</strong></span>
            {totalValue > 0 && installmentsCount > 1 && (
              <span>Parcelas: <strong className="text-foreground">{installmentsCount}x de {formatCurrency(totalValue / installmentsCount)}</strong></span>
            )}
          </div>
        )}
      </Card>

      {/* Contract-level Recurrence */}
      <Card className="p-4 sm:p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-primary" />
          Recorrência das Visitas
        </h3>


        {/* Regras por unidades */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">Regras por número de unidades</p>
              <p className="text-xs text-muted-foreground mt-1">Definem a recorrência com base na quantidade de unidades das filiais selecionadas</p>
            </div>
            <Popover open={addRulePopoverOpen} onOpenChange={setAddRulePopoverOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Regra
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="end">
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                  onClick={() => addContractRule("range")}
                >
                  De - Até
                  <span className="block text-xs text-muted-foreground">Intervalo de unidades</span>
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                  onClick={() => addContractRule("above")}
                >
                  Acima de
                  <span className="block text-xs text-muted-foreground">Acima de X unidades</span>
                </button>
              </PopoverContent>
            </Popover>
          </div>

          {selectedTotalUnitCount > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="secondary">
                {selectedTotalUnitCount} unidades selecionadas
              </Badge>
              <span className="text-sm text-muted-foreground">→</span>
              <Badge className="bg-primary text-primary-foreground">
                {getRecurrenceLabel(contractRecurrence)}
              </Badge>
            </div>
          )}

          {contractRecurrenceRules.length > 0 ? (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left font-medium text-xs px-3 py-2">Tipo</th>
                    <th className="text-left font-medium text-xs px-3 py-2">Condição</th>
                    <th className="text-left font-medium text-xs px-3 py-2">Recorrência</th>
                    <th className="w-10 px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {contractRecurrenceRules.map((rule, idx) => {
                    const isActiveRule = selectedTotalUnitCount > 0 && (
                      (rule.type === "range" && selectedTotalUnitCount >= rule.minUnits && selectedTotalUnitCount <= rule.maxUnits) ||
                      (rule.type === "above" && selectedTotalUnitCount > rule.minUnits)
                    )
                    return (
                      <tr key={idx} className={cn("border-b last:border-b-0", isActiveRule && "bg-primary/5")}>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                            {rule.type === "range" ? "De - Até" : "Acima de"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          {rule.type === "range" ? (
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="number"
                                className="w-20 h-7 text-xs"
                                value={rule.minUnits}
                                onChange={(e) => updateContractRule(idx, "minUnits", Number(e.target.value) || 1)}
                                min={1}
                              />
                              <span className="text-muted-foreground text-xs">até</span>
                              <Input
                                type="number"
                                className="w-20 h-7 text-xs"
                                value={rule.maxUnits}
                                onChange={(e) => updateContractRule(idx, "maxUnits", Number(e.target.value) || 1)}
                                min={1}
                              />
                              <span className="text-muted-foreground whitespace-nowrap text-xs">unid.</span>
                              {isActiveRule && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Aplicada</Badge>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="number"
                                className="w-20 h-7 text-xs"
                                value={rule.minUnits}
                                onChange={(e) => updateContractRule(idx, "minUnits", Number(e.target.value) || 1)}
                                min={1}
                              />
                              <span className="text-muted-foreground whitespace-nowrap text-xs">unid.</span>
                              {isActiveRule && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Aplicada</Badge>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Select
                            value={rule.recurrence}
                            onValueChange={(v) => updateContractRule(idx, "recurrence", v)}
                          >
                            <SelectTrigger className="w-[140px] h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="weekly">Semanal</SelectItem>
                              <SelectItem value="biweekly">Quinzenal</SelectItem>
                              <SelectItem value="monthly">Mensal</SelectItem>
                              <SelectItem value="bimonthly">Bimestral</SelectItem>
                              <SelectItem value="quarterly">Trimestral</SelectItem>
                              <SelectItem value="semiannual">Semestral</SelectItem>
                              <SelectItem value="annual">Anual</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeContractRule(idx)}
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Nenhuma regra configurada. A recorrência padrão será utilizada.</p>
          )}
        </div>
      </Card>

      {/* Services */}
      <Card className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            Serviços do Contrato
          </h3>
          <Button type="button" variant="outline" size="sm" onClick={addService}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Serviço
          </Button>
        </div>

        {services.length > 0 ? (
          <div className="pb-2 rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Serviço</TableHead>
                  <TableHead>Equipes / Funcionários</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => {
                  const serviceTeams = teams.filter(t => service.teamIds.includes(t.id))
                  const serviceEmployees = employees.filter(e => service.employeeIds.includes(e.id))
                  return (
                    <TableRow key={service.id} className="hover:bg-transparent !border-0">
                      <TableCell className="w-[220px]">
                        <Select
                          value={service.serviceTypeId}
                          onValueChange={(v) => updateService(service.id, "serviceTypeId", v)}
                        >
                          <SelectTrigger className="w-full min-w-[220px]">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {serviceTypes.map((st) => (
                              <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5 max-w-[280px]">
                          {serviceTeams.map(t => (
                            <Badge
                              key={t.id}
                              variant="secondary"
                              className="px-3 py-1 flex items-center gap-2 text-xs text-foreground/80"
                              style={{ backgroundColor: `${t.color}1A` }}
                            >
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                              {t.name}
                            </Badge>
                          ))}
                          {serviceEmployees.map(e => (
                            <Badge key={e.id} variant="outline" className="px-3 py-1 text-xs">
                              {e.name}
                            </Badge>
                          ))}
                          {serviceTeams.length === 0 && serviceEmployees.length === 0 && (
                            <span className="text-sm text-muted-foreground">Nenhum</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditServiceDialog(service.id)}
                            title="Editar equipes e funcionários"
                          >
                            <Users className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeService(service.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground rounded-lg">
            <p>Nenhum serviço adicionado</p>
            <p className="text-sm">Clique em "Adicionar Serviço" para começar</p>
          </div>
        )}

      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.push("/contratos")}>
          Cancelar
        </Button>
        <Button type="submit" className="bg-primary hover:bg-primary/90">
          <Save className="w-4 h-4 mr-2" />
          {isEditing ? "Salvar Alterações" : "Criar Contrato"}
        </Button>
      </div>

      {/* Edit Service Dialog - Teams and Employees */}
      <Dialog open={editServiceDialogOpen} onOpenChange={setEditServiceDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Equipes e Funcionários</DialogTitle>
          </DialogHeader>
          {editingService && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Equipes</Label>
                <Popover open={teamsPopoverOpen} onOpenChange={setTeamsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      <span className="text-muted-foreground">Buscar e adicionar equipes...</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Buscar equipe..."
                        value={teamSearchTerm}
                        onValueChange={setTeamSearchTerm}
                      />
                      <CommandList>
                        <CommandEmpty>Nenhuma equipe encontrada.</CommandEmpty>
                        <CommandGroup>
                          {filteredTeams.map((team) => (
                            <CommandItem
                              key={team.id}
                              value={team.name}
                              onSelect={() => toggleTeamForService(team.id)}
                              className="cursor-pointer"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  editingService.teamIds.includes(team.id) ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span>{team.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {editingService.teamIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {editingService.teamIds.map(teamId => {
                      const team = teams.find(t => t.id === teamId)
                      const teamColor = team ? getColorFromClass(team.color) : "#94A3B8"
                      return team ? (
                        <Badge
                          key={teamId}
                          variant="secondary"
                          className="px-3 py-1 flex items-center gap-2 text-foreground/80"
                          style={{ backgroundColor: `${teamColor}1A` }}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: teamColor }}
                          />
                          <span>{team.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-3.5 w-3.5 p-0 hover:bg-transparent"
                            onClick={() => toggleTeamForService(teamId)}
                          >
                            <X className="h-2.5 w-2.5" />
                          </Button>
                        </Badge>
                      ) : null
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Funcionários Avulsos</Label>
                <Popover open={employeesPopoverOpen} onOpenChange={setEmployeesPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      <span className="text-muted-foreground">Buscar e adicionar funcionários...</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Buscar funcionário..."
                        value={employeeSearchTerm}
                        onValueChange={setEmployeeSearchTerm}
                      />
                      <CommandList>
                        <CommandEmpty>Nenhum funcionário encontrado.</CommandEmpty>
                        <CommandGroup>
                          {filteredEmployees.map((emp) => (
                            <CommandItem
                              key={emp.id}
                              value={emp.name}
                              onSelect={() => toggleEmployeeForService(emp.id)}
                              className="cursor-pointer"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  editingService.employeeIds.includes(emp.id) ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{emp.name}</span>
                                <span className="text-sm text-muted-foreground">{emp.role}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {editingService.employeeIds.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {editingService.employeeIds.map(empId => {
                      const emp = employees.find(e => e.id === empId)
                      return emp ? (
                        <Badge key={empId} variant="outline" className="px-3 py-1 flex items-center gap-2">
                          <span>{emp.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-3.5 w-3.5 p-0 hover:bg-transparent"
                            onClick={() => toggleEmployeeForService(empId)}
                          >
                            <X className="h-2.5 w-2.5" />
                          </Button>
                        </Badge>
                      ) : null
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => setEditServiceDialogOpen(false)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Concluir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </form>
  )
}
