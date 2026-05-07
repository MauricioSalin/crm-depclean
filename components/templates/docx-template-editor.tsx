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
import { Skeleton } from "@/components/ui/skeleton"
import { DOCX_EDITOR_PT_BR } from "@/lib/docx-editor-pt-br"

type DocxEditorHandleLike = {
  focus?: () => void
  getDocument?: () => unknown | null
  getEditorRef?: () => PagedEditorRefLike | null
  getZoom?: () => number
  save?: (options?: { selective?: boolean }) => Promise<ArrayBuffer | Blob | null>
  setZoom?: (zoom: number) => void
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
  setNodeMarkup?: (pos: number, type?: unknown, attrs?: Record<string, unknown>) => ProseMirrorTransactionLike
}

type ProseMirrorViewLike = {
  dispatch?: (transaction: ProseMirrorTransactionLike) => void
  focus?: () => void
  state?: {
    doc?: ProseMirrorDocumentNodeLike
    schema?: {
      marks?: Record<string, ProseMirrorMarkTypeLike | undefined>
    }
    selection?: ProseMirrorSelectionLike
    storedMarks?: ProseMirrorMarkLike[] | null
    tr?: ProseMirrorTransactionLike
  }
}

type ProseMirrorDocumentNodeLike = {
  attrs?: Record<string, unknown>
  childCount?: number
  descendants?: (callback: (node: ProseMirrorDocumentNodeLike, pos: number) => boolean | void) => void
  forEach?: (callback: (node: ProseMirrorDocumentNodeLike, offset: number, index: number) => void) => void
  nodeAt?: (pos: number) => ProseMirrorDocumentNodeLike | null
  nodeSize?: number
  resolve?: (pos: number) => ProseMirrorResolvedPosLike
  type?: {
    name?: string
  }
}

type ProseMirrorResolvedPosLike = {
  before?: (depth: number) => number
  depth: number
  node?: (depth: number) => ProseMirrorDocumentNodeLike
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
  generatePreviewPdf: (options?: { download?: boolean; previewWatermark?: boolean }) => Promise<File>
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
  applyVariablesToEditor?: boolean
  previewDataKey?: string
  previewVariables?: Record<string, unknown> | null
  sourceFile?: File | null
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
const DOCX_EDITOR_DEFAULT_PAGE_WIDTH_PX = 794
const DOCX_EDITOR_FIT_PADDING_PX = 56
const DOCX_EDITOR_MIN_FIT_ZOOM = 0.45
const DOCX_EDITOR_MAX_FIT_ZOOM = 1

let preloadedDocxEditorFonts: Promise<void> | null = null

function cloneBuffer(buffer: ArrayBuffer) {
  return buffer.slice(0)
}

function clampDocxFitZoom(zoom: number) {
  if (!Number.isFinite(zoom)) return DOCX_EDITOR_MAX_FIT_ZOOM
  return Math.max(DOCX_EDITOR_MIN_FIT_ZOOM, Math.min(DOCX_EDITOR_MAX_FIT_ZOOM, zoom))
}

function calculateDocxFitZoom(host: HTMLElement | null, pageWidth = DOCX_EDITOR_DEFAULT_PAGE_WIDTH_PX) {
  if (!host) return DOCX_EDITOR_MAX_FIT_ZOOM

  const availableWidth = Math.max(0, host.clientWidth - DOCX_EDITOR_FIT_PADDING_PX)
  if (availableWidth <= 0 || pageWidth <= 0) return DOCX_EDITOR_MAX_FIT_ZOOM

  return clampDocxFitZoom(Number((availableWidth / pageWidth).toFixed(2)))
}

function fitDocxEditorToHost(host: HTMLElement | null, handle: DocxEditorHandleLike | null) {
  if (!host || !handle?.setZoom) return

  const currentZoom = handle.getZoom?.() ?? DOCX_EDITOR_MAX_FIT_ZOOM
  const firstPage = host.querySelector<HTMLElement>(".layout-page")
  const pageRect = firstPage?.getBoundingClientRect()
  const renderedPageWidth = pageRect?.width && pageRect.width > 0 ? pageRect.width : DOCX_EDITOR_DEFAULT_PAGE_WIDTH_PX
  const unscaledPageWidth = currentZoom > 0 ? renderedPageWidth / currentZoom : renderedPageWidth
  const nextZoom = calculateDocxFitZoom(host, unscaledPageWidth)

  if (Math.abs(currentZoom - nextZoom) > 0.01) {
    handle.setZoom(nextZoom)
  }

  window.requestAnimationFrame(() => {
    handle.getEditorRef?.()?.relayout?.()
  })
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

type DocxLineSpacing = {
  line: string
  lineRule: string
}

function getDocxLineSpacing(spacingXml: string): DocxLineSpacing | null {
  const line = spacingXml.match(/\sw:line="([^"]*)"/)?.[1]
  if (!line) return null

  return {
    line,
    lineRule: spacingXml.match(/\sw:lineRule="([^"]*)"/)?.[1] ?? "auto",
  }
}

