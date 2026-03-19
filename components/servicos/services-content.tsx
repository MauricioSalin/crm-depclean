"use client"

import { useState } from "react"
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
  TableRow,
} from "@/components/ui/table"
import { Search, Edit, Trash2, Clock, ClipboardList } from "lucide-react"
import { HeaderFiltersPortal } from "@/components/ui/header-filters-portal"
import { mockServiceTypes, mockTeams } from "@/lib/mock-data"
import Link from "next/link"

type ServiceTypeRow = (typeof mockServiceTypes)[number]

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
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeRow[]>(mockServiceTypes)
  const [searchTerm, setSearchTerm] = useState("")

  const handleDeleteType = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este tipo de serviço?")) {
      setServiceTypes(serviceTypes.filter(st => st.id !== id))
    }
  }

  const filteredTypes = serviceTypes.filter(st =>
    st.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div>
        <HeaderFiltersPortal>
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar tipos de serviço..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {viewToggle && <div className="hidden sm:block shrink-0">{viewToggle}</div>}
          </div>
        </HeaderFiltersPortal>

        {viewMode === "table" ? (
          <div className="rounded-md overflow-x-auto">
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
                {filteredTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      Nenhum tipo de serviço encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTypes.map((type) => (
                    <TableRow key={type.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <ClipboardList className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{type.name}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        <span className="line-clamp-1">{type.description || "-"}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {(type.teamIds || []).map((teamId: string) => {
                            const team = mockTeams.find(t => t.id === teamId)
                            return team ? (
                              <Badge
                                key={team.id}
                                variant="secondary"
                                className="px-2 py-0.5 flex items-center gap-1.5 text-xs text-foreground/80"
                                style={{ backgroundColor: `${team.color}1A` }}
                              >
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
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
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTypes.map((type) => (
              <Card key={type.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <ClipboardList className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate text-sm">{type.name}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-1">{type.description || "Sem descrição"}</p>
                      </div>
                    </div>
                    <div className="flex gap-0.5 shrink-0">
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
                  {type.teamIds?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {type.teamIds.map((teamId: string) => {
                        const team = mockTeams.find(t => t.id === teamId)
                        return team ? (
                          <Badge
                            key={team.id}
                            variant="secondary"
                            className="px-2 py-0.5 flex items-center gap-1.5 text-xs text-foreground/80"
                            style={{ backgroundColor: `${team.color}1A` }}
                          >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                            {team.name}
                          </Badge>
                        ) : null
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
    </div>
  )
}
