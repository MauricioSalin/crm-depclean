"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { EditorContent, useEditor } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import { Node as TiptapNode } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import { TextStyle } from "@tiptap/extension-text-style"
import { Color } from "@tiptap/extension-color"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import Link from "@tiptap/extension-link"
import { Table as BaseTable } from "@tiptap/extension-table"
import { TableRow as BaseTableRow } from "@tiptap/extension-table-row"
import { TableHeader } from "@tiptap/extension-table-header"
import { TableCell as BaseTableCell } from "@tiptap/extension-table-cell"
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Bold,
  ChevronsDownUp,
  ChevronsUpDown,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  PaintBucket,
  Quote,
  Redo,
  SeparatorHorizontal,
  Table as TableIcon,
  TableColumnsSplit,
  TableRowsSplit,
  Trash2,
  Underline as UnderlineIcon,
  Undo,
  Unlink,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const PageBreak = TiptapNode.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: "div[data-page-break]" }]
  },

  renderHTML() {
    return ["div", { "data-page-break": "true", class: "page-break" }, ["span", { "data-page-break-spacer": "true" }]]
  },
})

const Table = BaseTable.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      tableAlign: {
        default: "start",
        parseHTML: (element) => element.getAttribute("data-table-align") || "start",
        renderHTML: (attributes) => {
          const align = attributes.tableAlign || "start"
          const marginStyle =
            align === "end"
              ? "margin-left: auto; margin-right: 0;"
              : align === "center"
                ? "margin-left: auto; margin-right: auto;"
                : "margin-left: 0; margin-right: auto;"

          return {
            "data-table-align": align,
            style: marginStyle,
          }
        },
      },
    }
  },
})

const TableCell = BaseTableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.style.backgroundColor || null,
        renderHTML: (attributes) => {
          if (!attributes.backgroundColor) return {}
          return { style: `background-color: ${attributes.backgroundColor}` }
        },
      },
    }
  },
})

const TableRow = BaseTableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      rowHeight: {
        default: null,
        parseHTML: (element) => {
          const height = element.style.height || element.getAttribute("data-row-height")
          if (!height) return null

          const numericHeight = Number.parseInt(height.replace("px", ""), 10)
          return Number.isFinite(numericHeight) && numericHeight > 0 ? numericHeight : null
        },
        renderHTML: (attributes) => {
          if (!attributes.rowHeight) return {}

          return {
            "data-row-height": attributes.rowHeight,
            style: `height: ${attributes.rowHeight}px; min-height: ${attributes.rowHeight}px;`,
          }
        },
      },
    }
  },
})

const TABLE_PICKER_SIZE = 8
const MIN_TABLE_ROW_HEIGHT = 28
const TABLE_ROW_RESIZE_EDGE = 7

function EditorTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

function TableToolButton({
  label,
  active,
  destructive,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  destructive?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <EditorTooltip label={label}>
      <Button
        type="button"
        variant={active ? "secondary" : "ghost"}
        size="icon"
        className="h-8 w-8"
        onClick={onClick}
      >
        <span className={destructive ? "text-destructive" : undefined}>{children}</span>
      </Button>
    </EditorTooltip>
  )
}

function getActiveTableElement(editor: NonNullable<ReturnType<typeof useEditor>>) {
  if (typeof window === "undefined") return null

  const selection = editor.state.selection
  const domAtPos = editor.view.domAtPos(selection.from)
  const node =
    domAtPos.node.nodeType === window.Node.TEXT_NODE
      ? domAtPos.node.parentElement
      : domAtPos.node instanceof HTMLElement
        ? domAtPos.node
        : domAtPos.node.parentElement

  return node?.closest("table") ?? null
}

function getActiveTableRowElement(editor: NonNullable<ReturnType<typeof useEditor>>) {
  if (typeof window === "undefined") return null

  const selection = editor.state.selection
  const domAtPos = editor.view.domAtPos(selection.from)
  const node =
    domAtPos.node.nodeType === window.Node.TEXT_NODE
      ? domAtPos.node.parentElement
      : domAtPos.node instanceof HTMLElement
        ? domAtPos.node
        : domAtPos.node.parentElement

  return node?.closest("tr") ?? null
}

function getSelectedTableRow(editor: NonNullable<ReturnType<typeof useEditor>>) {
  const { $from } = editor.state.selection

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.type.name === "tableRow") {
      return {
        node,
        pos: $from.before(depth),
      }
    }
  }

  return null
}

