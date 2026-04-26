"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type ServiceClausesDialogProps = {
  open: boolean
  title: string
  description?: string
  clauses: string[]
  clausePrefix?: string
  onOpenChange: (open: boolean) => void
}

export function ServiceClausesDialog({
  open,
  title,
  description,
  clauses,
  clausePrefix,
  onOpenChange,
}: ServiceClausesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {description ?(
            <div className="rounded-lg border p-3">
              <p className="text-sm font-semibold text-foreground">Descrição</p>
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            </div>
          ) : null}

          <div className="space-y-3">
            {clauses.length > 0 ?(
              clauses.map((clause, index) => (
                <div key={`${title}-${index}`} className="rounded-lg border p-3">
                  <p className="text-sm font-semibold">
                    {clausePrefix ?`${clausePrefix}.${index + 1}` : `${index + 1}`}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{clause}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma cláusula informada para este serviço.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
