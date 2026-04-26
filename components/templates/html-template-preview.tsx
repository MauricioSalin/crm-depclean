"use client"

import type { TemplateKind } from "@/lib/api/templates"

type HtmlTemplatePreviewProps = {
  html: string
  title?: string
  mode?: "paged" | "single-page"
  templateKind?: TemplateKind
}

function getSinglePageCss(templateKind: Exclude<TemplateKind, "contract">) {
  const sharedCss = `
    .single-template-page {
      position: relative;
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto 14px;
      background: white;
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.1);
      border-radius: 10px;
      overflow: hidden;
      color: #202020;
      font-family: Arial, Helvetica, sans-serif;
    }

    .single-template-background {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      pointer-events: none;
      user-select: none;
      z-index: 0;
    }

    .single-template-body {
      position: relative;
      z-index: 1;
      min-height: 297mm;
      box-sizing: border-box;
    }

    .single-template-body table {
      display: table !important;
      width: auto !important;
      max-width: 100%;
      min-width: 0;
      border-collapse: separate !important;
      border-spacing: 0 !important;
      table-layout: fixed;
      border-top: 1px solid rgba(0, 0, 0, 0.3) !important;
      border-left: 1px solid rgba(0, 0, 0, 0.3) !important;
    }

    .single-template-body table[data-table-align="start"] {
      margin-left: 0 !important;
      margin-right: auto !important;
    }

    .single-template-body table[data-table-align="center"] {
      margin-left: auto !important;
      margin-right: auto !important;
    }

    .single-template-body table[data-table-align="end"] {
      margin-left: auto !important;
      margin-right: 0 !important;
    }

    .single-template-body th,
    .single-template-body td {
      display: table-cell !important;
      border: 0 !important;
      border-right: 1px solid rgba(0, 0, 0, 0.3) !important;
      border-bottom: 1px solid rgba(0, 0, 0, 0.3) !important;
      box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.22) !important;
      padding: 8px;
      vertical-align: top;
    }

    .single-template-body tr[data-row-height] > th,
    .single-template-body tr[data-row-height] > td {
      height: inherit !important;
    }
  `

  if (templateKind === "informative") {
    return `
      ${sharedCss}

      .single-template-page[data-kind="informative"] .single-template-body {
        padding: 36mm 18mm 26mm;
      }
    `
  }

  return `
    ${sharedCss}

    .single-template-page[data-kind="certificate"] .single-template-body {
      padding: 36mm 18mm 24mm;
    }
  `
}

export function HtmlTemplatePreview({
  html,
  mode = "paged",
  templateKind = "contract",
}: HtmlTemplatePreviewProps) {
  const safeHtml = html.trim() || "<p></p>"

  if (mode === "single-page") {
    const singlePageKind = templateKind === "certificate" ? "certificate" : "informative"

    return (
      <div className="h-full min-h-0 overflow-auto rounded-lg border bg-muted/20 p-4">
        <style>{getSinglePageCss(singlePageKind)}</style>
        <div className="single-template-page" data-kind={singlePageKind}>
          <img className="single-template-background" src="/template-assets/marca-dagua-real.jpg" alt="" />
          <div className="single-template-body" dangerouslySetInnerHTML={{ __html: safeHtml }} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 overflow-auto rounded-lg border bg-muted/20 p-4">
      <div className="contract-editor-paper contract-preview-paper" aria-label="Prévia do contrato">
        <div className="contract-doc min-h-[680px] max-w-none outline-none" dangerouslySetInnerHTML={{ __html: safeHtml }} />
      </div>
    </div>
  )
}
