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
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  ExternalLink,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DataPagination } from "@/components/ui/data-pagination"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TableEmptyState } from "@/components/ui/empty-state"
import { TableSkeletonRows } from "@/components/ui/table-skeleton"
import { Skeleton } from "@/components/ui/skeleton"
import { AssignmentBadges } from "@/components/ui/assignment-badges"
import { ScheduleTypeBadge } from "@/components/ui/schedule-type-badge"
import { DocxTemplateEditor, type DocxTemplateEditorRef } from "@/components/templates/docx-template-editor"
import { buildApiFileUrl } from "@/lib/api/client"
import {
  deleteClientAttachment,
  getClientAttachments,
  getClientById,
  uploadClientAttachment,
  type ClientAttachmentRecord,
} from "@/lib/api/clients"
import { listContracts, type ContractInstallmentRecord } from "@/lib/api/contracts"
import { getApiErrorMessage } from "@/lib/api/errors"
import { listSchedules, type ScheduleRecord } from "@/lib/api/schedules"
import { listServices } from "@/lib/api/services"
import { listClientTypes } from "@/lib/api/settings"
import { listTeams } from "@/lib/api/teams"
import { listTemplates, type TemplateRecord } from "@/lib/api/templates"
import { formatCivilDate } from "@/lib/date-utils"
import { formatCPF } from "@/lib/masks"
import { buildPathWithSearchParams, getSafeReturnTo, withReturnTo } from "@/lib/navigation"

interface ClientProfileProps {
  clientId: string
}

const clientProfileTabs = ["dados", "contratos", "parcelas", "servicos", "agenda", "anexos"] as const

type ClientProfileTab = (typeof clientProfileTabs)[number]

const defaultClientProfileTab: ClientProfileTab = "dados"

const clientProfileTabByUrlValue: Record<string, ClientProfileTab> = {
  dados: "dados",
  data: "dados",
  contratos: "contratos",
  contracts: "contratos",
  parcelas: "parcelas",
  installments: "parcelas",
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
  servicos: "servicos",
  agenda: "agenda",
  anexos: "anexos",
}

const clientProfileTabTriggerClassName =
  "h-10 w-36 shrink-0 cursor-pointer rounded-full bg-muted px-4 py-2 text-sm transition-[background-color,color,transform] duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground lg:w-full"

const clientProfileTabsListClassName =
  "flex h-auto min-w-full w-max justify-start gap-2 overflow-visible bg-transparent p-0 lg:grid lg:w-full lg:grid-cols-6 [&_[data-slot=tabs-indicator]]:hidden"

const getClientProfileTabFromUrl = (value: string | null): ClientProfileTab =>
  value ? clientProfileTabByUrlValue[value] ?? defaultClientProfileTab : defaultClientProfileTab

const isClientProfileTab = (value: string): value is ClientProfileTab =>
  clientProfileTabs.includes(value as ClientProfileTab)

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

const formatDate = (value?: string) =>
  formatCivilDate(value)

