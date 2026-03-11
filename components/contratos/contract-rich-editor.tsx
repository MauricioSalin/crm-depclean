"use client"

import { useEffect, useMemo, useRef } from "react"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import Link from "@tiptap/extension-link"
import { Table } from "@tiptap/extension-table"
import { TableRow } from "@tiptap/extension-table-row"
import { TableHeader } from "@tiptap/extension-table-header"
import { TableCell } from "@tiptap/extension-table-cell"
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Undo,
  Redo,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link as LinkIcon,
  Unlink,
  SeparatorHorizontal,
  Table as TableIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"

export function ContractRichEditor({
  valueHtml,
  onChangeHtml,
}: {
  valueHtml: string
  onChangeHtml: (next: string) => void
}) {
  const lastExternalSetRef = useRef<string | null>(null)

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
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
    // Next (App Router) faz SSR de Client Components; isso evita mismatch de hidratação.
    immediatelyRender: false,
    // Não focamos automaticamente para manter o scroll no início da página.
    autofocus: false,
    editorProps: {
      attributes: {
        class: "contract-doc min-h-[680px] outline-none max-w-none",
      },
    },
    onUpdate: ({ editor }) => {
      onChangeHtml(editor.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) return
    const next = valueHtml ?? ""
    const current = editor.getHTML()
    if (next === current) return

    // Evita loop quando a atualização veio do próprio editor
    if (lastExternalSetRef.current === next) return
    lastExternalSetRef.current = next
    editor.commands.setContent(next, { emitUpdate: false })
  }, [editor, valueHtml])

  if (!editor) return null

  const isActive = (name: string, attrs?: Record<string, any>) => editor.isActive(name as any, attrs)

  const ensureLink = () => {
    const previousUrl = editor.getAttributes("link").href as string | undefined
    const url = window.prompt("Cole o link:", previousUrl || "https://")
    if (!url) return
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
  }

  const insertPageBreak = () => {
    editor
      .chain()
      .focus()
      .insertContent(`<hr class="page-break" /><p></p>`)
      .run()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/20 p-2">
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

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          className="h-8 w-8"
          title="Inserir tabela"
        >
          <TableIcon className="h-4 w-4" />
        </Button>
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

      <div className="rounded-lg border bg-muted/20 h-[76vh] overflow-auto p-4">
        <div className="contract-editor-paper">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}

