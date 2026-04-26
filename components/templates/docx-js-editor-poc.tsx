"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Download, FileText, Loader2, RefreshCw, Save, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { TemplateKind } from "@/lib/api/templates"

type DocxEditorHandleLike = {
  save?: (options?: { selective?: boolean }) => Promise<ArrayBuffer | Blob | null>
  destroy?: () => void
}

type RenderAsync = (
  input: ArrayBuffer | Uint8Array | Blob | File,
  container: HTMLElement,
  options?: Record<string, unknown>
) => Promise<DocxEditorHandleLike>

const DOCX_POC_FILES: Record<TemplateKind, string> = {
  contract: "/template-assets/docx-poc-contract.docx",
  informative: "/template-assets/docx-poc-informative.docx",
  certificate: "/template-assets/docx-poc-certificate.docx",
}

const DOCX_POC_LABELS: Record<TemplateKind, string> = {
  contract: "Contrato",
  informative: "Informativo",
  certificate: "Certificado",
}

function cloneBuffer(buffer: ArrayBuffer) {
  return buffer.slice(0)
}

async function toArrayBuffer(value: ArrayBuffer | Blob | null | undefined) {
  if (!value) return null
  return value instanceof Blob ? value.arrayBuffer() : value
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível carregar o editor DOCX."
}