function buildDocxParagraphSpacingXml(lineSpacing?: DocxLineSpacing | null) {
  const lineAttributes = lineSpacing ? ` w:line="${lineSpacing.line}" w:lineRule="${lineSpacing.lineRule}"` : ""

  return `<w:spacing w:before="0" w:after="0"${lineAttributes}/>`
}

function normalizeDocxSpacingElement(spacingXml: string) {
  const lineSpacing = getDocxLineSpacing(spacingXml)

  return buildDocxParagraphSpacingXml(lineSpacing)
}

function normalizeDocxParagraphSpacing(xml: string) {
  return xml
    .replace(/(<w:pPr\b[^>]*>)([\s\S]*?)(<\/w:pPr>)/g, (_match, openTag, content, closeTag) => {
      const normalizedContent = /<w:spacing\b[^>]*(?:\/>|><\/w:spacing>)/.test(content)
        ? content.replace(/<w:spacing\b[^>]*(?:\/>|><\/w:spacing>)/g, normalizeDocxSpacingElement)
        : `${buildDocxParagraphSpacingXml()}${content}`

      return `${openTag}${normalizedContent}${closeTag}`
    })
    .replace(
      /<w:p(?!Pr)([^>]*)>(?!\s*<w:pPr\b)/g,
      `<w:p$1><w:pPr>${buildDocxParagraphSpacingXml()}</w:pPr>`,
    )
}

function normalizeDocxLayoutXml(xml: string) {
  return normalizeDocxParagraphSpacing(normalizeDocxXmlFontNames(xml))
}

function getLiveEditorParagraphLineSpacing(view: ProseMirrorViewLike | null | undefined) {
  const patches: Array<DocxLineSpacing | null> = []
  const doc = view?.state?.doc
  if (!doc?.descendants) return patches

  doc.descendants((node) => {
    if (node.type?.name !== "paragraph") return

    const rawLineSpacing = node.attrs?.lineSpacing
    const lineSpacing = typeof rawLineSpacing === "number" ? rawLineSpacing : Number(rawLineSpacing)
    if (!Number.isFinite(lineSpacing) || lineSpacing <= 0) {
      patches.push(null)
      return
    }

    const rawLineRule = node.attrs?.lineSpacingRule
    patches.push({
      line: String(Math.round(lineSpacing)),
      lineRule: typeof rawLineRule === "string" && rawLineRule ? rawLineRule : "auto",
    })
  })

  return patches
}

function toPositiveNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function getColumnWidthValues(value: unknown) {
  if (Array.isArray(value)) return value
  if (typeof value === "string") return value.split(/[,\s]+/).filter(Boolean)

  try {
    if (value && typeof (value as Iterable<unknown>)[Symbol.iterator] === "function") {
      return Array.from(value as Iterable<unknown>)
    }
  } catch {
    return []
  }

  return []
}

function getTableWidthFromAttrs(attrs: Record<string, unknown> | undefined) {
  const width = attrs?.width

  if (width && typeof width === "object" && !Array.isArray(width)) {
    return toPositiveNumber((width as Record<string, unknown>).value)
  }

  return toPositiveNumber(width)
}

function getTableColumnCount(tableNode: ProseMirrorDocumentNodeLike) {
  let columnCount = 0

  tableNode.forEach?.((rowNode) => {
    if (rowNode.type?.name !== "tableRow") return

    let rowColumnCount = 0
    rowNode.forEach?.((cellNode) => {
      const colspan =
        toPositiveNumber(cellNode.attrs?.colspan) ??
        toPositiveNumber(cellNode.attrs?.colSpan) ??
        toPositiveNumber(cellNode.attrs?.gridSpan) ??
        1

      rowColumnCount += Math.max(1, Math.trunc(colspan))
    })

    columnCount = Math.max(columnCount, rowColumnCount)
  })

  return columnCount
}

function normalizeColumnWidths(value: unknown, columnCount: number, totalWidth: number) {
  const rawWidths = getColumnWidthValues(value)
  const rawTotal = rawWidths.reduce((sum, item) => sum + (toPositiveNumber(item) ?? 0), 0)
  const normalizedTotal = Math.max(1, Math.round(totalWidth || rawTotal || 9360))
  const fallbackWidth = Math.max(1, Math.floor(normalizedTotal / Math.max(1, columnCount)))

  return Array.from({ length: columnCount }, (_, index) => {
    const width = toPositiveNumber(rawWidths[index])
    return width ? Math.round(width) : fallbackWidth
  })
}

function hasIterableDocxTableColumnWidths(value: unknown, columnCount: number) {
  if (!Array.isArray(value)) return false

  return (
    value.length >= columnCount &&
    value.slice(0, columnCount).every((width) => toPositiveNumber(width) !== null)
  )
}

