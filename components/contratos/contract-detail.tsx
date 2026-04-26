"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  ExternalLink,
  FileText,
  Eye,
  MapPin,
  MoreHorizontal,
  RefreshCw,
  Users,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/use-toast"
import { ServiceClausesDialog } from "@/components/servicos/service-clauses-dialog"
import { buildApiFileUrl } from "@/lib/api/client"
import { getClientById } from "@/lib/api/clients"
import { getContractById, updateInstallment } from "@/lib/api/contracts"
import { listEmployees } from "@/lib/api/employees"
import { listServices, type ServiceRecurrenceRuleRecord } from "@/lib/api/services"
import { listTeams } from "@/lib/api/teams"
import { cn } from "@/lib/utils"

interface ContractDetailProps {
  contractId: string
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const formatDate = (value?: string) =>
  value ? new Intl.DateTimeFormat("pt-BR").format(new Date(value)) : "-"

const formatDuration = (duration: number, durationType: "hours" | "shift" | "days") => {
  if (durationType === "hours") return `${duration} hora${duration === 1 ? "" : "s"}`
  if (durationType === "days") return `${duration} dia${duration === 1 ? "" : "s"}`
  return `${duration} turno${duration === 1 ? "" : "s"}`
}

const getRecurrenceLabel = (value: string) =>
  (
    {
      weekly: "Semanal",
      biweekly: "Quinzenal",
      monthly: "Mensal",
      bimonthly: "Bimestral",
      quarterly: "Trimestral",
      semiannual: "Semestral",
      annual: "Anual",
    } as Record<string, string>
  )[value] ?? value

const getStatusBadge = (status: string) => {
  switch (status) {
    case "active":
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Assinado</Badge>
    case "pending_signature":
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Aguardando assinatura</Badge>
    case "overdue":
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Em atraso</Badge>
    case "refused":
      return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Recusado</Badge>
    case "expired":
      return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Expirado</Badge>
    case "deadline_expired":
      return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">Prazo expirado</Badge>
    case "cancelled":
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Cancelado</Badge>
    default:
      return <Badge variant="secondary">Rascunho</Badge>
  }
}

const getInstallmentStatusBadge = (status: string) => {
  switch (status) {
    case "paid":
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Paga</Badge>
    case "overdue":
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Vencida</Badge>
    case "cancelled":
      return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Cancelada</Badge>
    default:
      return <Badge variant="secondary">Pendente</Badge>
  }
}

export function ContractDetail({ contractId }: ContractDetailProps) {
  const queryClient = useQueryClient()
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)

  const contractQuery = useQuery({
    queryKey: ["contract", contractId],
    queryFn: () => getContractById(contractId),
  })

  const contract = contractQuery.data?.data

  const clientQuery = useQuery({
    queryKey: ["client", contract?.clientId],
    queryFn: () => getClientById(contract!.clientId),
    enabled: Boolean(contract?.clientId),
  })

  const servicesQuery = useQuery({
    queryKey: ["services", "contract-detail"],
    queryFn: () => listServices(""),
  })

  const teamsQuery = useQuery({
    queryKey: ["teams", "contract-detail"],
    queryFn: () => listTeams(""),
  })

  const employeesQuery = useQuery({
    queryKey: ["employees", "contract-detail"],
    queryFn: () => listEmployees(""),
  })

  const client = clientQuery.data?.data
  const serviceTypes = servicesQuery.data?.data ?? []
  const teams = teamsQuery.data?.data ?? []
  const employees = employeesQuery.data?.data ?? []

  const serviceTypeMap = useMemo(() => new Map(serviceTypes.map((item) => [item.id, item])), [serviceTypes])
  const teamMap = useMemo(() => new Map(teams.map((item) => [item.id, item])), [teams])
  const employeeMap = useMemo(() => new Map(employees.map((item) => [item.id, item])), [employees])

  const selectedService = useMemo(
    () => contract?.services.find((service) => service.id === selectedServiceId) ?? null,
    [contract?.services, selectedServiceId],
  )

  const paidInstallments = useMemo(
    () => contract?.installments.filter((installment) => installment.status === "paid") ?? [],
    [contract?.installments],
  )

  const overdueInstallments = useMemo(
    () => contract?.installments.filter((installment) => installment.status === "overdue") ?? [],
    [contract?.installments],
  )

  const totalPaid = useMemo(
    () =>
      paidInstallments.reduce(
        (accumulator, installment) => accumulator + Number(installment.paidValue ?? installment.value),
        0,
      ),
    [paidInstallments],
  )

  const totalOverdue = useMemo(
    () => overdueInstallments.reduce((accumulator, installment) => accumulator + Number(installment.value ?? 0), 0),
    [overdueInstallments],
  )