function downloadDocx(buffer: ArrayBuffer, fileName: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")

  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

interface DocxJsEditorPocProps {
  kind: TemplateKind
  templateName: string
}

export function DocxJsEditorPoc({ kind, templateName }: DocxJsEditorPocProps) {
  const editorHostRef = useRef<HTMLDivElement | null>(null)
  const previewHostRef = useRef<HTMLDivElement | null>(null)
  const editorHandleRef = useRef<DocxEditorHandleLike | null>(null)
  const previewHandleRef = useRef<DocxEditorHandleLike | null>(null)

  const [sourceBuffer, setSourceBuffer] = useState<ArrayBuffer | null>(null)
  const [previewBuffer, setPreviewBuffer] = useState<ArrayBuffer | null>(null)
  const [fileName, setFileName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const defaultFileUrl = DOCX_POC_FILES[kind]
  const documentLabel = useMemo(() => {
    const baseName = templateName.trim() || `Template de ${DOCX_POC_LABELS[kind].toLowerCase()}`
    return `${baseName} - POC DOCX`
  }, [kind, templateName])

  const loadDocxFromUrl = useCallback(
    async (url: string) => {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`Não foi possível carregar o DOCX base (${response.status}).`)
        }

        const buffer = await response.arrayBuffer()
        setSourceBuffer(buffer)
        setPreviewBuffer(cloneBuffer(buffer))
        setFileName(url.split("/").pop() || `${kind}-template.docx`)
      } catch (error) {
        setErrorMessage(getErrorMessage(error))
      } finally {
        setIsLoading(false)
      }
    },
    [kind]
  )

  useEffect(() => {
    loadDocxFromUrl(defaultFileUrl)
  }, [defaultFileUrl, loadDocxFromUrl])

  useEffect(() => {
    const host = editorHostRef.current

    if (!host || !sourceBuffer) return

    const buffer = sourceBuffer
    let cancelled = false
    host.innerHTML = ""
    editorHandleRef.current?.destroy?.()
    editorHandleRef.current = null

    async function mountEditor() {
      try {
        const module = (await import("@eigenpal/docx-js-editor")) as { renderAsync: RenderAsync }

        if (cancelled || !host) return

        const handle = await module.renderAsync(cloneBuffer(buffer), host, {
          author: "Depclean",
          documentName: documentLabel,
          documentNameEditable: false,
          initialZoom: 0.72,
          mode: "editing",
          onError: (error: Error) => setErrorMessage(error.message),
          onSave: (buffer: ArrayBuffer) => setPreviewBuffer(cloneBuffer(buffer)),
          readOnly: false,
          rulerUnit: "cm",
          showMarginGuides: true,
          showOutline: false,
          showOutlineButton: false,
          showPrintButton: false,
          showRuler: true,
          showToolbar: true,
          showZoomControl: true,
        })

        if (cancelled) {
          handle.destroy?.()
          return
        }

        editorHandleRef.current = handle
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(getErrorMessage(error))
        }
      }
    }

    mountEditor()

    return () => {
      cancelled = true
      editorHandleRef.current?.destroy?.()
      editorHandleRef.current = null
      host.innerHTML = ""
    }
  }, [documentLabel, sourceBuffer])

  useEffect(() => {
    const host = previewHostRef.current

    if (!host || !previewBuffer) return

    const buffer = previewBuffer
    let cancelled = false
    host.innerHTML = ""
    previewHandleRef.current?.destroy?.()
    previewHandleRef.current = null

    async function mountPreview() {
      try {
        const module = (await import("@eigenpal/docx-js-editor")) as { renderAsync: RenderAsync }

        if (cancelled || !host) return

        const handle = await module.renderAsync(cloneBuffer(buffer), host, {
          documentName: `${documentLabel} - Prévia`,
          documentNameEditable: false,
          initialZoom: 0.72,
          mode: "viewing",
          readOnly: true,
          rulerUnit: "cm",
          showMarginGuides: true,
          showOutline: false,
          showOutlineButton: false,
          showPrintButton: false,
          showRuler: false,
          showToolbar: false,
          showZoomControl: true,
        })

        if (cancelled) {
          handle.destroy?.()
          return
        }

        previewHandleRef.current = handle
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(getErrorMessage(error))
        }
      }
    }

    mountPreview()

    return () => {
      cancelled = true
      previewHandleRef.current?.destroy?.()
      previewHandleRef.current = null
      host.innerHTML = ""
    }
  }, [documentLabel, previewBuffer])

  async function handleRefreshPreview() {
    setIsSaving(true)
    setErrorMessage(null)

    try {
      const saved = await editorHandleRef.current?.save?.({ selective: false })
      const buffer = await toArrayBuffer(saved)

      if (!buffer) {
        throw new Error("A lib não retornou um DOCX ao salvar.")
      }

      setPreviewBuffer(cloneBuffer(buffer))
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDownload() {
    setIsSaving(true)
    setErrorMessage(null)

    try {
      const saved = await editorHandleRef.current?.save?.({ selective: false })
      const buffer = await toArrayBuffer(saved)

      if (!buffer) {
        throw new Error("A lib não retornou um DOCX ao salvar.")
      }

      downloadDocx(buffer, fileName || `${kind}-template-poc.docx`)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) return

    setErrorMessage(null)
    const buffer = await file.arrayBuffer()

    setSourceBuffer(buffer)
    setPreviewBuffer(cloneBuffer(buffer))
    setFileName(file.name)
    event.target.value = ""
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 rounded-2xl border border-border/80 bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-background p-3 shadow-sm">
        <div className="flex min-w-[240px] flex-1 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">POC com @eigenpal/docx-js-editor</p>
            <p className="truncate text-xs text-muted-foreground">
              Editando {fileName || "DOCX base"} sem alterar o editor HTML atual.
            </p>
          </div>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-muted">
          <Upload className="h-4 w-4" />
          Abrir DOCX
          <Input type="file" accept=".docx" onChange={handleFileChange} className="hidden" />
        </label>

        <Button type="button" variant="outline" onClick={() => loadDocxFromUrl(defaultFileUrl)} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Recarregar base
        </Button>

        <Button type="button" variant="outline" onClick={handleDownload} disabled={!sourceBuffer || isSaving}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Baixar DOCX
        </Button>

        <Button type="button" onClick={handleRefreshPreview} disabled={!sourceBuffer || isSaving}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Atualizar prévia
        </Button>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-2">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
          <div className="border-b px-4 py-3">
            <p className="text-sm font-semibold">Edição DOCX</p>
            <p className="text-xs text-muted-foreground">Toolbar, régua, tabelas e quebras vêm da própria lib.</p>
          </div>
          <div ref={editorHostRef} className="docx-js-editor-poc-host min-h-[680px] flex-1 overflow-auto bg-[#f4f5f2]" />
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
          <div className="border-b px-4 py-3">
            <p className="text-sm font-semibold">Prévia DOCX</p>
            <p className="text-xs text-muted-foreground">Clique em “Atualizar prévia” para renderizar o DOCX salvo.</p>
          </div>
          <div ref={previewHostRef} className="docx-js-editor-poc-host min-h-[680px] flex-1 overflow-auto bg-[#f4f5f2]" />
        </section>
      </div>
    </div>
  )
}
