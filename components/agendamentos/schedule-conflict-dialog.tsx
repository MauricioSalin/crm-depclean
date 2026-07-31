"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  formatAvailabilitySlot,
  formatScheduleConflictConfirmation,
} from "@/lib/schedule-availability"

type ScheduleConflictSlot = {
  date: string
  time: string
}

type ScheduleConflictDialogProps = {
  open: boolean
  requested?: ScheduleConflictSlot
  suggested?: ScheduleConflictSlot
  conflictingResources?: string[]
  busy?: boolean
  onCancel: () => void
  onContinue: () => void
  onUseSuggested: () => void
}

export function ScheduleConflictDialog({
  open,
  requested,
  suggested,
  conflictingResources = [],
  busy = false,
  onCancel,
  onContinue,
  onUseSuggested,
}: ScheduleConflictDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conflito de horário</DialogTitle>
          <DialogDescription>
            {formatScheduleConflictConfirmation(conflictingResources)}
          </DialogDescription>
        </DialogHeader>

        {requested ? (
          <div className="space-y-3 rounded-2xl border bg-muted/40 p-4 text-sm">
            <div>
              <p className="font-medium">Horário solicitado</p>
              <p className="text-muted-foreground">
                {formatAvailabilitySlot(requested.date, requested.time)}
              </p>
            </div>
            {suggested ? (
              <div>
                <p className="font-medium">Horário mais próximo disponível</p>
                <p className="text-muted-foreground">
                  {formatAvailabilitySlot(suggested.date, suggested.time)}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:flex-wrap sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={onCancel}
            disabled={busy}
          >
            Cancelar
          </Button>
          {suggested ? (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={onUseSuggested}
              disabled={busy}
            >
              Usar horário sugerido
            </Button>
          ) : null}
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={onContinue}
            disabled={busy}
          >
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
