"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { completeSchedule, type ScheduleRecord } from "@/lib/api/schedules"
import { getApiErrorMessage } from "@/lib/api/errors"
import { getRescheduleReasonError, RescheduleReasonFields } from "./reschedule-reason-fields"

export function PartialCompletionAction({ schedule, payload, disabled, onSuccess }: {
  schedule: ScheduleRecord | null
  payload: Parameters<typeof completeSchedule>[1]
  disabled?: boolean
  onSuccess: (schedule: ScheduleRecord) => void
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async () => {
      if (!schedule) throw new Error("Agendamento não encontrado.")
      return completeSchedule(schedule.id, { ...payload, rescheduleReason: reason, rescheduleNotes: notes.trim() })
    },
    onSuccess: async ({ data }) => {
      setOpen(false)
      onSuccess(data)
      await Promise.all(["schedules", "analytics", "notifications"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
      toast.success("Atendimento concluído parcialmente.")
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Não foi possível concluir parcialmente.")),
  })
  return <>
    <Button type="button" variant="outline" disabled={disabled || mutation.isPending} onClick={() => { setReason(""); setNotes(""); setOpen(true) }}>Concluir parcialmente</Button>
    <Dialog open={open} onOpenChange={(value) => { if (!mutation.isPending) setOpen(value) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Concluir parcialmente</DialogTitle>
          <DialogDescription>O período executado será registrado e o atendimento ficará pendente de reagendamento.</DialogDescription>
        </DialogHeader>
        <RescheduleReasonFields reason={reason} notes={notes} onReasonChange={setReason} onNotesChange={setNotes} partialCompletion disabled={mutation.isPending} />
        <DialogFooter>
          <Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => setOpen(false)}>Voltar</Button>
          <Button type="button" disabled={Boolean(getRescheduleReasonError(reason, notes)) || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Salvando..." : "Confirmar conclusão parcial"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