function getDocxTableElement(host: HTMLElement | null | undefined, tablePos: number) {
  return host?.querySelector<HTMLElement>(`.layout-table[data-pm-start="${tablePos}"]`) ?? null
}

function getDocxTableWidth(
  tableNode: ProseMirrorDocumentNodeLike,
  tableElement: Element | null | undefined,
  currentWidths: unknown,
) {
  const rawWidths = getColumnWidthValues(currentWidths)
  const rawWidthTotal = rawWidths.reduce((sum, item) => sum + (toPositiveNumber(item) ?? 0), 0)

  return (
    getTableWidthFromAttrs(tableNode.attrs) ??
    (tableElement ? Math.round(tableElement.getBoundingClientRect().width * 15) : null) ??
    rawWidthTotal ??
    9360
  )
}

function normalizeDocxTableColumnWidths(
  view: ProseMirrorViewLike,
  tablePos: number,
  tableNode: ProseMirrorDocumentNodeLike,
  tableElement?: Element | null,
) {
  if (!view.state?.tr?.setNodeMarkup || !view.dispatch) return false

  const columnCount = getTableColumnCount(tableNode)
  if (columnCount <= 0) return false

  const currentWidths = tableNode.attrs?.columnWidths
  if (hasIterableDocxTableColumnWidths(currentWidths, columnCount)) return false

  const tableWidth = getDocxTableWidth(tableNode, tableElement, currentWidths)
  const columnWidths = normalizeColumnWidths(currentWidths, columnCount, tableWidth)
  const transaction = view.state.tr.setNodeMarkup(tablePos, undefined, {
    ...tableNode.attrs,
    columnWidths,
  })

  view.dispatch(transaction)
  return true
}

function normalizeAllDocxTableColumnWidths(
  view: ProseMirrorViewLike | null | undefined,
  host?: HTMLElement | null,
) {
  if (!view?.state?.doc?.descendants || !view.state.tr?.setNodeMarkup || !view.dispatch) return

  try {
    let transaction = view.state.tr
    let changed = false

    view.state.doc.descendants((node, pos) => {
      if (node.type?.name !== "table") return

      const columnCount = getTableColumnCount(node)
      if (columnCount <= 0 || hasIterableDocxTableColumnWidths(node.attrs?.columnWidths, columnCount)) return

      const tableElement = getDocxTableElement(host, pos)
      const columnWidths = normalizeColumnWidths(
        node.attrs?.columnWidths,
        columnCount,
        getDocxTableWidth(node, tableElement, node.attrs?.columnWidths),
      )

      transaction = transaction.setNodeMarkup?.(pos, undefined, {
        ...node.attrs,
        columnWidths,
      }) ?? transaction
      changed = true
    })

    if (changed) {
      view.dispatch(transaction)
    }
  } catch {
    // Avoid letting malformed DOCX table metadata break editor interactions.
  }
}

function normalizeDocxTableColumnWidthsBeforeResize(
  view: ProseMirrorViewLike | null | undefined,
  tablePmStart: number | null,
  tableElement?: Element | null,
) {
  if (!view?.state?.doc?.resolve || !view.state.tr?.setNodeMarkup || !view.dispatch || tablePmStart === null) return

  try {
    const resolved = view.state.doc.resolve(tablePmStart + 1)

    for (let depth = resolved.depth; depth >= 0; depth -= 1) {
      const tableNode = resolved.node?.(depth)
      if (tableNode?.type?.name !== "table") continue

      const tablePos = resolved.before?.(depth)
      if (typeof tablePos !== "number") return

      normalizeDocxTableColumnWidths(view, tablePos, tableNode, tableElement)
      return
    }
  } catch {
    // Avoid letting malformed DOCX table metadata break the editor interaction.
  }
}

