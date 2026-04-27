"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Braces, Download, Edit, Eye, FileText, ImageIcon, PenTool, Plus, Search, Trash2, Upload, X } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast as sonnerToast } from "sonner"

import { DocxTemplateEditor, type DocxTemplateEditorRef } from "@/components/templates/docx-template-editor"
import {
  getTemplateVariableGroups,
} from "@/components/templates/template-variables"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog"
import { DataPagination } from "@/components/ui/data-pagination"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { listClients, type ClientRecord, type ClientUnitRecord } from "@/lib/api/clients"
import { listContracts, type ContractRecord } from "@/lib/api/contracts"
import { listEmployees } from "@/lib/api/employees"
import { listSchedules, type ScheduleRecord } from "@/lib/api/schedules"
import { listServices, type ServiceRecord } from "@/lib/api/services"
import {
  createTemplate,
  deleteTemplate,
  getTemplateById,
  listTemplates,
  type TemplateFormat,
  type TemplateKind,
  type TemplateRecord,
  updateTemplate,
  uploadTemplateBaseFile,
  uploadTemplateWatermarkFile,
} from "@/lib/api/templates"
import { buildApiFileUrl } from "@/lib/api/client"
import { useUrlQueryState } from "@/lib/hooks/use-url-query-state"

export type ContractTemplate = TemplateRecord
export const mockTemplates: ContractTemplate[] = []

const TEMPLATE_CONFIG = {
  contract: {
    label: "Contrato",
    pluralLabel: "contratos",
    searchKey: "q",
    requiresSigner: true,
    signerLabel: "Assinante (Contratada)",
  },
  informative: {
    label: "Informativo",
    pluralLabel: "informativos",
    searchKey: "q-informativos",
    requiresSigner: false,
    signerLabel: "",
  },
  certificate: {
    label: "Certificado",
    pluralLabel: "certificados",
    searchKey: "q-certificados",
    requiresSigner: false,
    signerLabel: "",
  },
} as const satisfies Record<
  TemplateKind,
  {
    label: string
    pluralLabel: string
    searchKey: string
    requiresSigner: boolean
    signerLabel: string
  }
>

export interface EditorState {
  isOpen: boolean
  isEditing: boolean
  name: string
  canSave: boolean
  isSaving: boolean
  onSave: () => void
  onCancel: () => void
}

type TemplateFormState = {
  name: string
  description: string
  baseFileName: string
  format: TemplateFormat
  html: string
  signerId: string
  isActive: boolean
  watermarkFileName: string
  watermarkFileUrl: string
  informativeSendDaysBefore: number
  certificateSendDaysAfter: number
}

type TemplateEditorTab = "editor" | "preview"

function getTemplateEditorTab(value: string | null): TemplateEditorTab {
  return value === "preview" ? "preview" : "editor"
}

interface TemplatesContentProps {
  kind: TemplateKind
  openImport?: boolean
  onImportChange?: (open: boolean) => void
  onEditorStateChange?: (state: EditorState) => void
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível concluir a operação."
}

function notify({
  title,
  description,
  variant,
}: {
  title: string
  description?: string
  variant?: "destructive"
}) {
  if (variant === "destructive") {
    sonnerToast.error(title, { description })
    return
  }

  sonnerToast.success(title, { description })
}

function formatDate(value?: string | Date | null) {
  if (!value) return ""
  const parsed = value instanceof Date ? value : new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value)
  if (Number.isNaN(parsed.getTime())) return ""
  return new Intl.DateTimeFormat("pt-BR").format(parsed)
}

function formatLongDate(value = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value)
}

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(Number(value ?? 0))
}

function formatCnpj(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "").slice(0, 14)
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
}

function getUnitAddress(unit?: ClientUnitRecord | null) {
  if (!unit?.address) return ""

  const { street, number, complement, neighborhood, city, state, zipCode } = unit.address
  return `${street}, ${number}${complement ? ` - ${complement}` : ""} - ${neighborhood} - ${city}/${state}${zipCode ? `, CEP ${zipCode}` : ""}`
}

function getUnitAddressFull(unit?: ClientUnitRecord | null) {
  if (!unit?.address) return ""

  const { street, number, neighborhood, city, state } = unit.address
  return `${street}, ${number}, Bairro ${neighborhood}, ${city}/${state}`
}

function getPrimaryUnit(client?: ClientRecord | null, unitIds: string[] = []) {
  if (!client) return null
  return (
    client.units.find((unit) => unitIds.includes(unit.id)) ??
    client.units.find((unit) => unit.isPrimary) ??
    client.units[0] ??
    null
  )
}

function recurrenceLabel(value?: string | null) {
  const labels: Record<string, string> = {
    annual: "Anual",
    biweekly: "Quinzenal",
    bimonthly: "Bimestral",
    monthly: "Mensal",
    quarterly: "Trimestral",
    semiannual: "Semestral",
    weekly: "Semanal",
  }

  return labels[value ?? ""] ?? value ?? ""
}

