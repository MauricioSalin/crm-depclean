"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  AlertTriangle,
  Building2,
  Calendar,
  CalendarCheck,
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Mail,
  MapPin,
  MoreHorizontal,
  Paperclip,
  Phone,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DatePicker } from "@/components/ui/date-picker"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DataPagination } from "@/components/ui/data-pagination"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TableEmptyState } from "@/components/ui/empty-state"
import { TableSkeletonRows } from "@/components/ui/table-skeleton"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { AssignmentBadges } from "@/components/ui/assignment-badges"
import { ScheduleTypeBadge } from "@/components/ui/schedule-type-badge"
import { DocxTemplateEditor, type DocxTemplateEditorRef } from "@/components/templates/docx-template-editor"
import { buildApiFileUrl } from "@/lib/api/client"
import {
  deleteClientAttachment,
  createClientExtra,
  getClientAttachments,
  getClientById,
  listClientExtras,
  updateClientExtraStatus,
  uploadClientAttachment,
  type ClientAttachmentRecord,
  type ClientExtraStatus,
} from "@/lib/api/clients"
import { listContracts, type ContractInstallmentRecord } from "@/lib/api/contracts"
import { getApiErrorMessage } from "@/lib/api/errors"
import { listSchedules, type ScheduleRecord } from "@/lib/api/schedules"
import { listServices } from "@/lib/api/services"
import { listClientTypes } from "@/lib/api/settings"
import { listTeams } from "@/lib/api/teams"
import { listTemplates, type TemplateRecord } from "@/lib/api/templates"
import {
  getClicksignContractStatusLabel,
  isClosedClicksignContractStatus,
  isOperationallyActiveContract,
  normalizeClicksignContractStatus,
} from "@/lib/contract-status"
import { formatCivilDate, parseCivilDate, toCivilDateKey } from "@/lib/date-utils"
import { useHasAnyPermission } from "@/hooks/use-permissions"
import { formatCPF } from "@/lib/masks"
import { buildPathWithSearchParams, getSafeReturnTo, withReturnTo } from "@/lib/navigation"
import { formatContractNumber } from "@/lib/utils"

interface ClientProfileProps {
  clientId: string
}

const clientProfileTabs = ["dados", "contratos", "parcelas", "extras", "servicos", "agenda", "anexos"] as const

type ClientProfileTab = (typeof clientProfileTabs)[number]

const defaultClientProfileTab: ClientProfileTab = "dados"

const clientProfileTabByUrlValue: Record<string, ClientProfileTab> = {
  dados: "dados",
  data: "dados",
  contratos: "contratos",
  contracts: "contratos",
  parcelas: "parcelas",
  installments: "parcelas",
  extras: "extras",
  extra: "extras",
  servicos: "servicos",
  services: "servicos",
  agenda: "agenda",
  schedule: "agenda",
  anexos: "anexos",
  attachments: "anexos",
}

const clientProfileTabUrlValue: Record<ClientProfileTab, string> = {
  dados: "dados",
  contratos: "contratos",
  parcelas: "parcelas",
  extras: "extras",
  servicos: "servicos",
  agenda: "agenda",
  anexos: "anexos",
}

const clientProfileTabTriggerClassName =
  "h-10 w-36 shrink-0 cursor-pointer rounded-full bg-muted px-4 py-2 text-sm transition-[background-color,color,transform] duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground lg:w-full"

const clientProfileTabsListClassName =
  "flex h-auto min-w-full w-max justify-start gap-2 overflow-visible bg-transparent p-0 lg:grid lg:w-full lg:grid-cols-7 [&_[data-slot=tabs-indicator]]:hidden"

const getClientProfileTabFromUrl = (value: string | null): ClientProfileTab =>
  value ? clientProfileTabByUrlValue[value] ?? defaultClientProfileTab : defaultClientProfileTab

const isClientProfileTab = (value: string): value is ClientProfileTab =>
  clientProfileTabs.includes(value as ClientProfileTab)

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

const formatDate = (value?: string) =>
  formatCivilDate(value)

const createDefaultExtraForm = () => {
  const today = toCivilDateKey(new Date())
  return {
    description: "",
    value: "",
    createdDate: today,
    dueDate: today,
    status: "pending" as ClientExtraStatus,
  }
}

const parseExtraValue = (value: string) => {
  const normalized = value.trim().replace(/\s/g, "")
  if (!normalized) return Number.NaN
  if (normalized.includes(",")) {
    return Number(normalized.replace(/\./g, "").replace(",", "."))
  }

  if (/^\d{1,3}(\.\d{3})+$/.test(normalized)) {
    return Number(normalized.replace(/\./g, ""))
  }

  return Number(normalized)
}

const informativePdfFileName = (fileName: string) => {
  const cleanName = fileName.trim() || "informativo.pdf"
  if (/\.pdf$/i.test(cleanName)) return cleanName
  if (/\.docx$/i.test(cleanName)) return cleanName.replace(/\.docx$/i, ".pdf")
  return `${cleanName.replace(/\.[^.]+$/i, "") || "informativo"}.pdf`
}

const docxFileName = (fileName: string) => {
  const cleanName = fileName.trim() || "informativo.docx"
  return /\.docx$/i.test(cleanName) ? cleanName : `${cleanName.replace(/\.[^.]+$/i, "") || "informativo"}.docx`
}

const downloadBrowserFile = (file: File, fileName: string) => {
  const url = URL.createObjectURL(file)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 500)
}

const wait = (delay: number) => new Promise((resolve) => window.setTimeout(resolve, delay))

const templateWatermarkUrl = (template?: TemplateRecord | null) =>
  template?.watermarkFileUrl ? buildApiFileUrl(template.watermarkFileUrl) : undefined

const formatCNPJ = (value: string) => {
  const digits = value.replace(/\D/g, "")
  if (digits.length !== 14) return value
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
}

const fallbackClientTypeColor = "#64748B"

