"use client"

import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  FileText,
  Building2,
  Calendar,
  DollarSign,
  Users,
  Download,
  ExternalLink,
  CheckCircle,
  Clock,
  AlertTriangle,
  MapPin,
  MoreHorizontal
} from "lucide-react"
import {
  contracts,
  getClientById,
  getServiceTypeById,
  getTeamById,
  formatCurrency,
  formatDate
} from "@/lib/mock-data"
import type { RecurrenceRule } from "@/lib/types"
import { cn } from "@/lib/utils"
import { RefreshCw } from "lucide-react"
import Link from "next/link"

interface ContractDetailProps {
  contractId: string
}

export function ContractDetail({ contractId }: ContractDetailProps) {
  const contract = contracts.find(c => c.id === contractId)
  
  if (!contract) {
    return (
      <Card className="p-8 text-center">
        <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-2">Contrato não encontrado</h3>
        <p className="text-sm text-muted-foreground mb-4">
          O contrato solicitado não existe ou foi removido
        </p>
        <Link href="/contratos">
          <Button>Voltar para Contratos</Button>
        </Link>
      </Card>
    )
  }

  const client = getClientById(contract.clientId)
  const [installments, setInstallments] = useState(() => contract.installments)

  const paidInstallments = useMemo(
    () => installments.filter(i => i.status === "paid"),
    [installments]
  )
  const overdueInstallments = useMemo(
    () => installments.filter(i => i.status === "overdue"),
    [installments]
  )
  const pendingInstallments = useMemo(
    () => installments.filter(i => i.status === "pending"),
    [installments]
  )
  const progress = useMemo(
    () => (paidInstallments.length / contract.installmentsCount) * 100,
    [paidInstallments.length, contract.installmentsCount]
  )
  const totalPaid = useMemo(
    () => paidInstallments.reduce((acc, i) => acc + (i.paidValue || 0), 0),
    [paidInstallments]
  )
  const totalOverdue = useMemo(
    () => overdueInstallments.reduce((acc, i) => acc + i.value, 0),
    [overdueInstallments]
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500 text-white">Ativo</Badge>
      case "pending_signature":
        return <Badge className="bg-amber-500 text-white">Aguardando Assinatura</Badge>
      case "expired":
        return <Badge variant="secondary">Expirado</Badge>
      case "cancelled":
        return <Badge variant="destructive">Cancelado</Badge>
      default:
        return <Badge variant="secondary">Rascunho</Badge>
    }
  }

  const getInstallmentStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-500 text-white">Pago</Badge>
      case "overdue":
        return <Badge variant="destructive">Vencido</Badge>
      default:
        return <Badge variant="secondary">Pendente</Badge>
    }
  }

  const setInstallmentStatus = (installmentId: string, status: "pending" | "paid" | "overdue") => {
    setInstallments((prev) =>
      prev.map((i) => {
        if (i.id !== installmentId) return i
        if (status === "paid") {
          return {
            ...i,
            status,
            paidDate: new Date(),
            paidValue: i.value,
          }
        }
        if (status === "overdue") {
          return {
            ...i,
            status,
            paidDate: undefined,
            paidValue: undefined,
          }
        }
        return {
          ...i,
          status: "pending",
          paidDate: undefined,
          paidValue: undefined,
        }
      })
    )
  }

  const unitIds = useMemo(() => {
    const directUnitIds = (contract as unknown as { unitIds?: string[] }).unitIds ?? []
    const serviceUnitIds = contract.services.flatMap((s) => (s.unitIds ?? []))

    const merged = [...new Set([...directUnitIds, ...serviceUnitIds])]
    if (merged.length > 0) return merged

    const primary = client?.units?.find((u) => u.isPrimary) ?? client?.units?.[0]
    return primary ? [primary.id] : []
  }, [client?.units, contract.services])

  const units = useMemo(() => {
    if (!client?.units?.length || unitIds.length === 0) return []
    const byId = new Map(client.units.map((u) => [u.id, u] as const))
    const linked = unitIds.map((id) => byId.get(id)).filter(Boolean) as NonNullable<typeof client>["units"]
    return [...linked].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
  }, [client?.units, unitIds])

  return (
    <div className="space-y-6">
      {/* Contract Header */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="w-7 h-7 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold">{contract.contractNumber}</h2>
                {getStatusBadge(contract.status)}
              </div>
              <Link href={`/clientes/${client?.id}`} className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                <Building2 className="w-4 h-4" />
                <span>{client?.companyName}</span>
              </Link>
              <div className="flex flex-wrap gap-4 mt-2 text-sm">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(contract.startDate)} - {formatDate(contract.endDate)}</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <DollarSign className="w-4 h-4" />
                  <span className="font-medium text-foreground">{formatCurrency(contract.totalValue)}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2 [&>*]:flex-1 [&>*]:sm:flex-initial">
            {contract.documentUrl && (
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Baixar PDF
              </Button>
            )}
            {contract.signatureUrl && (
              <Button variant="outline" size="sm">
                <ExternalLink className="w-4 h-4 mr-2" />
                ClickSign
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Progress and Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valor Pago</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(totalPaid)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pendente</p>
              <p className="text-lg font-bold">{formatCurrency(contract.totalValue - totalPaid)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Em Atraso</p>
              <p className="text-lg font-bold text-red-600">{formatCurrency(totalOverdue)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium">{paidInstallments.length}/{contract.installmentsCount} parcelas</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </Card>
      </div>

      {/* Recurrence Rules */}
      {(() => {
        const recurrenceRules = (contract as unknown as { recurrenceRules?: RecurrenceRule[] }).recurrenceRules ?? []
        const contractRecurrence = (contract as unknown as { recurrence?: string }).recurrence ?? ""
        const totalUnitCount = units.reduce((acc, u) => acc + (u.unitCount ?? 0), 0)

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

        return (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <RefreshCw className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Recorrência das Visitas</h3>
              {contractRecurrence && (
                <Badge variant="secondary" className="ml-auto">
                  {getRecurrenceLabel(contractRecurrence)}
                </Badge>
              )}
            </div>

            {totalUnitCount > 0 && (
              <p className="text-sm text-muted-foreground mb-4">
                Total de unidades: <span className="font-medium text-foreground">{totalUnitCount}</span>
              </p>
            )}

            {recurrenceRules.length > 0 ? (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left font-medium text-xs px-3 py-2">Tipo</th>
                      <th className="text-left font-medium text-xs px-3 py-2">Condição</th>
                      <th className="text-left font-medium text-xs px-3 py-2">Recorrência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recurrenceRules.map((rule: RecurrenceRule, idx: number) => {
                      const isActiveRule = totalUnitCount > 0 && (
                        (rule.type === "range" && totalUnitCount >= rule.minUnits && totalUnitCount <= rule.maxUnits) ||
                        (rule.type === "above" && totalUnitCount > rule.minUnits)
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
                                <span className="font-medium">{rule.minUnits}</span>
                                <span className="text-muted-foreground">até</span>
                                <span className="font-medium">{rule.maxUnits}</span>
                                <span className="text-muted-foreground text-xs">unid.</span>
                                {isActiveRule && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Aplicada</Badge>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium">{rule.minUnits}</span>
                                <span className="text-muted-foreground text-xs">unid.</span>
                                {isActiveRule && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Aplicada</Badge>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className="font-medium">{getRecurrenceLabel(rule.recurrence)}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma regra de recorrência definida</p>
            )}
          </Card>
        )
      })()}

      {/* Tabs for Services, Installments, Units */}
      <Tabs defaultValue="services" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="services">Serviços ({contract.services.length})</TabsTrigger>
          <TabsTrigger value="installments">Parcelas ({contract.installmentsCount})</TabsTrigger>
          <TabsTrigger value="units">Filiais ({unitIds.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="mt-4">
          <div className="rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Equipe</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contract.services.map((service) => {
                  const serviceType = getServiceTypeById(service.serviceTypeId)
                  const teamsLabel = (service.teamIds ?? [])
                    .map((id) => getTeamById(id)?.name)
                    .filter(Boolean)
                    .join(", ")
                  return (
                    <TableRow key={service.id}>
                      <TableCell className="font-medium">{serviceType?.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span>{teamsLabel || "Não definida"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(service.value)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="installments" className="mt-4">
          <div className="rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data Pagamento</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installments.map((installment, index) => (
                  <TableRow key={installment.id}>
                    <TableCell className="font-medium">{index + 1}/{contract.installmentsCount}</TableCell>
                    <TableCell>{formatDate(installment.dueDate)}</TableCell>
                    <TableCell>{formatCurrency(installment.value)}</TableCell>
                    <TableCell>{getInstallmentStatusBadge(installment.status)}</TableCell>
                    <TableCell>
                      {installment.paidDate ? formatDate(installment.paidDate) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
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
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="units" className="mt-4">
          <div className="rounded-md overflow-x-auto">
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
                      Nenhuma filial vinculada a este contrato
                    </TableCell>
                  </TableRow>
                ) : (
                  units.map((unit) => (
                    <TableRow key={unit.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          {unit.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {unit.address.street}, {unit.address.number} - {unit.address.city}/{unit.address.state}
                      </TableCell>
                      <TableCell>
                        {unit.unitCount ?? "-"}
                      </TableCell>
                      <TableCell>
                        {unit.isPrimary ? <Badge variant="secondary">Matriz</Badge> : <Badge variant="outline">Filial</Badge>}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
