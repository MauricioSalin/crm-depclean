"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Download, Edit3, FileCheck2, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import {
  getTemplateBaseFileUrl,
  listTemplates,
  type TemplateKind,
  type TemplateRecord,
  updateTemplate,
} from "@/lib/api/templates"
import { useUrlQueryState } from "@/lib/hooks/use-url-query-state"

type AutomationDocxTemplatesProps = {
  kind: Extract<TemplateKind, "informative" | "certificate">
}

export function AutomationDocxTemplates({ kind }: AutomationDocxTemplatesProps) {
  const queryClient = useQueryClient()
  const searchKey = kind === "informative" ? "q-informativos" : "q-certificados"
  const [searchTerm, setSearchTerm] = useUrlQueryState(searchKey)
  const [editingTemplate, setEditingTemplate] = useState<TemplateRecord | null>(null)
  const [formData, setFormData] = useState({ name: "", description: "" })

  const templatesQuery = useQuery({
    queryKey: ["templates", kind, searchTerm],
    queryFn: () => listTemplates(searchTerm, kind),
  })

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name: string; description: string } }) => updateTemplate(id, payload),
    onSuccess: () => {
      toast({
        title: "Template atualizado",
        description: "Os dados do template foram salvos com sucesso.",
      })
      queryClient.invalidateQueries({ queryKey: ["templates", kind] })
      setEditingTemplate(null)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateTemplate(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates", kind] })
    },
  })

  const templates = useMemo(() => templatesQuery.data?.data ?? [], [templatesQuery.data?.data])

  const sectionTitle = kind === "informative" ? "Informativos automáticos" : "Certificados automáticos"
  const sectionDescription =
    kind === "informative"
      ? "Modelos DOCX usados para avisos prévios dos agendamentos. A marca d'água, imagens e assinatura do arquivo-base são preservadas."
      : "Modelos DOCX emitidos após a visita concluída. O arquivo-base permanece intacto e a automação só substitui os placeholders."

  return (
    <>
      <Dialog
        open={Boolean(editingTemplate)}
        onOpenChange={(open) => {
          if (!open) setEditingTemplate(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar template</DialogTitle>
          </DialogHeader>
          <form
            autoComplete="off"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (!editingTemplate) return
              saveMutation.mutate({
                id: editingTemplate.id,
                payload: {
                  name: formData.name.trim(),
                  description: formData.description.trim(),
                },
              })
            }}
          >
            <div className="space-y-2">
              <Label htmlFor={`${kind}-name`}>Nome</Label>
              <Input
                id={`${kind}-name`}
                value={formData.name}
                onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${kind}-description`}>Descrição</Label>
              <Input
                id={`${kind}-description`}
                value={formData.description}
                onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingTemplate(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{sectionTitle}</CardTitle>
            <CardDescription>{sectionDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={`Buscar ${kind === "informative" ? "informativos" : "certificados"}...`}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {templates.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Nenhum template encontrado para esta categoria.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <FileCheck2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <CardDescription className="mt-1">{template.description || "Sem descrição."}</CardDescription>
                      </div>
                    </div>
                    <Badge
                      className={
                        template.isActive
                          ? "cursor-pointer bg-green-100 text-green-700 hover:bg-green-200"
                          : "cursor-pointer bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }
                      onClick={() => toggleMutation.mutate({ id: template.id, isActive: !template.isActive })}
                    >
                      {template.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Arquivo base</p>
                    <p className="mt-2 text-sm text-foreground">
                      {template.baseFileName || "Template DOCX preservado no backend"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      A automação usa este DOCX original e substitui apenas os placeholders necessários.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Placeholders mapeados</p>
                    <div className="flex flex-wrap gap-2">
                      {template.placeholders.length > 0 ? (
                        template.placeholders.map((placeholder) => (
                          <Badge key={placeholder} variant="outline" className="rounded-full px-3 py-1 font-mono text-[11px]">
                            {placeholder}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">Nenhum placeholder registrado.</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingTemplate(template)
                        setFormData({
                          name: template.name,
                          description: template.description,
                        })
                      }}
                    >
                      <Edit3 className="mr-2 h-4 w-4" />
                      Editar metadados
                    </Button>
                    <Button type="button" variant="outline" asChild>
                      <a href={getTemplateBaseFileUrl(template.id)} target="_blank" rel="noreferrer">
                        <Download className="mr-2 h-4 w-4" />
                        Baixar DOCX base
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
