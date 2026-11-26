import type { ReactNode } from "react"
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react"

export function SavedAttachmentRow({ fileName, description, actions, state = "ready" }: {
  fileName: string
  description: string
  actions: ReactNode
  state?: "ready" | "loading" | "error"
}) {
  return <div data-slot="saved-attachment-row" aria-busy={state === "loading"} className="flex min-w-0 items-center gap-3 rounded-xl bg-background px-3 py-2 shadow-none">
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${state === "error" ? "bg-destructive/10 text-destructive" : "bg-emerald-50 text-emerald-700"}`}>
      {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : state === "error" ? <CircleAlert className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium" title={fileName}>{fileName}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
    <div className="flex shrink-0 items-center gap-1">{actions}</div>
  </div>
}
