"use client"

import { Clock3, MessageSquarePlus } from "lucide-react"

import { Button } from "@/components/ui/button"

export function DepAIHeaderActions() {
  return (
    <>
      <Button
        type="button"
        className="h-9 gap-2 rounded-full px-4 font-semibold"
        onClick={() => window.dispatchEvent(new CustomEvent("depai:new-conversation"))}
      >
        <MessageSquarePlus className="h-4 w-4" />
        Nova conversa
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-9 gap-2 rounded-full px-4 font-semibold"
        onClick={() => window.dispatchEvent(new CustomEvent("depai:toggle-history"))}
      >
        <Clock3 className="h-4 w-4" />
        {"Histórico"}
      </Button>
    </>
  )
}