  const progress = contract && contract.installmentsCount > 0 ? (paidInstallments.length / contract.installmentsCount) * 100 : 0

  const units = useMemo(() => {
    if (!client?.units?.length || !contract) return []
    const directUnitIds = contract.unitIds ?? []
    const serviceUnitIds = contract.services.flatMap((service) => service.unitIds ?? [])
    const unitIds = [...new Set([...directUnitIds, ...serviceUnitIds])]

    if (unitIds.length === 0) return client.units
    return client.units.filter((unit) => unitIds.includes(unit.id))
  }, [client?.units, contract])

  const recurrenceRules = useMemo(
    () => (contract?.recurrenceRules ?? []) as ServiceRecurrenceRuleRecord[],
    [contract?.recurrenceRules],
  )

  const installmentMutation = useMutation({
    mutationFn: ({
      installmentId,
      status,
    }: {
      installmentId: string
      status: "pending" | "paid" | "overdue" | "cancelled"
    }) =>
      updateInstallment(contractId, installmentId, {
        status,
        paidDate: status === "paid" ? new Date().toISOString() : undefined,
        paidValue:
          status === "paid" && contract
            ? contract.installments.find((installment) => installment.id === installmentId)?.value
            : undefined,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contract", contractId] })
      await queryClient.invalidateQueries({ queryKey: ["contracts"] })
      toast({
        title: "Parcela atualizada",
        description: "O status da parcela foi atualizado com sucesso.",
      })
    },
  })

  if (contractQuery.isLoading) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">Carregando contrato...</Card>
  }

  if (contractQuery.isError) {
    return (
      <Card className="p-8 text-center">
        <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 font-semibold">Erro ao carregar contrato</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Não foi possível buscar os dados do contrato agora. Verifique a conexão com a API e tente novamente.
        </p>
        <Link href="/contratos">
          <Button>Voltar para contratos</Button>
        </Link>
      </Card>
    )
  }

