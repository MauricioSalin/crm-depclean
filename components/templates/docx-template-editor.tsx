"use client"

import {
  forwardRef,
  type MouseEvent,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  fetchTemplateBaseBinary,
  type TemplateFormat,
  type TemplateKind,
} from "@/lib/api/templates"
import { DOCX_EDITOR_PT_BR } from "@/lib/docx-editor-pt-br"

type DocxEditorHandleLike = {
  focus?: () => void
  save?: (options?: { selective?: boolean }) => Promise<ArrayBuffer | Blob | null>
  destroy?: () => void
}

type RenderAsync = (
  input: ArrayBuffer | Uint8Array | Blob | File,
  container: HTMLElement,
  options?: Record<string, unknown>
) => Promise<DocxEditorHandleLike>

export type DocxTemplateEditorRef = {
  generatePreviewPdf: () => Promise<File>
  insertVariable: (path: string) => void
  saveToFile: () => Promise<File>
  refreshPreview: () => Promise<void>
}

type TemplateEditorTab = "editor" | "preview"

type PreviewRenderState = {
  key: number
  buffer: ArrayBuffer
}

interface DocxTemplateEditorProps {
  activeTab: TemplateEditorTab
  baseFileName?: string
  kind: TemplateKind
  onBaseFileNameChange?: (fileName: string) => void
  onVariableTokenClick?: (path: string) => void
  previewDataKey?: string
  previewVariables?: Record<string, unknown> | null
  templateFormat?: TemplateFormat
  templateId?: string
  templateName: string
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

const DEFAULT_DOCX_FILES: Record<TemplateKind, string> = {
  contract: "/template-assets/docx-poc-contract.docx",
  informative: "/template-assets/docx-poc-informative.docx",
  certificate: "/template-assets/docx-poc-certificate.docx",
}

const TEMPLATE_LABELS: Record<TemplateKind, string> = {
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

function safeDestroy(handle: DocxEditorHandleLike | null) {
  try {
    handle?.destroy?.()
  } catch {
    // The DOCX editor owns an internal React root; cleanup can race with React unmounting the host.
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível carregar o editor DOCX."
}

function formatVariableToken(path: string) {
  const normalized = path.trim().replace(/^\{\{\s*/, "").replace(/\s*\}\}$/, "")
  return `{{${normalized}}}`
}

function getVariablePathFromText(text: string, offset: number) {
  const tokenRegex = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(text))) {
    if (offset >= match.index && offset <= match.index + match[0].length) {
      return match[1]
    }
  }

  return null
}

async function waitForRenderedPages(host: HTMLElement | null, timeoutMs = 3000, previewKey?: number) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const isExpectedPreview = !previewKey || host?.dataset.previewRenderKey === String(previewKey)
    const pages = Array.from(host?.querySelectorAll<HTMLElement>(".layout-page") ?? [])

    if (isExpectedPreview && pages.length > 0) {
      return pages
    }

    await new Promise((resolve) => window.setTimeout(resolve, 80))
  }

  return Array.from(host?.querySelectorAll<HTMLElement>(".layout-page") ?? [])
}

function downloadGeneratedFile(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement("a")
  link.href = url
  link.download = file.name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function flattenPreviewVariables(value: unknown, prefix = ""): Record<string, string> {
  if (value == null) return {}

  if (typeof value !== "object" || value instanceof Date) {
    return prefix ? { [prefix]: String(value) } : {}
  }

  if (Array.isArray(value)) {
    return prefix ? { [prefix]: value.map((item) => String(item ?? "")).join(", ") } : {}
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, nestedValue]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key
    Object.assign(acc, flattenPreviewVariables(nestedValue, nextPrefix))
    return acc
  }, {})
}

function buildDocxTokenRegex(token: string) {
  const xmlGap = "(?:<[^>]+>)*"
  return new RegExp(token.split("").map(escapeRegExp).join(xmlGap), "g")
}