function getTableRowFromPointer(event: MouseEvent) {
  if (typeof window === "undefined") return null
  const target = event.target instanceof HTMLElement ? event.target : null
  if (!target || target.closest(".column-resize-handle")) return null

  const cell =
    target.closest("td, th") ??
    (document.elementFromPoint(event.clientX, event.clientY - 2) as HTMLElement | null)?.closest("td, th")
  const row = cell?.closest("tr")
  if (!(row instanceof HTMLTableRowElement)) return null

  const rect = row.getBoundingClientRect()
  const isNearBottom = event.clientY >= rect.bottom - TABLE_ROW_RESIZE_EDGE && event.clientY <= rect.bottom + 3

  return isNearBottom ? row : null
}

function getTableRowPos(editor: NonNullable<ReturnType<typeof useEditor>>, row: HTMLTableRowElement) {
  let rowPos: number | null = null

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "tableRow") return true
    if (editor.view.nodeDOM(pos) === row) {
      rowPos = pos
      return false
    }

    return true
  })

  if (rowPos === null) {
    const firstCell = row.querySelector("td, th")
    if (firstCell) {
      try {
        const cellPos = editor.view.posAtDOM(firstCell, 0)
        const $pos = editor.state.doc.resolve(cellPos)

        for (let depth = $pos.depth; depth > 0; depth -= 1) {
          const node = $pos.node(depth)
          if (node.type.name === "tableRow") {
            rowPos = $pos.before(depth)
            break
          }
        }
      } catch {}
    }
  }

  return rowPos
}

