"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Search, Edit, Trash2, Clock, ClipboardList } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog"
import { DataPagination } from "@/components/ui/data-pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useUrlQueryState } from "@/lib/hooks/use-url-query-state"
import { deleteService, listServices, type ServiceRecord } from "@/lib/api/services"
import { listTeams } from "@/lib/api/teams"

type ServiceTypeRow = ServiceRecord

interface ServicesContentProps {
  viewMode: "table" | "cards"
  viewToggle?: React.ReactNode
}

function formatDuration(type: ServiceTypeRow) {
  const dur = type.defaultDuration
  const durType = (type as any).durationType || "hours"
  if (durType === "days") return `${dur} dia${dur > 1 ? "s" : ""}`
  if (durType === "shift") return `${dur} turno${dur > 1 ? "s" : ""}`
  return `${dur} hora${dur > 1 ? "s" : ""}`
}

export function ServicesContent({ viewMode, viewToggle }: ServicesContentProps) {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useUrlQueryState("q")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null)

  const servicesQuery = useQuery({
    queryKey: ["services", "content"],
    queryFn: () => listServices(""),
  })
  const teamsQuery = useQuery({
    queryKey: ["teams", "services-content"],
    queryFn: () => listTeams(""),
  })

  const serviceTypes = servicesQuery.data?.data ?? []
  const teams = teamsQuery.data?.data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteService(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["services"] })
      setPendingDelete(null)
    },
  })

  const handleDeleteType = (id: string) => {
    setPendingDelete({
      id,
      label: serviceTypes.find((type) => type.id === id)?.name ?? "este tipo de serviço",
    })
  }

  const confirmDeleteType = () => {
    if (!pendingDelete) return
    deleteMutation.mutate(pendingDelete.id)
  }

  const filteredTypes = serviceTypes.filter((st) => st.name.toLowerCase().includes(searchTerm.toLowerCase()))
  const totalItems = filteredTypes.length
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage))
  const paginatedTypes = filteredTypes.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar tipos de serviço..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            className="pl-10"
          />
        </div>
        {viewToggle ? <div className="hidden shrink-0 sm:block">{viewToggle}</div> : null}
      </div>

      {viewMode === "table" ? (
        <div className="overflow-x-auto rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serviço</TableHead>
                <TableHead className="hidden sm:table-cell">Descrição</TableHead>
                <TableHead className="hidden md:table-cell">Equipe / Funcionários</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {servicesQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    Carregando tipos de serviço...
                  </TableCell>
                </TableRow>
              ) : filteredTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    Nenhum tipo de serviço encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTypes.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <ClipboardList className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{type.name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      <span className="line-clamp-1">{type.description || "-"}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(type.teamIds || []).map((teamId: string) => {
                          const team = teams.find((item) => item.id === teamId)
                          return team ? (
                            <Badge
                              key={team.id}
                              variant="secondary"
                              className="flex items-center gap-1.5 px-2 py-0.5 text-xs text-foreground/80"
                              style={{ backgroundColor: `${team.color}1A` }}
                            >
                              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: team.color }} />
                              {team.name}
                            </Badge>
                          ) : null
                        })}
                        {(!type.teamIds || type.teamIds.length === 0) && (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{formatDuration(type)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link href={`/servicos/${type.id}/editar`}>
                          <Button variant="ghost" size="icon">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteType(type.id)}>
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
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paginatedTypes.map((type) => (
            <Card key={type.id} className="overflow-hidden py-4 transition-shadow hover:shadow-lg">
              <CardContent className="px-4">
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <ClipboardList className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold">{type.name}</h3>
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {type.description || "Sem descrição"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <Link href={`/servicos/${type.id}/editar`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteType(type.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{formatDuration(type)}</span>
                </div>

                {type.teamIds?.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {type.teamIds.map((teamId: string) => {
                      const team = teams.find((item) => item.id === teamId)
                      return team ? (
                        <Badge
                          key={team.id}
                          variant="secondary"
                          className="flex items-center gap-1.5 px-2 py-0.5 text-xs text-foreground/80"
                          style={{ backgroundColor: `${team.color}1A` }}
                        >
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: team.color }} />
                          {team.name}
                        </Badge>
                      ) : null
                    })}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DataPagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={itemsPerPage}
        totalItems={totalItems}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => {
          setItemsPerPage(size)
          setCurrentPage(1)
        }}
      />

      <ConfirmActionDialog
        open={!!pendingDelete}
        title="Excluir tipo de serviço"
        description={`Tem certeza que deseja excluir ${pendingDelete?.label ?? "este tipo de serviço"}? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        busy={deleteMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        onConfirm={confirmDeleteType}
      />
    </div>
  )
}