async function replaceDocxTemplateVariables(buffer: ArrayBuffer, variables: Record<string, string>) {
  const JSZip = (await import("jszip")).default
  const zip = await JSZip.loadAsync(buffer)
  const xmlFiles = Object.keys(zip.files).filter((fileName) => /^word\/.*\.xml$/i.test(fileName))

  await Promise.all(
    xmlFiles.map(async (fileName) => {
      const file = zip.file(fileName)
      if (!file) return

      let xml = await file.async("text")
      let changed = false

      for (const [path, rawValue] of Object.entries(variables)) {
        if (rawValue === "") continue

        const replacement = escapeXml(rawValue).replace(/\r?\n/g, "</w:t><w:br/><w:t>")
        const tokens = [`{{${path}}}`, `{{ ${path} }}`]

        for (const token of tokens) {
          const nextXml = xml.replace(buildDocxTokenRegex(token), replacement)
          if (nextXml !== xml) {
            xml = nextXml
            changed = true
          }
        }
      }

      if (changed) {
        zip.file(fileName, xml)
      }
    }),
  )

  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" })
}

async function processDocxPreviewBuffer(buffer: ArrayBuffer, variables: Record<string, unknown>) {
  return replaceDocxTemplateVariables(buffer, flattenPreviewVariables(variables))
}

function sanitizeDocxFileName(value: string, fallback: string) {
  const normalized = value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")

  const fileName = normalized || fallback
  return fileName.toLowerCase().endsWith(".docx") ? fileName : `${fileName}.docx`
}

