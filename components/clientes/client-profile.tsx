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
import { getClientAttachments } from "@/lib/api/clients"
import {
  clients,
  contracts,
  formatCNPJ,
  formatCurrency,
  formatDate,
  getClientTypeById,
  getServiceTypeById,
  getTeamById,
  scheduledServices,
} from "@/lib/mock-data"
import type { ClientAttachmentType, InstallmentStatus } from "@/lib/types"
import { getColorFromClass } from "@/lib/utils"

interface ClientProfileProps {
  clientId: string
}

export function ClientProfile({ clientId }: ClientProfileProps) {
  const client = clients.find((item) => item.id === clientId)

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

  const clientType = getClientTypeById(client.clientTypeId)
  const clientContracts = contracts.filter((contract) => contract.clientId === client.id)
  const activeContracts = clientContracts.filter((contract) => contract.status === "active").length
  const clientServices = scheduledServices.filter((service) => service.clientId === client.id)
  const attachmentsQuery = useQuery({
    queryKey: ["client-attachments", client.id],
    queryFn: () => getClientAttachments(client.id),
  })
  const clientAttachments = attachmentsQuery.data?.data ?? []

  const [installmentOverrides, setInstallmentOverrides] = useState<
    Record<string, { status: InstallmentStatus; paidDate?: Date; paidValue?: number }>
  >({})

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
    (accumulator, installment) => accumulator + (installment.paidValue || 0),
    0,
  )
  const totalOverdue = overdueInstallments.reduce((accumulator, installment) => accumulator + installment.value, 0)
  const totalPending = pendingInstallments.reduce((accumulator, installment) => accumulator + installment.value, 0)

  const getAttachmentTypeLabel = (type: ClientAttachmentType) => {
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

  const setInstallmentStatus = (installmentId: string, status: InstallmentStatus) => {
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
            paidDate: new Date(),
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
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${getColorFromClass(clientType?.color || "")}1A` }}
            >
              <Building2 className="h-5 w-5" style={{ color: getColorFromClass(clientType?.color || "") }} />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">{client.companyName}</h3>
              <p className="font-mono text-xs text-muted-foreground">{formatCNPJ(client.cnpj)}</p>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0" />
                <span>{client.phone}</span>
              </div>
              <Badge
                style={{ backgroundColor: getColorFromClass(clientType?.color || "") }}
                className="shrink-0 border-0 text-xs text-white hover:opacity-90"
              >
                {clientType?.name}
              </Badge>
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
                      <Badge className={`${clientType?.color} text-white`}>{clientType?.name}</Badge>
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
                          contract.status === "active"
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
                        {contract.status === "active"
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
                    const serviceType = getServiceTypeById(service.serviceTypeId)
                    const team = getTeamById(service.teamIds[0])

                    return (
                      <TableRow key={service.id}>
                        <TableCell>
                          <p className="font-medium">{serviceType?.name}</p>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{team?.name}</TableCell>
                        <TableCell className="text-sm">{formatDate(service.completedAt || service.scheduledDate)}</TableCell>
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
                  .filter((service) => service.status === "scheduled" || service.status === "in_progress")
                  .map((service) => {
                    const serviceType = getServiceTypeById(service.serviceTypeId)
                    const team = getTeamById(service.teamIds[0])

                    return (
                      <TableRow key={service.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{serviceType?.name}</p>
                            {service.isEmergency ? <AlertTriangle className="h-4 w-4 text-destructive" /> : null}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{team?.name}</TableCell>
                        <TableCell className="text-sm">{formatDate(service.scheduledDate)}</TableCell>
                        <TableCell className="text-sm">{service.scheduledTime || "08:00"}</TableCell>
                        <TableCell>
                          <Badge variant={service.status === "in_progress" ? "default" : "secondary"}>
                            {service.status === "in_progress" ? "Em andamento" : "Agendado"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}

                {clientServices.filter((service) => service.status === "scheduled" || service.status === "in_progress").length === 0 ? (
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
                      {attachment.source === "agenda" ? "Agenda" : attachment.source === "ai" ? "IA" : "Manual"}
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
