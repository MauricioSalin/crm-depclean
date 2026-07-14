"use client"

import { useDeferredValue, useState, useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog"
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
import { CsvImportDialog, type CsvImportField } from "@/components/ui/csv-import-dialog"
import { EmptyState, TableEmptyState } from "@/components/ui/empty-state"
import { CardSkeletonGrid, TableSkeletonRows } from "@/components/ui/table-skeleton"
import { createClient, deleteClient, listClients, type ClientRecord } from "@/lib/api/clients"
import { listContracts } from "@/lib/api/contracts"
import { listClientTypes } from "@/lib/api/settings"
import { useMobileFiltersOpen } from "@/lib/hooks/use-mobile-filters"
import { useUrlQueryState } from "@/lib/hooks/use-url-query-state"
import { getApiErrorMessage } from "@/lib/api/errors"
import { toast } from "@/components/ui/use-toast"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { buildPathWithSearchParams, withReturnTo } from "@/lib/navigation"
import { useHasAnyPermission } from "@/hooks/use-permissions"

interface ClientsContentProps {
  viewMode: "table" | "cards"
  viewToggle?: React.ReactNode
  openImport?: boolean
  onImportChange?: (open: boolean) => void
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

const parseCsvBoolean = (value?: string, fallback = false) => {
  const normalized = String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

  if (!normalized) return fallback
  if (["sim", "s", "true", "1", "yes", "y", "ativo", "recebe"].includes(normalized)) return true
  if (["nao", "n", "false", "0", "no", "inativo", "nao recebe"].includes(normalized)) return false

  return fallback
}

const CLIENT_IMPORT_FIELDS: CsvImportField[] = [
  { key: "companyName", label: "Razão social", required: true },
  { key: "cnpj", label: "CNPJ", required: true },
  { key: "responsibleName", label: "Responsável", required: true },
  { key: "responsibleCpf", label: "CPF do responsável", required: true },
  { key: "phone", label: "Telefone" },
  { key: "email", label: "E-mail", required: false },
  { key: "assessorName", label: "Assessor" },
  { key: "assessorCpf", label: "CPF do assessor" },
  { key: "assessorEmail", label: "E-mail do assessor" },
  { key: "assessorPhone", label: "Telefone do assessor" },
  { key: "assessorReceivesNotifications", label: "Assessor recebe notificações" },
  { key: "syndicName", label: "Síndico" },
  { key: "syndicCpf", label: "CPF do síndico" },
  { key: "syndicEmail", label: "E-mail do síndico" },
  { key: "syndicPhone", label: "Telefone do síndico" },
  { key: "syndicReceivesNotifications", label: "Síndico recebe notificações" },
  { key: "clientTypeId", label: "Tipo", required: true },
  { key: "unitName", label: "Unidade", required: true },
  { key: "unitCount", label: "Quantidade de unidades", required: true },
  { key: "street", label: "Rua", required: true },
  { key: "number", label: "Número", required: true },
  { key: "neighborhood", label: "Bairro", required: true },
  { key: "city", label: "Cidade", required: true },
  { key: "state", label: "UF", required: true },
  { key: "zipCode", label: "CEP", required: true },
]

export function ClientsContent({ viewMode, viewToggle, openImport = false, onImportChange }: ClientsContentProps) {
  const queryClient = useQueryClient()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const mobileFiltersOpen = useMobileFiltersOpen()
  const canEditClients = useHasAnyPermission(["clients_edit"])
  const canDeleteClients = useHasAnyPermission(["clients_delete"])
  const [searchTerm, setSearchTerm] = useUrlQueryState("q")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [clientToRemove, setClientToRemove] = useState<ClientRecord | null>(null)
  const deferredSearchTerm = useDeferredValue(searchTerm)

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
  const clientTypeOptions = useMemo(() => clientTypes.map(t => ({ value: t.id, label: t.name })), [clientTypes])
  const clientTypeById = useMemo(() => new Map(clientTypes.map((type) => [type.id, type])), [clientTypes])
  const contractsByClientId = useMemo(() => {
    const grouped = new Map<string, number>()
    contracts.forEach((contract) => {
      grouped.set(contract.clientId, (grouped.get(contract.clientId) ?? 0) + 1)
    })
    return grouped
  }, [contracts])
  const currentHref = buildPathWithSearchParams(pathname, searchParams)
  const getClientProfileHref = (clientId: string) => withReturnTo(`/clientes/${clientId}`, currentHref)
  const getClientEditHref = (clientId: string) => withReturnTo(`/clientes/${clientId}/editar`, currentHref)
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["clients"] }),
        queryClient.invalidateQueries({ queryKey: ["contracts"] }),
        queryClient.invalidateQueries({ queryKey: ["schedules"] }),
        queryClient.invalidateQueries({ queryKey: ["certificates"] }),
        queryClient.invalidateQueries({ queryKey: ["analytics"] }),
      ])
      setClientToRemove(null)
      toast({
        title: "Cliente excluído",
        description: "Agendamentos, contratos, anexos, informativos e certificados vinculados também foram removidos.",
      })
    },
    onError: (error: unknown) => {
      toast({
        title: getApiErrorMessage(error, "Não foi possível remover o cliente."),
        variant: "destructive",
      })
    },
  })
  const importMutation = useMutation({
    mutationFn: async (rows: Array<Record<string, string>>) => {
      for (const row of rows) {
        await createClient({
          companyName: row.companyName,
          cnpj: row.cnpj,
          responsibleName: row.responsibleName,
          responsibleCpf: row.responsibleCpf,
          phone: row.phone,
          email: row.email,
          clientTypeId: row.clientTypeId,
          assessorName: row.assessorName,
          assessorCpf: row.assessorCpf,
          assessorEmail: row.assessorEmail,
          assessorPhone: row.assessorPhone,
          assessorReceivesNotifications: parseCsvBoolean(row.assessorReceivesNotifications),
          syndicName: row.syndicName,
          syndicCpf: row.syndicCpf,
          syndicEmail: row.syndicEmail,
          syndicPhone: row.syndicPhone,
          syndicReceivesNotifications: parseCsvBoolean(row.syndicReceivesNotifications),
          responsibleReceivesNotifications: true,
          copyNotificationsToOwner: false,
          isActive: true,
          units: [{
            name: row.unitName || "Matriz",
            isPrimary: true,
            unitCount: Number(row.unitCount) || 0,
            address: {
              street: row.street,
              number: row.number,
              neighborhood: row.neighborhood,
              city: row.city,
              state: row.state,
              zipCode: row.zipCode,
            },
          }],
        })
      }
    },
    onSuccess: async (_data, rows) => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] })
      toast({
        title: "Clientes importados",
        description: `${rows.length} registro(s) foram inseridos no banco de dados.`,
      })
    },
    onError: (error: unknown) => {
      toast({
        title: getApiErrorMessage(error, "Não foi possível importar os clientes."),
        variant: "destructive",
      })
    },
  })
  const getClientTypeById = (id: string) => clientTypeById.get(id)
  const isClientListLoading = clientsQuery.isLoading || clientTypesQuery.isLoading

  const filteredClients = useMemo(() => {
    const term = deferredSearchTerm.trim().toLowerCase()
    return clients.filter(client => {
      const matchesSearch = !term ||
        client.companyName.toLowerCase().includes(term) ||
        client.responsibleName.toLowerCase().includes(term) ||
        (client.assessor?.name ?? "").toLowerCase().includes(term) ||
        (client.syndic?.name ?? "").toLowerCase().includes(term) ||
        client.cnpj.includes(term)
      const matchesType = typeFilter === "all" || client.clientTypeId === typeFilter
      return matchesSearch && matchesType
    })
  }, [clients, deferredSearchTerm, typeFilter])

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize))
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredClients.slice(start, start + pageSize)
  }, [filteredClients, currentPage, pageSize])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <CsvImportDialog
        open={openImport}
        onOpenChange={(open) => onImportChange?.(open)}
        title="Importar clientes"
        description="Anexe um CSV e confira o relacionamento entre campos obrigatórios e colunas antes de importar."
        fields={CLIENT_IMPORT_FIELDS}
        onImport={(rows) => importMutation.mutateAsync(rows)}
      />

        <div className={`${mobileFiltersOpen ? "grid" : "hidden"} -m-1 shrink-0 grid-cols-2 gap-2 overflow-visible p-1 sm:flex sm:items-center`}>
          <div className="relative focus-within:z-[70] sm:w-80 sm:flex-none">
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
            options={clientTypeOptions}
            placeholder="Tipo"
            searchPlaceholder="Buscar tipo..."
            allLabel="Todos os tipos"
            className="sm:flex-none sm:w-[160px]"
          />
          {viewToggle && <div className="hidden sm:block shrink-0">{viewToggle}</div>}
        </div>

      {viewMode === "table" ? (
        <div className="rounded-md md:min-h-0 md:flex-1 md:overflow-hidden">
          <Table containerClassName="md:h-full">
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
              {isClientListLoading ? (
                <TableSkeletonRows
                  rows={5}
                  columns={[
                    { withIcon: true, width: "w-40" },
                    { className: "hidden md:table-cell", width: "w-32" },
                    { className: "hidden lg:table-cell", width: "w-36" },
                    { className: "hidden sm:table-cell", width: "w-24" },
                    { className: "hidden lg:table-cell", width: "w-20" },
                    { align: "right", width: "w-8" },
                  ]}
                />
              ) : paginatedClients.length === 0 ? (
                <TableEmptyState colSpan={6} icon={Building2} title="Nenhum cliente encontrado." />
              ) : (
                paginatedClients.map((client) => {
                  const clientType = getClientTypeById(client.clientTypeId)
                  const clientTypeColor = resolveColor(clientType?.color)
                  const totalContracts = contractsByClientId.get(client.id) ?? 0

                  return (
                    <TableRow key={client.id}>
                      <TableCell>
                        <Link href={getClientProfileHref(client.id)} className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${clientTypeColor}1A` }}
                          >
                            <Building2 className="w-5 h-5" style={{ color: clientTypeColor }} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">{client.companyName}</p>
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
                          <span>{totalContracts} contrato(s)</span>
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
                              <Link href={getClientProfileHref(client.id)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Ver Detalhes
                              </Link>
                            </DropdownMenuItem>
                            {canEditClients ? (
                              <DropdownMenuItem asChild>
                                <Link href={getClientEditHref(client.id)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Editar
                                </Link>
                              </DropdownMenuItem>
                            ) : null}
                            {canDeleteClients ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setClientToRemove(client)}>
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </>
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
        <div className="md:min-h-0 md:flex-1 md:overflow-y-auto md:pr-1">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {isClientListLoading ? (
              <CardSkeletonGrid cards={4} />
            ) : paginatedClients.length === 0 ? (
              <EmptyState icon={Building2} title="Nenhum cliente encontrado." className="sm:col-span-2" />
            ) : paginatedClients.map((client) => {
              const clientType = getClientTypeById(client.clientTypeId)
              const clientTypeColor = resolveColor(clientType?.color)
              const totalContracts = contractsByClientId.get(client.id) ?? 0

              return (
                <Card key={client.id} className="h-full overflow-hidden">
                  <CardContent className="flex h-full flex-col px-6">
                    <Link href={getClientProfileHref(client.id)} className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${clientTypeColor}1A` }}
                        >
                          <Building2 className="w-5 h-5" style={{ color: clientTypeColor }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                            <h3 className="min-w-0 flex-1 break-words text-sm font-semibold text-foreground">{client.companyName}</h3>
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
                          <span>{totalContracts} contrato(s)</span>
                        </div>
                      </div>
                    </Link>
                    <div className="mt-auto flex gap-2 pt-3">
                      {canEditClients ? (
                        <Button variant="outline" size="sm" className="flex-1" asChild>
                          <Link href={getClientEditHref(client.id)}>
                            <Edit className="w-4 h-4 mr-1" />
                            Editar
                          </Link>
                        </Button>
                      ) : null}
                      <Button size="sm" className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground" asChild>
                        <Link href={getClientProfileHref(client.id)}>
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
        </div>
      )}

      {!isClientListLoading ? (
        <DataPagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredClients.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1) }}
        />
      ) : null}
      <ConfirmActionDialog
        open={Boolean(clientToRemove)}
        title="Excluir cliente"
        description={`Excluir ${
          clientToRemove?.companyName ? `o cliente ${clientToRemove.companyName}` : "este cliente"
        } também removerá todos os agendamentos, contratos, anexos, informativos e certificados vinculados. Essa ação é irreversível. Tem certeza que deseja continuar?`}
        confirmLabel="Excluir cliente"
        busy={deleteMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setClientToRemove(null)
        }}
        onConfirm={() => {
          if (!clientToRemove) return
          if (deleteMutation.isPending) return
          deleteMutation.mutate(clientToRemove.id)
        }}
      />
      {/* </CardContent> */}
    </div>
  )
}