export function ContractRichEditor({
  valueHtml,
  onChangeHtml,
}: {
  valueHtml: string
  onChangeHtml: (next: string) => void
}) {
  const lastSyncedHtmlRef = useRef(valueHtml)
  const [, refreshToolbar] = useState(0)
  const [tablePickerOpen, setTablePickerOpen] = useState(false)
  const [hoveredTableSize, setHoveredTableSize] = useState({ rows: 3, cols: 3 })

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TextStyle,
      Color,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      PageBreak,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    []
  )

  const editor = useEditor({
    extensions,
    content: valueHtml,
    parseOptions: {
      preserveWhitespace: "full",
    },
    immediatelyRender: false,
    autofocus: false,
    editorProps: {
      attributes: {
        class: "contract-doc min-h-[680px] outline-none max-w-none",
      },
    },
    onUpdate: ({ editor }) => {
      const nextHtml = editor.getHTML()
      lastSyncedHtmlRef.current = nextHtml
      onChangeHtml(nextHtml)
    },
  })

  useEffect(() => {
    if (!editor) return

    const nextHtml = valueHtml ?? ""
    if (nextHtml === lastSyncedHtmlRef.current || nextHtml === editor.getHTML()) return

    lastSyncedHtmlRef.current = nextHtml
    editor.commands.setContent(nextHtml, { emitUpdate: false })
  }, [editor, valueHtml])

  useEffect(() => {
    if (!editor) return

    let frame = 0
    const refresh = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        refreshToolbar((value) => value + 1)
      })
    }

    editor.on("selectionUpdate", refresh)
    editor.on("focus", refresh)
    editor.on("blur", refresh)

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      editor.off("selectionUpdate", refresh)
      editor.off("focus", refresh)
      editor.off("blur", refresh)
    }
  }, [editor])

  useEffect(() => {
    if (!editor || typeof window === "undefined") return

    const editorDom = editor.view.dom
    let activeRow: HTMLTableRowElement | null = null
    let startY = 0
    let startHeight = 0
    let nextHeight = 0

    const clearResizeCursor = () => {
      editorDom.classList.remove("row-resize-cursor")
      document.body.classList.remove("row-resize-cursor")
    }

    const handleEditorMouseMove = (event: MouseEvent) => {
      if (activeRow) return

      const row = getTableRowFromPointer(event)
      editorDom.classList.toggle("row-resize-cursor", Boolean(row))
    }

    const handleEditorMouseLeave = () => {
      if (!activeRow) editorDom.classList.remove("row-resize-cursor")
    }

    const handleDocumentMouseMove = (event: MouseEvent) => {
      if (!activeRow) return

      event.preventDefault()
      nextHeight = Math.max(MIN_TABLE_ROW_HEIGHT, Math.round(startHeight + event.clientY - startY))
      activeRow.style.height = `${nextHeight}px`
      activeRow.style.minHeight = `${nextHeight}px`
      Array.from(activeRow.cells).forEach((cell) => {
        cell.style.height = `${nextHeight}px`
      })
    }

    const handleDocumentMouseUp = () => {
      if (!activeRow) return

      const row = activeRow
      const rowPos = getTableRowPos(editor, row)
      activeRow = null
      clearResizeCursor()

      if (rowPos === null) return

      const node = editor.state.doc.nodeAt(rowPos)
      if (!node) return

      const transaction = editor.state.tr.setNodeMarkup(rowPos, undefined, {
        ...node.attrs,
        rowHeight: nextHeight,
      })

      editor.view.dispatch(transaction)
    }

    const handleEditorMouseDown = (event: MouseEvent) => {
      const row = getTableRowFromPointer(event)
      if (!row) return

      event.preventDefault()
      event.stopPropagation()
      activeRow = row
      startY = event.clientY
      startHeight = row.getBoundingClientRect().height
      nextHeight = Math.max(MIN_TABLE_ROW_HEIGHT, Math.round(startHeight))
      editorDom.classList.add("row-resize-cursor")
      document.body.classList.add("row-resize-cursor")
    }

    editorDom.addEventListener("mousemove", handleEditorMouseMove, true)
    editorDom.addEventListener("mouseleave", handleEditorMouseLeave, true)
    editorDom.addEventListener("mousedown", handleEditorMouseDown, true)
    document.addEventListener("mousemove", handleDocumentMouseMove)
    document.addEventListener("mouseup", handleDocumentMouseUp)

    return () => {
      editorDom.removeEventListener("mousemove", handleEditorMouseMove, true)
      editorDom.removeEventListener("mouseleave", handleEditorMouseLeave, true)
      editorDom.removeEventListener("mousedown", handleEditorMouseDown, true)
      document.removeEventListener("mousemove", handleDocumentMouseMove)
      document.removeEventListener("mouseup", handleDocumentMouseUp)
      clearResizeCursor()
    }
  }, [editor])

  if (!editor) return null

  const isActive = (name: string, attrs?: Record<string, any>) => editor.isActive(name as any, attrs)
  const currentColor = editor.getAttributes("textStyle").color || "#111111"
  const colorPickerValue = /^#[0-9a-f]{6}$/i.test(currentColor) ? currentColor : "#111111"

  const ensureLink = () => {
    const previousUrl = editor.getAttributes("link").href as string | undefined
    const url = window.prompt("Cole o link:", previousUrl || "https://")
    if (!url) return
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
  }

  const insertPageBreak = () => {
    editor.chain().focus().insertContent([{ type: "pageBreak" }, { type: "paragraph" }]).run()
  }

  const insertTable = (rows = 3, cols = 3) => {
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: false }).run()
    setTablePickerOpen(false)
    setHoveredTableSize({ rows: 3, cols: 3 })
  }

  const updateSelectedRowHeight = (delta: number) => {
    const row = getSelectedTableRow(editor)
    if (!row) return

    const rowElement = getActiveTableRowElement(editor)
    const currentHeight =
      Number(row.node.attrs.rowHeight) ||
      (rowElement ? Math.round(rowElement.getBoundingClientRect().height) : MIN_TABLE_ROW_HEIGHT)
    const nextHeight = Math.max(MIN_TABLE_ROW_HEIGHT, currentHeight + delta)

    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(row.pos, undefined, {
        ...row.node.attrs,
        rowHeight: nextHeight,
      })
    )
    editor.commands.focus()
  }

  const tableCellColor = editor.getAttributes("tableCell").backgroundColor || "#ffffff"
  const tableAlign = editor.getAttributes("table").tableAlign || "start"

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-lg border bg-muted/20 p-2">
        <Button
          type="button"
          variant={isActive("bold") ? "secondary" : "ghost"}
          size="icon"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className="h-8 w-8"
          title="Negrito"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={isActive("italic") ? "secondary" : "ghost"}
          size="icon"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className="h-8 w-8"
          title="Itálico"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={isActive("underline") ? "secondary" : "ghost"}
          size="icon"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className="h-8 w-8"
          title="Sublinhado"
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>

        <span className="mx-1 h-5 w-px bg-border" />

        <label
          className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-transparent transition-colors hover:border-border hover:bg-muted"
          title="Cor do texto"
          style={{ backgroundColor: colorPickerValue === "#111111" ? undefined : `${colorPickerValue}14` }}
        >
          <span className="relative flex h-5 w-5 items-center justify-center text-[17px] font-semibold leading-none text-foreground">
            A
            <span
              className="absolute -bottom-1 left-0 h-[3px] w-full rounded-full shadow-sm"
              style={{ backgroundColor: colorPickerValue }}
            />
          </span>
          <input
            type="color"
            value={colorPickerValue}
            onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>

        <span className="mx-1 h-5 w-px bg-border" />

        <Button
          type="button"
          variant={isActive("heading", { level: 1 }) ? "secondary" : "ghost"}
          size="icon"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className="h-8 w-8"
          title="Título 1"
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={isActive("heading", { level: 2 }) ? "secondary" : "ghost"}
          size="icon"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className="h-8 w-8"
          title="Título 2"
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={isActive("heading", { level: 3 }) ? "secondary" : "ghost"}
          size="icon"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className="h-8 w-8"
          title="Título 3"
        >
          <Heading3 className="h-4 w-4" />
        </Button>

        <span className="mx-1 h-5 w-px bg-border" />

        <Button
          type="button"
          variant={isActive("bulletList") ? "secondary" : "ghost"}
          size="icon"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className="h-8 w-8"
          title="Lista"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={isActive("orderedList") ? "secondary" : "ghost"}
          size="icon"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className="h-8 w-8"
          title="Lista numerada"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={isActive("blockquote") ? "secondary" : "ghost"}
          size="icon"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className="h-8 w-8"
          title="Citação"
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="h-8 w-8"
          title="Linha"
        >
          <Minus className="h-4 w-4" />
        </Button>

        <span className="mx-1 h-5 w-px bg-border" />

        <Button
          type="button"
          variant={editor.isActive({ textAlign: "left" }) ? "secondary" : "ghost"}
          size="icon"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className="h-8 w-8"
          title="Alinhar à esquerda"
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive({ textAlign: "center" }) ? "secondary" : "ghost"}
          size="icon"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className="h-8 w-8"
          title="Centralizar"
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive({ textAlign: "right" }) ? "secondary" : "ghost"}
          size="icon"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className="h-8 w-8"
          title="Alinhar à direita"
        >
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive({ textAlign: "justify" }) ? "secondary" : "ghost"}
          size="icon"
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          className="h-8 w-8"
          title="Justificar"
        >
          <AlignJustify className="h-4 w-4" />
        </Button>

        <span className="mx-1 h-5 w-px bg-border" />

        <Button
          type="button"
          variant={isActive("link") ? "secondary" : "ghost"}
          size="icon"
          onClick={ensureLink}
          className="h-8 w-8"
          title="Inserir link"
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().unsetLink().run()}
          className="h-8 w-8"
          title="Remover link"
          disabled={!isActive("link")}
        >
          <Unlink className="h-4 w-4" />
        </Button>

        <span className="mx-1 h-5 w-px bg-border" />

        <Popover open={tablePickerOpen} onOpenChange={setTablePickerOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Inserir tabela">
              <TableIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-2">
            <div className="grid grid-cols-8 gap-0.5">
              {Array.from({ length: TABLE_PICKER_SIZE * TABLE_PICKER_SIZE }, (_, index) => {
                const row = Math.floor(index / TABLE_PICKER_SIZE) + 1
                const col = (index % TABLE_PICKER_SIZE) + 1
                const active = row <= hoveredTableSize.rows && col <= hoveredTableSize.cols

                return (
                  <button
                    key={`${row}-${col}`}
                    type="button"
                    className={`h-4 w-4 rounded-[2px] border transition-colors ${
                      active ? "border-primary bg-primary" : "border-border bg-background hover:bg-primary/20"
                    }`}
                    onMouseEnter={() => setHoveredTableSize({ rows: row, cols: col })}
                    onFocus={() => setHoveredTableSize({ rows: row, cols: col })}
                    onClick={() => insertTable(row, col)}
                    aria-label={`Inserir tabela ${row} por ${col}`}
                  />
                )
              })}
            </div>
            <div className="mt-2 text-center text-xs text-muted-foreground">
              {hoveredTableSize.rows}x{hoveredTableSize.cols}
            </div>
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={insertPageBreak}
          className="h-8 w-8"
          title="Quebra de página"
        >
          <SeparatorHorizontal className="h-4 w-4" />
        </Button>

        <span className="mx-1 h-5 w-px bg-border" />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().undo().run()}
          className="h-8 w-8"
          title="Desfazer"
          disabled={!editor.can().undo()}
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().redo().run()}
          className="h-8 w-8"
          title="Refazer"
          disabled={!editor.can().redo()}
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-muted/20 p-4">
        <div className="contract-editor-paper">
          <BubbleMenu
            editor={editor}
            shouldShow={({ editor }) => editor.isActive("table")}
            getReferencedVirtualElement={() => {
              const table = getActiveTableElement(editor)
              if (!table) return null

              return {
                getBoundingClientRect: () => table.getBoundingClientRect(),
              }
            }}
            options={{ placement: "top", offset: 10, flip: true, shift: true }}
          >
            <div className="relative flex max-w-full flex-wrap items-center gap-1 rounded-lg border bg-popover p-1.5 text-popover-foreground shadow-md after:absolute after:left-1/2 after:top-full after:h-3 after:w-3 after:-translate-x-1/2 after:-translate-y-1/2 after:rotate-45 after:border-b after:border-r after:bg-popover">
              <TableToolButton
                label="Alinhar tabela ao início"
                active={tableAlign === "start"}
                onClick={() => editor.chain().focus().updateAttributes("table", { tableAlign: "start" }).run()}
              >
                <AlignLeft className="h-4 w-4" />
              </TableToolButton>
              <TableToolButton
                label="Centralizar tabela"
                active={tableAlign === "center"}
                onClick={() => editor.chain().focus().updateAttributes("table", { tableAlign: "center" }).run()}
              >
                <AlignCenter className="h-4 w-4" />
              </TableToolButton>
              <TableToolButton
                label="Alinhar tabela ao fim"
                active={tableAlign === "end"}
                onClick={() => editor.chain().focus().updateAttributes("table", { tableAlign: "end" }).run()}
              >
                <AlignRight className="h-4 w-4" />
              </TableToolButton>

              <span className="mx-1 h-5 w-px bg-border" />

              <TableToolButton label="Inserir linha antes" onClick={() => editor.chain().focus().addRowBefore().run()}>
                <ArrowUpToLine className="h-4 w-4" />
              </TableToolButton>
              <TableToolButton label="Inserir linha depois" onClick={() => editor.chain().focus().addRowAfter().run()}>
                <ArrowDownToLine className="h-4 w-4" />
              </TableToolButton>
              <TableToolButton label="Remover linha" onClick={() => editor.chain().focus().deleteRow().run()}>
                <TableRowsSplit className="h-4 w-4" />
                <Minus className="-ml-1 h-3 w-3 text-destructive" />
              </TableToolButton>
              <TableToolButton label="Aumentar altura da linha" onClick={() => updateSelectedRowHeight(12)}>
                <ChevronsUpDown className="h-4 w-4" />
              </TableToolButton>
              <TableToolButton label="Diminuir altura da linha" onClick={() => updateSelectedRowHeight(-12)}>
                <ChevronsDownUp className="h-4 w-4" />
              </TableToolButton>

              <span className="mx-1 h-5 w-px bg-border" />

              <TableToolButton
                label="Inserir coluna antes"
                onClick={() => editor.chain().focus().addColumnBefore().run()}
              >
                <ArrowLeftToLine className="h-4 w-4" />
              </TableToolButton>
              <TableToolButton
                label="Inserir coluna depois"
                onClick={() => editor.chain().focus().addColumnAfter().run()}
              >
                <ArrowRightToLine className="h-4 w-4" />
              </TableToolButton>
              <TableToolButton label="Remover coluna" onClick={() => editor.chain().focus().deleteColumn().run()}>
                <TableColumnsSplit className="h-4 w-4" />
                <Minus className="-ml-1 h-3 w-3 text-destructive" />
              </TableToolButton>

              <span className="mx-1 h-5 w-px bg-border" />

              <EditorTooltip label="Cor do plano de fundo">
                <label className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md hover:bg-muted">
                  <span className="relative flex h-6 w-5 items-center justify-center pb-1">
                    <PaintBucket className="h-4 w-4" />
                    <span
                      className="absolute bottom-0 left-0 h-[3px] w-full rounded-full shadow-sm"
                      style={{ backgroundColor: tableCellColor }}
                    />
                  </span>
                  <input
                    type="color"
                    value={/^#[0-9a-f]{6}$/i.test(tableCellColor) ? tableCellColor : "#ffffff"}
                    onChange={(event) =>
                      editor.chain().focus().setCellAttribute("backgroundColor", event.target.value).run()
                    }
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
              </EditorTooltip>

              <TableToolButton
                label="Excluir tabela"
                destructive
                onClick={() => editor.chain().focus().deleteTable().run()}
              >
                <Trash2 className="h-4 w-4" />
              </TableToolButton>
            </div>
          </BubbleMenu>
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
