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
import { mockServiceTypes } from "@/lib/mock-data"
import Link from "next/link"

type ServiceTypeRow = (typeof mockServiceTypes)[number]

interface ServicesContentProps {
  viewMode: "table" | "cards"
  viewToggle?: React.ReactNode
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
        <div className="flex items-center gap-2 mb-6">
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

        {viewMode === "table" ? (
          <div className="rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serviço</TableHead>
                  <TableHead className="hidden sm:table-cell">Descrição</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead className="hidden md:table-cell">Preço</TableHead>
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
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{type.defaultDuration} min</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {type.pricePerHour ? `R$ ${type.pricePerHour.toFixed(2)}` : "-"}
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
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <ClipboardList className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex gap-1">
                      <Link href={`/servicos/${type.id}/editar`}>
                        <Button variant="ghost" size="icon">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteType(type.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <h3 className="font-semibold mb-1">{type.name}</h3>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{type.description || "Sem descrição"}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{type.defaultDuration} min</span>
                    </div>
                    {type.pricePerHour ? (
                      <Badge variant="outline">R$ {type.pricePerHour.toFixed(2)}</Badge>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
    </div>
  )
}
