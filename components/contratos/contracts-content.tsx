"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  Building2,
  Calendar,
  CalendarCheck,
  Download,
  Edit,
  ExternalLink,
  Eye,
  FileText,
  MoreHorizontal,
  Search,
} from "lucide-react"

import { DataPagination } from "@/components/ui/data-pagination"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { buildApiFileUrl } from "@/lib/api/client"
import { listContracts } from "@/lib/api/contracts"
import { useUrlQueryState } from "@/lib/hooks/use-url-query-state"

interface ContractsContentProps {
  viewMode: "table" | "cards"
  viewToggle?: React.ReactNode
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value))
}

export function ContractsContent({ viewMode, viewToggle }: ContractsContentProps) {
  const [searchTerm, setSearchTerm] = useUrlQueryState("q")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const contractsQuery = useQuery({
    queryKey: ["contracts", searchTerm],
    queryFn: () => listContracts(searchTerm),
  })

  const contracts = contractsQuery.data?.data ?? []
  const filteredContracts = useMemo(() => {
    return contracts.filter((contract) => statusFilter === "all" || contract.status === statusFilter)
  }, [contracts, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredContracts.length / pageSize))
  const paginatedContracts = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredContracts.slice(start, start + pageSize)
  }, [currentPage, filteredContracts, pageSize])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "signed":
      case "active":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Assinado</Badge>
      case "pending_signature":
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Aguardando Assinatura</Badge>
      case "overdue":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Em Atraso</Badge>
      case "refused":
        return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Recusado</Badge>
      case "expired":
        return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Expirado</Badge>
      case "deadline_expired":
        return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">Prazo Expirado</Badge>
      case "cancelled":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Cancelado</Badge>
      default:
        return <Badge variant="secondary">Rascunho</Badge>
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
        <div className="relative sm:w-80 sm:flex-none">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número ou cliente..."
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value)
              setCurrentPage(1)
            }}
            className="pl-10"
          />
        </div>

        <SearchableSelect
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value)
            setCurrentPage(1)
          }}
          options={[
            { value: "draft", label: "Rascunho" },
            { value: "pending_signature", label: "Aguardando Assinatura" },
            { value: "signed", label: "Assinado" },
            { value: "overdue", label: "Em Atraso" },
            { value: "refused", label: "Recusado" },
            { value: "expired", label: "Expirado" },
            { value: "deadline_expired", label: "Prazo Expirado" },
            { value: "cancelled", label: "Cancelado" },
          ]}
          placeholder="Status"
          searchPlaceholder="Buscar status..."
          allLabel="Todos os status"
          className="sm:w-[160px] sm:flex-none"
        />

        {viewToggle ? <div className="hidden shrink-0 sm:block">{viewToggle}</div> : null}
      </div>

      {viewMode === "table" ? (
        <div className="overflow-x-auto rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Contrato</TableHead>
                <TableHead className="hidden w-[300px] sm:table-cell">Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Valor</TableHead>
                <TableHead className="hidden lg:table-cell">Vigência</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedContracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    Nenhum contrato encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedContracts.map((contract) => {
                  const paidInstallments = contract.installments.filter((item) => item.status === "paid").length
                  return (
                    <TableRow key={contract.id}>
                      <TableCell>
                        <Link href={`/contratos/${contract.id}`} className="flex items-center gap-3">
                          <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:flex">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{contract.contractNumber}</p>
                            <p className="text-xs text-muted-foreground sm:hidden">{contract.clientCompanyName}</p>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Link href={`/clientes/${contract.clientId}`} className="flex items-center gap-2 hover:text-primary">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="max-w-[250px] truncate">{contract.clientCompanyName}</span>
                        </Link>
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
                      </TableCell>
                      <TableCell>{getStatusBadge(contract.status)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/contratos/${contract.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                Ver Detalhes
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/contratos/${contract.id}/editar`}>
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </Link>
                            </DropdownMenuItem>
                            {contract.documentUrl ? (
                              <DropdownMenuItem asChild>
                                <a href={buildApiFileUrl(contract.documentUrl)} target="_blank" rel="noreferrer">
                                  <Download className="mr-2 h-4 w-4" />
                                  Baixar DOCX
                                </a>
                              </DropdownMenuItem>
                            ) : null}
                            {contract.signatureUrl ? (
                              <DropdownMenuItem asChild>
                                <a href={contract.signatureUrl} target="_blank" rel="noreferrer">
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  Ver no ClickSign
                                </a>
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paginatedContracts.map((contract) => {
            const paidInstallments = contract.installments.filter((item) => item.status === "paid").length
            const progress = contract.installmentsCount > 0 ? (paidInstallments / contract.installmentsCount) * 100 : 0

            return (
              <Card key={contract.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <Link href={`/contratos/${contract.id}`}>
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold">{contract.contractNumber}</h3>
                        <p className="truncate text-xs text-muted-foreground">{contract.clientCompanyName}</p>
                      </div>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-foreground">{formatCurrency(contract.totalValue)}</p>
                        {getStatusBadge(contract.status)}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {formatDate(contract.startDate)} - {formatDate(contract.endDate)}
                        </span>
                      </div>
                      <div className="mb-2 mt-2 flex justify-between text-xs">
                        <span>
                          {paidInstallments}/{contract.installmentsCount} parcelas pagas
                        </span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="mb-2 h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  </Link>
                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <Link href={`/contratos/${contract.id}/editar`}>
                        <Edit className="mr-1 h-4 w-4" />
                        Editar
                      </Link>
                    </Button>
                    <Button size="sm" className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                      <Link href={`/contratos/${contract.id}`}>
                        <Eye className="mr-1 h-4 w-4" />
                        Ver
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <DataPagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={filteredContracts.length}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setCurrentPage(1)
        }}
      />
    </div>
  )
}
