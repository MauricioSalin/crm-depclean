"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { buildApiFileUrl } from "@/lib/api/client"
import { getClientAttachments, getClientById, type ClientAttachmentRecord } from "@/lib/api/clients"
import { listContracts, type ContractInstallmentRecord } from "@/lib/api/contracts"
import { listSchedules } from "@/lib/api/schedules"
import { listServices } from "@/lib/api/services"
import { listClientTypes } from "@/lib/api/settings"
import { listTeams } from "@/lib/api/teams"

interface ClientProfileProps {
  clientId: string
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const formatDate = (value?: string) =>
  value ? new Intl.DateTimeFormat("pt-BR").format(new Date(value)) : "-"

const formatCNPJ = (value: string) => {
  const digits = value.replace(/\D/g, "")
  if (digits.length !== 14) return value
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
}

const resolveColor = (color?: string) => {
  if (!color) return "#84CC16"
  if (color.startsWith("#")) return color
  return "#84CC16"
}

const getScheduleStatusLabel = (status: string) => {
  switch (status) {
    case "draft":
      return "Rascunho"
    case "scheduled":
      return "Agendado"
    case "in_progress":
      return "Em andamento"
    case "completed":
      return "Concluído"
    case "cancelled":
      return "Cancelado"
    case "rescheduled":
      return "Reagendado"
    default:
      return status
  }
}

export function ClientProfile({ clientId }: ClientProfileProps) {
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

  const [installmentOverrides, setInstallmentOverrides] = useState<
    Record<string, { status: ContractInstallmentRecord["status"]; paidDate?: string; paidValue?: number }>
  >({})

  const clientContracts = useMemo(
    () => (contractsQuery.data?.data ?? []).filter((contract) => contract.clientId === resolvedClientId),
    [contractsQuery.data?.data, resolvedClientId],
  )
  const clientServices = useMemo(
    () => (schedulesQuery.data?.data ?? []).filter((service) => service.clientId === resolvedClientId),
    [schedulesQuery.data?.data, resolvedClientId],
  )
  const clientAttachments = attachmentsQuery.data?.data ?? []
  const serviceTypeMap = useMemo(
    () => new Map((servicesQuery.data?.data ?? []).map((service) => [service.id, service] as const)),
    [servicesQuery.data?.data],
  )
  const teamMap = useMemo(
    () => new Map((teamsQuery.data?.data ?? []).map((team) => [team.id, team] as const)),
    [teamsQuery.data?.data],
  )
  const clientType = (clientTypesQuery.data?.data.items ?? []).find((item) => item.id === client?.clientTypeId)
  const clientTypeColor = resolveColor(clientType?.color)
  const activeContracts = clientContracts.filter((contract) => ["signed", "active"].includes(contract.status)).length

  const allInstallments = useMemo(() => {
    return clientContracts.flatMap((contract) =>
      contract.installments.map((installment) => {
        const override = installmentOverrides[installment.id]
        return override ? { ...installment, ...override } : installment
      }),
    )
  }, [clientContracts, installmentOverrides])

  const paidInstallments = allInstallments.filter((installment) => installment.status === "paid")
  const overdueInstallments = allInstallments.filter((installment) => installment.status === "overdue")
  const pendingInstallments = allInstallments.filter((installment) => installment.status === "pending")
  const totalPaid = paidInstallments.reduce(
    (accumulator, installment) => accumulator + (installment.paidValue ?? installment.value),
    0,
  )
  const totalOverdue = overdueInstallments.reduce((accumulator, installment) => accumulator + installment.value, 0)
  const totalPending = pendingInstallments.reduce((accumulator, installment) => accumulator + installment.value, 0)

  if (clientQuery.isLoading) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">Carregando cliente...</Card>
  }

