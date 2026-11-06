"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { getOrganizationSettings, updateOrganizationSettings } from "@/lib/api/settings"
import { getApiErrorMessage } from "@/lib/api/errors"
import { formatScheduleDisposalCurrency, type DisposalType } from "@/lib/schedule-disposal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Editor = { kind: "type" | "item"; id?: string; originalTypeId?: string }

export function DisposalSettings() {
  const client = useQueryClient()
  const catalog = useQuery({ queryKey: ["organization-disposals"], queryFn: getOrganizationSettings })
  const types = catalog.data?.data.disposalTypes ?? []
  const [editor, setEditor] = useState<Editor | null>(null)
  const [name, setName] = useState("")
  const [typeId, setTypeId] = useState("")
  const [price, setPrice] = useState("")
  const [removing, setRemoving] = useState<Editor | null>(null)
  const save = useMutation({
    mutationFn: (disposalTypes: DisposalType[]) => updateOrganizationSettings({ disposalTypes }),
    onSuccess: async (response) => {
      client.setQueryData(["organization-disposals"], response)
      await client.invalidateQueries({ queryKey: ["disposal-catalog"] })
      setEditor(null); setRemoving(null); toast.success("Catálogo de descartes atualizado.")
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Não foi possível salvar os descartes.")),
  })
  function openEditor(value: Editor, itemName = "", itemPrice = "") {
    setEditor(value); setName(itemName); setTypeId(value.originalTypeId ?? ""); setPrice(itemPrice)
  }
  function submit() {
    const unitPrice = Number(price.replace(",", "."))
    if (!name.trim() || (editor?.kind === "item" && (!typeId || !price.trim() || !Number.isFinite(unitPrice) || unitPrice < 0 || Math.round(unitPrice * 100) / 100 !== unitPrice))) {
      toast.error("Informe o nome, o tipo e um valor válido com até duas casas decimais."); return
    }
    const next = structuredClone(types)
    if (editor?.kind === "type") {
      const existing = next.find((type) => type.id === editor.id)
      if (existing) existing.name = name.trim()
      else next.push({ id: crypto.randomUUID(), name: name.trim(), items: [] })
    } else {
      if (editor?.id) {
        const original = next.find((type) => type.id === editor.originalTypeId)
        if (original) original.items = original.items.filter((item) => item.id !== editor.id)
      }
      next.find((type) => type.id === typeId)!.items.push({ id: editor?.id ?? crypto.randomUUID(), name: name.trim(), unitPrice })
    }
    save.mutate(next)
  }
  return <Card>
    <CardHeader><CardTitle className="text-base">Descartes</CardTitle><CardDescription>Cadastre os tipos de descarte e suas estações, com valor por m³. Reajustes valem para novos registros; descartes já registrados mantêm seus valores.</CardDescription></CardHeader>
    <CardContent className="space-y-6">
      {catalog.isError ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar os descartes. <Button variant="link" onClick={() => void catalog.refetch()}>Tentar novamente</Button></p> : null}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Tipos de descarte</h4>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label="Adicionar tipo de descarte"
            disabled={!catalog.isSuccess || save.isPending}
            onClick={() => openEditor({ kind: "type" })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar
          </Button>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Itens vinculados</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow></TableHeader><TableBody>
          {types.map((type) => <TableRow key={type.id}><TableCell>{type.name}</TableCell><TableCell>{type.items.length}</TableCell><TableCell><div className="flex gap-1">
            <Button type="button" variant="ghost" size="icon" disabled={save.isPending} aria-label={`Editar tipo ${type.name}`} onClick={() => openEditor({ kind: "type", id: type.id }, type.name)}><Pencil className="h-4 w-4" /></Button>
            <Button type="button" variant="ghost" size="icon" disabled={save.isPending} aria-label={`Remover tipo ${type.name}`} onClick={() => { if (type.items.length) { toast.error("Remova ou transfira os itens vinculados antes de remover o tipo."); return } setRemoving({ kind: "type", id: type.id }) }}><Trash2 className="h-4 w-4" /></Button>
          </div></TableCell></TableRow>)}
          {!types.length ? <TableRow><TableCell colSpan={3}>{catalog.isLoading ? "Carregando..." : "Nenhum tipo cadastrado."}</TableCell></TableRow> : null}
        </TableBody></Table>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Itens de descarte</h4>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label="Adicionar item de descarte"
            disabled={!catalog.isSuccess || !types.length || save.isPending}
            onClick={() => openEditor({ kind: "item" })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar
          </Button>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Estação / item</TableHead>
            <TableHead>Valor por m³</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow></TableHeader><TableBody>
          {types.flatMap((type) => type.items.map((item) => <TableRow key={`${type.id}-${item.id}`}>
            <TableCell>{type.name}</TableCell>
            <TableCell>{item.name}</TableCell>
            <TableCell>{formatScheduleDisposalCurrency(item.unitPrice)}</TableCell>
            <TableCell><div className="flex gap-1">
            <Button type="button" variant="ghost" size="icon" disabled={save.isPending} aria-label={`Editar ${item.name} de ${type.name}`} onClick={() => openEditor({ kind: "item", id: item.id, originalTypeId: type.id }, item.name, item.unitPrice.toFixed(2).replace(".", ","))}><Pencil className="h-4 w-4" /></Button>
            <Button type="button" variant="ghost" size="icon" disabled={save.isPending} aria-label={`Remover ${item.name} de ${type.name}`} onClick={() => setRemoving({ kind: "item", id: item.id, originalTypeId: type.id })}><Trash2 className="h-4 w-4" /></Button>
          </div></TableCell></TableRow>))}
          {catalog.isSuccess && !types.some((type) => type.items.length) ? <TableRow><TableCell colSpan={4}>Nenhum item cadastrado.</TableCell></TableRow> : null}
        </TableBody></Table>
      </div>
    </CardContent>
    <Dialog open={Boolean(editor)} onOpenChange={(open) => { if (!open && !save.isPending) setEditor(null) }}><DialogContent><DialogHeader><DialogTitle>{editor?.id ? "Editar" : "Adicionar"} {editor?.kind === "type" ? "tipo de descarte" : "item de descarte"}</DialogTitle></DialogHeader>
      <form id="disposal-settings-form" className="space-y-4" onSubmit={(event) => { event.preventDefault(); submit() }}>
        {editor?.kind === "item" ? <div className="space-y-2"><Label htmlFor="disposal-item-type">Tipo *</Label><SearchableSelect id="disposal-item-type" value={typeId} options={types.map((type) => ({ value: type.id, label: type.name }))} onValueChange={setTypeId} includeAll={false} placeholder="Selecione o tipo" disabled={save.isPending} /></div> : null}
        <div className="space-y-2"><Label htmlFor="disposal-item-name">Nome *</Label><Input id="disposal-item-name" value={name} maxLength={editor?.kind === "type" ? 100 : 180} onChange={(event) => setName(event.target.value)} disabled={save.isPending} /></div>
        {editor?.kind === "item" ? <div className="space-y-2"><Label htmlFor="disposal-item-price">Valor unitário por m³ (R$) *</Label><Input id="disposal-item-price" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} disabled={save.isPending} /></div> : null}
      </form><DialogFooter><Button type="button" variant="outline" disabled={save.isPending} onClick={() => setEditor(null)}>Cancelar</Button><Button type="submit" form="disposal-settings-form" disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar"}</Button></DialogFooter>
    </DialogContent></Dialog>
    <ConfirmActionDialog open={Boolean(removing)} title="Remover cadastro de descarte?" description="O cadastro deixará de aparecer em novos descartes. Os atendimentos já registrados serão preservados." confirmLabel="Remover" busy={save.isPending} onOpenChange={(open) => { if (!open && !save.isPending) setRemoving(null) }} onConfirm={() => save.mutate(types.filter((type) => removing?.kind !== "type" || type.id !== removing.id).map((type) => ({ ...type, items: type.items.filter((item) => removing?.kind !== "item" || type.id !== removing.originalTypeId || item.id !== removing.id) })))} />
  </Card>
}