const paginateItems = <T,>(items: T[], page: number, pageSize: number) =>
  items.slice((page - 1) * pageSize, page * pageSize)

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
    queryKey: ["teams", "client-profile"],
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

  const uploadAttachmentMutation = useMutation({
    mutationFn: (file: File) => uploadClientAttachment(resolvedClientId, file),
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
    mutationFn: (attachmentId: string) => deleteClientAttachment(resolvedClientId, attachmentId),
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
  const clientServices = useMemo(
    () => (schedulesQuery.data?.data ?? []).filter((service) => service.clientId === resolvedClientId),
    [schedulesQuery.data?.data, resolvedClientId],
  )
  const clientAttachments = attachmentsQuery.data?.data ?? []
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
  const activeContracts = clientContracts.filter((contract) => ["signed", "active"].includes(contract.status)).length

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
    () => clientServices.filter((service) => ["draft", "scheduled", "in_progress", "rescheduled"].includes(service.status)),
    [clientServices],
  )
  const installmentsTotalPages = Math.max(1, Math.ceil(allInstallments.length / installmentsPageSize))
  const servicesTotalPages = Math.max(1, Math.ceil(completedServices.length / servicesPageSize))
  const agendaTotalPages = Math.max(1, Math.ceil(scheduledServices.length / agendaPageSize))
  const attachmentsTotalPages = Math.max(1, Math.ceil(clientAttachments.length / attachmentsPageSize))
  const paginatedInstallments = useMemo(
    () => paginateItems(allInstallments, installmentsPage, installmentsPageSize),
    [allInstallments, installmentsPage, installmentsPageSize],
  )
  const paginatedServices = useMemo(
    () => paginateItems(completedServices, servicesPage, servicesPageSize),
    [completedServices, servicesPage, servicesPageSize],
  )
  const paginatedAgenda = useMemo(
    () => paginateItems(scheduledServices, agendaPage, agendaPageSize),
    [scheduledServices, agendaPage, agendaPageSize],
  )
  const paginatedAttachments = useMemo(
    () => paginateItems(clientAttachments, attachmentsPage, attachmentsPageSize),
    [clientAttachments, attachmentsPage, attachmentsPageSize],
  )

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

  const paidInstallments = allInstallments.filter((installment) => installment.status === "paid")
  const overdueInstallments = allInstallments.filter((installment) => ["late", "overdue"].includes(installment.status))
  const pendingInstallments = allInstallments.filter((installment) => installment.status === "pending")
  const totalPaid = paidInstallments.reduce(
    (accumulator, installment) => accumulator + (installment.paidValue ?? installment.value),
    0,
  )
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
        <CardContent className="">
          <div className="flex items-start gap-4">
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

              <div className="space-y-2 text-sm">
                <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0" />
                  <span>{client.phone}</span>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="truncate">{client.email}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <div className="overflow-x-auto rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Valor total</TableHead>
                  <TableHead className="hidden md:table-cell">Vigência</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientContracts.map((contract) => (
                  <TableRow
                    key={contract.id}
                    className="cursor-pointer"
                    onClick={() => router.push(getContractProfileHref(contract.id))}
                  >
                    <TableCell>
                      <Link
                        href={getContractProfileHref(contract.id)}
                        className="block hover:text-primary"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <p className="font-medium">{contract.contractNumber}</p>
                        <p className="text-xs text-muted-foreground">{contract.services.length} serviço(s)</p>
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{formatCurrency(contract.totalValue)}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {formatDate(contract.startDate)} - {formatDate(contract.endDate)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          ["signed", "active"].includes(contract.status)
                            ? "bg-green-100 text-green-700"
                            : contract.status === "pending_signature"
                              ? "bg-amber-100 text-amber-700"
                              : contract.status === "overdue"
                                ? "bg-red-100 text-red-700"
                                : contract.status === "refused"
                                  ? "bg-orange-100 text-orange-700"
                                  : contract.status === "deadline_expired"
                                    ? "bg-purple-100 text-purple-700"
                                    : contract.status === "cancelled"
                                      ? "bg-red-100 text-red-700"
                                      : contract.status === "expired"
                                        ? "bg-gray-100 text-gray-700"
                                        : "bg-gray-100 text-gray-600"
                        }
                      >
                        {["signed", "active"].includes(contract.status)
                          ? "Assinado"
                          : contract.status === "pending_signature"
                            ? "Aguardando assinatura"
                            : contract.status === "overdue"
                              ? "Em atraso"
                              : contract.status === "refused"
                                ? "Recusado"
                                : contract.status === "deadline_expired"
                                  ? "Prazo expirado"
                                  : contract.status === "expired"
                                    ? "Expirado"
                                    : contract.status === "cancelled"
                                      ? "Cancelado"
                                      : "Rascunho"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" asChild>
                          <Link
                            href={getContractProfileHref(contract.id)}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                        {contract.documentUrl ? (
                          <Button variant="ghost" size="icon" onClick={(event) => event.stopPropagation()}>
                            <Download className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {clientContracts.length === 0 ? (
                  <TableEmptyState colSpan={5} icon={FileText} title="Nenhum contrato encontrado." />
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
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allInstallments.length === 0 ? (
                    <TableEmptyState colSpan={6} icon={DollarSign} title="Nenhuma parcela encontrada." />
                  ) : (
                    paginatedInstallments.map((installment) => (
                      <TableRow key={installment.id}>
                        <TableCell className="text-sm">{installment.contractNumber}</TableCell>
                        <TableCell>
                          {installment.number}/{installment.installmentsCount}
                        </TableCell>
                        <TableCell className="font-medium">{formatCurrency(installment.value)}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm">{formatDate(installment.dueDate)}</TableCell>
                        <TableCell>{getInstallmentStatusBadge(installment.status)}</TableCell>
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

        <TabsContent value="servicos" className="mt-4">
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="hidden md:table-cell">Equipe / Funcionários</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedServices.map((service) => {
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
              <Table>
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
                <TableBody>
                  {paginatedAgenda.map((service) => {
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead className="hidden md:table-cell">Origem</TableHead>
                    <TableHead className="hidden md:table-cell">Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAttachments.map((attachment) => (
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
                          {attachment.source === "manual" ? (
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
    </div>
  )
}
