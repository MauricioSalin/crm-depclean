"use client"

import { useId } from "react"
import { MessageSquareText } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

export const RESCHEDULE_REASONS = [
  { value: "full_water_tanks", label: "Caixas d'água cheias" },
  { value: "rain", label: "Chuva" },
  { value: "no_team", label: "Sem Equipe" },
  { value: "no_truck", label: "Ausência de caminhão" },
  { value: "other", label: "Outros" },
] as const

export function getRescheduleReasonError(reason?: string, notes?: string) {
  if (!reason) return "Selecione o motivo do reagendamento."
  if (reason === "other" && !notes?.trim()) return "Preencha as observações ao selecionar Outros."
  return ""
}

export function RescheduleReasonFields({ reason, notes, onReasonChange, onNotesChange, showIcon = true }: {
  reason: string; notes: string; onReasonChange: (value: string) => void; onNotesChange: (value: string) => void; showIcon?: boolean
}) {
  const id = useId()
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={`${id}-reason`} className="flex items-center gap-2">
          {showIcon ? <MessageSquareText className="h-4 w-4 text-primary" aria-hidden="true" /> : null}
          Motivo do reagendamento *
        </Label>
        <Select value={reason} onValueChange={onReasonChange}>
          <SelectTrigger id={`${id}-reason`} className="w-full" aria-required="true"><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
          <SelectContent>{RESCHEDULE_REASONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-notes`}>{reason === "other" ? "Descreva o motivo / observações *" : "Observações do reagendamento"}</Label>
        <Textarea id={`${id}-notes`} required={reason === "other"} maxLength={2000} value={notes} onChange={(event) => onNotesChange(event.target.value)} placeholder="Explique o motivo do reagendamento" />
      </div>
    </div>
  )
}
