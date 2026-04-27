"use client"

import {
  createElement,
  createRef,
  forwardRef,
  type CSSProperties,
  type MouseEvent,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import { createRoot } from "react-dom/client"
import {
  fetchTemplateBaseBinary,
  type TemplateFormat,
  type TemplateKind,
} from "@/lib/api/templates"
import { DOCX_EDITOR_PT_BR } from "@/lib/docx-editor-pt-br"

type DocxEditorHandleLike = {
  focus?: () => void
  getDocument?: () => unknown | null
  getEditorRef?: () => PagedEditorRefLike | null
  save?: (options?: { selective?: boolean }) => Promise<ArrayBuffer | Blob | null>
  destroy?: () => void
}

type DocxEditorOptions = Record<string, unknown> & {
  onChange?: (document: unknown) => void
  onEditorViewReady?: (view: unknown) => void
  onFontsLoaded?: () => void
  onSelectionChange?: (state: unknown) => void
  onError?: (error: Error) => void
}

type ProseMirrorMarkTypeLike = {
  create?: (attrs?: Record<string, unknown>) => unknown
}

type ProseMirrorMarkLike = {
  type?: ProseMirrorMarkTypeLike
}

type ProseMirrorSelectionLike = {
  $from?: {
    marks?: () => ProseMirrorMarkLike[]
  }
  anchor?: number
  from?: number
  head?: number
  to?: number
}

type ProseMirrorTransactionLike = {
  addMark?: (from: number, to: number, mark: unknown) => ProseMirrorTransactionLike
  removeMark?: (from: number, to: number, markType: ProseMirrorMarkTypeLike) => ProseMirrorTransactionLike
  scrollIntoView?: () => ProseMirrorTransactionLike
  setStoredMarks?: (marks: unknown[] | null) => ProseMirrorTransactionLike
}

type ProseMirrorViewLike = {
  dispatch?: (transaction: ProseMirrorTransactionLike) => void
  focus?: () => void
  state?: {
    schema?: {
      marks?: Record<string, ProseMirrorMarkTypeLike | undefined>
    }
    selection?: ProseMirrorSelectionLike
    storedMarks?: ProseMirrorMarkLike[] | null
    tr?: ProseMirrorTransactionLike
  }
}

type PagedEditorRefLike = {
  focus?: () => void
  getView?: () => ProseMirrorViewLike | null
  relayout?: () => void
  setSelection?: (anchor: number, head?: number) => void
}

type ProseMirrorSelectionSnapshot = {
  from: number
  to: number
}

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

type NativeTooltipState = {
  text: string
  x: number
  y: number
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
  watermarkImageUrl?: string
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

const DEFAULT_DOCX_FILES: Record<TemplateKind, string> = {
  contract: "/template-assets/docx-poc-contract.docx",
  informative: "/template-assets/docx-poc-informative.docx",
  certificate: "/template-assets/docx-poc-certificate.docx",
}

const DOCX_EDITOR_FONT_NAMES = [
  "Arial",
  "Calibri",
  "Helvetica",
  "Verdana",
  "Open Sans",
  "Roboto",
  "Times New Roman",
  "Georgia",
  "Cambria",
  "Garamond",
  "Courier New",
  "Consolas",
]

const TEMPLATE_LABELS: Record<TemplateKind, string> = {
  contract: "Contrato",
  informative: "Informativo",
  certificate: "Certificado",
}

const REACT_STYLE_PROPERTY_WARNING =
  "Removing a style property during rerender (borderColor) when a conflicting property is set (border)"

let preloadedDocxEditorFonts: Promise<void> | null = null

function cloneBuffer(buffer: ArrayBuffer) {
  return buffer.slice(0)
}

async function toArrayBuffer(value: ArrayBuffer | Blob | null | undefined) {
  if (!value) return null
  return value instanceof Blob ? value.arrayBuffer() : value
}

function unescapeXmlAttribute(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
}

function escapeXmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function normalizeFontFamilyName(value: string) {
  const decoded = unescapeXmlAttribute(value)
  const firstFont = decoded
    .split(",")[0]
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .trim()

  if (!firstFont) return value

  const knownFont = DOCX_EDITOR_FONT_NAMES.find((font) => font.toLowerCase() === firstFont.toLowerCase())
  return knownFont ?? firstFont
}

function normalizeDocxXmlFontNames(xml: string) {
  return xml.replace(/(w:(?:ascii|hAnsi|eastAsia|cs)=")([^"]*)(")/g, (match, prefix, value, suffix) => {
    const normalizedValue = normalizeFontFamilyName(value)
    if (normalizedValue === value) return match

    return `${prefix}${escapeXmlAttribute(normalizedValue)}${suffix}`
  })
}

function getKnownToolbarFontName(value: string | null | undefined) {
  if (!value) return null

  const normalized = normalizeFontFamilyName(value.replace(/\s+/g, " ").trim())
  const normalizedLower = normalized.toLowerCase()

  return (
    DOCX_EDITOR_FONT_NAMES.find((font) => {
      const fontLower = font.toLowerCase()
      return normalizedLower === fontLower || normalizedLower.includes(fontLower)
    }) ?? null
  )
}

function getToolbarFontOption(target: EventTarget | null) {
  if (!(target instanceof Element)) return null

  const option = target.closest<HTMLElement>('[role="option"]')
  if (!option) return null

  return getKnownToolbarFontName(option.textContent)
}

function getSelectionSnapshot(view: ProseMirrorViewLike | null | undefined): ProseMirrorSelectionSnapshot | null {
  const selection = view?.state?.selection
  const from = typeof selection?.from === "number" ? selection.from : selection?.anchor
  const to = typeof selection?.to === "number" ? selection.to : selection?.head

  if (typeof from !== "number" || typeof to !== "number") return null
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null

  return { from, to }
}

function stripNativeToolbarTitleAttributes(host: HTMLElement | null) {
  if (!host) return

  host
    .querySelectorAll<HTMLElement>('[data-testid="editor-toolbar"] [title], .docx-list-buttons [title]')
    .forEach((element) => {
      const title = element.getAttribute("title")
      if (!title) return

      element.setAttribute("data-depclean-tooltip", title)
      if (!element.getAttribute("aria-label")) {
        element.setAttribute("aria-label", title)
      }
      element.removeAttribute("title")
    })
}

function getNativeToolbarTooltip(target: EventTarget | null, host: HTMLElement | null) {
  if (!(target instanceof Element) || !host?.contains(target)) return null

  const element = target.closest<HTMLElement>("[data-depclean-tooltip], [title]")
  if (!element || !host.contains(element)) return null

  const toolbar = host.querySelector('[data-testid="editor-toolbar"]')
  const isToolbarElement = Boolean(toolbar?.contains(element)) || Boolean(element.closest(".docx-list-buttons"))
  if (!isToolbarElement) return null

  stripNativeToolbarTitleAttributes(host)

  const text = element.getAttribute("data-depclean-tooltip")
  if (!text) return null

  const rect = element.getBoundingClientRect()

  return {
    text,
    x: rect.left + rect.width / 2,
    y: rect.bottom + 8,
  }
}

async function serializeDocumentModel(document: unknown) {
  if (!document) return null

  const module = (await import("@eigenpal/docx-js-editor")) as {
    DocumentAgent: {
      fromDocument: (document: never) => {
        toBuffer: () => Promise<ArrayBuffer>
      }
    }
  }

  return module.DocumentAgent.fromDocument(document as never).toBuffer()
}

function preloadDocxEditorFonts() {
  if (typeof document === "undefined") return Promise.resolve()

  preloadedDocxEditorFonts ??= import("@eigenpal/docx-js-editor")
    .then((module) => {
      const loadFonts = (module as { loadFonts?: (fonts: string[]) => Promise<void> }).loadFonts
      return loadFonts?.(DOCX_EDITOR_FONT_NAMES)
    })
    .then(() => undefined)
    .catch(() => undefined)

  return preloadedDocxEditorFonts
}

async function renderDocxEditor(
  input: ArrayBuffer | Uint8Array | Blob | File,
  container: HTMLElement,
  options: DocxEditorOptions = {}
) {
  const module = (await import("@eigenpal/docx-js-editor")) as { DocxEditor: unknown }
  const root = createRoot(container)
  const editorRef = createRef<DocxEditorHandleLike>()

  return new Promise<DocxEditorHandleLike>((resolve, reject) => {
    let settled = false

    const resolveHandle = () => {
      if (settled) return

      const current = editorRef.current
      if (!current) {
        window.setTimeout(resolveHandle, 0)
        return
      }

      settled = true
      resolve({
        destroy: () => root.unmount(),
        focus: () => editorRef.current?.focus?.(),
        getDocument: () => editorRef.current?.getDocument?.() ?? null,
        getEditorRef: () => editorRef.current?.getEditorRef?.() ?? null,
        save: (saveOptions) => editorRef.current?.save?.(saveOptions) ?? Promise.resolve(null),
      })
    }

    const handleError = (error: Error) => {
      options.onError?.(error)
      if (!settled) {
        settled = true
        window.setTimeout(() => root.unmount(), 0)
        reject(error)
      }
    }

    root.render(
      createElement(module.DocxEditor as never, {
        ...options,
        documentBuffer: input,
        onChange: (document: unknown) => {
          options.onChange?.(document)
          resolveHandle()
        },
        onEditorViewReady: (view: unknown) => {
          options.onEditorViewReady?.(view)
          resolveHandle()
        },
        onError: handleError,
        onFontsLoaded: () => {
          options.onFontsLoaded?.()
        },
        onSelectionChange: (state: unknown) => {
          options.onSelectionChange?.(state)
        },
        ref: editorRef,
      })
    )

    window.setTimeout(resolveHandle, 50)
  })
}

function safeDestroy(handle: DocxEditorHandleLike | null) {
  if (!handle?.destroy) return

  window.setTimeout(() => {
    try {
      handle.destroy?.()
    } catch {
      // The DOCX editor owns an internal React root; cleanup can race with React unmounting the host.
    }
  }, 0)
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

const DOCX_STYLE_IDS_FOR_BLACK_TEXT = ["Title", "Subtitle", "Heading1", "Heading2", "Heading3", "Heading4", "Heading5", "Heading6"]

function forceStyleTextColor(stylesXml: string, styleId: string, color = "000000") {
  const styleRegex = new RegExp(`(<w:style\\b(?=[^>]*\\bw:styleId="${escapeRegExp(styleId)}")[\\s\\S]*?</w:style>)`, "g")

  return stylesXml.replace(styleRegex, (styleBlock) => {
    const colorNode = `<w:color w:val="${color}"/>`
    const runPropertiesMatch = styleBlock.match(/<w:rPr\b[\s\S]*?<\/w:rPr>/)

    if (!runPropertiesMatch) {
      return styleBlock.replace("</w:style>", `<w:rPr>${colorNode}</w:rPr></w:style>`)
    }

    const nextRunProperties = runPropertiesMatch[0].includes("<w:color")
      ? runPropertiesMatch[0].replace(/<w:color\b[^>]*\/>/g, colorNode)
      : runPropertiesMatch[0].replace(/(<w:rPr\b[^>]*>)/, `$1${colorNode}`)

    return styleBlock.replace(runPropertiesMatch[0], nextRunProperties)
  })
}

async function normalizeDocxTemplateBuffer(buffer: ArrayBuffer) {
  const JSZip = (await import("jszip")).default
  const zip = await JSZip.loadAsync(buffer)
  const stylesFile = zip.file("word/styles.xml")
  const xmlFiles = Object.keys(zip.files).filter((fileName) => /^word\/.*\.xml$/i.test(fileName))
  let hasChanges = false

  await Promise.all(
    xmlFiles.map(async (fileName) => {
      const file = zip.file(fileName)
      if (!file) return

      const xml = await file.async("text")
      const normalizedXml = normalizeDocxXmlFontNames(xml)

      if (normalizedXml !== xml) {
        zip.file(fileName, normalizedXml)
        hasChanges = true
      }
    }),
  )

  if (stylesFile) {
    const stylesXml = await stylesFile.async("text")
    const normalizedStylesXml = DOCX_STYLE_IDS_FOR_BLACK_TEXT.reduce(
      (xml, styleId) => forceStyleTextColor(xml, styleId),
      normalizeDocxXmlFontNames(stylesXml),
    )

    if (normalizedStylesXml !== stylesXml) {
      zip.file("word/styles.xml", normalizedStylesXml)
      hasChanges = true
    }
  }

  if (!hasChanges) {
    return buffer
  }

  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" })
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
      watermarkImageUrl,
    },
    ref
  ) {
    const editorHostRef = useRef<HTMLDivElement | null>(null)
    const previewHostRef = useRef<HTMLDivElement | null>(null)
    const editorHandleRef = useRef<DocxEditorHandleLike | null>(null)
    const previewHandleRef = useRef<DocxEditorHandleLike | null>(null)
    const editorViewRef = useRef<ProseMirrorViewLike | null>(null)
    const editorMountRef = useRef<HTMLDivElement | null>(null)
    const previewMountRef = useRef<HTMLDivElement | null>(null)
    const documentLabelRef = useRef("")
    const onBaseFileNameChangeRef = useRef(onBaseFileNameChange)
    const onVariableTokenClickRef = useRef(onVariableTokenClick)
    const lastEditorSelectionRef = useRef<Range | null>(null)
    const lastProseMirrorSelectionRef = useRef<ProseMirrorSelectionSnapshot | null>(null)
    const pendingToolbarFontRef = useRef<{
      fontName: string
      selection: ProseMirrorSelectionSnapshot | null
    } | null>(null)
    const previewVariablesRef = useRef<Record<string, unknown> | null>(previewVariables ?? null)
    const previewBufferRef = useRef<ArrayBuffer | null>(null)
    const previewRenderKeyRef = useRef(0)
    const savedBufferRef = useRef<ArrayBuffer | null>(null)
    const sourceBufferRef = useRef<ArrayBuffer | null>(null)
    const latestDocumentRef = useRef<unknown | null>(null)

    const [sourceBuffer, setSourceBuffer] = useState<ArrayBuffer | null>(null)
    const [previewBuffer, setPreviewBuffer] = useState<ArrayBuffer | null>(null)
    const [editorRenderKey, setEditorRenderKey] = useState(0)
    const [previewRender, setPreviewRender] = useState<PreviewRenderState | null>(null)
    const [fileName, setFileName] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [nativeTooltip, setNativeTooltip] = useState<NativeTooltipState | null>(null)

    const defaultFileUrl = DEFAULT_DOCX_FILES[kind]
    const loadKey = `${kind}:${templateId || "new"}`
    const documentLabel = useMemo(() => {
      const fallback = `Template de ${TEMPLATE_LABELS[kind].toLowerCase()}`
      return templateName.trim() || fallback
    }, [kind, templateName])
    const watermarkStyle = useMemo(
      () =>
        watermarkImageUrl
          ? ({
              "--docx-template-watermark-image": `url("${watermarkImageUrl.replace(/"/g, "%22")}")`,
            } as CSSProperties)
          : undefined,
      [watermarkImageUrl],
    )
    const shouldUsePageWatermark = Boolean(watermarkImageUrl)

    useEffect(() => {
      const originalError = console.error
      const filteredError: typeof console.error = (...args) => {
        const [message] = args

        if (typeof message === "string" && message.includes(REACT_STYLE_PROPERTY_WARNING)) {
          return
        }

        originalError(...args)
      }

      console.error = filteredError

      return () => {
        if (console.error === filteredError) {
          console.error = originalError
        }
      }
    }, [])

    useEffect(() => {
      onBaseFileNameChangeRef.current = onBaseFileNameChange
    }, [onBaseFileNameChange])

    useEffect(() => {
      onVariableTokenClickRef.current = onVariableTokenClick
    }, [onVariableTokenClick])

    useEffect(() => {
      void preloadDocxEditorFonts()
    }, [])

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

    useEffect(() => {
      if (activeTab !== "editor") {
        setNativeTooltip(null)
        return
      }

      const host = editorHostRef.current
      if (!host) return

      stripNativeToolbarTitleAttributes(host)

      const observer =
        typeof MutationObserver !== "undefined"
          ? new MutationObserver(() => stripNativeToolbarTitleAttributes(host))
          : null

      observer?.observe(host, {
        attributeFilter: ["title"],
        attributes: true,
        childList: true,
        subtree: true,
      })

      const showTooltip = (event: PointerEvent | FocusEvent) => {
        const tooltip = getNativeToolbarTooltip(event.target, editorHostRef.current)
        if (tooltip) {
          setNativeTooltip(tooltip)
        }
      }

      const hideTooltip = (event: PointerEvent | FocusEvent) => {
        const target = event.target
        const relatedTarget = event instanceof PointerEvent || event instanceof FocusEvent ? event.relatedTarget : null

        if (!(target instanceof Element)) {
          setNativeTooltip(null)
          return
        }

        const tooltipTarget = target.closest("[data-depclean-tooltip]")
        if (tooltipTarget && relatedTarget instanceof Node && tooltipTarget.contains(relatedTarget)) {
          return
        }

        setNativeTooltip(null)
      }

      document.addEventListener("pointerover", showTooltip, true)
      document.addEventListener("focusin", showTooltip, true)
      document.addEventListener("pointerout", hideTooltip, true)
      document.addEventListener("focusout", hideTooltip, true)

      return () => {
        observer?.disconnect()
        document.removeEventListener("pointerover", showTooltip, true)
        document.removeEventListener("focusin", showTooltip, true)
        document.removeEventListener("pointerout", hideTooltip, true)
        document.removeEventListener("focusout", hideTooltip, true)
      }
    }, [activeTab])

    const getActiveEditorRef = useCallback(() => editorHandleRef.current?.getEditorRef?.() ?? null, [])

    const getActiveEditorView = useCallback(() => {
      const view = getActiveEditorRef()?.getView?.() ?? editorViewRef.current
      if (view) {
        editorViewRef.current = view
      }

      return view
    }, [getActiveEditorRef])

    const rememberProseMirrorSelection = useCallback(
      (view?: ProseMirrorViewLike | null) => {
        const snapshot = getSelectionSnapshot(view ?? getActiveEditorView())

        if (snapshot) {
          lastProseMirrorSelectionRef.current = snapshot
        }

        return snapshot
      },
      [getActiveEditorView],
    )

    const restoreProseMirrorSelection = useCallback(
      (selection = lastProseMirrorSelectionRef.current) => {
        if (!selection) return null

        const editorRef = getActiveEditorRef()

        try {
          editorRef?.setSelection?.(selection.from, selection.to)
        } catch {
          return getActiveEditorView()
        }

        const view = getActiveEditorView()
        view?.focus?.()
        return view
      },
      [getActiveEditorRef, getActiveEditorView],
    )

    const applyFontFamilyToSelection = useCallback(
      (fontName: string, selection = lastProseMirrorSelectionRef.current) => {
        const view = restoreProseMirrorSelection(selection) ?? getActiveEditorView()
        const state = view?.state
        const fontFamilyMark = state?.schema?.marks?.fontFamily
        const transaction = state?.tr
        const activeSelection = selection ?? getSelectionSnapshot(view)
        const mark = fontFamilyMark?.create?.({
          ascii: fontName,
          hAnsi: fontName,
          eastAsia: fontName,
          cs: fontName,
        })

        if (!view?.dispatch || !state || !fontFamilyMark || !transaction || !activeSelection || !mark) {
          return false
        }

        let nextTransaction = transaction

        if (activeSelection.from === activeSelection.to) {
          const currentMarks = state.storedMarks ?? state.selection?.$from?.marks?.() ?? []
          nextTransaction =
            nextTransaction.setStoredMarks?.([...currentMarks.filter((markItem) => markItem.type !== fontFamilyMark), mark]) ??
            nextTransaction
        } else {
          nextTransaction = nextTransaction.removeMark?.(activeSelection.from, activeSelection.to, fontFamilyMark) ?? nextTransaction
          nextTransaction = nextTransaction.addMark?.(activeSelection.from, activeSelection.to, mark) ?? nextTransaction
        }

        nextTransaction = nextTransaction.scrollIntoView?.() ?? nextTransaction
        view.dispatch(nextTransaction)
        lastProseMirrorSelectionRef.current = activeSelection
        savedBufferRef.current = null

        window.requestAnimationFrame(() => {
          getActiveEditorRef()?.relayout?.()
        })

        return true
      },
      [getActiveEditorRef, getActiveEditorView, restoreProseMirrorSelection],
    )

    useEffect(() => {
      if (activeTab !== "editor") return

      const handlePointerDown = (event: PointerEvent) => {
        const target = event.target
        const host = editorHostRef.current
        const toolbar = host?.querySelector('[data-testid="editor-toolbar"]')
        const isToolbarTarget = target instanceof Node && Boolean(toolbar?.contains(target))

        if (isToolbarTarget) {
          rememberProseMirrorSelection()
        }

        const fontName = getToolbarFontOption(target)
        if (!fontName) return

        const option = target instanceof Element ? target.closest('[role="option"]') : null
        const isEditorToolbarOption = Boolean(option?.closest(".ep-root")) || isToolbarTarget

        if (!isEditorToolbarOption) return

        const selection = lastProseMirrorSelectionRef.current ?? rememberProseMirrorSelection()
        pendingToolbarFontRef.current = { fontName, selection }
        restoreProseMirrorSelection(selection)
      }

      const queueToolbarFontApply = (fontName: string, selection: ProseMirrorSelectionSnapshot | null) => {
        const apply = () => {
          applyFontFamilyToSelection(fontName, selection)
        }

        window.setTimeout(apply, 0)
        window.setTimeout(apply, 50)
        window.requestAnimationFrame(() => {
          apply()
          window.requestAnimationFrame(apply)
        })
      }

      const applyPendingToolbarFont = (target: EventTarget | null) => {
        const fontName = getToolbarFontOption(target)
        const pendingFont = pendingToolbarFontRef.current

        if (!fontName || pendingFont?.fontName !== fontName) return

        queueToolbarFontApply(fontName, pendingFont.selection)
        window.setTimeout(() => {
          if (pendingToolbarFontRef.current?.fontName === fontName) {
            pendingToolbarFontRef.current = null
          }
        }, 120)
      }

      const handlePointerUp = (event: PointerEvent) => {
        applyPendingToolbarFont(event.target)
      }

      const handleClick = (event: globalThis.MouseEvent) => {
        applyPendingToolbarFont(event.target)
      }

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== " ") return
        applyPendingToolbarFont(event.target)
      }

      document.addEventListener("pointerdown", handlePointerDown, true)
      document.addEventListener("pointerup", handlePointerUp, true)
      document.addEventListener("click", handleClick, true)
      document.addEventListener("keydown", handleKeyDown, true)

      return () => {
        document.removeEventListener("pointerdown", handlePointerDown, true)
        document.removeEventListener("pointerup", handlePointerUp, true)
        document.removeEventListener("click", handleClick, true)
        document.removeEventListener("keydown", handleKeyDown, true)
      }
    }, [activeTab, applyFontFamilyToSelection, rememberProseMirrorSelection, restoreProseMirrorSelection])

    const applyDocumentBuffer = useCallback(async (buffer: ArrayBuffer, nextFileName: string) => {
      const normalizedBuffer = await normalizeDocxTemplateBuffer(buffer)

      setEditorRenderKey((current) => current + 1)
      setSourceBuffer(cloneBuffer(normalizedBuffer))
      setPreviewBuffer(cloneBuffer(normalizedBuffer))
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
              await applyDocumentBuffer(buffer, baseFileName)
            }

            return
          }

          const response = await fetch(defaultFileUrl)

          if (!response.ok) {
            throw new Error(`Não foi possível carregar o DOCX base (${response.status}).`)
          }

          const buffer = await response.arrayBuffer()

          if (!cancelled) {
            await applyDocumentBuffer(buffer, defaultFileUrl.split("/").pop() || `${kind}-template.docx`)
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

      latestDocumentRef.current = null
      editorViewRef.current = null
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
          if (cancelled || !host || !mount.isConnected) return

          const handle = await renderDocxEditor(buffer, mount, {
            author: "Depclean",
            documentName: documentLabelRef.current,
            documentNameEditable: false,
            initialZoom: 1,
            i18n: DOCX_EDITOR_PT_BR,
            mode: "editing",
            onChange: (document: unknown) => {
              latestDocumentRef.current = document
            },
            onEditorViewReady: (view: unknown) => {
              editorViewRef.current = view as ProseMirrorViewLike
              rememberProseMirrorSelection(view as ProseMirrorViewLike)
            },
            onError: (error: Error) => setErrorMessage(error.message),
            onFontsLoaded: () => {
              window.requestAnimationFrame(() => {
                editorHandleRef.current?.getEditorRef?.()?.relayout?.()
              })
            },
            onSave: (savedBuffer: ArrayBuffer) => {
              const nextBuffer = cloneBuffer(savedBuffer)
              savedBufferRef.current = nextBuffer
              previewBufferRef.current = cloneBuffer(nextBuffer)
              sourceBufferRef.current = cloneBuffer(nextBuffer)
              setPreviewBuffer(cloneBuffer(nextBuffer))
            },
            onSelectionChange: () => {
              rememberProseMirrorSelection()
            },
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
            safeDestroy(handle)
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
        editorViewRef.current = null
        if (editorMountRef.current === mount) {
          editorMountRef.current = null
        }
        if (mount.parentNode === host) {
          mount.remove()
        }
      }
    }, [editorRenderKey, rememberProseMirrorSelection, sourceBuffer])

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
          if (cancelled || !host || !mount.isConnected) return

          const handle = await renderDocxEditor(buffer, mount, {
            documentName: `${documentLabelRef.current} - Prévia`,
            documentNameEditable: false,
            initialZoom: 1,
            i18n: DOCX_EDITOR_PT_BR,
            mode: "viewing",
            onFontsLoaded: () => {
              window.requestAnimationFrame(() => {
                previewHandleRef.current?.getEditorRef?.()?.relayout?.()
              })
            },
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
            safeDestroy(handle)
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

    const saveCurrentBuffer = useCallback(async (options: { syncEditor?: boolean } = {}) => {
      savedBufferRef.current = null

      await new Promise((resolve) => window.requestAnimationFrame(resolve))

      const commitSavedBuffer = (buffer: ArrayBuffer) => {
        savedBufferRef.current = buffer
        previewBufferRef.current = cloneBuffer(buffer)
        sourceBufferRef.current = cloneBuffer(buffer)
        setPreviewBuffer(cloneBuffer(buffer))

        if (options.syncEditor) {
          setSourceBuffer(cloneBuffer(buffer))
          setEditorRenderKey((current) => current + 1)
        }
      }

      let savedBuffer: ArrayBuffer | null = null

      try {
        const saved = await editorHandleRef.current?.save?.({ selective: false })
        savedBuffer = await toArrayBuffer(saved)
      } catch {
        savedBuffer = null
      }

      if (savedBuffer) {
        const nextBuffer = await normalizeDocxTemplateBuffer(savedBuffer)
        commitSavedBuffer(nextBuffer)
        return cloneBuffer(nextBuffer)
      }

      const liveDocument = editorHandleRef.current?.getDocument?.() ?? latestDocumentRef.current
      let modelBuffer: ArrayBuffer | null = null

      try {
        modelBuffer = await serializeDocumentModel(liveDocument)
      } catch {
        modelBuffer = null
      }

      if (modelBuffer) {
        const nextBuffer = await normalizeDocxTemplateBuffer(modelBuffer)
        commitSavedBuffer(nextBuffer)
        return cloneBuffer(nextBuffer)
      }

      const startedAt = Date.now()
      while (Date.now() - startedAt < 1500) {
        if (savedBufferRef.current) {
          return cloneBuffer(savedBufferRef.current)
        }

        await new Promise((resolve) => window.setTimeout(resolve, 50))
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
        const buffer = await saveCurrentBuffer({ syncEditor: true })
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
        style={watermarkStyle}
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

        {nativeTooltip ? (
          <div
            className="docx-template-editor-native-tooltip"
            style={{ left: nativeTooltip.x, top: nativeTooltip.y }}
          >
            {nativeTooltip.text}
          </div>
        ) : null}
      </div>
    )
  }
)
