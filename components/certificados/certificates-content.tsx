"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Award, Calendar, CheckCircle2, FileText, Search } from "lucide-react"

import { listCertificates, type CertificateQueueRecord } from "@/lib/api/certificates"
import { getStoredUser } from "@/lib/auth/session"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DataPagination } from "@/components/ui/data-pagination"
import { Input } from "@/components/ui/input"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function formatDate(value: string) {
  if (!value) return "-"
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}

function getStatusBadge(status: CertificateQueueRecord["status"]) {
  if (status === "sent") {
    return <Badge className="bg-green-100 text-green-800">Enviado</Badge>
  }

  return <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>
}

export function CertificatesContent() {
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getStoredUser>>(null)
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  useEffect(() => {
    setMounted(true)
    const sync = () => setCurrentUser(getStoredUser())
    sync()
    window.addEventListener("storage", sync)
    window.addEventListener("depclean:session", sync)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("depclean:session", sync)
    }
  }, [])

  const canView = Boolean(
    currentUser?.permissions.includes("certificates_view") ||
      currentUser?.permissions.includes("certificates_manage") ||
      currentUser?.permissions.includes("settings_manage"),
  )
  const canManage = Boolean(
    currentUser?.permissions.includes("certificates_manage") || currentUser?.permissions.includes("settings_manage"),
  )

  const certificatesQuery = useQuery({
    queryKey: ["certificates"],
    queryFn: () => listCertificates(),
    enabled: mounted && canView,
  })

  const records = certificatesQuery.data?.data ?? []

  const filteredRecords = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return records.filter((record) => {
      const matchesStatus = statusFilter === "all" || record.status === statusFilter
      const matchesSearch =
        !term ||
        record.clientName.toLowerCase().includes(term) ||
        record.unitName.toLowerCase().includes(term) ||
        record.serviceTypeName.toLowerCase().includes(term) ||
        record.teams.some((team) => team.name.toLowerCase().includes(term)) ||
        record.additionalEmployees.some((employee) => employee.name.toLowerCase().includes(term))

      return matchesStatus && matchesSearch
    })
  }, [records, searchTerm, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / itemsPerPage))
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredRecords.slice(start, start + itemsPerPage)
  }, [currentPage, filteredRecords, itemsPerPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, itemsPerPage])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  if (mounted && !canView) {
    return (
      <Card>
        <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-center">
          <Award className="h-10 w-10 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold">Acesso restrito</h2>
            <p className="text-sm text-muted-foreground">
              Seu perfil não possui permissão para visualizar certificados.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
        <div className="relative col-span-2 sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value)
              setCurrentPage(1)
            }}
            placeholder="Buscar cliente, serviço, equipe..."
            className="pl-10"
          />
        </div>
        <SearchableSelect
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value)
            setCurrentPage(1)
          }}
          allLabel="Todos os status"
          placeholder="Status"
          searchPlaceholder="Buscar status..."
          className="sm:w-[160px]"
          options={[
            { value: "pending", label: "Pendentes" },
            { value: "sent", label: "Enviados" },
          ]}
        />
      </div>

      <div className="overflow-x-auto rounded-md">
        <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Cliente</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Equipe / Funcionários</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certificatesQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                    Carregando certificados...
                  </TableCell>
                </TableRow>
              ) : paginatedRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                    Nenhum agendamento concluído com NA encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-primary/10 p-3">
                          <Award className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{record.clientName}</p>
                          <p className="text-xs text-muted-foreground">{record.unitName || "Unidade principal"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{record.serviceTypeName}</p>
                        {record.naFileName ? (
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <FileText className="h-3 w-3" />
                            {record.naFileName}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {record.teams.map((team) => (
                          <Badge key={team.id} variant="secondary">{team.name}</Badge>
                        ))}
                        {record.additionalEmployees.map((employee) => (
                          <Badge key={employee.id} variant="outline">{employee.name}</Badge>
                        ))}
                        {record.teams.length === 0 && record.additionalEmployees.length === 0 ? (
                          <span className="text-sm text-muted-foreground">Sem responsável</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <p className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {formatDate(record.date)}
                        </p>
                        <p className="text-muted-foreground">{record.time || "--:--"}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell className="text-right">
                      {canManage ? (
                        <Button asChild size="sm">
                          <Link href={`/certificados/${record.scheduleId}`}>
                            {record.status === "sent" ? (
                              <>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Reemitir
                              </>
                            ) : (
                              <>
                                <Award className="mr-2 h-4 w-4" />
                                Gerar certificado
                              </>
                            )}
                          </Link>
                        </Button>
                      ) : (
                        <Button size="sm" disabled>
                          Gerar certificado
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
        </Table>
      </div>

      <DataPagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={itemsPerPage}
        totalItems={filteredRecords.length}
        onPageChange={setCurrentPage}
        onPageSizeChange={setItemsPerPage}
      />
    </div>
  )
}
