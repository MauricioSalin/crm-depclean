"use client"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { MoreHorizontal, Plus, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { getVehicles, removeVehicle, saveVehicle, saveVehicleType, type VehicleRecord } from "@/lib/api/vehicles"
import { getApiErrorMessage } from "@/lib/api/errors"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog"

export function VehiclesSettings() {
  const client = useQueryClient()
  const catalog = useQuery({ queryKey: ["vehicles"], queryFn: getVehicles })
  const [editor, setEditor] = useState<{ type: boolean; id?: string } | null>(null)
  const [name, setName] = useState("")
  const [typeId, setTypeId] = useState("")
  const [plate, setPlate] = useState("")
  const [model, setModel] = useState("")
  const [color, setColor] = useState("")
  const [year, setYear] = useState("")
  const [removing, setRemoving] = useState<{ id: string; type: boolean } | null>(null)
  const save = useMutation({
    mutationFn: () => editor?.type ? saveVehicleType(name, editor.id) : saveVehicle({ typeId, plate, model: model.trim(), color: color.trim(), year: year ? Number(year) : null }, editor?.id),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["vehicles"] }); setEditor(null); toast.success("Cadastro salvo.") },
    onError: (error) => toast.error(getApiErrorMessage(error, "Não foi possível salvar o cadastro.")),
  })
  const remove = useMutation({
    mutationFn: () => removeVehicle(removing!.id, removing!.type),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["vehicles"] }); setRemoving(null); toast.success("Cadastro removido.") },
    onError: (error) => toast.error(getApiErrorMessage(error, "Não foi possível remover o cadastro.")),
  })
  const types = catalog.data?.data.types ?? []
  const vehicles = catalog.data?.data.vehicles ?? []
  const openVehicleEditor = (vehicle?: VehicleRecord) => {
    setTypeId(vehicle?.typeId ?? "")
    setPlate(vehicle?.plate ?? "")
    setModel(vehicle?.model ?? "")
    setColor(vehicle?.color ?? "")
    setYear(vehicle?.year ? String(vehicle.year) : "")
    setEditor({ type: false, id: vehicle?.id })
  }
  return <Card>
    <CardHeader><CardTitle className="text-base">Veículos</CardTitle><CardDescription>Cadastre os tipos e os veículos utilizados nos atendimentos.</CardDescription></CardHeader>
    <CardContent className="space-y-6">
      {catalog.isError ? <p className="text-sm text-destructive">Não foi possível carregar os veículos.</p> : null}
      <div className="space-y-3">
        <div className="flex items-center justify-between"><h4 className="font-medium">Tipos de veículo</h4><Button type="button" variant="outline" size="sm" onClick={() => { setName(""); setEditor({ type: true }) }}><Plus className="mr-2 h-4 w-4" />Adicionar tipo</Button></div>
        <Table><TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead className="w-12">Ações</TableHead></TableRow></TableHeader><TableBody>
          {types.map((type) => <TableRow key={type.id}><TableCell>{type.name}</TableCell><TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Ações de ${type.name}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => { setName(type.name); setEditor({ type: true, id: type.id }) }}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem><DropdownMenuItem className="text-destructive" onClick={() => setRemoving({ id: type.id, type: true })}><Trash2 className="mr-2 h-4 w-4" />Remover</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell></TableRow>)}
          {!types.length ? <TableRow><TableCell colSpan={2}>{catalog.isLoading ? "Carregando..." : "Nenhum tipo cadastrado."}</TableCell></TableRow> : null}
        </TableBody></Table>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between"><h4 className="font-medium">Veículos cadastrados</h4><Button type="button" variant="outline" size="sm" onClick={() => openVehicleEditor()}><Plus className="mr-2 h-4 w-4" />Adicionar veículo</Button></div>
        <Table><TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Placa</TableHead><TableHead>Modelo</TableHead><TableHead>Cor</TableHead><TableHead>Ano</TableHead><TableHead className="w-12">Ações</TableHead></TableRow></TableHeader><TableBody>
          {vehicles.map((vehicle) => <TableRow key={vehicle.id}><TableCell>{types.find((type) => type.id === vehicle.typeId)?.name}</TableCell><TableCell>{vehicle.plate}</TableCell><TableCell>{vehicle.model || "—"}</TableCell><TableCell>{vehicle.color || "—"}</TableCell><TableCell>{vehicle.year ?? "—"}</TableCell><TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Ações de ${vehicle.plate}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => openVehicleEditor(vehicle)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem><DropdownMenuItem className="text-destructive" onClick={() => setRemoving({ id: vehicle.id, type: false })}><Trash2 className="mr-2 h-4 w-4" />Remover</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell></TableRow>)}
          {!vehicles.length ? <TableRow><TableCell colSpan={6}>{catalog.isLoading ? "Carregando..." : "Nenhum veículo cadastrado."}</TableCell></TableRow> : null}
        </TableBody></Table>
      </div>
    </CardContent>
    <Dialog open={Boolean(editor)} onOpenChange={(open) => { if (!open && !save.isPending) setEditor(null) }}><DialogContent><DialogHeader><DialogTitle>{editor?.id ? "Editar" : "Adicionar"} {editor?.type ? "tipo de veículo" : "veículo"}</DialogTitle></DialogHeader>
      <form id="vehicle-settings-form" className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (editor?.type ? !name.trim() : !typeId || !plate.trim()) { toast.error("Preencha os campos obrigatórios."); return } if (!editor?.type && year && (!/^\d{4}$/.test(year) || Number(year) < 1000)) { toast.error("Informe um ano com quatro dígitos."); return } save.mutate() }}>
        {editor?.type ? <div className="space-y-2"><Label htmlFor="vehicle-type-name">Tipo *</Label><Input id="vehicle-type-name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} /></div> : <>
          <div className="space-y-2"><Label>Tipo *</Label><SearchableSelect value={typeId} options={types.map((type) => ({ value: type.id, label: type.name }))} onValueChange={setTypeId} includeAll={false} placeholder="Selecione o tipo" /></div>
          <div className="space-y-2"><Label htmlFor="vehicle-plate">Placa *</Label><Input id="vehicle-plate" value={plate} maxLength={8} onChange={(event) => setPlate(event.target.value.toUpperCase())} /></div>
          <div className="space-y-2"><Label htmlFor="vehicle-model">Modelo</Label><Input id="vehicle-model" value={model} maxLength={120} onChange={(event) => setModel(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="vehicle-color">Cor</Label><Input id="vehicle-color" value={color} maxLength={80} onChange={(event) => setColor(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="vehicle-year">Ano</Label><Input id="vehicle-year" value={year} inputMode="numeric" maxLength={4} onChange={(event) => setYear(event.target.value.replace(/\D/g, ""))} /></div>
        </>}
      </form><DialogFooter><Button type="button" variant="outline" onClick={() => setEditor(null)} disabled={save.isPending}>Cancelar</Button><Button type="submit" form="vehicle-settings-form" disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar"}</Button></DialogFooter>
    </DialogContent></Dialog>
    <ConfirmActionDialog open={Boolean(removing)} title="Remover cadastro?" description="Confirme a remoção deste cadastro da frota." confirmLabel="Remover" busy={remove.isPending} onOpenChange={(open) => { if (!open) setRemoving(null) }} onConfirm={() => remove.mutate()} />
  </Card>
}