  if (!client) {
    return (
      <Card className="p-8 text-center">
        <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 font-semibold">Cliente não encontrado</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          O cliente solicitado não existe ou foi removido.
        </p>
        <Link href="/clientes">
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

  const formatAttachmentSize = (size?: number) => {
    if (!size) return "-"
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
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
      <Card className="overflow-hidden">
        <CardContent className="px-4 py-3">
          <div className="mb-3 flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${clientTypeColor}1A` }}
            >
              <Building2 className="h-5 w-5" style={{ color: clientTypeColor }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                <h3 className="min-w-0 flex-1 break-words text-sm font-semibold">{client.companyName}</h3>
                <Badge
                  style={{ backgroundColor: clientTypeColor }}
                  className="shrink-0 border-0 text-xs text-white hover:opacity-90"
                >
                  {clientType?.name ?? "Cliente"}
                </Badge>
              </div>
              <p className="font-mono text-xs text-muted-foreground">{formatCNPJ(client.cnpj)}</p>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4 shrink-0" />
              <span>{client.phone}</span>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4 shrink-0" />
              <span className="truncate">{client.email}</span>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="h-4 w-4 shrink-0" />
              <span>{activeContracts} contrato(s) ativo(s)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Contratos ativos</p>
              <p className="text-2xl font-bold">{activeContracts}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <DollarSign className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total pago</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pendente</p>
              <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalPending)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vencido</p>
              <p className="text-2xl font-bold text-destructive">{formatCurrency(totalOverdue)}</p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="dados" className="w-full">
        <TabsList className="grid w-full grid-cols-2 gap-2 bg-transparent p-0 sm:grid-cols-3 lg:grid-cols-6">
          <TabsTrigger
            onFocus={(event) => event.currentTarget.focus({ preventScroll: true })}
            value="dados"
            className="w-full rounded-full bg-muted px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <span className="font-semibold">Dados</span>
          </TabsTrigger>
          <TabsTrigger
            onFocus={(event) => event.currentTarget.focus({ preventScroll: true })}
            value="contratos"
            className="w-full rounded-full bg-muted px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <span className="font-semibold">Contratos</span>
          </TabsTrigger>
          <TabsTrigger
            onFocus={(event) => event.currentTarget.focus({ preventScroll: true })}
            value="parcelas"
            className="w-full rounded-full bg-muted px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <span className="font-semibold">Parcelas</span>
          </TabsTrigger>
          <TabsTrigger
            onFocus={(event) => event.currentTarget.focus({ preventScroll: true })}
            value="servicos"
            className="w-full rounded-full bg-muted px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <span className="font-semibold">Serviços</span>
          </TabsTrigger>
          <TabsTrigger
            onFocus={(event) => event.currentTarget.focus({ preventScroll: true })}
            value="agenda"
            className="w-full rounded-full bg-muted px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <span className="font-semibold">Agenda</span>
          </TabsTrigger>
          <TabsTrigger
            onFocus={(event) => event.currentTarget.focus({ preventScroll: true })}
            value="anexos"
            className="w-full rounded-full bg-muted px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <span className="font-semibold">Anexos</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-4">
          <div className="space-y-4">
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
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        Nenhuma filial cadastrada.
                      </TableCell>
                    </TableRow>
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
                  <TableRow key={contract.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{contract.contractNumber}</p>
                        <p className="text-xs text-muted-foreground">{contract.services.length} serviço(s)</p>
                      </div>
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
                          <Link href={`/contratos/${contract.id}`}>
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                        {contract.documentUrl ? (
                          <Button variant="ghost" size="icon">
                            <Download className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {clientContracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center">
                      <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">Nenhum contrato encontrado.</p>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="parcelas" className="mt-4">
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
                {clientContracts.flatMap((contract) =>
                  contract.installments.map((installment) => {
                    const override = installmentOverrides[installment.id]
                    const displayInstallment = override ? { ...installment, ...override } : installment

                    return (
                      <TableRow key={installment.id}>
                        <TableCell className="text-sm">{contract.contractNumber}</TableCell>
                        <TableCell>
                          {installment.number}/{contract.installmentsCount}
                        </TableCell>
                        <TableCell className="font-medium">{formatCurrency(installment.value)}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm">{formatDate(installment.dueDate)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              displayInstallment.status === "paid"
                                ? "default"
                                : displayInstallment.status === "overdue"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {displayInstallment.status === "paid"
                              ? "Paga"
                              : displayInstallment.status === "overdue"
                                ? "Vencida"
                                : "Pendente"}
                          </Badge>
                        </TableCell>
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
                                Marcar como atrasada
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setInstallmentStatus(installment.id, "pending")}>
                                Marcar como pendente
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  }),
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="servicos" className="mt-4">
          <div className="overflow-x-auto rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serviço</TableHead>
                  <TableHead className="hidden md:table-cell">Equipe</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientServices
                  .filter((service) => service.status === "completed")
                  .map((service) => {
                    const serviceType = serviceTypeMap.get(service.serviceTypeId)
                    const team = service.teams[0] ?? (service.teamId ? teamMap.get(service.teamId) : undefined)

                    return (
                      <TableRow key={service.id}>
                        <TableCell>
                          <p className="font-medium">{serviceType?.name ?? service.serviceTypeName}</p>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{team?.name}</TableCell>
                        <TableCell className="text-sm">{formatDate(service.date)}</TableCell>
                        <TableCell>
                          <Badge variant="default">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Concluído
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}

                {clientServices.filter((service) => service.status === "completed").length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center">
                      <CheckCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">Nenhum serviço realizado ainda.</p>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="agenda" className="mt-4">
          <div className="overflow-x-auto rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serviço</TableHead>
                  <TableHead className="hidden md:table-cell">Equipe</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientServices
                  .filter((service) => ["draft", "scheduled", "in_progress", "rescheduled"].includes(service.status))
                  .map((service) => {
                    const serviceType = serviceTypeMap.get(service.serviceTypeId)
                    const team = service.teams[0] ?? (service.teamId ? teamMap.get(service.teamId) : undefined)

                    return (
                      <TableRow key={service.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{serviceType?.name ?? service.serviceTypeName}</p>
                            {service.isEmergency ? <AlertTriangle className="h-4 w-4 text-destructive" /> : null}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{team?.name}</TableCell>
                        <TableCell className="text-sm">{formatDate(service.date)}</TableCell>
                        <TableCell className="text-sm">{service.time || "08:00"}</TableCell>
                        <TableCell>
                          <Badge variant={service.status === "in_progress" ? "default" : "secondary"}>
                            {getScheduleStatusLabel(service.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}

                {clientServices.filter((service) => ["draft", "scheduled", "in_progress", "rescheduled"].includes(service.status)).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center">
                      <Calendar className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">Nenhum serviço agendado.</p>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="anexos" className="mt-4">
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
                {clientAttachments.map((attachment) => (
                  <TableRow key={attachment.id}>
                    <TableCell>
                      <Badge variant="secondary">{getAttachmentTypeLabel(attachment.type)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                          <FileCheck2 className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{attachment.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {attachment.fileName} - {formatAttachmentSize(attachment.fileSize)}
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
                      <Button variant="ghost" size="icon" asChild>
                        <a href={buildApiFileUrl(attachment.documentUrl)} target="_blank" rel="noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}

                {!attachmentsQuery.isLoading && clientAttachments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center">
                      <Paperclip className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">Nenhum anexo vinculado a este cliente.</p>
                    </TableCell>
                  </TableRow>
                ) : null}

                {attachmentsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Carregando anexos...
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