const resolveColor = (color?: string) => {
  const normalizedColor = color?.trim()
  if (!normalizedColor) return fallbackClientTypeColor
  if (/^#[0-9a-f]{3,8}$/i.test(normalizedColor)) return normalizedColor
  return fallbackClientTypeColor
}

const getScheduleStatusBadge = (status: ScheduleRecord["status"]) => {
  switch (status) {
    case "draft":
      return <Badge className="bg-slate-100 text-slate-700">Rascunho</Badge>
    case "scheduled":
      return <Badge className="bg-blue-100 text-blue-800">Agendado</Badge>
    case "in_progress":
      return <Badge className="bg-yellow-100 text-yellow-800">Em andamento</Badge>
    case "completed":
      return <Badge className="bg-green-100 text-green-800">Concluído</Badge>
    case "cancelled":
      return <Badge className="bg-red-100 text-red-800">Cancelado</Badge>
    case "rescheduled":
      return <Badge className="bg-purple-100 text-purple-800">Reagendado</Badge>
  }
}

const getInstallmentStatusBadge = (status: ContractInstallmentRecord["status"]) => {
  switch (status) {
    case "paid":
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Paga</Badge>
    case "pending":
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pendente</Badge>
    case "late":
      return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Atrasada</Badge>
    case "overdue":
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Vencida</Badge>
    case "cancelled":
      return <Badge variant="secondary">Cancelada</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

const getClientExtraStatusBadge = (status: ClientExtraStatus) => {
  switch (status) {
    case "paid":
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Paga</Badge>
    case "pending":
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pendente</Badge>
    case "late":
      return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Atrasada</Badge>
    case "overdue":
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Vencida</Badge>
    case "cancelled":
      return <Badge variant="secondary">Cancelada</Badge>
  }
}

const getClientContractStatusBadge = (status: string) => {
  const normalized = normalizeClicksignContractStatus(status)
  const className =
    normalized === "closed"
      ? "bg-green-100 text-green-700 hover:bg-green-100"
      : normalized === "running"
        ? "bg-amber-100 text-amber-700 hover:bg-amber-100"
        : normalized === "canceled"
          ? "bg-red-100 text-red-700 hover:bg-red-100"
          : "bg-gray-100 text-gray-700 hover:bg-gray-100"

  return <Badge className={`shrink-0 ${className}`}>{getClicksignContractStatusLabel(normalized)}</Badge>
}

type ClientContactInfo = {
  name?: string
  cpf?: string
  email?: string
  phone?: string
  receivesNotifications?: boolean
} | null | undefined

const hasContactInfo = (contact: ClientContactInfo) =>
  Boolean(contact?.name?.trim() || contact?.cpf?.trim() || contact?.email?.trim() || contact?.phone?.trim())

const formatContactValue = (value?: string) => value?.trim() || "-"

function NotificationStatusBadge({ enabled }: { enabled?: boolean }) {
  return enabled ? (
    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Recebe</Badge>
  ) : (
    <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Não recebe</Badge>
  )
}

function ContactInfoTable({
  title,
  contact,
  emptyMessage,
}: {
  title: string
  contact: ClientContactInfo
  emptyMessage: string
}) {
  const hasData = hasContactInfo(contact)

  return (
    <div className="overflow-x-auto rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead colSpan={2}>{title}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {hasData ? (
            <>
              <TableRow>
                <TableCell className="w-[180px] text-muted-foreground">Nome</TableCell>
                <TableCell className="font-medium">{formatContactValue(contact?.name)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">CPF</TableCell>
                <TableCell className="font-medium">{contact?.cpf ? formatCPF(contact.cpf) : "-"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">Telefone</TableCell>
                <TableCell className="font-medium">{formatContactValue(contact?.phone)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">E-mail</TableCell>
                <TableCell className="font-medium">{formatContactValue(contact?.email)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">Notificações</TableCell>
                <TableCell>
                  <NotificationStatusBadge enabled={contact?.receivesNotifications} />
                </TableCell>
              </TableRow>
            </>
          ) : (
            <TableRow>
              <TableCell colSpan={2} className="py-8 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export function ClientProfile({ clientId }: ClientProfileProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const canEditClients = useHasAnyPermission(["clients_edit"])
  const canDeleteClients = useHasAnyPermission(["clients_delete"])
  const canViewContracts = useHasAnyPermission(["contracts_view", "contracts_edit", "contracts_create", "contracts_delete"])
  const canManageInstallments = useHasAnyPermission(["financial_manage", "contracts_edit"])
  const canManageExtras = useHasAnyPermission(["financial_manage"])
  const canModifyClientAttachments = canEditClients || canDeleteClients
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const informativePdfEditorRef = useRef<DocxTemplateEditorRef | null>(null)
  const [informativePdfJob, setInformativePdfJob] = useState<{
    id: string
    attachment: ClientAttachmentRecord
    sourceFile: File
    watermarkImageUrl?: string
    toastId: string | number
  } | null>(null)
  const [isGeneratingInformativePdf, setIsGeneratingInformativePdf] = useState(false)
  const clientQuery = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getClientById(clientId),
  })

  const contractsQuery = useQuery({
    queryKey: ["contracts", "client-profile"],
    queryFn: () => listContracts(""),
  })

  const schedulesQuery = useQuery({
    queryKey: ["schedules", "client-profile"],
    queryFn: () => listSchedules({}),
  })

  const servicesQuery = useQuery({
    queryKey: ["services", "client-profile"],
    queryFn: () => listServices(""),
  })

  const teamsQuery = useQuery({
    queryKey: ["teams", "catalog"],
    queryFn: () => listTeams(""),
  })

  const clientTypesQuery = useQuery({
    queryKey: ["client-types", "client-profile"],
    queryFn: () => listClientTypes(""),
  })

  const client = clientQuery.data?.data
  const resolvedClientId = client?.id ?? clientId

  const attachmentsQuery = useQuery({
    queryKey: ["client-attachments", resolvedClientId],
    queryFn: () => getClientAttachments(resolvedClientId),
    enabled: Boolean(client?.id),
  })

  const extrasQuery = useQuery({
    queryKey: ["client-extras", resolvedClientId],
    queryFn: () => listClientExtras(resolvedClientId),
    enabled: Boolean(client?.id),
  })

  const uploadAttachmentMutation = useMutation({
    mutationFn: (file: File) => {
      if (!canEditClients) {
        throw new Error("Sem permissao para anexar arquivos ao cliente.")
      }

      return uploadClientAttachment(resolvedClientId, file)
    },
    onMutate: () => {
      const toastId = toast.loading("Salvando anexo...")
      return { toastId }
    },
    onSuccess: (_data, _variables, context) => {
      queryClient.invalidateQueries({ queryKey: ["client-attachments", resolvedClientId] })
      toast.success("Anexo salvo no cliente.", { id: context?.toastId })
    },
    onError: (error, _variables, context) => {
      toast.error(getApiErrorMessage(error, "Não foi possível salvar o anexo."), { id: context?.toastId })
    },
  })

  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) => {
      if (!canModifyClientAttachments) {
        throw new Error("Sem permissao para remover anexos do cliente.")
      }

      return deleteClientAttachment(resolvedClientId, attachmentId)
    },
    onMutate: () => {
      const toastId = toast.loading("Removendo anexo...")
      return { toastId }
    },
    onSuccess: (_data, _variables, context) => {
      queryClient.invalidateQueries({ queryKey: ["client-attachments", resolvedClientId] })
      toast.success("Anexo removido.", { id: context?.toastId })
    },
    onError: (error, _variables, context) => {
      toast.error(getApiErrorMessage(error, "Não foi possível remover o anexo."), { id: context?.toastId })
    },
  })

  const [isCreateExtraOpen, setIsCreateExtraOpen] = useState(false)
  const [extraForm, setExtraForm] = useState(createDefaultExtraForm)

  useEffect(() => {
    if (searchParams.get("addExtra") !== "1" || !canManageExtras) return

    setExtraForm(createDefaultExtraForm())
    setIsCreateExtraOpen(true)

    const params = new URLSearchParams(searchParams.toString())
    params.delete("addExtra")
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [canManageExtras, pathname, router, searchParams])

  const createExtraMutation = useMutation({
    mutationFn: () => {
      if (!canManageExtras) {
        throw new Error("Sem permissão para adicionar valores extras.")
      }

      const value = parseExtraValue(extraForm.value)
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("Informe um valor extra maior que zero.")
      }

      const description = extraForm.description.trim()
      if (!description) {
        throw new Error("Informe a descrição do valor extra.")
      }

      if (!extraForm.createdDate || !extraForm.dueDate) {
        throw new Error("Informe as datas de criação e vencimento.")
      }

      return createClientExtra(resolvedClientId, {
        description,
        value,
        createdDate: extraForm.createdDate,
        dueDate: extraForm.dueDate,
        status: extraForm.status,
      })
    },
    onMutate: () => {
      const toastId = toast.loading("Salvando valor extra...")
      return { toastId }
    },
    onSuccess: (_data, _variables, context) => {
      queryClient.invalidateQueries({ queryKey: ["client-extras", resolvedClientId] })
      queryClient.invalidateQueries({ queryKey: ["analytics"] })
      setIsCreateExtraOpen(false)
      setExtraForm(createDefaultExtraForm())
      toast.success("Valor extra adicionado ao cliente.", { id: context?.toastId })
    },
    onError: (error, _variables, context) => {
      toast.error(getApiErrorMessage(error, "Não foi possível adicionar o valor extra."), { id: context?.toastId })
    },
  })

  const updateExtraStatusMutation = useMutation({
    mutationFn: ({ extraId, status }: { extraId: string; status: ClientExtraStatus }) => {
      if (!canManageExtras) {
        throw new Error("Sem permissão para alterar valores extras.")
      }

      return updateClientExtraStatus(resolvedClientId, extraId, status)
    },
    onMutate: () => {
      const toastId = toast.loading("Atualizando status...")
      return { toastId }
    },
    onSuccess: (_data, _variables, context) => {
      queryClient.invalidateQueries({ queryKey: ["client-extras", resolvedClientId] })
      queryClient.invalidateQueries({ queryKey: ["analytics"] })
      toast.success("Status do valor extra atualizado.", { id: context?.toastId })
    },
    onError: (error, _variables, context) => {
      toast.error(getApiErrorMessage(error, "Não foi possível atualizar o status."), { id: context?.toastId })
    },
  })

  const [installmentOverrides, setInstallmentOverrides] = useState<
    Record<string, { status: ContractInstallmentRecord["status"]; paidDate?: string; paidValue?: number }>
  >({})
  const [installmentsPage, setInstallmentsPage] = useState(1)
  const [installmentsPageSize, setInstallmentsPageSize] = useState(10)
  const [servicesPage, setServicesPage] = useState(1)
  const [servicesPageSize, setServicesPageSize] = useState(10)
  const [agendaPage, setAgendaPage] = useState(1)
  const [agendaPageSize, setAgendaPageSize] = useState(10)
  const [attachmentsPage, setAttachmentsPage] = useState(1)
  const [attachmentsPageSize, setAttachmentsPageSize] = useState(10)
  const [extrasPage, setExtrasPage] = useState(1)
  const [extrasPageSize, setExtrasPageSize] = useState(10)
  const activeTab = getClientProfileTabFromUrl(searchParams.get("tab"))
  const backHref = getSafeReturnTo(searchParams.get("returnTo"), "/clientes")
  const contractReturnPath = buildPathWithSearchParams(pathname, searchParams, {
    tab: clientProfileTabUrlValue.contratos,
  })
  const getContractProfileHref = (contractId: string) =>
    withReturnTo(`/contratos/${contractId}`, contractReturnPath)

  const handleTabChange = (value: string) => {
    if (!isClientProfileTab(value)) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", clientProfileTabUrlValue[value])
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handleManualAttachmentSelected = (file?: File) => {
    if (!file) return
    if (!canEditClients) return
    if (uploadAttachmentMutation.isPending) return
    uploadAttachmentMutation.mutate(file)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const clientContracts = useMemo(
    () => (contractsQuery.data?.data ?? []).filter((contract) => contract.clientId === resolvedClientId),
    [contractsQuery.data?.data, resolvedClientId],
  )
  const primaryContract = useMemo(() => {
    return [...clientContracts].sort((left, right) => {
      const operationalDifference = Number(isOperationallyActiveContract(right)) - Number(isOperationallyActiveContract(left))
      if (operationalDifference !== 0) return operationalDifference

      const rightReferenceDate = right.startDate ?? right.creationDate ?? right.createdAt
      const leftReferenceDate = left.startDate ?? left.creationDate ?? left.createdAt
      return new Date(rightReferenceDate).getTime() - new Date(leftReferenceDate).getTime()
    })[0]
  }, [clientContracts])
  const clientServices = useMemo(
    () => (schedulesQuery.data?.data ?? []).filter((service) => service.clientId === resolvedClientId),
    [schedulesQuery.data?.data, resolvedClientId],
  )
  const clientAttachments = attachmentsQuery.data?.data ?? []
  const clientExtras = extrasQuery.data?.data ?? []
  const hasInformativeAttachments = clientAttachments.some((attachment) => attachment.type === "informative")
  const informativeTemplatesQuery = useQuery({
    queryKey: ["templates", "client-profile", "informative"],
    queryFn: () => listTemplates("", "informative"),
    enabled: hasInformativeAttachments,
  })
  const informativeTemplates = informativeTemplatesQuery.data?.data ?? []
  const serviceTypeMap = useMemo(
    () => new Map((servicesQuery.data?.data ?? []).map((service) => [service.id, service] as const)),
    [servicesQuery.data?.data],
  )
  const informativeTemplateMap = useMemo(
    () => new Map(informativeTemplates.map((template) => [template.id, template] as const)),
    [informativeTemplates],
  )
  const teamMap = useMemo(
    () => new Map((teamsQuery.data?.data ?? []).map((team) => [team.id, team] as const)),
    [teamsQuery.data?.data],
  )
  const clientType = (clientTypesQuery.data?.data.items ?? []).find((item) => item.id === client?.clientTypeId)
  const clientTypeColor = resolveColor(clientType?.color)
  const activeContracts = clientContracts.filter((contract) => isOperationallyActiveContract(contract)).length

  const findInformativeTemplate = useCallback(
    async (attachment: ClientAttachmentRecord) => {
      const templateId = attachment.metadata?.templateId
      if (!templateId) return null

      const cachedTemplate = informativeTemplateMap.get(templateId)
      if (cachedTemplate) return cachedTemplate

      const refreshed = await informativeTemplatesQuery.refetch()
      return refreshed.data?.data.find((template) => template.id === templateId) ?? null
    },
    [informativeTemplateMap, informativeTemplatesQuery],
  )

  const handleAttachmentDownload = useCallback(
    async (attachment: ClientAttachmentRecord) => {
      if (attachment.type !== "informative") {
        const toastId = toast.loading("Baixando anexo...")

        try {
          const response = await fetch(buildApiFileUrl(attachment.documentUrl))
          if (!response.ok) {
            throw new Error(`Falha ao carregar o anexo (${response.status}).`)
          }

          const blob = await response.blob()
          const fileName = attachment.fileName.trim() || attachment.title.trim() || "anexo"
          const file = new File([blob], fileName, {
            type: blob.type || attachment.mimeType || "application/octet-stream",
          })
          downloadBrowserFile(file, file.name)
          toast.success("Anexo baixado.", { id: toastId })
        } catch (error) {
          toast.error(getApiErrorMessage(error, "Não foi possível baixar o anexo."), { id: toastId })
        }

        return
      }

      const toastId = toast.loading("Gerando PDF do informativo...")
      setIsGeneratingInformativePdf(true)

      try {
        const fileUrl = buildApiFileUrl(attachment.documentUrl)
        const isAlreadyPdf = attachment.mimeType === "application/pdf" || /\.pdf$/i.test(attachment.fileName)

        if (isAlreadyPdf) {
          const response = await fetch(fileUrl)
          if (!response.ok) {
            throw new Error(`Falha ao carregar o informativo (${response.status}).`)
          }

          const blob = await response.blob()
          const file = new File([blob], informativePdfFileName(attachment.fileName), { type: "application/pdf" })
          downloadBrowserFile(file, file.name)
          toast.success("PDF do informativo baixado.", { id: toastId })
          setIsGeneratingInformativePdf(false)
          return
        }

        const [response, template] = await Promise.all([
          fetch(fileUrl),
          findInformativeTemplate(attachment),
        ])

        if (!response.ok) {
          throw new Error(`Falha ao carregar o informativo (${response.status}).`)
        }

        const blob = await response.blob()
        const sourceFile = new File([blob], docxFileName(attachment.fileName), { type: blob.type || DOCX_MIME })

        setInformativePdfJob({
          id: `${attachment.id}-${Date.now()}`,
          attachment,
          sourceFile,
          watermarkImageUrl: templateWatermarkUrl(template),
          toastId,
        })
      } catch (error) {
        setIsGeneratingInformativePdf(false)
        toast.error(getApiErrorMessage(error, "Não foi possível gerar o PDF do informativo."), { id: toastId })
      }
    },
    [findInformativeTemplate],
  )

  useEffect(() => {
    if (!informativePdfJob) return

    const job = informativePdfJob
    let cancelled = false

    async function generateInformativePdf() {
      let lastError: unknown = null

      for (let attempt = 0; attempt < 8; attempt += 1) {
        await wait(attempt === 0 ? 350 : 250)

        if (cancelled) return

        try {
          const file = await informativePdfEditorRef.current?.generatePreviewPdf({ download: false })
          if (!file) throw new Error("Editor de PDF indisponível.")

          if (cancelled) return

          downloadBrowserFile(file, informativePdfFileName(job.attachment.fileName))
          toast.success("PDF do informativo gerado.", { id: job.toastId })
          setInformativePdfJob(null)
          setIsGeneratingInformativePdf(false)
          return
        } catch (error) {
          lastError = error
        }
      }

      if (cancelled) return

      toast.error(getApiErrorMessage(lastError, "Não foi possível gerar o PDF do informativo."), {
        id: job.toastId,
      })
      setInformativePdfJob(null)
      setIsGeneratingInformativePdf(false)
    }

    void generateInformativePdf()

    return () => {
      cancelled = true
    }
  }, [informativePdfJob])

  const allInstallments = useMemo(() => {
    return clientContracts.flatMap((contract) =>
      contract.installments.map((installment) => {
        const override = installmentOverrides[installment.id]
        return {
          ...installment,
          ...(override ?? {}),
          contractNumber: contract.contractNumber,
          installmentsCount: contract.installmentsCount,
        }
      }),
    )
  }, [clientContracts, installmentOverrides])
  const completedServices = useMemo(
    () => clientServices.filter((service) => service.status === "completed"),
    [clientServices],
  )
  const scheduledServices = useMemo(
    () => clientServices,
    [clientServices],
  )
  const installmentsTotalPages = Math.max(1, Math.ceil(allInstallments.length / installmentsPageSize))
  const servicesTotalPages = Math.max(1, Math.ceil(completedServices.length / servicesPageSize))
  const agendaTotalPages = Math.max(1, Math.ceil(scheduledServices.length / agendaPageSize))
  const attachmentsTotalPages = Math.max(1, Math.ceil(clientAttachments.length / attachmentsPageSize))
  const extrasTotalPages = Math.max(1, Math.ceil(clientExtras.length / extrasPageSize))
  useEffect(() => {
    if (installmentsPage > installmentsTotalPages) setInstallmentsPage(installmentsTotalPages)
  }, [installmentsPage, installmentsTotalPages])

  useEffect(() => {
    if (servicesPage > servicesTotalPages) setServicesPage(servicesTotalPages)
  }, [servicesPage, servicesTotalPages])

  useEffect(() => {
    if (agendaPage > agendaTotalPages) setAgendaPage(agendaTotalPages)
  }, [agendaPage, agendaTotalPages])

  useEffect(() => {
    if (attachmentsPage > attachmentsTotalPages) setAttachmentsPage(attachmentsTotalPages)
  }, [attachmentsPage, attachmentsTotalPages])

  useEffect(() => {
    if (extrasPage > extrasTotalPages) setExtrasPage(extrasTotalPages)
  }, [extrasPage, extrasTotalPages])

  const paidInstallments = allInstallments.filter((installment) => installment.status === "paid")
  const lateInstallments = allInstallments.filter((installment) => installment.status === "late")
  const overdueInstallments = allInstallments.filter((installment) => installment.status === "overdue")
  const pendingInstallments = allInstallments.filter((installment) => installment.status === "pending")
  const totalPaid = paidInstallments.reduce(
    (accumulator, installment) => accumulator + (installment.paidValue ?? installment.value),
    0,
  )
  const totalLate = lateInstallments.reduce((accumulator, installment) => accumulator + installment.value, 0)
  const totalOverdue = overdueInstallments.reduce((accumulator, installment) => accumulator + installment.value, 0)
  const totalPending = pendingInstallments.reduce((accumulator, installment) => accumulator + installment.value, 0)

  if (clientQuery.isLoading || clientTypesQuery.isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-5 w-72 max-w-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </Card>
    )
  }

  if (!client) {
    return (
      <Card className="p-8 text-center">
        <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 font-semibold">Cliente não encontrado</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          O cliente solicitado não existe ou foi removido.
        </p>
        <Link href={backHref}>
          <Button>Voltar para clientes</Button>
        </Link>
      </Card>
    )
  }

  const clientPhone = client.phone?.trim()
  const clientEmail = client.email?.trim()
  const hasClientDirectContact = Boolean(clientPhone || clientEmail)

  const getAttachmentTypeLabel = (type: ClientAttachmentRecord["type"]) => {
    switch (type) {
      case "service_na":
        return "NA"
      case "certificate":
        return "Certificado"
      case "informative":
        return "Informativo"
      case "contract":
        return "Contrato"
      default:
        return "Outro"
    }
  }

  const getAttachmentTypeBadge = (type: ClientAttachmentRecord["type"]) => {
    const label = getAttachmentTypeLabel(type)

    switch (type) {
      case "contract":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{label}</Badge>
      case "certificate":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{label}</Badge>
      case "service_na":
        return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">{label}</Badge>
      case "informative":
        return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">{label}</Badge>
      default:
        return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">{label}</Badge>
    }
  }

  const formatAttachmentSize = (size?: number) => {
    if (!size) return ""
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatAttachmentFileInfo = (attachment: ClientAttachmentRecord) => {
    const fileName = attachment.type === "informative"
      ? informativePdfFileName(attachment.fileName)
      : attachment.fileName
    const size = formatAttachmentSize(attachment.fileSize)

    return [fileName, size].filter(Boolean).join(" - ")
  }

  const setInstallmentStatus = (installmentId: string, status: ContractInstallmentRecord["status"]) => {
    if (!canManageInstallments) return

    setInstallmentOverrides((previous) => {
      if (status === "paid") {
        const original = clientContracts
          .flatMap((contract) => contract.installments)
          .find((installment) => installment.id === installmentId)
        const value = original?.value ?? 0
        return {
          ...previous,
          [installmentId]: {
            status,
            paidDate: new Date().toISOString(),
            paidValue: value,
          },
        }
      }

      if (status === "overdue") {
        return {
          ...previous,
          [installmentId]: {
            status,
            paidDate: undefined,
            paidValue: undefined,
          },
        }
      }

      return {
        ...previous,
        [installmentId]: {
          status: "pending",
          paidDate: undefined,
          paidValue: undefined,
        },
      }
    })
  }

  return (
    <div className="space-y-6">
      {informativePdfJob ? (
        <div
          aria-hidden="true"
          style={{
            height: 1200,
            left: -10000,
            overflow: "hidden",
            pointerEvents: "none",
            position: "fixed",
            top: 0,
            width: 900,
            zIndex: -1,
          }}
        >
          <DocxTemplateEditor
            key={informativePdfJob.id}
            ref={informativePdfEditorRef}
            activeTab="preview"
            kind="informative"
            sourceFile={informativePdfJob.sourceFile}
            templateFormat="docx"
            templateName={informativePdfJob.attachment.title || "Informativo"}
            watermarkImageUrl={informativePdfJob.watermarkImageUrl}
          />
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${clientTypeColor}1A` }}
            >
              <Building2 className="h-6 w-6" style={{ color: clientTypeColor }} />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="min-w-0 break-words text-xl font-bold">{client.companyName}</h3>
                <Badge
                  style={{ backgroundColor: clientTypeColor }}
                  className="shrink-0 border-0 text-white hover:opacity-90"
                >
                  {clientType?.name ?? "Cliente"}
                </Badge>
              </div>
              <p className="font-mono text-sm text-muted-foreground">{formatCNPJ(client.cnpj)}</p>

              {hasClientDirectContact ? (
                <div className="space-y-2 text-sm">
                  {clientPhone ? (
                    <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4 shrink-0" />
                      <span>{client.phone}</span>
                    </div>
                  ) : null}

                  {clientEmail ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4 shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
            {canViewContracts && primaryContract ? (
              <Link href={getContractProfileHref(primaryContract.id)}>
                <Button variant="outline" className="h-9 bg-transparent text-sm">
                  <FileText className="mr-2 h-4 w-4" />
                  Acessar contrato
                </Button>
              </Link>
            ) : null}
            {canManageExtras ? (
              <Button
                type="button"
                variant="outline"
                className="h-9 bg-transparent text-sm"
                onClick={() => {
                  setExtraForm(createDefaultExtraForm())
                  setIsCreateExtraOpen(true)
                }}
              >
                <DollarSign className="mr-2 h-4 w-4" />
                Adicionar extra
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary/80" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Contratos ativos</p>
              <p className="text-xl font-semibold text-primary/80">{activeContracts}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
              <DollarSign className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total pago</p>
              <p className="text-xl font-semibold text-green-600/80">{formatCurrency(totalPaid)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pendente</p>
              <p className="text-xl font-semibold text-amber-600/80">{formatCurrency(totalPending)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Em atraso</p>
              <p className="text-xl font-semibold text-orange-600/80">{formatCurrency(totalLate)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vencido</p>
              <p className="text-xl font-semibold text-red-600/80">{formatCurrency(totalOverdue)}</p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="w-full overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className={clientProfileTabsListClassName}>
            <TabsTrigger
              onFocus={(event) => event.currentTarget.focus({ preventScroll: true })}
              value="dados"
              className={clientProfileTabTriggerClassName}
            >
              <Building2 className="h-4 w-4" />
              <span className="font-semibold">Dados</span>
            </TabsTrigger>
            <TabsTrigger
              onFocus={(event) => event.currentTarget.focus({ preventScroll: true })}
              value="contratos"
              className={clientProfileTabTriggerClassName}
            >
              <FileText className="h-4 w-4" />
              <span className="font-semibold">Contratos ({clientContracts.length})</span>
            </TabsTrigger>
            <TabsTrigger
              onFocus={(event) => event.currentTarget.focus({ preventScroll: true })}
              value="parcelas"
              className={clientProfileTabTriggerClassName}
            >
              <DollarSign className="h-4 w-4" />
              <span className="font-semibold">Parcelas ({allInstallments.length})</span>
            </TabsTrigger>
            <TabsTrigger
              onFocus={(event) => event.currentTarget.focus({ preventScroll: true })}
              value="extras"
              className={clientProfileTabTriggerClassName}
            >
              <DollarSign className="h-4 w-4" />
              <span className="font-semibold">Extras ({clientExtras.length})</span>
            </TabsTrigger>
            <TabsTrigger
              onFocus={(event) => event.currentTarget.focus({ preventScroll: true })}
              value="servicos"
              className={clientProfileTabTriggerClassName}
            >
              <Wrench className="h-4 w-4" />
              <span className="font-semibold">Serviços ({completedServices.length})</span>
            </TabsTrigger>
            <TabsTrigger
              onFocus={(event) => event.currentTarget.focus({ preventScroll: true })}
              value="agenda"
              className={clientProfileTabTriggerClassName}
            >
              <Calendar className="h-4 w-4" />
              <span className="font-semibold">Agenda ({scheduledServices.length})</span>
            </TabsTrigger>
            <TabsTrigger
              onFocus={(event) => event.currentTarget.focus({ preventScroll: true })}
              value="anexos"
              className={clientProfileTabTriggerClassName}
            >
              <Paperclip className="h-4 w-4" />
              <span className="font-semibold">Anexos ({clientAttachments.length})</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dados" className="mt-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="overflow-x-auto rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead colSpan={2}>Informações do cliente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="w-[220px] text-muted-foreground">Razão social</TableCell>
                    <TableCell className="font-medium">{client.companyName}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">CNPJ</TableCell>
                    <TableCell className="font-medium">{formatCNPJ(client.cnpj)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Responsável</TableCell>
                    <TableCell className="font-medium">{client.responsibleName}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">CPF do responsável</TableCell>
                    <TableCell className="font-medium">{client.responsibleCpf ? formatCPF(client.responsibleCpf) : "-"}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Telefone</TableCell>
                    <TableCell className="font-medium">{client.phone}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">E-mail</TableCell>
                    <TableCell className="font-medium">{client.email}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Tipo</TableCell>
                    <TableCell>
                      <Badge className="border-0 text-white" style={{ backgroundColor: clientTypeColor }}>
                        {clientType?.name ?? "Cliente"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Notificações do responsável</TableCell>
                    <TableCell>
                      <NotificationStatusBadge enabled={client.responsibleReceivesNotifications} />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="overflow-x-auto rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filial</TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead>Unidades</TableHead>
                    <TableHead>Tipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {client.units.length === 0 ? (
                    <TableEmptyState colSpan={4} icon={MapPin} title="Nenhuma filial cadastrada." />
                  ) : (
                    client.units.map((unit) => (
                      <TableRow key={unit.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            {unit.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {unit.address.street}, {unit.address.number}
                          {unit.address.complement ? ` - ${unit.address.complement}` : ""}, {unit.address.neighborhood} -{" "}
                          {unit.address.city}/{unit.address.state} (CEP: {unit.address.zipCode})
                        </TableCell>
                        <TableCell>{unit.unitCount ?? "-"}</TableCell>
                        <TableCell>
                          {unit.isPrimary ? <Badge variant="secondary">Matriz</Badge> : <Badge variant="outline">Filial</Badge>}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <ContactInfoTable
              title="Síndico"
              contact={client.syndic}
              emptyMessage="Nenhum síndico cadastrado."
            />

            <ContactInfoTable
              title="Assessor"
              contact={client.assessor}
              emptyMessage="Nenhum assessor cadastrado."
            />
          </div>
        </TabsContent>

        <TabsContent value="contratos" className="mt-4">
          <div className="overflow-x-auto rounded-xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px] min-w-[300px]">Contrato</TableHead>
                  <TableHead className="hidden w-[420px] min-w-[380px] sm:table-cell">Cliente</TableHead>
                  <TableHead className="hidden md:table-cell">Valor</TableHead>
                  <TableHead className="hidden lg:table-cell">Vigência</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientContracts.map((contract) => {
                  const paidInstallments = contract.installments.filter((installment) => installment.status === "paid").length

                  return (
                    <TableRow key={contract.id}>
                      <TableCell className="w-[300px] max-w-[300px]">
                        <Link href={getContractProfileHref(contract.id)} className="flex items-center gap-3">
                          <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:flex">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{formatContractNumber(contract.contractNumber)}</p>
                            <p className="text-xs text-muted-foreground sm:hidden">{client.companyName}</p>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="hidden w-[420px] max-w-[420px] sm:table-cell">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="max-w-[360px] truncate">{client.companyName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div>
                          <p className="font-medium">{formatCurrency(contract.totalValue)}</p>
                          <p className="text-xs text-muted-foreground">
                            {paidInstallments}/{contract.installmentsCount} parcelas
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-sm lg:table-cell">
                        {isClosedClicksignContractStatus(contract.status) && contract.startDate && contract.endDate ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(contract.startDate)}</span>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <CalendarCheck className="h-3 w-3" />
                              <span>{formatDate(contract.endDate)}</span>
                            </div>
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>{getClientContractStatusBadge(contract.status)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={getContractProfileHref(contract.id)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Ver Detalhes
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}

                {clientContracts.length === 0 ? (
                  <TableEmptyState colSpan={6} icon={FileText} title="Nenhum contrato encontrado." />
                ) : null}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="parcelas" className="mt-4">
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead className="hidden md:table-cell">Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    {canManageInstallments ? <TableHead className="text-right">Ações</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody page={allInstallments.length > 0 ? installmentsPage : undefined} pageSize={allInstallments.length > 0 ? installmentsPageSize : undefined}>
                  {allInstallments.length === 0 ? (
                    <TableEmptyState colSpan={canManageInstallments ? 6 : 5} icon={DollarSign} title="Nenhuma parcela encontrada." />
                  ) : (
                    allInstallments.map((installment) => (
                      <TableRow key={installment.id}>
                        <TableCell className="text-sm">{formatContractNumber(installment.contractNumber)}</TableCell>
                        <TableCell>
                          {installment.number}/{installment.installmentsCount}
                        </TableCell>
                        <TableCell className="font-medium">{formatCurrency(installment.value)}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm">{formatDate(installment.dueDate)}</TableCell>
                        <TableCell>{getInstallmentStatusBadge(installment.status)}</TableCell>
                        {canManageInstallments ? (
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setInstallmentStatus(installment.id, "paid")}>
                                  Marcar como paga
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setInstallmentStatus(installment.id, "overdue")}>
                                  Marcar como vencida
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setInstallmentStatus(installment.id, "pending")}>
                                  Marcar como pendente
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {allInstallments.length > 0 ? (
              <DataPagination
                currentPage={installmentsPage}
                totalPages={installmentsTotalPages}
                pageSize={installmentsPageSize}
                totalItems={allInstallments.length}
                onPageChange={setInstallmentsPage}
                onPageSizeChange={(size) => {
                  setInstallmentsPageSize(size)
                  setInstallmentsPage(1)
                }}
                className="md:static md:bottom-auto md:z-auto"
              />
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="extras" className="mt-4">
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-md">
              <Table onSortChange={() => setExtrasPage(1)}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data de criação</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    {canManageExtras ? <TableHead className="text-right">Ações</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody
                  page={!extrasQuery.isLoading && clientExtras.length > 0 ? extrasPage : undefined}
                  pageSize={!extrasQuery.isLoading && clientExtras.length > 0 ? extrasPageSize : undefined}
                >
                  {clientExtras.map((extra) => (
                    <TableRow key={extra.id}>
                      <TableCell className="text-sm">{formatDate(extra.createdDate)}</TableCell>
                      <TableCell className="min-w-64 max-w-md whitespace-normal text-sm">
                        {extra.description || "Sem descrição"}
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(extra.value)}</TableCell>
                      <TableCell className="text-sm">{formatDate(extra.dueDate)}</TableCell>
                      <TableCell>{getClientExtraStatusBadge(extra.status)}</TableCell>
                      {canManageExtras ? (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={updateExtraStatusMutation.isPending}
                                title="Alterar status"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => updateExtraStatusMutation.mutate({ extraId: extra.id, status: "paid" })}>
                                Marcar como paga
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateExtraStatusMutation.mutate({ extraId: extra.id, status: "pending" })}>
                                Marcar como pendente
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateExtraStatusMutation.mutate({ extraId: extra.id, status: "late" })}>
                                Marcar como atrasada
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateExtraStatusMutation.mutate({ extraId: extra.id, status: "overdue" })}>
                                Marcar como vencida
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateExtraStatusMutation.mutate({ extraId: extra.id, status: "cancelled" })}>
                                Marcar como cancelada
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}

                  {!extrasQuery.isLoading && clientExtras.length === 0 ? (
                    <TableEmptyState
                      colSpan={canManageExtras ? 6 : 5}
                      icon={DollarSign}
                      title="Nenhum valor extra cadastrado para este cliente."
                    />
                  ) : null}

                  {extrasQuery.isLoading ? (
                    <TableSkeletonRows
                      rows={3}
                      columns={[
                        { width: "w-28" },
                        { width: "w-64" },
                        { width: "w-24" },
                        { width: "w-28" },
                        { width: "w-20" },
                        ...(canManageExtras ? [{ align: "right" as const, width: "w-8" }] : []),
                      ]}
                    />
                  ) : null}
                </TableBody>
              </Table>
            </div>
            {!extrasQuery.isLoading && clientExtras.length > 0 ? (
              <DataPagination
                currentPage={extrasPage}
                totalPages={extrasTotalPages}
                pageSize={extrasPageSize}
                totalItems={clientExtras.length}
                onPageChange={setExtrasPage}
                onPageSizeChange={(size) => {
                  setExtrasPageSize(size)
                  setExtrasPage(1)
                }}
                className="md:static md:bottom-auto md:z-auto"
              />
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="servicos" className="mt-4">
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-md">
              <Table onSortChange={() => setServicesPage(1)}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="hidden md:table-cell">Equipe / Funcionários</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody page={completedServices.length > 0 ? servicesPage : undefined} pageSize={completedServices.length > 0 ? servicesPageSize : undefined}>
                  {completedServices.map((service) => {
                      const serviceTeams =
                        service.teams.length > 0
                          ? service.teams
                          : service.teamId && teamMap.get(service.teamId)
                            ? [teamMap.get(service.teamId)!]
                            : []

                      return (
                        <TableRow key={service.id}>
                          <TableCell>
                            <p className="font-medium">{service.serviceTypeName}</p>
                          </TableCell>
                          <TableCell>
                            <ScheduleTypeBadge schedule={service} />
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <AssignmentBadges teams={serviceTeams} employees={service.additionalEmployees} />
                          </TableCell>
                          <TableCell className="text-sm">{formatDate(service.date)}</TableCell>
                        </TableRow>
                      )
                    })}

                  {completedServices.length === 0 ? (
                    <TableEmptyState colSpan={4} icon={CheckCircle} title="Nenhum serviço realizado ainda." />
                  ) : null}
                </TableBody>
              </Table>
            </div>
            {completedServices.length > 0 ? (
              <DataPagination
                currentPage={servicesPage}
                totalPages={servicesTotalPages}
                pageSize={servicesPageSize}
                totalItems={completedServices.length}
                onPageChange={setServicesPage}
                onPageSizeChange={(size) => {
                  setServicesPageSize(size)
                  setServicesPage(1)
                }}
                className="md:static md:bottom-auto md:z-auto"
              />
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="agenda" className="mt-4">
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-md">
              <Table onSortChange={() => setAgendaPage(1)}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="hidden md:table-cell">Equipe / Funcionários</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody page={scheduledServices.length > 0 ? agendaPage : undefined} pageSize={scheduledServices.length > 0 ? agendaPageSize : undefined}>
                  {scheduledServices.map((service) => {
                      const serviceTeams =
                        service.teams.length > 0
                          ? service.teams
                          : service.teamId && teamMap.get(service.teamId)
                            ? [teamMap.get(service.teamId)!]
                            : []

                      return (
                        <TableRow key={service.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{service.serviceTypeName}</p>
                              {service.isEmergency ? <AlertTriangle className="h-4 w-4 text-destructive" /> : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <ScheduleTypeBadge schedule={service} />
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <AssignmentBadges teams={serviceTeams} employees={service.additionalEmployees} />
                          </TableCell>
                          <TableCell className="text-sm">{formatDate(service.date)}</TableCell>
                          <TableCell className="text-sm">{service.time || "08:00"}</TableCell>
                          <TableCell>{getScheduleStatusBadge(service.status)}</TableCell>
                        </TableRow>
                      )
                    })}

                  {scheduledServices.length === 0 ? (
                    <TableEmptyState colSpan={6} icon={Calendar} title="Nenhum serviço agendado." />
                  ) : null}
                </TableBody>
              </Table>
            </div>
            {scheduledServices.length > 0 ? (
              <DataPagination
                currentPage={agendaPage}
                totalPages={agendaTotalPages}
                pageSize={agendaPageSize}
                totalItems={scheduledServices.length}
                onPageChange={setAgendaPage}
                onPageSizeChange={(size) => {
                  setAgendaPageSize(size)
                  setAgendaPage(1)
                }}
                className="md:static md:bottom-auto md:z-auto"
              />
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="anexos" className="mt-4">
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-md">
              <Table onSortChange={() => setAttachmentsPage(1)}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead className="hidden md:table-cell">Origem</TableHead>
                    <TableHead className="hidden md:table-cell">Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody page={!attachmentsQuery.isLoading && clientAttachments.length > 0 ? attachmentsPage : undefined} pageSize={!attachmentsQuery.isLoading && clientAttachments.length > 0 ? attachmentsPageSize : undefined}>
                  {clientAttachments.map((attachment) => (
                    <TableRow key={attachment.id}>
                      <TableCell>
                        {getAttachmentTypeBadge(attachment.type)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                            <FileCheck2 className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{attachment.title}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {formatAttachmentFileInfo(attachment)}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {attachment.source === "agenda"
                          ? "Agenda"
                          : attachment.source === "contracts"
                            ? "Contratos"
                            : attachment.source === "ai"
                              ? "IA"
                              : "Manual"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {new Date(attachment.uploadedAt).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleAttachmentDownload(attachment)}
                            disabled={attachment.type === "informative" && isGeneratingInformativePdf}
                            title={attachment.type === "informative" ? "Baixar PDF" : "Baixar arquivo"}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {attachment.source === "manual" && canModifyClientAttachments ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteAttachmentMutation.mutate(attachment.id)}
                              disabled={deleteAttachmentMutation.isPending}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}

                  {!attachmentsQuery.isLoading && clientAttachments.length === 0 ? (
                    <TableEmptyState colSpan={5} icon={Paperclip} title="Nenhum anexo vinculado a este cliente." />
                  ) : null}

                  {attachmentsQuery.isLoading ? (
                    <TableSkeletonRows
                      rows={3}
                      columns={[
                        { width: "w-20" },
                        { withIcon: true, width: "w-48" },
                        { className: "hidden md:table-cell", width: "w-20" },
                        { className: "hidden md:table-cell", width: "w-20" },
                        { align: "right", width: "w-8" },
                      ]}
                    />
                  ) : null}
                </TableBody>
              </Table>
            </div>
            {!attachmentsQuery.isLoading && clientAttachments.length > 0 ? (
              <DataPagination
                currentPage={attachmentsPage}
                totalPages={attachmentsTotalPages}
                pageSize={attachmentsPageSize}
                totalItems={clientAttachments.length}
                onPageChange={setAttachmentsPage}
                onPageSizeChange={(size) => {
                  setAttachmentsPageSize(size)
                  setAttachmentsPage(1)
                }}
                className="md:static md:bottom-auto md:z-auto"
              />
            ) : null}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog
        open={isCreateExtraOpen}
        onOpenChange={(open) => {
          if (!createExtraMutation.isPending) setIsCreateExtraOpen(open)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar valor extra</DialogTitle>
            <DialogDescription>
              Registre uma cobrança avulsa para {client.companyName}, sem vínculo com contrato ou parcela.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="client-extra-description">Descrição</Label>
              <Textarea
                id="client-extra-description"
                value={extraForm.description}
                onChange={(event) => setExtraForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Informe do que se trata este valor extra"
                maxLength={500}
                rows={3}
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="client-extra-value">Valor</Label>
              <Input
                id="client-extra-value"
                value={extraForm.value}
                onChange={(event) => setExtraForm((current) => ({ ...current, value: event.target.value }))}
                inputMode="decimal"
                placeholder="R$ 0,00"
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Data de criação</Label>
                <DatePicker
                  value={parseCivilDate(extraForm.createdDate)}
                  onChange={(date) => setExtraForm((current) => ({
                    ...current,
                    createdDate: date ? toCivilDateKey(date) : "",
                  }))}
                  placeholder="Selecione a criação"
                />
              </div>
              <div className="grid gap-2">
                <Label>Data de vencimento</Label>
                <DatePicker
                  value={parseCivilDate(extraForm.dueDate)}
                  onChange={(date) => setExtraForm((current) => ({
                    ...current,
                    dueDate: date ? toCivilDateKey(date) : "",
                  }))}
                  placeholder="Selecione o vencimento"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="client-extra-status">Status</Label>
              <Select
                value={extraForm.status}
                onValueChange={(status: ClientExtraStatus) => setExtraForm((current) => ({ ...current, status }))}
              >
                <SelectTrigger id="client-extra-status" className="w-full">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Paga</SelectItem>
                  <SelectItem value="late">Atrasada</SelectItem>
                  <SelectItem value="overdue">Vencida</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateExtraOpen(false)}
              disabled={createExtraMutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => createExtraMutation.mutate()} disabled={createExtraMutation.isPending}>
              {createExtraMutation.isPending ? "Salvando..." : "Adicionar extra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
