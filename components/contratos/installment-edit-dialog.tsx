"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { CurrencyInput } from "@/components/ui/currency-input"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type {
  ContractInstallmentRecord,
  UpdateContractInstallmentPayload,
} from "@/lib/api/contracts"
import { parseCivilDate, toCivilDateKey } from "@/lib/date-utils"

type InstallmentEditDialogProps = {
  installment: ContractInstallmentRecord | null
  open: boolean
  isSaving: boolean
  onOpenChange: (open: boolean) => void
  onSave: (payload: UpdateContractInstallmentPayload) => void
}

function civilDateKey(value?: string) {
  const parsed = parseCivilDate(value)
  return parsed ? toCivilDateKey(parsed) : ""
}

export function InstallmentEditDialog({
  installment,
  open,
  isSaving,
  onOpenChange,
  onSave,
}: InstallmentEditDialogProps) {
  const [paidDate, setPaidDate] = useState("")
  const [status, setStatus] = useState<ContractInstallmentRecord["status"]>("pending")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open || !installment) return
    setPaidDate(civilDateKey(installment.paidDate))
    setStatus(installment.status)
    setError("")
  }, [installment, open])

  const handleStatusChange = (nextStatus: ContractInstallmentRecord["status"]) => {
    setStatus(nextStatus)
    setError("")
    if (nextStatus === "paid" && !paidDate) {
      setPaidDate(toCivilDateKey(new Date()))
    }
    if (nextStatus !== "paid") {
      setPaidDate("")
    }
  }

  const handleSave = () => {
    if (!installment) return
    if (status === "paid" && !paidDate) {
      setError("Informe a data de pagamento.")
      return
    }

    onSave({
      status,
      paidDate: status === "paid" ? paidDate : undefined,
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSaving) onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar parcela {installment?.number ?? ""}</DialogTitle>
          <DialogDescription>
            Altere a data de pagamento e o status. Vencimento e valor são dados contratuais.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Vencimento</Label>
              <DatePicker
                value={parseCivilDate(installment?.dueDate)}
                ariaLabel="Vencimento da parcela"
                placeholder="Selecione o vencimento"
                disabled
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="installment-edit-value">Valor</Label>
              <CurrencyInput
                id="installment-edit-value"
                value={Math.round(Number(installment?.value ?? 0) * 100)}
                onChange={() => undefined}
                disabled
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Data do pagamento</Label>
              <DatePicker
                value={parseCivilDate(paidDate)}
                ariaLabel="Data de pagamento da parcela"
                onChange={(date) => {
                  setPaidDate(date ? toCivilDateKey(date) : "")
                  setError("")
                }}
                placeholder={status === "paid" ? "Selecione o pagamento" : "Disponível quando paga"}
                disabled={isSaving || status !== "paid"}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="installment-edit-status">Status</Label>
              <Select
                value={status}
                onValueChange={(value: ContractInstallmentRecord["status"]) => handleStatusChange(value)}
                disabled={isSaving}
              >
                <SelectTrigger id="installment-edit-status" className="w-full">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Paga</SelectItem>
                  <SelectItem value="late">Atrasada</SelectItem>
                  <SelectItem value="overdue">Vencida</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving || !installment}>
            {isSaving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
