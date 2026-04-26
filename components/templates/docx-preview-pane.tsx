"use client"

import { useEffect, useRef, useState } from "react"

import { fetchTemplatePreviewBinary } from "@/lib/api/templates"

type DocxPreviewPaneProps = {
  templateId?: string | null
  title?: string
  version?: number
}

export function DocxPreviewPane({ templateId, title = "Prévia do template DOCX", version = 0 }: DocxPreviewPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function renderPreview() {
      if (!templateId || !containerRef.current) return

      setLoading(true)
      setError("")
      containerRef.current.innerHTML = ""

      try {
        const [{ renderAsync }, buffer] = await Promise.all([
          import("docx-preview"),
          fetchTemplatePreviewBinary(templateId),
        ])

        if (cancelled || !containerRef.current) return

        await renderAsync(buffer, containerRef.current, undefined, {
          className: "docx-preview",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          breakPages: true,
          useBase64URL: true,
        })
      } catch (previewError) {
        if (!cancelled) {
          setError(previewError instanceof Error ? previewError.message : "Falha ao renderizar a prévia.")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    renderPreview()

    return () => {
      cancelled = true
    }
  }, [templateId, version])

  return (
    <div className="h-[76vh] overflow-auto rounded-lg border bg-muted/20 p-4">
      {loading ? <p className="mb-3 text-sm text-muted-foreground">Renderizando prévia do DOCX...</p> : null}
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
      <div
        ref={containerRef}
        aria-label={title}
        className="docx-preview-host min-h-full rounded-md bg-white p-2 shadow-sm"
      />
    </div>
  )
}
