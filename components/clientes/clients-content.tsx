"use client"

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Building2,
  Phone,
  Mail,
  FileText,
} from "lucide-react"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { DataPagination } from "@/components/ui/data-pagination"
import { listClients } from "@/lib/api/clients"
import { listContracts } from "@/lib/api/contracts"
import { listClientTypes } from "@/lib/api/settings"
import { useUrlQueryState } from "@/lib/hooks/use-url-query-state"
import Link from "next/link"

interface ClientsContentProps {
  viewMode: "table" | "cards"
  viewToggle?: React.ReactNode
}

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

export function ClientsContent({ viewMode, viewToggle }: ClientsContentProps) {
  const [searchTerm, setSearchTerm] = useUrlQueryState("q")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const clientsQuery = useQuery({
    queryKey: ["clients", "content"],
    queryFn: () => listClients(""),
  })

  const contractsQuery = useQuery({
    queryKey: ["contracts", "clients-content"],
    queryFn: () => listContracts(""),
  })

  const clientTypesQuery = useQuery({
    queryKey: ["client-types", "clients-content"],
    queryFn: () => listClientTypes(""),
  })

  const clients = clientsQuery.data?.data ?? []
  const contracts = contractsQuery.data?.data ?? []
  const clientTypes = clientTypesQuery.data?.data.items ?? []
  const getClientTypeById = (id: string) => clientTypes.find((type) => type.id === id)

  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      const matchesSearch = client.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.responsibleName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.cnpj.includes(searchTerm)
      const matchesType = typeFilter === "all" || client.clientTypeId === typeFilter
      return matchesSearch && matchesType
    })
  }, [clients, searchTerm, typeFilter])

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize))
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredClients.slice(start, start + pageSize)
  }, [filteredClients, currentPage, pageSize])

  return (
    <div className="space-y-4">
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
          <div className="relative sm:flex-none sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, responsável ou CNPJ..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
              className="pl-10"
            />
          </div>
          <SearchableSelect
            value={typeFilter}
            onValueChange={(value) => { setTypeFilter(value); setCurrentPage(1) }}
            options={clientTypes.map(t => ({ value: t.id, label: t.name }))}
            placeholder="Tipo"
            searchPlaceholder="Buscar tipo..."
            allLabel="Todos os tipos"
            className="sm:flex-none sm:w-[160px]"
          />
          {viewToggle && <div className="hidden sm:block shrink-0">{viewToggle}</div>}
        </div>

      {viewMode === "table" ? (
        <div className="rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">CNPJ</TableHead>
                <TableHead className="hidden lg:table-cell">Responsável</TableHead>
                <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                <TableHead className="hidden lg:table-cell">Contratos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientsQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    Carregando clientes...
                  </TableCell>
                </TableRow>
              ) : paginatedClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    Nenhum cliente encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedClients.map((client) => {
                  const clientType = getClientTypeById(client.clientTypeId)
                  const clientTypeColor = resolveColor(clientType?.color)
                  const clientContracts = contracts.filter(c => c.clientId === client.id)
                  const activeContracts = clientContracts.filter(c => ["signed", "active"].includes(c.status)).length

                  return (
                    <TableRow key={client.id}>
                      <TableCell>
                        <Link href={`/clientes/${client.id}`} className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${clientTypeColor}1A` }}
                          >
                            <Building2 className="w-5 h-5" style={{ color: clientTypeColor }} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{client.companyName}</p>
                            <p className="text-xs text-muted-foreground md:hidden">{formatCNPJ(client.cnpj)}</p>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground font-mono">
                        {formatCNPJ(client.cnpj)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div>
                          <p className="text-sm">{client.responsibleName}</p>
                          <p className="text-xs text-muted-foreground">{client.phone}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge
                          style={{ backgroundColor: clientTypeColor }}
                          className="text-white border-0 hover:opacity-90"
                        >
                          {clientType?.name ?? "Cliente"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span>{activeContracts} ativo(s)</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/clientes/${client.id}`}>
                                <Eye className="w-4 h-4 mr-2" />
                                Ver Detalhes
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/clientes/${client.id}/editar`}>
                                <Edit className="w-4 h-4 mr-2" />
                                Editar
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
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
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {clientsQuery.isLoading ? (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">Carregando clientes...</CardContent>
            </Card>
          ) : paginatedClients.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">Nenhum cliente encontrado.</CardContent>
            </Card>
          ) : paginatedClients.map((client) => {
            const clientType = getClientTypeById(client.clientTypeId)
            const clientTypeColor = resolveColor(clientType?.color)
            const clientContracts = contracts.filter(c => c.clientId === client.id)
            const activeContracts = clientContracts.filter(c => ["signed", "active"].includes(c.status)).length

            return (
              <Card key={client.id} className="h-full overflow-hidden">
                <CardContent className="flex h-full flex-col px-4 py-3">
                  <Link href={`/clientes/${client.id}`} className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${clientTypeColor}1A` }}
                      >
                        <Building2 className="w-5 h-5" style={{ color: clientTypeColor }} />
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
                        <p className="text-xs text-muted-foreground font-mono">{formatCNPJ(client.cnpj)}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4 shrink-0" />
                        <span>{client.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-4 h-4 shrink-0" />
                        <span className="truncate">{client.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <FileText className="w-4 h-4 shrink-0" />
                        <span>{activeContracts} contrato(s) ativo(s)</span>
                      </div>
                    </div>
                  </Link>
                  <div className="mt-auto flex gap-2 pt-3">
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <Link href={`/clientes/${client.id}/editar`}>
                        <Edit className="w-4 h-4 mr-1" />
                        Editar
                      </Link>
                    </Button>
                    <Button size="sm" className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground" asChild>
                      <Link href={`/clientes/${client.id}`}>
                        <Eye className="w-4 h-4 mr-1" />
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
        totalItems={filteredClients.length}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1) }}
      />
      {/* </CardContent> */}
    </div>
  )
}
