import { createElement, useCallback, useEffect, useMemo, useState } from "react"
import type {
  EditorPlugin,
  RenderedDomContext,
} from "@eigenpal/docx-js-editor"
import type { Node as ProseMirrorNode } from "prosemirror-model"
import type { EditorView } from "prosemirror-view"

const VARIABLE_TOKEN_REGEX = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g

type VariableToken = {
  from: number
  label: string
  path: string
  rawToken: string
  to: number
}

type BadgeOverlayItem = {
  height: number
  isPrimary: boolean
  left: number
  token: VariableToken
  top: number
  width: number
}

type TemplateVariableBadgeOverlayProps = {
  context: RenderedDomContext
  tokens: VariableToken[]
  view: EditorView
}

function findVariableTokens(doc: ProseMirrorNode, variableLabels: Readonly<Record<string, string>>) {
  let documentText = ""
  const textPositions: number[] = []

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return

    for (let index = 0; index < node.text.length; index += 1) {
      textPositions.push(pos + index)
    }
    documentText += node.text
  })

  const tokens: VariableToken[] = []
  const tokenRegex = new RegExp(VARIABLE_TOKEN_REGEX)
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(documentText))) {
    const path = match[1]
    const label = variableLabels[path]
    if (!label) continue

    const from = textPositions[match.index]
    const lastCharacterPosition = textPositions[match.index + match[0].length - 1]
    if (typeof from !== "number" || typeof lastCharacterPosition !== "number") continue

    tokens.push({
      from,
      label,
      path,
      rawToken: match[0],
      to: lastCharacterPosition + 1,
    })
  }

  return tokens
}

function TemplateVariableBadgeOverlay({
  context,
  tokens = [],
  view,
}: TemplateVariableBadgeOverlayProps) {
  const [layoutRevision, setLayoutRevision] = useState(0)
  const refreshLayout = useCallback(() => {
    window.requestAnimationFrame(() => setLayoutRevision((current) => current + 1))
  }, [])

  useEffect(() => {
    const resizeObserver = new ResizeObserver(refreshLayout)
    resizeObserver.observe(context.pagesContainer)
    window.addEventListener("resize", refreshLayout)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", refreshLayout)
    }
  }, [context.pagesContainer, refreshLayout])

  const overlayItems = useMemo(() => {
    const offset = context.getContainerOffset()

    return tokens.flatMap((token) =>
      context.getRectsForRange(token.from, token.to).map((rect, index) => ({
        height: rect.height,
        isPrimary: index === 0,
        left: rect.x + offset.x,
        token,
        top: rect.y + offset.y,
        width: rect.width,
      })),
    )
  }, [context, layoutRevision, tokens])

  function removeToken(token: VariableToken) {
    view.dispatch(view.state.tr.delete(token.from, token.to).scrollIntoView())
    view.focus()
  }

  return (
    <div className="docx-template-variable-overlay">
      {overlayItems.map((item) => (
        <span
          key={`${item.token.from}:${item.token.path}:${item.left}:${item.top}`}
          className={`docx-template-variable-badge ${item.isPrimary ? "" : "docx-template-variable-badge--continuation"}`}
          data-template-variable-badge={item.token.path}
          style={{
            fontSize: Math.max(8, Math.min(13, item.height * 0.68)),
            height: item.height,
            left: item.left,
            top: item.top,
            width: item.width,
          }}
          onPointerDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
        >
          {item.isPrimary ? (
            <>
              <span className="docx-template-variable-badge__label">{item.token.label}</span>
              <button
                type="button"
                className="docx-template-variable-badge__remove"
                data-template-variable-remove={item.token.path}
                aria-label={`Remover ${item.token.label}`}
                title={`Remover ${item.token.label}`}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  removeToken(item.token)
                }}
              >
                ×
              </button>
            </>
          ) : null}
        </span>
      ))}
    </div>
  )
}

const TEMPLATE_VARIABLE_BADGE_STYLES = `
  .docx-template-variable-overlay {
    position: absolute;
    inset: 0;
    z-index: 20;
    overflow: visible;
    pointer-events: none;
  }

  .docx-template-variable-badge {
    position: absolute;
    display: inline-flex;
    box-sizing: border-box;
    min-width: 0;
    align-items: center;
    justify-content: center;
    gap: 0;
    overflow: visible;
    border: 1px solid #c9d9bd;
    border-radius: 999px;
    background: #eef5e8;
    color: #405534;
    font-family: Arial, sans-serif;
    font-style: normal;
    font-weight: 600;
    line-height: 1;
    text-decoration: none;
    white-space: nowrap;
    cursor: default;
    user-select: none;
    pointer-events: auto;
  }

  .docx-template-variable-badge--continuation {
    pointer-events: none;
  }

  .docx-template-variable-badge__label {
    min-width: 0;
    overflow: hidden;
    padding: 0 5px;
    text-overflow: ellipsis;
  }

  .docx-template-variable-badge__remove {
    display: inline-grid;
    width: 0;
    height: 16px;
    margin: 0;
    padding: 0;
    place-items: center;
    overflow: hidden;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: #5f7354;
    font: 700 14px/1 Arial, sans-serif;
    opacity: 0;
    cursor: pointer;
    transition: width 120ms ease, margin-right 120ms ease, opacity 120ms ease, background-color 120ms ease;
  }

  .docx-template-variable-badge:hover .docx-template-variable-badge__remove,
  .docx-template-variable-badge:focus-within .docx-template-variable-badge__remove {
    width: 16px;
    margin-right: 2px;
    opacity: 1;
  }

  .docx-template-variable-badge__remove:hover,
  .docx-template-variable-badge__remove:focus-visible {
    background: #dbe8d2;
    color: #27391f;
    outline: none;
  }
`

export function createTemplateVariableBadgePlugin(
  variableLabels: Readonly<Record<string, string>>,
): EditorPlugin<VariableToken[]> {
  const readTokens = (view: EditorView | null) =>
    view ? findVariableTokens(view.state.doc, variableLabels) : []

  return {
    id: "depclean-template-variable-badges",
    name: "Variáveis do template",
    initialize: readTokens,
    onStateChange: readTokens,
    renderOverlay: (context, tokens = [], view) =>
      view
        ? createElement(TemplateVariableBadgeOverlay, {
            context,
            tokens,
            view,
          })
        : null,
    styles: TEMPLATE_VARIABLE_BADGE_STYLES,
  }
}