export const DocxTemplateEditor = forwardRef<DocxTemplateEditorRef, DocxTemplateEditorProps>(
  function DocxTemplateEditor(
    {
      activeTab,
      baseFileName,
      kind,
      onBaseFileNameChange,
      onVariableTokenClick,
      previewDataKey,
      previewVariables,
      templateFormat,
      templateId,
      templateName,
    },
    ref
  ) {
    const editorHostRef = useRef<HTMLDivElement | null>(null)
    const previewHostRef = useRef<HTMLDivElement | null>(null)
    const editorHandleRef = useRef<DocxEditorHandleLike | null>(null)
    const previewHandleRef = useRef<DocxEditorHandleLike | null>(null)
    const editorMountRef = useRef<HTMLDivElement | null>(null)
    const previewMountRef = useRef<HTMLDivElement | null>(null)
    const documentLabelRef = useRef("")
    const onBaseFileNameChangeRef = useRef(onBaseFileNameChange)
    const onVariableTokenClickRef = useRef(onVariableTokenClick)
    const lastEditorSelectionRef = useRef<Range | null>(null)
    const previewVariablesRef = useRef<Record<string, unknown> | null>(previewVariables ?? null)
    const previewBufferRef = useRef<ArrayBuffer | null>(null)
    const previewRenderKeyRef = useRef(0)
    const sourceBufferRef = useRef<ArrayBuffer | null>(null)

    const [sourceBuffer, setSourceBuffer] = useState<ArrayBuffer | null>(null)
    const [previewBuffer, setPreviewBuffer] = useState<ArrayBuffer | null>(null)
    const [editorRenderKey, setEditorRenderKey] = useState(0)
    const [previewRender, setPreviewRender] = useState<PreviewRenderState | null>(null)
    const [fileName, setFileName] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const defaultFileUrl = DEFAULT_DOCX_FILES[kind]
    const loadKey = `${kind}:${templateId || "new"}`
    const documentLabel = useMemo(() => {
      const fallback = `Template de ${TEMPLATE_LABELS[kind].toLowerCase()}`
      return templateName.trim() || fallback
    }, [kind, templateName])
    const shouldUsePageWatermark = kind === "informative" || kind === "certificate"

    useEffect(() => {
      onBaseFileNameChangeRef.current = onBaseFileNameChange
    }, [onBaseFileNameChange])

    useEffect(() => {
      onVariableTokenClickRef.current = onVariableTokenClick
    }, [onVariableTokenClick])

    useEffect(() => {
      previewVariablesRef.current = previewVariables ?? null
    }, [previewVariables])

    useEffect(() => {
      documentLabelRef.current = documentLabel
    }, [documentLabel])

    useEffect(() => {
      sourceBufferRef.current = sourceBuffer
    }, [sourceBuffer])

    useEffect(() => {
      previewBufferRef.current = previewBuffer
    }, [previewBuffer])

    const captureEditorSelection = useCallback(() => {
      const host = editorHostRef.current
      const selection = window.getSelection()

      if (!host || !selection || selection.rangeCount === 0) return

      const range = selection.getRangeAt(0)
      const container = range.commonAncestorContainer
      const parent = container.nodeType === Node.ELEMENT_NODE ? container : container.parentNode

      if (parent && host.contains(parent)) {
        lastEditorSelectionRef.current = range.cloneRange()
      }
    }, [])

    const handleEditorMouseUp = useCallback(
      (event: MouseEvent<HTMLDivElement>) => {
        captureEditorSelection()

        const selection = window.getSelection()
        const target = event.target

        if (!selection || selection.rangeCount === 0 || !(target instanceof Node)) return
        if (!editorHostRef.current?.contains(target)) return

        const anchorNode = selection.anchorNode
        const text = anchorNode?.textContent ?? ""
        const offset = selection.anchorOffset ?? 0
        const path = getVariablePathFromText(text, offset)

        if (path) {
          onVariableTokenClickRef.current?.(path)
        }
      },
      [captureEditorSelection],
    )

    useEffect(() => {
      document.addEventListener("selectionchange", captureEditorSelection)
      return () => document.removeEventListener("selectionchange", captureEditorSelection)
    }, [captureEditorSelection])

    const applyDocumentBuffer = useCallback((buffer: ArrayBuffer, nextFileName: string) => {
      setEditorRenderKey((current) => current + 1)
      setSourceBuffer(cloneBuffer(buffer))
      setPreviewBuffer(cloneBuffer(buffer))
      setPreviewRender(null)
      setFileName(nextFileName)
      onBaseFileNameChangeRef.current?.(nextFileName)
    }, [])

    useEffect(() => {
      let cancelled = false

      async function loadInitialDocx() {
        setIsLoading(true)
        setErrorMessage(null)

        try {
          if (templateId && templateFormat === "docx" && baseFileName) {
            const buffer = await fetchTemplateBaseBinary(templateId)

            if (!cancelled) {
              applyDocumentBuffer(buffer, baseFileName)
            }

            return
          }

          const response = await fetch(defaultFileUrl)

          if (!response.ok) {
            throw new Error(`Não foi possível carregar o DOCX base (${response.status}).`)
          }

          const buffer = await response.arrayBuffer()

          if (!cancelled) {
            applyDocumentBuffer(buffer, defaultFileUrl.split("/").pop() || `${kind}-template.docx`)
          }
        } catch (error) {
          if (!cancelled) {
            setErrorMessage(getErrorMessage(error))
          }
        } finally {
          if (!cancelled) {
            setIsLoading(false)
          }
        }
      }

      loadInitialDocx()

      return () => {
        cancelled = true
      }
    }, [applyDocumentBuffer, loadKey])

    useEffect(() => {
      const host = editorHostRef.current

      if (!host || !sourceBuffer) return

      const buffer = cloneBuffer(sourceBuffer)
      let cancelled = false

      safeDestroy(editorHandleRef.current)
      editorHandleRef.current = null
      if (editorMountRef.current?.parentNode === host) {
        editorMountRef.current.remove()
      }

      const mount = document.createElement("div")
      mount.className = "docx-template-editor-mount h-full min-h-0"
      host.appendChild(mount)
      editorMountRef.current = mount

      async function mountEditor() {
        try {
          const module = (await import("@eigenpal/docx-js-editor")) as { renderAsync: RenderAsync }

          if (cancelled || !host || !mount.isConnected) return

          const handle = await module.renderAsync(buffer, mount, {
            author: "Depclean",
            documentName: documentLabelRef.current,
            documentNameEditable: false,
            initialZoom: 1,
            i18n: DOCX_EDITOR_PT_BR,
            mode: "editing",
            onError: (error: Error) => setErrorMessage(error.message),
            onSave: (savedBuffer: ArrayBuffer) => setPreviewBuffer(cloneBuffer(savedBuffer)),
            readOnly: false,
            renderLogo: () => null,
            renderTitleBarRight: () => null,
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
            if (mount.parentNode === host) {
              mount.remove()
            }
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
        safeDestroy(editorHandleRef.current)
        editorHandleRef.current = null
        if (editorMountRef.current === mount) {
          editorMountRef.current = null
        }
        if (mount.parentNode === host) {
          mount.remove()
        }
      }
    }, [editorRenderKey, sourceBuffer])

    useEffect(() => {
      const host = previewHostRef.current

      if (activeTab !== "preview" || !host || !previewRender) return

      const buffer = cloneBuffer(previewRender.buffer)
      let cancelled = false

      safeDestroy(previewHandleRef.current)
      previewHandleRef.current = null
      if (previewMountRef.current?.parentNode === host) {
        previewMountRef.current.remove()
      }

      const mount = document.createElement("div")
      mount.className = "docx-template-editor-mount h-full min-h-0"
      host.appendChild(mount)
      previewMountRef.current = mount

      async function mountPreview() {
        try {
          const module = (await import("@eigenpal/docx-js-editor")) as { renderAsync: RenderAsync }

          if (cancelled || !host || !mount.isConnected) return

          const handle = await module.renderAsync(buffer, mount, {
            documentName: `${documentLabelRef.current} - Prévia`,
            documentNameEditable: false,
            initialZoom: 1,
            i18n: DOCX_EDITOR_PT_BR,
            mode: "viewing",
            readOnly: true,
            renderLogo: () => null,
            renderTitleBarRight: () => null,
            rulerUnit: "cm",
            showMarginGuides: true,
            showOutline: false,
            showOutlineButton: false,
            showPrintButton: false,
            showRuler: false,
            showToolbar: false,
            showZoomControl: false,
          })

          if (cancelled) {
            handle.destroy?.()
            if (mount.parentNode === host) {
              mount.remove()
            }
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
        safeDestroy(previewHandleRef.current)
        previewHandleRef.current = null
        if (previewMountRef.current === mount) {
          previewMountRef.current = null
        }
        if (mount.parentNode === host) {
          mount.remove()
        }
      }
    }, [activeTab, previewRender])

    const saveCurrentBuffer = useCallback(async () => {
      const saved = await editorHandleRef.current?.save?.({ selective: false })
      const buffer = await toArrayBuffer(saved)

      if (buffer) {
        setPreviewBuffer(cloneBuffer(buffer))
        return buffer
      }

      if (previewBufferRef.current) {
        return cloneBuffer(previewBufferRef.current)
      }

      if (sourceBufferRef.current) {
        return cloneBuffer(sourceBufferRef.current)
      }

      throw new Error("Nenhum DOCX foi carregado para salvar.")
    }, [])

    const refreshPreview = useCallback(async () => {
      setErrorMessage(null)

      try {
        const buffer = await saveCurrentBuffer()
        const previewVariables = previewVariablesRef.current
        const processedBuffer =
          previewVariables && Object.keys(previewVariables).length > 0
            ? await processDocxPreviewBuffer(buffer, previewVariables)
            : buffer

        previewRenderKeyRef.current += 1
        setPreviewRender({
          key: previewRenderKeyRef.current,
          buffer: cloneBuffer(processedBuffer),
        })
      } catch (error) {
        const message = getErrorMessage(error)
        setErrorMessage(message)
        throw new Error(message)
      }
    }, [saveCurrentBuffer])

    useEffect(() => {
      if (activeTab !== "preview") return

      void refreshPreview().catch(() => undefined)
    }, [activeTab, previewDataKey, refreshPreview])

    const saveToFile = useCallback(async () => {
      const buffer = await saveCurrentBuffer()
      const safeFileName = sanitizeDocxFileName(fileName || templateName, `${kind}-template.docx`)

      onBaseFileNameChangeRef.current?.(safeFileName)

      return new File([buffer], safeFileName, { type: DOCX_MIME })
    }, [fileName, kind, saveCurrentBuffer, templateName])

    const insertVariable = useCallback(
      (path: string) => {
        const token = formatVariableToken(path)
        const selection = window.getSelection()

        editorHandleRef.current?.focus?.()

        if (selection && lastEditorSelectionRef.current) {
          selection.removeAllRanges()
          selection.addRange(lastEditorSelectionRef.current)
        }

        const inserted = document.execCommand("insertText", false, token)

        if (!inserted) {
          throw new Error("Clique no ponto do documento onde a variável deve entrar e tente novamente.")
        }

        window.setTimeout(() => {
          captureEditorSelection()
        }, 0)
      },
      [captureEditorSelection],
    )

    const generatePreviewPdf = useCallback(async () => {
      setErrorMessage(null)
      await refreshPreview()
      const targetPreviewKey = previewRenderKeyRef.current
      await new Promise((resolve) => window.requestAnimationFrame(resolve))
      await new Promise((resolve) => window.requestAnimationFrame(resolve))

      const pages = await waitForRenderedPages(previewHostRef.current, 3000, targetPreviewKey)

      if (pages.length === 0) {
        throw new Error("A prévia ainda não foi renderizada para gerar o PDF.")
      }

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")])
      const pdf = new jsPDF({ format: "a4", orientation: "portrait", unit: "pt" })
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()

      for (const [index, page] of pages.entries()) {
        const canvas = await html2canvas(page, {
          backgroundColor: "#ffffff",
          logging: false,
          scale: 2,
          useCORS: true,
        })
        const imageData = canvas.toDataURL("image/jpeg", 0.98)

        if (index > 0) {
          pdf.addPage()
        }

        pdf.addImage(imageData, "JPEG", 0, 0, pdfWidth, pdfHeight)
      }

      const safeDocxName = sanitizeDocxFileName(fileName || templateName, `${kind}-template.docx`)
      const pdfName = safeDocxName.replace(/\.docx$/i, ".pdf")
      const blob = pdf.output("blob")
      const file = new File([blob], pdfName, { type: "application/pdf" })

      downloadGeneratedFile(file)

      return file
    }, [fileName, kind, refreshPreview, templateName])

    useImperativeHandle(
      ref,
      () => ({ generatePreviewPdf, insertVariable, refreshPreview, saveToFile }),
      [generatePreviewPdf, insertVariable, refreshPreview, saveToFile],
    )

    return (
      <div
        className={`docx-template-editor-shell docx-template-editor-shell--${activeTab} ${
          shouldUsePageWatermark ? "docx-template-editor-shell--watermark" : ""
        } flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-2xl border border-border/80 bg-muted/20 p-3`}
      >
        {isLoading ? (
          <div className="rounded-xl border bg-background px-4 py-3 text-sm text-muted-foreground">
            Carregando documento DOCX...
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}

        <section className={activeTab === "editor" ? "min-h-0 flex-1 overflow-hidden" : "hidden"}>
          <div
            key={`editor-${editorRenderKey}`}
            ref={editorHostRef}
            onKeyUp={captureEditorSelection}
            onMouseUp={handleEditorMouseUp}
            className="docx-template-editor-host h-full min-h-0 flex-1 overflow-auto rounded-xl bg-[#f4f5f2]"
          />
        </section>

        <section className={activeTab === "preview" ? "min-h-0 flex-1 overflow-hidden" : "hidden"}>
          <div
            key={`preview-${previewRender?.key ?? 0}`}
            ref={previewHostRef}
            data-preview-render-key={previewRender?.key ?? 0}
            className="docx-template-editor-host h-full min-h-0 flex-1 overflow-auto rounded-xl bg-[#f4f5f2]"
          />
        </section>
      </div>
    )
  }
)