function buildServiceSectionsText(contract: ContractRecord, services: ServiceRecord[]) {
  return contract.services
    .map((item, index) => {
      const service = services.find((candidate) => candidate.id === item.serviceTypeId)
      const serviceName = service?.name ?? "Serviço"
      const clauses = item.clauses?.length
        ? item.clauses.map((clause, clauseIndex) => `${index + 1}.${clauseIndex + 1}. ${clause}`).join("\n")
        : `${index + 1}.1. Cláusulas específicas não informadas para este serviço.`

      return `${index + 1}. ${serviceName}\n${clauses}`
    })
    .join("\n\n")
}

function buildReservoirRows(unit?: ClientUnitRecord | null) {
  const entries = unit?.reservoirProfile?.entries ?? []
  return Array.from({ length: 5 }, (_, index) => entries[index] ?? { label: "", capacityLiters: "" })
}

function buildPreviewVariables(params: {
  client?: ClientRecord
  contract?: ContractRecord
  employeeName?: string
  kind: TemplateKind
  schedule?: ScheduleRecord
  services: ServiceRecord[]
}) {
  const { client, contract, employeeName, kind, schedule, services } = params
  if (!client) return null

  const unit = contract
    ? getPrimaryUnit(client, contract.unitIds)
    : getPrimaryUnit(client, schedule?.unitId ? [schedule.unitId] : [])
  const service = schedule ? services.find((item) => item.id === schedule.serviceTypeId) : null
  const scheduleDate = formatDate(schedule?.date)
  const scheduleTime = (schedule?.time || "08:00").replace(":00", "h")
  const reservoirRows = buildReservoirRows(unit)
  const validityMonths = Number(unit?.reservoirProfile?.validityMonths ?? 6) || 6
  const installmentValue =
    contract && contract.installmentsCount > 0 ? contract.totalValue / contract.installmentsCount : contract?.totalValue ?? 0
  const contractServiceNames =
    contract?.services
      .map((item) => services.find((serviceItem) => serviceItem.id === item.serviceTypeId)?.name)
      .filter(Boolean)
      .join(", ") || ""
  const serviceSectionsText = contract ? buildServiceSectionsText(contract, services) : ""

  const base = {
    client: {
      address: getUnitAddress(unit),
      cnpj: formatCnpj(client.cnpj),
      companyName: client.companyName,
      email: client.email,
      phone: client.phone,
      responsibleName: client.responsibleName,
    },
    contractor: {
      address: "Rua Um, 23 - Brigadeira - Canoas/RS - CEP 92425-692",
      cnpj: "21.602.658/0001-43",
      email: "contato@depcleanrs.com.br",
      legalName: "Depclean Soluções Ambientais LTDA",
      signerName: employeeName || "Melina Costa",
      signerRole: "Sócia administradora",
    },
    document: {
      generatedDate: formatDate(new Date()),
      generatedDateLong: formatLongDate(),
    },
    service: {
      name: service?.name ?? contractServiceNames,
      description: service?.description ?? "",
    },
    unit: {
      address: {
        city: unit?.address.city ?? "",
        cityState: unit ? `${unit.address.city.toUpperCase()} /${unit.address.state}` : "",
        full: getUnitAddressFull(unit),
        neighborhood: unit?.address.neighborhood ?? "",
        number: unit?.address.number ?? "",
        state: unit?.address.state ?? "",
        street: unit?.address.street ?? "",
        zipCode: unit?.address.zipCode ?? "",
      },
      name: unit?.name ?? "",
      reservoirProfile: {
        observations: unit?.reservoirProfile?.observations ?? "",
        validityMonths: String(validityMonths),
      },
    },
  }

  if (kind === "contract" && contract) {
    return {
      ...base,
      contract: {
        createdAt: formatDate(contract.createdAt),
        durationMonths: String(contract.duration),
        endDate: formatDate(contract.endDate),
        firstDueDate: formatDate(contract.installments[0]?.dueDate),
        installmentValue: formatCurrency(installmentValue),
        installmentsCount: String(contract.installmentsCount),
        number: contract.contractNumber,
        paymentDay: String(contract.paymentDay).padStart(2, "0"),
        recurrence: recurrenceLabel(contract.recurrence),
        startDate: formatDate(contract.startDate),
        totalValue: formatCurrency(contract.totalValue),
      },
      services: {
        names: contractServiceNames,
        sectionsHtml: serviceSectionsText,
        sectionsText: serviceSectionsText,
        summary: contractServiceNames.toLowerCase(),
      },
    }
  }

  return {
    ...base,
    certificate: {
      executionDatesText: scheduleDate,
      observations: unit?.reservoirProfile?.observations || schedule?.notes || "",
      reservoirRow1Capacity: reservoirRows[0]?.capacityLiters ?? "",
      reservoirRow1Label: reservoirRows[0]?.label ?? "",
      reservoirRow2Capacity: reservoirRows[1]?.capacityLiters ?? "",
      reservoirRow2Label: reservoirRows[1]?.label ?? "",
      reservoirRow3Capacity: reservoirRows[2]?.capacityLiters ?? "",
      reservoirRow3Label: reservoirRows[2]?.label ?? "",
      reservoirRow4Capacity: reservoirRows[3]?.capacityLiters ?? "",
      reservoirRow4Label: reservoirRows[3]?.label ?? "",
      reservoirRow5Capacity: reservoirRows[4]?.capacityLiters ?? "",
      reservoirRow5Label: reservoirRows[4]?.label ?? "",
      validityText: `${String(validityMonths).padStart(2, "0")} ${validityMonths === 1 ? "mês" : "meses"}`,
    },
    schedule: {
      date: scheduleDate,
      duration: schedule ? `${schedule.duration} min` : "",
      time: scheduleTime,
    },
  }
}

