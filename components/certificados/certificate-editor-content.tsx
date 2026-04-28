"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Award, Calendar, Edit, ExternalLink, Eye, FileText, Send, UserRound } from "lucide-react"

import { DocxTemplateEditor, type DocxTemplateEditorRef } from "@/components/templates/docx-template-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getCertificateContext, sendCertificate } from "@/lib/api/certificates"
import { buildApiFileUrl } from "@/lib/api/client"
import { listTemplates, type TemplateRecord } from "@/lib/api/templates"
import { getStoredUser } from "@/lib/auth/session"

type EditorTab = "editor" | "preview"

function formatDate(value: string) {
  if (!value) return "-"
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}

function getTemplateImageUrl(template?: TemplateRecord | null) {
  if (!template?.watermarkFileUrl) return undefined
  return buildApiFileUrl(template.watermarkFileUrl)
}

function formatFileSize(size?: number) {
  if (!size) return ""
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function CertificateEditorContent({ scheduleId }: { scheduleId: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const editorRef = useRef<DocxTemplateEditorRef | null>(null)
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getStoredUser>>(null)
  const [mounted, setMounted] = useState(false)
  const [editorTab, setEditorTab] = useState<EditorTab>("editor")
  const [selectedTemplateId, setSelectedTemplateId] = useState("")

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

  const templatesQuery = useQuery({
    queryKey: ["templates", "certificate-editor"],
    queryFn: () => listTemplates("", "certificate"),
    enabled: mounted && canView,
  })

  const contextQuery = useQuery({
    queryKey: ["certificates", scheduleId, "context"],
    queryFn: () => getCertificateContext(scheduleId),
    enabled: mounted && canView && Boolean(scheduleId),
  })

  const templates = useMemo(
    () => (templatesQuery.data?.data ?? []).filter((template) => template.isActive && template.format === "docx"),
    [templatesQuery.data?.data],
  )
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null
  const context = contextQuery.data?.data

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplate) {
        throw new Error("Selecione um template de certificado.")
      }

      setEditorTab("preview")
      await new Promise((resolve) => window.requestAnimationFrame(resolve))
      await new Promise((resolve) => window.requestAnimationFrame(resolve))

      const file = await editorRef.current?.generatePreviewPdf({ download: false })
      if (!file) {
        throw new Error("A prévia ainda não está pronta para gerar o PDF.")
      }

      return sendCertificate(scheduleId, file, selectedTemplate.id)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["certificates"] })
      toast.success("Certificado enviado para processamento e anexado ao perfil do cliente.")
      router.push("/certificados")
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o certificado.")
    },
  })

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

  if (templatesQuery.isLoading || contextQuery.isLoading || !context) {
    return (
      <Card>
        <CardContent className="flex min-h-[260px] items-center justify-center text-sm text-muted-foreground">
          Carregando certificado...
        </CardContent>
      </Card>
    )
  }

  if (templates.length === 0) {
    return (
      <Card>
        <CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-center">
          <FileText className="h-10 w-10 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold">Nenhum template ativo</h2>
            <p className="text-sm text-muted-foreground">
              Cadastre um template DOCX de certificado antes de gerar o documento.
            </p>
          </div>
          <Button asChild>
            <Link href="/templates?tab=certificate">Abrir templates</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
      <Tabs value={editorTab} onValueChange={(value) => setEditorTab(value as EditorTab)} className="flex h-[calc(100dvh-170px)] min-h-[760px] min-w-0 flex-col">
        <TabsList className="mb-3 shrink-0">
          <TabsTrigger value="editor" className="gap-1.5">
            <Edit className="h-3.5 w-3.5" />
            Editar
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            Prévia
          </TabsTrigger>
        </TabsList>

        <DocxTemplateEditor
          ref={editorRef}
          activeTab={editorTab}
          applyVariablesToEditor
          baseFileName={selectedTemplate?.baseFileName}
          kind="certificate"
          previewDataKey={`${scheduleId}:${selectedTemplateId}:${JSON.stringify(context.variables)}`}
          previewVariables={context.variables}
          templateFormat={selectedTemplate?.format ?? "docx"}
          templateId={selectedTemplate?.id}
          templateName={selectedTemplate?.name || "Certificado"}
          watermarkImageUrl={getTemplateImageUrl(selectedTemplate)}
        />
      </Tabs>

      <Card className="h-[calc(100dvh-170px)] min-h-[760px] overflow-hidden xl:sticky xl:top-4 xl:mt-[55px]">
        <CardContent className="flex h-full min-h-0 flex-col gap-4 overflow-hidden px-0 pt-4">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pr-8 pb-1">
            <div>
              <h3 className="text-base font-semibold">Dados do certificado</h3>
              <p className="text-sm text-muted-foreground">
                Escolha o template e revise o documento antes de enviar.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Template</Label>
              <SearchableSelect
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
                includeAll={false}
                placeholder="Selecione o template"
                searchPlaceholder="Buscar template..."
                emptyMessage="Nenhum template encontrado."
                options={templates.map((template) => ({ value: template.id, label: template.name }))}
              />
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <UserRound className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold">{context.client.companyName}</p>
                  <p className="text-sm text-muted-foreground">{context.client.cnpj}</p>
                  <p className="truncate text-sm text-muted-foreground">{context.client.email}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{context.service.name}</p>
                  <p className="text-sm text-muted-foreground">{context.unit.name || "Unidade principal"}</p>
                </div>
                <Badge className="bg-green-100 text-green-800">Concluído</Badge>
              </div>
              <div className="grid gap-3 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {formatDate(context.schedule.date)} às {context.schedule.time || "--:--"}
                </p>
                <p>{context.unit.address}</p>
                {context.schedule.serviceReport ? <p>{context.schedule.serviceReport}</p> : null}
              </div>
            </div>

            {context.schedule.naAttachment ? (
              <div className="space-y-3 rounded-xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">NA anexada</p>
                    <p className="truncate text-sm text-muted-foreground">{context.schedule.naAttachment.fileName}</p>
                    {context.schedule.naAttachment.fileSize ? (
                      <p className="text-xs text-muted-foreground">{formatFileSize(context.schedule.naAttachment.fileSize)}</p>
                    ) : null}
                  </div>
                </div>
                <Button variant="outline" className="w-full justify-center" asChild>
                  <a href={buildApiFileUrl(context.schedule.naAttachment.documentUrl)} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir NA
                  </a>
                </Button>
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t px-6 py-4">
            <Button variant="outline" asChild>
              <Link href="/certificados">Voltar</Link>
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!canManage || sendMutation.isPending || !selectedTemplate}
              onClick={() => sendMutation.mutate()}
            >
              {sendMutation.isPending ? (
                "Enviando..."
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar certificado
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
