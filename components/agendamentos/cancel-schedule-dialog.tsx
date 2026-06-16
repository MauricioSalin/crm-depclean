"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type CancelScheduleDialogProps = {
  open: boolean
  clientName?: string
  initialReason?: string
  busy?: boolean
  contentClassName?: string
  reasonInputId?: string
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => void
}

export function CancelScheduleDialog({
  open,
  clientName,
  initialReason = "",
  busy = false,
  contentClassName = "max-w-[calc(100vw-2rem)] gap-5 sm:max-w-md",
  reasonInputId = "cancel-reason",
  onOpenChange,
  onConfirm,
}: CancelScheduleDialogProps) {
  const [reason, setReason] = useState(initialReason)
  const [step, setStep] = useState<"reason" | "confirm">("reason")

  useEffect(() => {
    if (!open) return
    setReason(initialReason)
    setStep("reason")
  }, [initialReason, open])

  const trimmedReason = reason.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={contentClassName}>
        {step === "reason" ? (
          <>
            <DialogHeader className="min-w-0 pr-6">
              <DialogTitle>Cancelar agendamento</DialogTitle>
              <DialogDescription>
                Informe o motivo do cancelamento para manter o histórico claro para a equipe.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor={reasonInputId}>Motivo do cancelamento *</Label>
              <Textarea
                id={reasonInputId}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ex.: cliente pediu reagendamento, acesso indisponível, equipe sem janela..."
                className="min-h-28"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Voltar
              </Button>
              <Button
                type="button"
                disabled={!trimmedReason}
                className="bg-red-500 text-white hover:bg-red-600"
                onClick={() => setStep("confirm")}
              >
                Cancelar agendamento
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="min-w-0 pr-6">
              <DialogTitle>Confirmar cancelamento?</DialogTitle>
              <DialogDescription>
                Esta ação vai marcar o agendamento de {clientName || "este cliente"} como cancelado.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-900">
              <p className="font-medium">Motivo registrado</p>
              <p className="mt-1 text-red-800">{trimmedReason}</p>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("reason")}>
                Voltar
              </Button>
              <Button
                type="button"
                disabled={busy}
                className="bg-red-500 text-white hover:bg-red-600"
                onClick={() => onConfirm(trimmedReason)}
              >
                {busy ? "Cancelando..." : "Confirmar cancelamento"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