  if (!contract) {
    return (
      <Card className="p-8 text-center">
        <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 font-semibold">Contrato não encontrado</h3>
        <p className="mb-4 text-sm text-muted-foreground">O contrato solicitado não existe ou foi removido.</p>
        <Link href="/contratos">
          <Button>Voltar para contratos</Button>
        </Link>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
              <FileText className="h-7 w-7 text-primary" />
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold">{contract.contractNumber}</h2>
                {getStatusBadge(contract.status)}
              </div>
              <Link
                href={`/clientes/${contract.clientId}`}
                className="flex items-center gap-2 text-muted-foreground hover:text-primary"
              >
                <Building2 className="h-4 w-4" />
                <span>{contract.clientCompanyName ?? client?.companyName ?? "Cliente"}</span>
              </Link>
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  {formatDate(contract.startDate)} - {formatDate(contract.endDate)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4 lg:min-w-[260px]">
            <div className="flex flex-wrap gap-2">
              {contract.documentUrl ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={buildApiFileUrl(contract.documentUrl)} target="_blank" rel="noreferrer">
                    <Download className="mr-2 h-4 w-4" />
                    Baixar DOCX
                  </a>
                </Button>
              ) : null}
              {contract.signatureUrl ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={contract.signatureUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    ClickSign
                  </a>
                </Button>
              ) : null}
            </div>

            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-muted-foreground">
                  {paidInstallments.length}/{contract.installmentsCount} parcelas pagas
                </span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valor total</p>
              <p className="text-lg font-bold">{formatCurrency(contract.totalValue)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valor pago</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(totalPaid)}</p>
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
              <p className="text-lg font-bold text-amber-600">
                {formatCurrency(Math.max(contract.totalValue - totalPaid, 0))}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
              <RefreshCw className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Em atraso</p>
              <p className="text-lg font-bold text-red-600">{formatCurrency(totalOverdue)}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Recorrência das visitas</h3>
          <Badge variant="secondary" className="ml-auto">
            {getRecurrenceLabel(contract.recurrence)}
          </Badge>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Total de unidades vinculadas:{" "}
          <span className="font-medium text-foreground">
            {units.reduce((sum, unit) => sum + Number(unit.unitCount ?? 0), 0)}
          </span>
        </p>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Condição</TableHead>
                <TableHead>Recorrência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recurrenceRules.map((rule, index) => (
                <TableRow key={`${rule.type}-${index}`}>
                  <TableCell>
                    <Badge variant="outline">{rule.type === "range" ? "De - Até" : "Acima de"}</Badge>
                  </TableCell>
                  <TableCell>
                    {rule.type === "range"
                      ? `${rule.minUnits} até ${rule.maxUnits} unidades`
                      : `Acima de ${rule.minUnits} unidades`}
                  </TableCell>
                  <TableCell>{getRecurrenceLabel(rule.recurrence)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Tabs defaultValue="services" className="w-full">
        <TabsList className="grid w-full grid-cols-3 gap-2 bg-transparent p-0">
          <TabsTrigger
            onFocus={(event) => event.currentTarget.focus({ preventScroll: true })}
            value="services"
            className="w-full rounded-full bg-muted px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <span className="font-semibold">Serviços ({contract.services.length})</span>
          </TabsTrigger>
          <TabsTrigger
            onFocus={(event) => event.currentTarget.focus({ preventScroll: true })}
            value="installments"
            className="w-full rounded-full bg-muted px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <span className="font-semibold">Parcelas ({contract.installmentsCount})</span>
          </TabsTrigger>
          <TabsTrigger
            onFocus={(event) => event.currentTarget.focus({ preventScroll: true })}
            value="units"
            className="w-full rounded-full bg-muted px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <span className="font-semibold">Filiais ({units.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="mt-4">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Equipe / Funcionários</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contract.services.map((service) => {
                  const serviceType = serviceTypeMap.get(service.serviceTypeId)
                  const serviceTeams = teams.filter((team) => service.teamIds.includes(team.id))
                  const serviceEmployees = employees.filter((employee) =>
                    (service.additionalEmployeeIds ?? []).includes(employee.id),
                  )

                  return (
                    <TableRow
                      key={service.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedServiceId(service.id)}
                    >
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{serviceType?.name ?? service.serviceTypeId}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {serviceType?.description || "Sem descrição cadastrada."}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {serviceTeams.length > 0 || serviceEmployees.length > 0 ? (
                            <>
                              {serviceTeams.map((team) => (
                                <Badge key={team.id} variant="secondary" className="gap-2 px-3 py-1">
                                  <span
                                    className="h-2.5 w-2.5 rounded-full"
                                    style={{ backgroundColor: team.color }}
                                  />
                                  {team.name}
                                </Badge>
                              ))}
                              {serviceEmployees.map((employee) => (
                                <Badge key={employee.id} variant="outline" className="gap-2 px-3 py-1">
                                  <Users className="h-3.5 w-3.5" />
                                  {employee.name}
                                </Badge>
                              ))}
                            </>
                          ) : (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Users className="h-4 w-4" />
                              <span>Não definida</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-foreground">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {serviceType
                              ? formatDuration(serviceType.defaultDuration, serviceType.durationType)
                              : "-"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation()
                            setSelectedServiceId(service.id)
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="installments" className="mt-4">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data de pagamento</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contract.installments.map((installment) => (
                  <TableRow key={installment.id}>
                    <TableCell className="font-medium">
                      {installment.number}/{contract.installmentsCount}
                    </TableCell>
                    <TableCell>{formatDate(installment.dueDate)}</TableCell>
                    <TableCell>{formatCurrency(installment.value)}</TableCell>
                    <TableCell>{getInstallmentStatusBadge(installment.status)}</TableCell>
                    <TableCell>{formatDate(installment.paidDate)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              installmentMutation.mutate({ installmentId: installment.id, status: "paid" })
                            }
                          >
                            Marcar como paga
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              installmentMutation.mutate({ installmentId: installment.id, status: "overdue" })
                            }
                          >
                            Marcar como vencida
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              installmentMutation.mutate({ installmentId: installment.id, status: "pending" })
                            }
                          >
                            Marcar como pendente
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="units" className="mt-4">
          <div className="overflow-x-auto rounded-md border">
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
                {units.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      Nenhuma filial vinculada a este contrato.
                    </TableCell>
                  </TableRow>
                ) : (
                  units.map((unit) => (
                    <TableRow key={unit.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          {unit.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {unit.address.street}, {unit.address.number} - {unit.address.city}/{unit.address.state}
                      </TableCell>
                      <TableCell>{unit.unitCount}</TableCell>
                      <TableCell>
                        {unit.isPrimary ? (
                          <Badge variant="secondary">Matriz</Badge>
                        ) : (
                          <Badge variant="outline">Filial</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <ServiceClausesDialog
        open={Boolean(selectedService)}
        title={
          selectedService
            ? serviceTypeMap.get(selectedService.serviceTypeId)?.name ?? "Cláusulas do serviço"
            : "Cláusulas do serviço"
        }
        description={
          selectedService
            ? serviceTypeMap.get(selectedService.serviceTypeId)?.description || "Sem descrição cadastrada."
            : undefined
        }
        clauses={
          selectedService
            ? serviceTypeMap.get(selectedService.serviceTypeId)?.clauses ?? selectedService.clauses ?? []
            : []
        }
        clausePrefix={selectedService ? String(contract.services.findIndex((service) => service.id === selectedService.id) + 1) : undefined}
        onOpenChange={(open) => !open && setSelectedServiceId(null)}
      />
    </div>
  )
}
