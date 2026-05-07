"use client"

import { Clock3, MessageSquarePlus } from "lucide-react"
import { useEffect, useState } from "react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

function HeaderActionTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" className="bg-primary text-primary-foreground" arrowClassName="bg-primary fill-primary">{label}</TooltipContent>
    </Tooltip>
  )
}

export function DepAIHeaderActions() {
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    const syncHistoryState = (event: Event) => {
      const customEvent = event as CustomEvent<{ open?: boolean }>
      setHistoryOpen(Boolean(customEvent.detail?.open))
    }

    window.addEventListener("depai:history-state", syncHistoryState)
    return () => window.removeEventListener("depai:history-state", syncHistoryState)
  }, [])

  return (
    <>
      <HeaderActionTooltip label="Nova conversa">
        <button
          type="button"
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
          onClick={() => window.dispatchEvent(new CustomEvent("depai:new-conversation"))}
          aria-label="Nova conversa"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </button>
      </HeaderActionTooltip>
      <HeaderActionTooltip label="Histórico">
        <button
          type="button"
          className={`inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted ${historyOpen ? "bg-muted" : ""}`}
          onClick={() => window.dispatchEvent(new CustomEvent("depai:toggle-history"))}
          aria-pressed={historyOpen}
          aria-label="Histórico"
        >
          <Clock3 className="h-4 w-4" />
        </button>
      </HeaderActionTooltip>
    </>
  )
}