function applyDocxParagraphLineSpacing(paragraphXml: string, lineSpacing: DocxLineSpacing) {
  const spacingXml = buildDocxParagraphSpacingXml(lineSpacing)

  if (/<w:pPr\b/.test(paragraphXml)) {
    return paragraphXml.replace(/(<w:pPr\b[^>]*>)([\s\S]*?)(<\/w:pPr>)/, (_match, openTag, content, closeTag) => {
      const nextContent = /<w:spacing\b[^>]*(?:\/>|><\/w:spacing>)/.test(content)
        ? content.replace(/<w:spacing\b[^>]*(?:\/>|><\/w:spacing>)/g, spacingXml)
        : `${spacingXml}${content}`

      return `${openTag}${nextContent}${closeTag}`
    })
  }

  return paragraphXml.replace(/(<w:p\b[^>]*>)/, `$1<w:pPr>${spacingXml}</w:pPr>`)
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

async function waitForEditorMutationFlush() {
  await new Promise((resolve) => window.requestAnimationFrame(resolve))
  await new Promise((resolve) => window.requestAnimationFrame(resolve))
  await new Promise((resolve) => window.setTimeout(resolve, 80))
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
        getZoom: () => editorRef.current?.getZoom?.() ?? 1,
        save: (saveOptions) => editorRef.current?.save?.(saveOptions) ?? Promise.resolve(null),
        setZoom: (zoom) => editorRef.current?.setZoom?.(zoom),
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

function addPreviewPdfWatermark(page: HTMLElement, enabled: boolean) {
  if (!enabled) return () => undefined

  const previousPosition = page.style.position
  const computedPosition = window.getComputedStyle(page).position
  if (computedPosition === "static") {
    page.style.position = "relative"
  }

  const watermark = document.createElement("div")
  watermark.setAttribute("aria-hidden", "true")
  watermark.textContent = "PRÉVIA"
  watermark.style.alignItems = "center"
  watermark.style.color = "rgba(0, 0, 0, 0.4)"
  watermark.style.display = "flex"
  watermark.style.fontFamily = "Arial, sans-serif"
  watermark.style.fontSize = `${Math.max(72, Math.min(page.offsetWidth * 0.18, 150))}px`
  watermark.style.fontWeight = "800"
  watermark.style.inset = "0"
  watermark.style.justifyContent = "center"
  watermark.style.letterSpacing = "0.08em"
  watermark.style.lineHeight = "1"
  watermark.style.pointerEvents = "none"
  watermark.style.position = "absolute"
  watermark.style.textTransform = "uppercase"
  watermark.style.transform = "rotate(-35deg)"
  watermark.style.transformOrigin = "center"
  watermark.style.userSelect = "none"
  watermark.style.zIndex = "9999"

  page.appendChild(watermark)

  return () => {
    watermark.remove()
    page.style.position = previousPosition
  }
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

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

function decodeHtmlText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function getDocxRunXmlAt(xml: string, offset: number) {
  const openIndex = xml.lastIndexOf("<w:r", offset)
  const closeIndex = xml.indexOf("</w:r>", offset)

  if (openIndex === -1 || closeIndex === -1 || closeIndex < offset) {
    return ""
  }

  return xml.slice(openIndex, closeIndex + "</w:r>".length)
}

function getDocxRunPropertiesXml(runXml: string) {
  return runXml.match(/<w:rPr\b[\s\S]*?<\/w:rPr>/)?.[0] ?? ""
}

const DEFAULT_SERVICE_SECTIONS_RUN_PROPERTIES =
  '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>'

function hasDocxRunFont(runPropertiesXml: string) {
  return /<w:rFonts\b/i.test(runPropertiesXml)
}

function hasDocxRunSize(runPropertiesXml: string) {
  return /<w:sz\b/i.test(runPropertiesXml) || /<w:szCs\b/i.test(runPropertiesXml)
}

function mergeDocxRunProperties(primaryXml: string, fallbackXml: string) {
  if (!primaryXml || primaryXml === "<w:rPr/>") return fallbackXml
  if (!fallbackXml) return primaryXml

  const missingNodes = [
    !hasDocxRunFont(primaryXml) ? fallbackXml.match(/<w:rFonts\b[^>]*\/>/)?.[0] : "",
    !/<w:sz\b/i.test(primaryXml) ? fallbackXml.match(/<w:sz\b[^>]*\/>/)?.[0] : "",
    !/<w:szCs\b/i.test(primaryXml) ? fallbackXml.match(/<w:szCs\b[^>]*\/>/)?.[0] : "",
  ].filter(Boolean).join("")

  return missingNodes ? primaryXml.replace(/<w:rPr\b([^>]*)>/, `<w:rPr$1>${missingNodes}`) : primaryXml
}

function getDocxRunPropertiesWithFont(xml: string, offset: number) {
  const directRunProperties = getDocxRunPropertiesXml(getDocxRunXmlAt(xml, offset))
  if (hasDocxRunFont(directRunProperties) && hasDocxRunSize(directRunProperties)) {
    return directRunProperties
  }

  const before = xml.slice(0, offset)
  const after = xml.slice(offset)
  const beforeMatches = [...before.matchAll(/<w:rPr\b[\s\S]*?<\/w:rPr>/g)]
    .map((match) => match[0])
    .filter((runProperties) => hasDocxRunFont(runProperties) || hasDocxRunSize(runProperties))
  const afterRunProperties = after.match(/<w:rPr\b[\s\S]*?<\/w:rPr>/)?.[0] ?? ""
  const nearbyRunProperties = beforeMatches.at(-1) ?? afterRunProperties

  if (!directRunProperties || directRunProperties === "<w:rPr/>") {
    return nearbyRunProperties || DEFAULT_SERVICE_SECTIONS_RUN_PROPERTIES
  }

  return mergeDocxRunProperties(directRunProperties, nearbyRunProperties || DEFAULT_SERVICE_SECTIONS_RUN_PROPERTIES)
}

function ensureBoldRunPropertiesXml(runPropertiesXml: string) {
  if (!runPropertiesXml) {
    return "<w:rPr><w:b/></w:rPr>"
  }

  if (/<w:b\b/i.test(runPropertiesXml)) {
    return runPropertiesXml
  }

  return runPropertiesXml.replace(/<w:rPr\b([^>]*)>/, "<w:rPr$1><w:b/>")
}

function buildDocxRunXml(text: string, bold = false, baseRunPropertiesXml = "") {
  if (!text) return ""

  const runPropertiesXml = bold ? ensureBoldRunPropertiesXml(baseRunPropertiesXml) : baseRunPropertiesXml

  return `<w:r>${runPropertiesXml}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`
}

function buildDocxRunsFromHtml(innerHtml: string, baseRunPropertiesXml = "") {
  const runs: string[] = []
  let cursor = 0
  const strongRegex = /<strong\b[^>]*>([\s\S]*?)<\/strong>/gi
  let match: RegExpExecArray | null

  while ((match = strongRegex.exec(innerHtml)) !== null) {
    runs.push(buildDocxRunXml(decodeHtmlText(innerHtml.slice(cursor, match.index)), false, baseRunPropertiesXml))
    runs.push(buildDocxRunXml(decodeHtmlText(match[1] ?? ""), true, baseRunPropertiesXml))
    cursor = match.index + match[0].length
  }

  runs.push(buildDocxRunXml(decodeHtmlText(innerHtml.slice(cursor)), false, baseRunPropertiesXml))
  return runs.join("")
}

function buildDocxInlineHtmlXml(html: string, baseRunPropertiesXml = "") {
  const paragraphMatches = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
  const lines = paragraphMatches.length > 0
    ? paragraphMatches.map((match) => buildDocxRunsFromHtml(match[1] ?? "", baseRunPropertiesXml)).filter(Boolean)
    : [buildDocxRunsFromHtml(html, baseRunPropertiesXml)].filter(Boolean)

  if (lines.length === 0) {
    return escapeXml(stripHtml(html))
  }

  return `</w:t></w:r>${lines.join("<w:r><w:br/></w:r><w:r><w:br/></w:r>")}<w:r>${baseRunPropertiesXml}<w:t xml:space="preserve">`
}

function buildDocxTableXmlFromHtml(html: string) {
  const rowMatches = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
  const rows = rowMatches
    .map((rowMatch) =>
      [...(rowMatch[1] ?? "").matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cellMatch) =>
        stripHtml(cellMatch[1] ?? ""),
      ),
    )
    .filter((cells) => cells.length > 0)

  if (rows.length === 0) {
    return escapeXml(stripHtml(html))
  }

  const border = '<w:top w:val="single" w:sz="8" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="8" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="8" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="8" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="8" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="8" w:space="0" w:color="000000"/>'
  const tableRows = rows
    .map((cells) => {
      const tableCells = cells
        .map(
          (cell) =>
            `<w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escapeXml(cell)}</w:t></w:r></w:p></w:tc>`,
        )
        .join("")

      return `<w:tr>${tableCells}</w:tr>`
    })
    .join("")

  return `</w:t></w:r></w:p><w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${border}</w:tblBorders></w:tblPr>${tableRows}</w:tbl><w:p><w:r><w:t xml:space="preserve">`
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
  const xmlEntries = await Promise.all(
    xmlFiles.map(async (fileName) => {
      const file = zip.file(fileName)
      if (!file) return null

      return {
        fileName,
        xml: await file.async("text"),
      }
    }),
  )
  let hasChanges = false

  await Promise.all(
    xmlEntries.map(async (entry) => {
      if (!entry) return

      const { fileName, xml } = entry
      const normalizedXml = normalizeDocxLayoutXml(xml)

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
      normalizeDocxLayoutXml(stylesXml),
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

        const isRecurrenceTable = path === "contract.recurrenceTable" && /<table\b/i.test(rawValue)
        const isServiceSectionsHtml = path === "services.sectionsHtml" && /<(p|strong)\b/i.test(rawValue)
        const tokens = [`{{${path}}}`, `{{ ${path} }}`]

        for (const token of tokens) {
          const tokenRegex = buildDocxTokenRegex(token)
          const replacement = isRecurrenceTable
            ? buildDocxTableXmlFromHtml(rawValue)
            : escapeXml(rawValue).replace(/\r?\n/g, "</w:t><w:br/><w:t>")
          const nextXml = isServiceSectionsHtml
            ? xml.replace(tokenRegex, (_match, offset: number) => {
                const runPropertiesXml = getDocxRunPropertiesWithFont(xml, offset)
                return buildDocxInlineHtmlXml(rawValue, runPropertiesXml)
              })
            : xml.replace(tokenRegex, replacement)
          if (nextXml !== xml) {
            xml = nextXml
            changed = true
          }
        }
      }

      if (changed) {
        zip.file(fileName, normalizeDocxLayoutXml(xml))
      }
    }),
  )

  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" })
}

async function processDocxPreviewBuffer(buffer: ArrayBuffer, variables: Record<string, unknown>) {
  return replaceDocxTemplateVariables(buffer, flattenPreviewVariables(variables))
}

async function applyLiveParagraphLineSpacingToDocxBuffer(
  buffer: ArrayBuffer,
  paragraphLineSpacing: Array<DocxLineSpacing | null>,
) {
  if (!paragraphLineSpacing.some(Boolean)) return buffer

  const JSZip = (await import("jszip")).default
  const zip = await JSZip.loadAsync(buffer)
  const documentFile = zip.file("word/document.xml")
  if (!documentFile) return buffer

  const xml = await documentFile.async("text")
  let index = 0
  let changed = false
  const nextXml = xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraphXml) => {
    const lineSpacing = paragraphLineSpacing[index++]
    if (!lineSpacing) return paragraphXml

    const nextParagraphXml = applyDocxParagraphLineSpacing(paragraphXml, lineSpacing)
    if (nextParagraphXml !== paragraphXml) changed = true
    return nextParagraphXml
  })

  if (!changed) return buffer

  zip.file("word/document.xml", nextXml)
  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" })
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
      applyVariablesToEditor = false,
      previewDataKey,
      previewVariables,
      sourceFile,
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
    const activeTableResizePmStartRef = useRef<number | null>(null)

    const [sourceBuffer, setSourceBuffer] = useState<ArrayBuffer | null>(null)
    const [previewBuffer, setPreviewBuffer] = useState<ArrayBuffer | null>(null)
    const [editorRenderKey, setEditorRenderKey] = useState(0)
    const [previewRender, setPreviewRender] = useState<PreviewRenderState | null>(null)
    const [fileName, setFileName] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [nativeTooltip, setNativeTooltip] = useState<NativeTooltipState | null>(null)

    const defaultFileUrl = DEFAULT_DOCX_FILES[kind]
    const sourceFileKey = sourceFile ? `${sourceFile.name}:${sourceFile.size}:${sourceFile.lastModified}` : ""
    const loadKey = sourceFileKey || `${kind}:${templateId || "new"}${applyVariablesToEditor ? `:${previewDataKey || ""}` : ""}`
    const editorInitialVariables = applyVariablesToEditor ? previewVariables : null
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

    useEffect(() => {
      const host = editorHostRef.current
      if (!host) return

      let frame = 0
      const fit = () => {
        window.cancelAnimationFrame(frame)
        frame = window.requestAnimationFrame(() => fitDocxEditorToHost(host, editorHandleRef.current))
      }
      const observer = new ResizeObserver(fit)

      observer.observe(host)
      fit()

      return () => {
        window.cancelAnimationFrame(frame)
        observer.disconnect()
      }
    }, [activeTab, editorRenderKey, sourceBuffer])

    useEffect(() => {
      const host = previewHostRef.current
      if (!host) return

      let frame = 0
      const fit = () => {
        window.cancelAnimationFrame(frame)
        frame = window.requestAnimationFrame(() => fitDocxEditorToHost(host, previewHandleRef.current))
      }
      const observer = new ResizeObserver(fit)

      observer.observe(host)
      fit()

      return () => {
        window.cancelAnimationFrame(frame)
        observer.disconnect()
      }
    }, [activeTab, previewRender?.key])

    const getActiveEditorRef = useCallback(() => editorHandleRef.current?.getEditorRef?.() ?? null, [])

    const getActiveEditorView = useCallback(() => {
      const view = getActiveEditorRef()?.getView?.() ?? editorViewRef.current
      if (view) {
        editorViewRef.current = view
      }

      return view
    }, [getActiveEditorRef])

    useEffect(() => {
      if (activeTab !== "editor") return

      const host = editorHostRef.current
      if (!host) return

      const normalizeActiveTables = () => {
        normalizeAllDocxTableColumnWidths(getActiveEditorView(), host)
      }

      let frame = window.requestAnimationFrame(normalizeActiveTables)

      const scheduleNormalizeActiveTables = () => {
        window.cancelAnimationFrame(frame)
        frame = window.requestAnimationFrame(normalizeActiveTables)
      }

      const normalizeTableResizeTarget = (target: EventTarget | null) => {
        if (!(target instanceof Element)) return

        const handle = target.closest<HTMLElement>(".layout-table-resize-handle, .layout-table-edge-handle-right")
        if (!handle || !host.contains(handle)) return

        normalizeActiveTables()

        const tablePmStartValue = handle.dataset.tablePmStart ?? handle.closest<HTMLElement>(".layout-table")?.dataset.pmStart
        const tablePmStart = tablePmStartValue ? Number.parseInt(tablePmStartValue, 10) : Number.NaN
        if (!Number.isFinite(tablePmStart)) {
          return
        }

        activeTableResizePmStartRef.current = tablePmStart
        normalizeDocxTableColumnWidthsBeforeResize(
          getActiveEditorView(),
          tablePmStart,
          handle.closest(".layout-table"),
        )
      }

      const handleResizeStart = (event: Event) => {
        normalizeTableResizeTarget(event.target)
      }

      const handleResizeEnd = () => {
        normalizeActiveTables()
        normalizeDocxTableColumnWidthsBeforeResize(
          getActiveEditorView(),
          activeTableResizePmStartRef.current,
          host.querySelector(".layout-table"),
        )
        activeTableResizePmStartRef.current = null
      }

      host.addEventListener("mousedown", handleResizeStart, true)
      host.addEventListener("mousemove", handleResizeStart, true)
      host.addEventListener("pointerdown", handleResizeStart, true)
      host.addEventListener("pointerover", handleResizeStart, true)
      host.addEventListener("focusin", scheduleNormalizeActiveTables, true)
      document.addEventListener("mouseup", handleResizeEnd, true)
      window.addEventListener("mouseup", handleResizeEnd, true)
      window.addEventListener("pointerup", handleResizeEnd, true)

      return () => {
        window.cancelAnimationFrame(frame)
        host.removeEventListener("mousedown", handleResizeStart, true)
        host.removeEventListener("mousemove", handleResizeStart, true)
        host.removeEventListener("pointerdown", handleResizeStart, true)
        host.removeEventListener("pointerover", handleResizeStart, true)
        host.removeEventListener("focusin", scheduleNormalizeActiveTables, true)
        document.removeEventListener("mouseup", handleResizeEnd, true)
        window.removeEventListener("mouseup", handleResizeEnd, true)
        window.removeEventListener("pointerup", handleResizeEnd, true)
        activeTableResizePmStartRef.current = null
      }
    }, [activeTab, getActiveEditorView])

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

    const applyDocumentBuffer = useCallback(async (buffer: ArrayBuffer, nextFileName: string, variables?: Record<string, unknown> | null) => {
      const filledBuffer =
        applyVariablesToEditor && variables && Object.keys(variables).length > 0
          ? await processDocxPreviewBuffer(buffer, variables)
          : buffer
      const normalizedBuffer = await normalizeDocxTemplateBuffer(filledBuffer)

      setEditorRenderKey((current) => current + 1)
      setSourceBuffer(cloneBuffer(normalizedBuffer))
      setPreviewBuffer(cloneBuffer(normalizedBuffer))
      setPreviewRender(null)
      setFileName(nextFileName)
      onBaseFileNameChangeRef.current?.(nextFileName)
    }, [applyVariablesToEditor])

    useEffect(() => {
      let cancelled = false

      async function loadInitialDocx() {
        setIsLoading(true)
        setErrorMessage(null)

        try {
          if (sourceFile) {
            const buffer = await sourceFile.arrayBuffer()

            if (!cancelled) {
              await applyDocumentBuffer(buffer, sourceFile.name, editorInitialVariables)
            }

            return
          }

          if (templateId && templateFormat === "docx" && baseFileName) {
            const buffer = await fetchTemplateBaseBinary(templateId)

            if (!cancelled) {
              await applyDocumentBuffer(buffer, baseFileName, editorInitialVariables)
            }

            return
          }

          const response = await fetch(defaultFileUrl)

          if (!response.ok) {
            throw new Error(`Não foi possível carregar o DOCX base (${response.status}).`)
          }

          const buffer = await response.arrayBuffer()

          if (!cancelled) {
            await applyDocumentBuffer(buffer, defaultFileUrl.split("/").pop() || `${kind}-template.docx`, editorInitialVariables)
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
    }, [applyDocumentBuffer, editorInitialVariables, loadKey, sourceFile])

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
            initialZoom: calculateDocxFitZoom(host),
            i18n: DOCX_EDITOR_PT_BR,
            mode: "editing",
            onChange: (document: unknown) => {
              latestDocumentRef.current = document
              const view = editorViewRef.current
              if (view) {
                window.requestAnimationFrame(() => normalizeAllDocxTableColumnWidths(view, host))
              }
            },
            onEditorViewReady: (view: unknown) => {
              const editorView = view as ProseMirrorViewLike
              editorViewRef.current = editorView
              normalizeAllDocxTableColumnWidths(editorView, host)
              window.requestAnimationFrame(() => normalizeAllDocxTableColumnWidths(editorView, host))
              rememberProseMirrorSelection(editorView)
            },
            onError: (error: Error) => setErrorMessage(error.message),
            onFontsLoaded: () => {
              window.requestAnimationFrame(() => {
                editorHandleRef.current?.getEditorRef?.()?.relayout?.()
                fitDocxEditorToHost(host, editorHandleRef.current)
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
          fitDocxEditorToHost(host, handle)
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
            initialZoom: calculateDocxFitZoom(host),
            i18n: DOCX_EDITOR_PT_BR,
            mode: "viewing",
            onFontsLoaded: () => {
              window.requestAnimationFrame(() => {
                previewHandleRef.current?.getEditorRef?.()?.relayout?.()
                fitDocxEditorToHost(host, previewHandleRef.current)
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
          fitDocxEditorToHost(host, handle)
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
      savedBufferRef.current = null

      await waitForEditorMutationFlush()

      const commitSavedBuffer = (buffer: ArrayBuffer) => {
        savedBufferRef.current = buffer
        previewBufferRef.current = cloneBuffer(buffer)
        sourceBufferRef.current = cloneBuffer(buffer)
        setPreviewBuffer(cloneBuffer(buffer))
      }

      const paragraphLineSpacing = getLiveEditorParagraphLineSpacing(editorViewRef.current)
      let savedBuffer: ArrayBuffer | null = null

      try {
        const saved = await editorHandleRef.current?.save?.({ selective: false })
        savedBuffer = await toArrayBuffer(saved)
      } catch {
        savedBuffer = null
      }

      if (!savedBuffer) {
        try {
          const saved = await editorHandleRef.current?.save?.()
          savedBuffer = await toArrayBuffer(saved)
        } catch {
          savedBuffer = null
        }
      }

      if (savedBuffer) {
        const patchedBuffer = await applyLiveParagraphLineSpacingToDocxBuffer(savedBuffer, paragraphLineSpacing)
        const nextBuffer = await normalizeDocxTemplateBuffer(patchedBuffer)
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
        const patchedBuffer = await applyLiveParagraphLineSpacingToDocxBuffer(modelBuffer, paragraphLineSpacing)
        const nextBuffer = await normalizeDocxTemplateBuffer(patchedBuffer)
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
        const buffer = await saveCurrentBuffer()
        const previewVariables = previewVariablesRef.current
        const processedBuffer =
          !applyVariablesToEditor && previewVariables && Object.keys(previewVariables).length > 0
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
    }, [applyVariablesToEditor, saveCurrentBuffer])

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

    const generatePreviewPdf = useCallback(async (options?: { download?: boolean; previewWatermark?: boolean }) => {
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
        const removePreviewWatermark = addPreviewPdfWatermark(page, Boolean(options?.previewWatermark))
        let canvas: HTMLCanvasElement

        try {
          canvas = await html2canvas(page, {
            backgroundColor: "#ffffff",
            logging: false,
            scale: 2,
            useCORS: true,
          })
        } finally {
          removePreviewWatermark()
        }

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

      if (options?.download !== false) {
        downloadGeneratedFile(file)
      }

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
        <style>{`
          .docx-template-editor-shell [data-testid="editor-toolbar"] button[title^="Editing"],
          .docx-template-editor-shell [data-testid="editor-toolbar"] button[title^="Suggesting"],
          .docx-template-editor-shell [data-testid="editor-toolbar"] button[title^="Viewing"],
          .docx-template-editor-shell [data-testid="editor-toolbar"] button[title^="Editando"],
          .docx-template-editor-shell [data-testid="editor-toolbar"] button[title^="Sugerindo"],
          .docx-template-editor-shell [data-testid="editor-toolbar"] button[title^="Visualizando"],
          .docx-template-editor-shell [data-testid="editor-toolbar"] button[data-depclean-tooltip^="Editing"],
          .docx-template-editor-shell [data-testid="editor-toolbar"] button[data-depclean-tooltip^="Suggesting"],
          .docx-template-editor-shell [data-testid="editor-toolbar"] button[data-depclean-tooltip^="Viewing"],
          .docx-template-editor-shell [data-testid="editor-toolbar"] button[data-depclean-tooltip^="Editando"],
          .docx-template-editor-shell [data-testid="editor-toolbar"] button[data-depclean-tooltip^="Sugerindo"],
          .docx-template-editor-shell [data-testid="editor-toolbar"] button[data-depclean-tooltip^="Visualizando"],
          .docx-template-editor-shell [data-testid="editor-toolbar"] button[aria-label^="Editing"],
          .docx-template-editor-shell [data-testid="editor-toolbar"] button[aria-label^="Suggesting"],
          .docx-template-editor-shell [data-testid="editor-toolbar"] button[aria-label^="Viewing"],
          .docx-template-editor-shell [data-testid="editor-toolbar"] button[aria-label^="Editando"],
          .docx-template-editor-shell [data-testid="editor-toolbar"] button[aria-label^="Sugerindo"],
          .docx-template-editor-shell [data-testid="editor-toolbar"] button[aria-label^="Visualizando"] {
            display: none !important;
          }
        `}</style>

        {isLoading ? (
          <div className="rounded-xl border bg-background px-4 py-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-3 w-72 max-w-full" />
              </div>
            </div>
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
