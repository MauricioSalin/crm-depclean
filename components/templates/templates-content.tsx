"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Search, Plus, Upload, Edit, Trash2, FileText, Eye, PenTool } from "lucide-react"
import { ContractRichEditor } from "@/components/contratos/contract-rich-editor"
import { mockEmployees } from "@/lib/mock-data"

export interface ContractTemplate {
  id: string
  name: string
  description: string
  html: string
  signerId: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const defaultTemplateHtml = `
<h1 style="text-align: center;">CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h1>
<p style="text-align: center;"><strong>TEMPLATE</strong></p>
<hr />
<p>Pelo presente instrumento particular, de um lado <strong>[NOME DA CONTRATANTE]</strong>, pessoa jurídica de direito privado, inscrita no CNPJ sob nº <strong>[CNPJ]</strong>, com sede na <strong>[ENDEREÇO]</strong>, neste ato representada por <strong>[REPRESENTANTE]</strong>, doravante denominada <strong>CONTRATANTE</strong>;</p>
<p>E de outro lado, <strong>DEPCLEAN SERVIÇOS AMBIENTAIS LTDA</strong>, pessoa jurídica de direito privado, inscrita no CNPJ sob nº 00.000.000/0001-00, com sede na Rua Exemplo, nº 100 – Centro, São Paulo/SP, neste ato representada por <strong>[ASSINANTE]</strong>, doravante denominada <strong>CONTRATADA</strong>;</p>
<h2>CLÁUSULA 1 – DO OBJETO</h2>
<p>O presente contrato tem por objeto a prestação de serviços de <strong>[TIPO DE SERVIÇO]</strong>, conforme especificações e condições descritas neste instrumento.</p>
<h2>CLÁUSULA 2 – DO PRAZO</h2>
<p>O presente contrato terá vigência de <strong>[DURAÇÃO]</strong> meses, com início em <strong>[DATA INÍCIO]</strong> e término em <strong>[DATA FIM]</strong>.</p>
<h2>CLÁUSULA 3 – DO VALOR E FORMA DE PAGAMENTO</h2>
<p>O valor total do presente contrato é de <strong>[VALOR TOTAL]</strong>, a ser pago em <strong>[PARCELAS]</strong> parcelas mensais de <strong>[VALOR PARCELA]</strong>, com vencimento todo dia <strong>[DIA VENCIMENTO]</strong> de cada mês.</p>
<h2>CLÁUSULA 4 – DAS OBRIGAÇÕES DA CONTRATADA</h2>
<ul>
  <li>Executar os serviços conforme especificado;</li>
  <li>Manter equipe técnica qualificada;</li>
  <li>Fornecer relatórios de execução;</li>
</ul>
<h2>CLÁUSULA 5 – DAS OBRIGAÇÕES DA CONTRATANTE</h2>
<ul>
  <li>Efetuar os pagamentos nas datas acordadas;</li>
  <li>Garantir acesso às dependências para execução dos serviços;</li>
</ul>
<h2>CLÁUSULA 6 – DA RESCISÃO</h2>
<p>O presente contrato poderá ser rescindido por qualquer das partes, mediante aviso prévio de 30 dias.</p>
<hr />
<p style="text-align: center;">São Paulo, [DATA]</p>
<br /><br />
<p style="text-align: center;">_____________________________________</p>
<p style="text-align: center;"><strong>CONTRATANTE</strong></p>
<br />
<p style="text-align: center;">_____________________________________</p>
<p style="text-align: center;"><strong>CONTRATADA</strong></p>
`

export const mockTemplates: ContractTemplate[] = [
  {
    id: "tpl-1",
    name: "Contrato Padrão de Desentupimento",
    description: "Template para contratos de serviços de desentupimento e hidrojateamento",
    html: defaultTemplateHtml,
    signerId: "emp10",
    isActive: true,
    createdAt: "2024-06-15",
    updatedAt: "2024-11-20",
  },
  {
    id: "tpl-2",
    name: "Contrato de Limpeza de Reservatórios",
    description: "Template específico para limpeza e higienização de reservatórios",
    html: defaultTemplateHtml,
    signerId: "emp9",
    isActive: true,
    createdAt: "2024-07-01",
    updatedAt: "2024-12-05",
  },
  {
    id: "tpl-3",
    name: "Contrato de Dedetização Completa",
    description: "Template para serviços de dedetização, desratização e descupinização",
    html: defaultTemplateHtml,
    signerId: "emp10",
    isActive: false,
    createdAt: "2024-08-10",
    updatedAt: "2024-10-15",
  },
]

export interface EditorState {
  isOpen: boolean
  isEditing: boolean
  name: string
  canSave: boolean
  onSave: () => void
  onCancel: () => void
}

interface TemplatesContentProps {
  openImport?: boolean
  onImportChange?: (open: boolean) => void
  onEditorStateChange?: (state: EditorState) => void
}

export function TemplatesContent({ openImport, onImportChange, onEditorStateChange }: TemplatesContentProps) {
  const [templates, setTemplates] = useState<ContractTemplate[]>(mockTemplates)
  const [searchTerm, setSearchTerm] = useState("")
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [editorTab, setEditorTab] = useState<"editor" | "preview">("editor")

  useEffect(() => {
    if (openImport) {
      handleImport()
      onImportChange?.(false)
    }
  }, [openImport])

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    html: defaultTemplateHtml,
    signerId: "",
    isActive: true,
  })

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getSignerName = (id: string) => {
    return mockEmployees.find(e => e.id === id)?.name || "-"
  }

  const handleImport = () => {
    setFormData({
      name: "",
      description: "",
      html: defaultTemplateHtml,
      signerId: "",
      isActive: true,
    })
    setEditingTemplate(null)
    setIsImportOpen(true)
  }

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsImportOpen(false)
    setEditorTab("editor")
    setIsEditorOpen(true)
  }

  const handleEdit = (template: ContractTemplate) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      description: template.description,
      html: template.html,
      signerId: template.signerId,
      isActive: template.isActive,
    })
    setEditorTab("editor")
    setIsEditorOpen(true)
  }

  const handleSave = () => {
    if (editingTemplate) {
      setTemplates(templates.map(t =>
        t.id === editingTemplate.id
          ? { ...t, ...formData, updatedAt: new Date().toISOString().split("T")[0] }
          : t
      ))
    } else {
      const newTemplate: ContractTemplate = {
        id: `tpl-${Date.now()}`,
        name: formData.name,
        description: formData.description,
        html: formData.html,
        signerId: formData.signerId,
        isActive: formData.isActive,
        createdAt: new Date().toISOString().split("T")[0],
        updatedAt: new Date().toISOString().split("T")[0],
      }
      setTemplates([...templates, newTemplate])
    }
    setIsEditorOpen(false)
    setEditingTemplate(null)
  }

  const handleCancel = () => {
    setIsEditorOpen(false)
    setEditingTemplate(null)
  }

  useEffect(() => {
    onEditorStateChange?.({
      isOpen: isEditorOpen,
      isEditing: !!editingTemplate,
      name: formData.name,
      canSave: !!(formData.name && formData.signerId),
      onSave: handleSave,
      onCancel: handleCancel,
    })
  }, [isEditorOpen, editingTemplate, formData.name, formData.signerId])

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este template?")) {
      setTemplates(templates.filter(t => t.id !== id))
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (file.name.endsWith(".html") || file.name.endsWith(".htm")) {
        setFormData(prev => ({ ...prev, html: content }))
      } else {
        setFormData(prev => ({
          ...prev,
          html: `<div>${content.replace(/\n/g, "<br />")}</div>`,
        }))
      }
    }
    reader.readAsText(file)
  }

  const toggleActive = (id: string) => {
    setTemplates(templates.map(t =>
      t.id === id ? { ...t, isActive: !t.isActive } : t
    ))
  }

  const previewIframeRef = useRef<HTMLIFrameElement | null>(null)
  const [previewDocHeight, setPreviewDocHeight] = useState(0)

  // Write preview HTML to iframe when preview tab is active
  useEffect(() => {
    if (!isEditorOpen || editorTab !== "preview") return
    const iframe = previewIframeRef.current
    if (!iframe) return

    const html = (formData.html || "").trim()
    if (!html) return

    const payloadHtml = JSON.stringify(html)
    const pageCss = `
      @page { size: A4; margin: 18mm 16mm; }
      html, body { background: transparent; }
      body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.6; color: #000; }
      p { margin: 0 0 10px 0; text-align: justify; min-height: 1em; }
      p:empty { min-height: 1.6em; }
      h1 { margin: 0 0 14px 0; text-align: center; text-transform: uppercase; font-weight: 700; font-style: italic; text-decoration: underline; font-size: 12pt; }
      .clause-title { text-align: left; font-weight: 700; font-style: italic; margin: 18px 0 10px 0; }
      hr { border: 0; border-top: 1px solid rgba(0,0,0,.25); margin: 14px 0; }
      strong { font-weight: 700; }
      .pagedjs_pages { width: 100%; }
      .pagedjs_page { background: white; margin: 0 auto 14px; box-shadow: 0 8px 28px rgba(0,0,0,.10); border-radius: 10px; overflow: hidden; }
    `

    const doc = iframe.contentDocument
    if (!doc) return

    doc.open()
    doc.write(`<!doctype html>
<html><head><meta charset="utf-8"/><style>${pageCss}</style></head><body>
<script src="https://cdn.jsdelivr.net/npm/pagedjs@0.4.3/dist/paged.js"><\/script>
<script>
(async function(){
  try {
    const html = ${payloadHtml};
    const source = document.createElement("div");
    source.innerHTML = html;
    source.style.position = "absolute";
    source.style.left = "-99999px";
    source.style.width = "210mm";
    source.style.visibility = "hidden";
    document.body.appendChild(source);
    const Previewer = (window.Paged && window.Paged.Previewer) ? window.Paged.Previewer : null;
    if (!Previewer) throw new Error("Paged.js não carregou");
    const previewer = new Previewer();
    await previewer.preview(source, [], document.body);
    try { source.remove(); } catch(e){}
    window.parent.postMessage({type:"tpl-preview-ready"},"*");
  } catch(e) {
    document.body.innerHTML = ${payloadHtml};
    window.parent.postMessage({type:"tpl-preview-ready"},"*");
  }
})();
<\/script></body></html>`)
    doc.close()

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== "tpl-preview-ready") return
      if (event.source !== iframe.contentWindow) return
      try {
        const h = iframe.contentDocument?.documentElement?.scrollHeight ?? 0
        if (h > 0) setPreviewDocHeight(h)
      } catch {}
    }
    window.addEventListener("message", onMessage)

    setTimeout(() => {
      try {
        const h = iframe.contentDocument?.documentElement?.scrollHeight ?? 0
        if (h > 0) setPreviewDocHeight(h)
      } catch {}
    }, 500)

    return () => window.removeEventListener("message", onMessage)
  }, [isEditorOpen, editorTab, formData.html])

  // Full-screen editor view
  if (isEditorOpen) {
    return (
      <div className="space-y-4">
        {/* Template metadata - horizontal above editor */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2 flex-1 min-w-[200px]">
                <Label htmlFor="tpl-name">Nome do Template</Label>
                <Input
                  id="tpl-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome do template"
                  required
                />
              </div>
              <div className="space-y-2 flex-1 min-w-[200px]">
                <Label htmlFor="tpl-desc">Descrição</Label>
                <Input
                  id="tpl-desc"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Breve descrição"
                />
              </div>
              <div className="space-y-2 w-[200px]">
                <Label htmlFor="tpl-signer" className="flex items-center gap-1.5">
                  <PenTool className="w-3.5 h-3.5 text-muted-foreground" />
                  Assinante (Contratada)
                </Label>
                <Select
                  value={formData.signerId}
                  onValueChange={(value) => setFormData({ ...formData, signerId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockEmployees
                      .filter(e => e.status === "active")
                      .map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 w-[130px]">
                <Label htmlFor="tpl-status">Status</Label>
                <Select
                  value={formData.isActive ? "active" : "inactive"}
                  onValueChange={(value) => setFormData({ ...formData, isActive: value === "active" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Editor / Preview */}
        <Tabs value={editorTab} onValueChange={(v) => setEditorTab(v as "editor" | "preview")}>
          <TabsList className="mb-3">
            <TabsTrigger value="editor" className="gap-1.5">
              <Edit className="w-3.5 h-3.5" />
              Editar
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              Prévia
            </TabsTrigger>
          </TabsList>
          <TabsContent value="editor">
            <ContractRichEditor
              valueHtml={formData.html}
              onChangeHtml={(html) => setFormData({ ...formData, html })}
            />
          </TabsContent>
          <TabsContent value="preview" forceMount style={{ display: editorTab === "preview" ? undefined : "none" }}>
            <div className="rounded-lg border bg-muted/20 h-[76vh] overflow-auto p-4">
              <iframe
                ref={previewIframeRef}
                title="Prévia paginada do template"
                className="w-full bg-white rounded-md"
                style={{ height: previewDocHeight > 0 ? `${previewDocHeight}px` : "100%" }}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  return (
    <>
      {/* Import Dialog */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Importar Template
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleImportSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="import-name">Nome do Template</Label>
              <Input
                id="import-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do template"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="import-desc">Descrição</Label>
              <Input
                id="import-desc"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Breve descrição do template"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="import-signer" className="flex items-center gap-1.5">
                <PenTool className="w-3.5 h-3.5 text-muted-foreground" />
                Assinante (Contratada)
              </Label>
              <Select
                value={formData.signerId}
                onValueChange={(value) => setFormData({ ...formData, signerId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o funcionário" />
                </SelectTrigger>
                <SelectContent>
                  {mockEmployees
                    .filter(e => e.status === "active")
                    .map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Arquivo do Contrato</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Arraste um arquivo ou clique para selecionar
                </p>
                <Input
                  type="file"
                  accept=".html,.htm,.txt"
                  onChange={handleFileUpload}
                  className="max-w-xs mx-auto"
                />
                <p className="text-[10px] text-muted-foreground mt-2">
                  Formatos aceitos: .html, .htm, .txt
                </p>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setIsImportOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={!formData.name || !formData.signerId}
              >
                Importar e Editar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Templates List */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead className="hidden md:table-cell">Assinante</TableHead>
                <TableHead className="hidden lg:table-cell">Atualizado</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    Nenhum template encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTemplates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 min-w-[2.5rem] rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <span className="font-medium">{template.name}</span>
                          <p className="text-xs text-muted-foreground">{template.description}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-1.5">
                        <PenTool className="h-3.5 w-3.5 text-muted-foreground" />
                        {getSignerName(template.signerId)}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {template.updatedAt}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`cursor-pointer ${template.isActive
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        onClick={() => toggleActive(template.id)}
                      >
                        {template.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(template)} title="Editar">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(template.id)} title="Excluir">
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
      </div>
    </>
  )
}