export function TemplatesContent({ kind, openImport, onImportChange, onEditorStateChange }: TemplatesContentProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const config = TEMPLATE_CONFIG[kind]
  const docxEditorRef = useRef<DocxTemplateEditorRef | null>(null)
  const closingEditorRef = useRef(false)
  const routeTemplateId = searchParams.get("template")
  const routeTemplateMode = searchParams.get("templateMode")
  const routeEditorTab = getTemplateEditorTab(searchParams.get("view"))
  const [searchTerm, setSearchTerm] = useUrlQueryState(config.searchKey)
  const [editingTemplate, setEditingTemplate] = useState<TemplateRecord | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [editorTab, setEditorTab] = useState<TemplateEditorTab>("editor")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null)
  const [previewClientId, setPreviewClientId] = useState("")
  const [previewDocumentId, setPreviewDocumentId] = useState("")
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [selectedWatermarkFile, setSelectedWatermarkFile] = useState<File | null>(null)
  const [selectedWatermarkPreviewUrl, setSelectedWatermarkPreviewUrl] = useState("")

  const [formData, setFormData] = useState<TemplateFormState>({
    name: "",
    description: "",
    baseFileName: "",
    format: "docx",
    html: "",
    signerId: "",
    isActive: true,
    watermarkFileName: "",
    watermarkFileUrl: "",
    informativeSendDaysBefore: 1,
    certificateSendDaysAfter: 0,
  })

  const templatesQuery = useQuery({
    queryKey: ["templates", kind, searchTerm],
    queryFn: () => listTemplates(searchTerm, kind),
  })

  const employeesQuery = useQuery({
    queryKey: ["employees", "templates"],
    queryFn: () => listEmployees(""),
  })

  const clientsQuery = useQuery({
    enabled: isEditorOpen,
    queryKey: ["clients", "templates-preview"],
    queryFn: () => listClients(""),
  })

  const contractsQuery = useQuery({
    enabled: isEditorOpen,
    queryKey: ["contracts", "templates-preview"],
    queryFn: () => listContracts(""),
  })

  const schedulesQuery = useQuery({
    enabled: isEditorOpen,
    queryKey: ["schedules", "templates-preview"],
    queryFn: () => listSchedules({}),
  })

  const servicesQuery = useQuery({
    enabled: isEditorOpen,
    queryKey: ["services", "templates-preview"],
    queryFn: () => listServices(""),
  })

  const templates = templatesQuery.data?.data ?? []
  const totalPages = Math.max(1, Math.ceil(templates.length / pageSize))
  const paginatedTemplates = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return templates.slice(start, start + pageSize)
  }, [currentPage, pageSize, templates])
  const routeTemplateFromList = routeTemplateId ? templates.find((template) => template.id === routeTemplateId) : null

  const routeTemplateQuery = useQuery({
    enabled: Boolean(routeTemplateId && !routeTemplateFromList),
    queryKey: ["template", routeTemplateId],
    queryFn: () => getTemplateById(routeTemplateId ?? ""),
  })

  const routeTemplate = routeTemplateFromList ?? routeTemplateQuery.data?.data ?? null
  const employees = employeesQuery.data?.data ?? []
  const clients = clientsQuery.data?.data ?? []
  const contracts = contractsQuery.data?.data ?? []
  const schedules = schedulesQuery.data?.data ?? []
  const services = servicesQuery.data?.data ?? []
  const variableGroups = useMemo(() => getTemplateVariableGroups(kind), [kind])
  const watermarkImageUrl = selectedWatermarkPreviewUrl || (formData.watermarkFileUrl ? buildApiFileUrl(formData.watermarkFileUrl) : "")

  const previewClient = clients.find((client) => client.id === previewClientId)
  const previewContracts = contracts.filter((contract) => contract.clientId === previewClientId)
  const previewSchedules = schedules.filter((schedule) => schedule.clientId === previewClientId)
  const selectedPreviewContract = contracts.find((contract) => contract.id === previewDocumentId)
  const selectedPreviewSchedule = schedules.find((schedule) => schedule.id === previewDocumentId)
  const previewVariables = useMemo(
    () =>
      buildPreviewVariables({
        client: previewClient,
        contract: kind === "contract" ? selectedPreviewContract : undefined,
        employeeName: employees.find((employee) => employee.id === formData.signerId)?.name,
        kind,
        schedule: kind === "contract" ? undefined : selectedPreviewSchedule,
        services,
      }),
    [employees, formData.signerId, kind, previewClient, selectedPreviewContract, selectedPreviewSchedule, services],
  )
  const previewDataKey = [
    kind,
    previewClientId,
    previewDocumentId,
    clientsQuery.dataUpdatedAt,
    contractsQuery.dataUpdatedAt,
    schedulesQuery.dataUpdatedAt,
    servicesQuery.dataUpdatedAt,
  ].join(":")

  const replaceRouteParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())

      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          params.set(key, value)
        } else {
          params.delete(key)
        }
      })

      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  useEffect(() => {
    return () => {
      if (selectedWatermarkPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(selectedWatermarkPreviewUrl)
      }
    }
  }, [selectedWatermarkPreviewUrl])

  useEffect(() => {
    setEditingTemplate(null)
    setIsEditorOpen(false)
    setIsImportOpen(false)
    setEditorTab("editor")
    setCurrentPage(1)
    setPreviewClientId("")
    setPreviewDocumentId("")
    setSelectedWatermarkFile(null)
    setSelectedWatermarkPreviewUrl("")
    setFormData({
      name: "",
      description: "",
      baseFileName: "",
      format: "docx",
      html: "",
      signerId: "",
      isActive: true,
      watermarkFileName: "",
      watermarkFileUrl: "",
      informativeSendDaysBefore: 1,
      certificateSendDaysAfter: 0,
    })
  }, [kind])

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  useEffect(() => {
    if (closingEditorRef.current) {
      if (!routeTemplateId && routeTemplateMode !== "new") {
        closingEditorRef.current = false
      }

      return
    }

    if (routeTemplateId) {
      if (!routeTemplate || routeTemplate.kind !== kind) return

      if (isEditorOpen && editingTemplate?.id === routeTemplate.id) {
        setEditorTab((current) => (current === routeEditorTab ? current : routeEditorTab))
        return
      }

      openTemplateEditor(routeTemplate, routeEditorTab)
      return
    }

    if (routeTemplateMode === "new") {
      if (isEditorOpen && !editingTemplate) {
        setEditorTab((current) => (current === routeEditorTab ? current : routeEditorTab))
        return
      }

      openNewTemplateEditor(routeEditorTab)
    }
  }, [editingTemplate, isEditorOpen, kind, routeEditorTab, routeTemplate, routeTemplateId, routeTemplateMode])

  useEffect(() => {
    setPreviewDocumentId("")
  }, [kind, previewClientId])

  function prepareNewTemplateForm() {
    setEditingTemplate(null)
    setSelectedWatermarkFile(null)
    setSelectedWatermarkPreviewUrl("")
    setFormData({
      name: "",
      description: "",
      baseFileName: "",
      format: "docx",
      html: "",
      signerId: "",
      isActive: true,
      watermarkFileName: "",
      watermarkFileUrl: "",
      informativeSendDaysBefore: 1,
      certificateSendDaysAfter: 0,
    })
  }

  useEffect(() => {
    if (!openImport) return

    prepareNewTemplateForm()
    setIsImportOpen(true)
    onImportChange?.(false)
  }, [onImportChange, openImport])

  function handleOpenImportDialog() {
    prepareNewTemplateForm()
    setIsImportOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const docxFile = await docxEditorRef.current?.saveToFile()

      if (!docxFile) {
        throw new Error("O editor DOCX ainda não carregou o documento para salvar.")
      }

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        kind,
        format: "docx" as const,
        html: formData.html,
        signerId: config.requiresSigner ? formData.signerId : "",
        baseFileName: docxFile.name,
        isActive: formData.isActive,
        watermarkFileName: formData.watermarkFileName,
        informativeSendDaysBefore: kind === "informative" ? formData.informativeSendDaysBefore : 0,
        certificateSendDaysAfter: kind === "certificate" ? formData.certificateSendDaysAfter : 0,
      }

      let template = editingTemplate
        ? (await updateTemplate(editingTemplate.id, payload)).data
        : (await createTemplate(payload)).data

      if (selectedWatermarkFile) {
        template = (await uploadTemplateWatermarkFile(template.id, selectedWatermarkFile)).data
      }

      const uploadResponse = await uploadTemplateBaseFile(template.id, docxFile)
      return uploadResponse.data
    },
    onSuccess: (savedTemplate) => {
      notify({
        title: editingTemplate ? "Template atualizado" : "Template criado",
        description: "O template foi salvo com sucesso.",
      })
      queryClient.invalidateQueries({ queryKey: ["templates"] })
      setEditingTemplate(savedTemplate)
      setFormData((current) => ({
        ...current,
        name: savedTemplate.name,
        description: savedTemplate.description,
        baseFileName: savedTemplate.baseFileName || current.baseFileName,
        format: savedTemplate.format || "docx",
        html: savedTemplate.html || "",
        signerId: savedTemplate.signerId || "",
        isActive: savedTemplate.isActive,
        watermarkFileName: savedTemplate.watermarkFileName || "",
        watermarkFileUrl: savedTemplate.watermarkFileUrl || "",
      }))
      setSelectedWatermarkFile(null)
      setSelectedWatermarkPreviewUrl("")
      replaceRouteParams({
        template: savedTemplate.id,
        templateMode: null,
        view: editorTab,
      })
    },
    onError: (error) => {
      notify({
        title: "Erro ao salvar template",
        description: getErrorMessage(error),
        variant: "destructive",
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      notify({
        title: "Template excluído",
        description: "O template foi removido com sucesso.",
      })
      queryClient.invalidateQueries({ queryKey: ["templates"] })
      setPendingDelete(null)
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateTemplate(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] })
    },
  })

  useEffect(() => {
    onEditorStateChange?.({
      isOpen: isEditorOpen,
      isEditing: Boolean(editingTemplate),
      name: formData.name,
      canSave: Boolean(formData.name.trim() && (!config.requiresSigner || formData.signerId)) && !saveMutation.isPending,
      isSaving: saveMutation.isPending,
      onSave: handleSave,
      onCancel: handleCancel,
    })
  })

  function openTemplateEditor(template: TemplateRecord, nextTab: TemplateEditorTab = "editor") {
    closingEditorRef.current = false
    setEditingTemplate(template)
    setSelectedWatermarkFile(null)
    setSelectedWatermarkPreviewUrl("")
    setFormData({
      name: template.name,
      description: template.description,
      baseFileName: template.baseFileName || "",
      format: template.format || "docx",
      html: template.html || "",
      signerId: template.signerId,
      isActive: template.isActive,
      watermarkFileName: template.watermarkFileName || "",
      watermarkFileUrl: template.watermarkFileUrl || "",
      informativeSendDaysBefore: template.informativeSendDaysBefore ?? 1,
      certificateSendDaysAfter: template.certificateSendDaysAfter ?? 0,
    })
    setEditorTab(nextTab)
    setPreviewClientId("")
    setPreviewDocumentId("")
    setIsEditorOpen(true)
  }

  function openNewTemplateEditor(nextTab: TemplateEditorTab = "editor") {
    closingEditorRef.current = false
    setEditingTemplate(null)
    setSelectedWatermarkFile(null)
    setSelectedWatermarkPreviewUrl("")
    setFormData({
      name: "",
      description: "",
      baseFileName: "",
      format: "docx",
      html: "",
      signerId: "",
      isActive: true,
      watermarkFileName: "",
      watermarkFileUrl: "",
      informativeSendDaysBefore: 1,
      certificateSendDaysAfter: 0,
    })
    setEditorTab(nextTab)
    setPreviewClientId("")
    setPreviewDocumentId("")
    setIsEditorOpen(true)
  }

  function handleEdit(template: TemplateRecord) {
    openTemplateEditor(template, "editor")
    replaceRouteParams({
      template: template.id,
      templateMode: null,
      view: "editor",
    })
  }

  function handleImportSubmit(event: React.FormEvent) {
    event.preventDefault()
    setIsImportOpen(false)
    openNewTemplateEditor("editor")
    replaceRouteParams({
      template: null,
      templateMode: "new",
      view: "editor",
    })
  }

  function handleSave() {
    if (saveMutation.isPending) return

    if (!formData.name.trim() || (config.requiresSigner && !formData.signerId)) {
      notify({
        title: "Campos obrigatórios",
        description: config.requiresSigner
          ? "Preencha nome e assinante antes de salvar."
          : "Preencha o nome do template antes de salvar.",
      })
      return
    }

    const loadingToast = sonnerToast.loading("Salvando template...", {
      description: "Gerando o DOCX atual e enviando para a API.",
    })

    saveMutation.mutate(undefined, {
      onSettled: () => sonnerToast.dismiss(loadingToast),
    })
  }

  function handleCancel() {
    closingEditorRef.current = true
    setIsEditorOpen(false)
    setEditingTemplate(null)
    replaceRouteParams({
      tab: kind,
      template: null,
      templateMode: null,
      view: null,
    })
  }

  function handleEditorTabChange(nextTab: TemplateEditorTab) {
    if (nextTab !== "preview" || editorTab === "preview") {
      setEditorTab(nextTab)
      replaceRouteParams({ view: nextTab })
      return
    }

    const previewPromise = docxEditorRef.current?.refreshPreview()
    if (!previewPromise) {
      setEditorTab("preview")
      replaceRouteParams({ view: "preview" })
      return
    }

    void previewPromise
      .then(() => {
        setEditorTab("preview")
        replaceRouteParams({ view: "preview" })
      })
      .catch((error) => {
        notify({
          title: "Não foi possível atualizar a prévia",
          description: getErrorMessage(error),
          variant: "destructive",
        })
      })
  }

  function handleInsertVariable(path: string) {
    try {
      docxEditorRef.current?.insertVariable(path)
      notify({
        title: "Variável inserida",
        description: path,
      })
    } catch (error) {
      notify({
        title: "Não foi possível inserir a variável",
        description: getErrorMessage(error),
        variant: "destructive",
      })
    }
  }

  function handleSelectVariable(path: string) {
    handleInsertVariable(path)
  }

  function handleSelectVariablePath(_path: string) {}

  function handleWatermarkFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file) return

    if (!file.type.startsWith("image/")) {
      notify({
        title: "Imagem inválida",
        description: "Selecione uma imagem PNG, JPG ou WEBP.",
        variant: "destructive",
      })
      return
    }

    setSelectedWatermarkFile(file)
    setSelectedWatermarkPreviewUrl(URL.createObjectURL(file))
    setFormData((current) => ({
      ...current,
      watermarkFileName: file.name,
    }))
  }

  function handleRemoveWatermark() {
    setSelectedWatermarkFile(null)
    setSelectedWatermarkPreviewUrl("")
    setFormData((current) => ({
      ...current,
      watermarkFileName: "",
      watermarkFileUrl: "",
    }))
  }

  async function handleGeneratePreviewPdf() {
    try {
      setIsGeneratingPdf(true)
      const file = await docxEditorRef.current?.generatePreviewPdf()

      notify({
        title: "PDF gerado para teste",
        description: file ? `Arquivo ${file.name} baixado com a prévia atual.` : "A prévia ainda não carregou.",
      })
    } catch (error) {
      notify({
        title: "Erro ao gerar PDF",
        description: getErrorMessage(error),
        variant: "destructive",
      })
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const getSignerName = (id: string) => employees.find((employee) => employee.id === id)?.name || "-"

  if (isEditorOpen) {
    return (
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
        <Tabs
          value={editorTab}
          onValueChange={(value) => handleEditorTabChange(value as TemplateEditorTab)}
          className="flex h-[calc(100dvh-170px)] min-h-[760px] min-w-0 flex-col"
        >
          <TabsList className="mb-3 shrink-0">
            <TabsTrigger value="editor" className="gap-1.5">
              <Edit className="h-3.5 w-3.5" />
              Editar
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              Prévia
            </TabsTrigger>
          </TabsList>

          <DocxTemplateEditor
            ref={docxEditorRef}
            activeTab={editorTab}
            baseFileName={formData.baseFileName}
            kind={kind}
            onBaseFileNameChange={(fileName) =>
              setFormData((current) => ({
                ...current,
                baseFileName: fileName,
                format: "docx",
              }))
            }
            onVariableTokenClick={handleSelectVariablePath}
            previewDataKey={previewDataKey}
            previewVariables={previewVariables}
            templateFormat={formData.format}
            templateId={editingTemplate?.id}
            templateName={formData.name || config.label}
            watermarkImageUrl={watermarkImageUrl}
          />

        </Tabs>

        <Card className="h-[calc(100dvh-170px)] min-h-[760px] overflow-hidden xl:sticky xl:top-4 xl:mt-[55px]">
          <CardContent className="flex h-full min-h-0 flex-col gap-4 overflow-hidden px-0 pt-4">
            {editorTab === "preview" ? (
              <>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pr-8 pb-1">
                <div>
                  <h3 className="text-base font-semibold">Dados da prévia</h3>
                  <p className="text-sm text-muted-foreground">
                    Escolha um cliente e um {kind === "contract" ? "contrato" : config.label.toLowerCase()} para
                    preencher os campos do DOCX.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preview-client">Cliente</Label>
                  <Select
                    value={previewClientId}
                    onValueChange={(value) => {
                      setPreviewClientId(value)
                      setPreviewDocumentId("")
                    }}
                  >
                    <SelectTrigger id="preview-client">
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {previewClientId ? (
                  <div className="space-y-2">
                    <Label htmlFor="preview-document">
                      {kind === "contract" ? "Contrato" : config.label}
                    </Label>
                    <Select
                      value={previewDocumentId}
                      onValueChange={setPreviewDocumentId}
                      disabled={kind === "contract" ? previewContracts.length === 0 : previewSchedules.length === 0}
                    >
                      <SelectTrigger id="preview-document">
                        <SelectValue
                          placeholder={
                            kind === "contract"
                              ? "Selecione o contrato"
                              : `Selecione o ${config.label.toLowerCase()}`
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {kind === "contract"
                          ? previewContracts.map((contract) => (
                              <SelectItem key={contract.id} value={contract.id}>
                                {contract.contractNumber} - {contract.templateName || contract.status}
                              </SelectItem>
                            ))
                          : previewSchedules.map((schedule) => (
                              <SelectItem key={schedule.id} value={schedule.id}>
                                {formatDate(schedule.date)} - {schedule.serviceTypeName} - {schedule.unitName}
                              </SelectItem>
                            ))}
                      </SelectContent>
                    </Select>
                    {(kind === "contract" ? previewContracts.length === 0 : previewSchedules.length === 0) ? (
                      <p className="text-xs text-muted-foreground">
                        Nenhum {kind === "contract" ? "contrato" : "agendamento"} encontrado para este cliente.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {previewVariables ? (
                  <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                    A prévia está usando os dados selecionados. Campos sem valor ficam preservados para você enxergar
                    o placeholder.
                  </div>
                ) : (
                  <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                    Sem seleção completa, a prévia mostra o template com os placeholders.
                  </div>
                )}

                <Button
                  type="button"
                  className="w-full gap-2"
                  onClick={handleGeneratePreviewPdf}
                  disabled={isGeneratingPdf}
                >
                  <Download className="h-4 w-4" />
                  {isGeneratingPdf ? "Gerando PDF..." : "Gerar PDF de teste"}
                </Button>
                </div>
              </>
            ) : (
              <>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pr-8 pb-1">
              <div className="space-y-2">
                <Label htmlFor="tpl-watermark" className="flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  Marca d'água
                </Label>
                <div className="space-y-3">
                  {watermarkImageUrl ? (
                    <div className="overflow-hidden rounded-lg border bg-muted/40">
                      <img
                        src={watermarkImageUrl}
                        alt="Prévia da marca d'água"
                        className="h-32 w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex h-32 items-center justify-center rounded-lg border border-dashed bg-muted/30 px-4 text-center text-sm text-muted-foreground">
                      Nenhuma imagem selecionada.
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" asChild>
                      <label htmlFor="tpl-watermark">
                        <Upload className="h-4 w-4" />
                        Escolher imagem
                      </label>
                    </Button>
                    {watermarkImageUrl ? (
                      <Button type="button" variant="ghost" size="sm" onClick={handleRemoveWatermark}>
                        <X className="h-4 w-4" />
                        Remover
                      </Button>
                    ) : null}
                  </div>

                  <Input
                    id="tpl-watermark"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleWatermarkFileChange}
                  />
                  <p className="text-xs text-muted-foreground">
                    Resolução recomendada: 1414px x 2000px.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tpl-name">Nome do Template</Label>
                <Input
                  id="tpl-name"
                  value={formData.name}
                  onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                  placeholder={`Nome do template de ${config.label.toLowerCase()}`}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tpl-desc">Descrição</Label>
                <Input
                  id="tpl-desc"
                  value={formData.description}
                  onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Breve descrição"
                />
              </div>

              {kind === "informative" ? (
                <div className="space-y-2">
                  <Label htmlFor="tpl-informative-days">Enviar informativo quantos dias antes?</Label>
                  <Input
                    id="tpl-informative-days"
                    type="number"
                    min={0}
                    value={formData.informativeSendDaysBefore}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        informativeSendDaysBefore: Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                      }))
                    }
                  />
                </div>
              ) : null}

              {kind === "certificate" ? (
                <div className="space-y-2">
                  <Label htmlFor="tpl-certificate-days">Gerar/enviar certificado quantos dias depois?</Label>
                  <Input
                    id="tpl-certificate-days"
                    type="number"
                    min={0}
                    value={formData.certificateSendDaysAfter}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        certificateSendDaysAfter: Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                      }))
                    }
                  />
                </div>
              ) : null}

              {config.requiresSigner ? (
                <div className="space-y-2">
                  <Label htmlFor="tpl-signer" className="flex items-center gap-1.5">
                    <PenTool className="h-3.5 w-3.5 text-muted-foreground" />
                    {config.signerLabel}
                  </Label>
                  <Select
                    value={formData.signerId}
                    onValueChange={(value) => setFormData((current) => ({ ...current, signerId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees
                        .filter((employee) => employee.status === "active")
                        .map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="tpl-status">Status</Label>
                <Select
                  value={formData.isActive ? "active" : "inactive"}
                  onValueChange={(value) => setFormData((current) => ({ ...current, isActive: value === "active" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Braces className="h-4 w-4 text-primary" />
                  Variáveis do template
                </Label>
                <Accordion type="single" collapsible className="rounded-xl border bg-background px-2">
                  {variableGroups.map((group) => (
                    <AccordionItem key={group.id} value={group.id}>
                      <AccordionTrigger className="items-center py-3 hover:no-underline">
                        <span className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="truncate">{group.label}</span>
                          <span className="ml-auto min-w-7 rounded-full bg-muted px-2 py-0.5 text-center text-xs text-muted-foreground">
                            {group.variables.length}
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pb-3">
                        {group.variables.map((variable) => (
                          <button
                            key={variable.path}
                            type="button"
                            className="w-full rounded-xl border bg-card px-3 py-2 text-left transition hover:border-primary/50 hover:bg-primary/5"
                            onClick={() => handleSelectVariable(variable.path)}
                          >
                            <span className="block text-sm font-medium">{variable.label}</span>
                            <span className="mt-1 block truncate font-mono text-[11px] text-muted-foreground">{`{{${variable.path}}}`}</span>
                          </button>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>

                <p className="text-xs text-muted-foreground">
                  Clique no ponto do documento e escolha uma variável para inserir automaticamente.
                </p>
              </div>
              </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <>
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Novo Template
            </DialogTitle>
          </DialogHeader>

          <form autoComplete="off" onSubmit={handleImportSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="import-watermark" className="flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                Marca d'água
              </Label>
              <div className="space-y-3">
                {watermarkImageUrl ? (
                  <div className="overflow-hidden rounded-lg border bg-muted/40">
                    <img
                      src={watermarkImageUrl}
                      alt="Prévia da marca d'água"
                      className="h-28 w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex h-28 items-center justify-center rounded-lg border border-dashed bg-muted/30 px-4 text-center text-sm text-muted-foreground">
                    Nenhuma imagem selecionada.
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <label htmlFor="import-watermark">
                      <Upload className="h-4 w-4" />
                      Escolher imagem
                    </label>
                  </Button>
                  {watermarkImageUrl ? (
                    <Button type="button" variant="ghost" size="sm" onClick={handleRemoveWatermark}>
                      <X className="h-4 w-4" />
                      Remover
                    </Button>
                  ) : null}
                </div>

                <Input
                  id="import-watermark"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleWatermarkFileChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="import-name">Nome do Template</Label>
              <Input
                id="import-name"
                value={formData.name}
                onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                placeholder="Nome do template"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="import-desc">Descrição</Label>
              <Input
                id="import-desc"
                value={formData.description}
                onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                placeholder="Breve descrição do template"
              />
            </div>

            {kind === "informative" ? (
              <div className="space-y-2">
                <Label htmlFor="import-informative-days">Enviar informativo quantos dias antes?</Label>
                <Input
                  id="import-informative-days"
                  type="number"
                  min={0}
                  value={formData.informativeSendDaysBefore}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      informativeSendDaysBefore: Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                    }))
                  }
                />
              </div>
            ) : null}

            {kind === "certificate" ? (
              <div className="space-y-2">
                <Label htmlFor="import-certificate-days">Gerar/enviar certificado quantos dias depois?</Label>
                <Input
                  id="import-certificate-days"
                  type="number"
                  min={0}
                  value={formData.certificateSendDaysAfter}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      certificateSendDaysAfter: Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                    }))
                  }
                />
              </div>
            ) : null}

            {config.requiresSigner ? (
              <div className="space-y-2">
                <Label htmlFor="import-signer" className="flex items-center gap-1.5">
                  <PenTool className="h-3.5 w-3.5 text-muted-foreground" />
                  {config.signerLabel}
                </Label>
                <Select
                  value={formData.signerId}
                  onValueChange={(value) => setFormData((current) => ({ ...current, signerId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees
                      .filter((employee) => employee.status === "active")
                      .map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setIsImportOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!formData.name || (config.requiresSigner && !formData.signerId)}>
                Criar e Editar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title="Excluir template"
        description={`Esta ação vai excluir o template "${pendingDelete?.label}".`}
        confirmLabel="Excluir"
        onConfirm={() => {
          if (!pendingDelete) return
          deleteMutation.mutate(pendingDelete.id)
        }}
        busy={deleteMutation.isPending}
      />

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={`Buscar ${config.pluralLabel}...`}
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value)
                setCurrentPage(1)
              }}
              className="pl-10"
            />
          </div>
          <Button onClick={handleOpenImportDialog} className="h-9 w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Novo Template
          </Button>
        </div>

        <div className="overflow-x-auto rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                {config.requiresSigner ? <TableHead className="hidden md:table-cell">Assinante</TableHead> : null}
                <TableHead className="hidden lg:table-cell">Atualizado</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTemplates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={config.requiresSigner ? 5 : 4} className="h-24 text-center">
                    Nenhum template encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTemplates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 min-w-[2.5rem] shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <span className="font-medium">{template.name}</span>
                          <p className="text-xs text-muted-foreground">{template.description}</p>
                        </div>
                      </div>
                    </TableCell>

                    {config.requiresSigner ? (
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <PenTool className="h-3.5 w-3.5 text-muted-foreground" />
                          {getSignerName(template.signerId)}
                        </div>
                      </TableCell>
                    ) : null}

                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                      {template.updatedAt}
                    </TableCell>

                    <TableCell>
                      <Badge
                        className={
                          template.isActive
                            ? "cursor-pointer bg-green-100 text-green-700 hover:bg-green-200"
                            : "cursor-pointer bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }
                        onClick={() => toggleActiveMutation.mutate({ id: template.id, isActive: !template.isActive })}
                      >
                        {template.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(template)} title="Editar">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setPendingDelete({ id: template.id, label: template.name })}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <DataPagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={templates.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setCurrentPage(1)
          }}
        />
      </div>
    </>
  )
}
