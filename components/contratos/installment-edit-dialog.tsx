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
  installment: Pick<ContractInstallmentRecord, "id" | "number" | "value" | "dueDate" | "paidDate" | "status"> | null
  open: boolean
  isSaving: boolean
  valueEditable?: boolean
  title?: string
  onOpenChange: (open: boolean) => void
  onSave: (payload: UpdateContractInstallmentPayload, value?: number) => void
}

function civilDateKey(value?: string) {
  const parsed = parseCivilDate(value)
  return parsed ? toCivilDateKey(parsed) : ""
}

export function InstallmentEditDialog({
  installment,
  open,
  isSaving,
  valueEditable = false,
  title,
  onOpenChange,
  onSave,
}: InstallmentEditDialogProps) {
  const [dueDate, setDueDate] = useState("")
  const [paidDate, setPaidDate] = useState("")
  const [valueCents, setValueCents] = useState(0)
  const [status, setStatus] = useState<ContractInstallmentRecord["status"]>("pending")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open || !installment) return
    setDueDate(civilDateKey(installment.dueDate))
    setPaidDate(civilDateKey(installment.paidDate))
    setValueCents(Math.round(Number(installment.value ?? 0) * 100))
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
    if (!dueDate) {
      setError("Informe a data de vencimento.")
      return
    }
    if (valueEditable && valueCents <= 0) {
      setError("Informe um valor maior que zero.")
      return
    }
    if (status === "paid" && !paidDate) {
      setError("Informe a data de pagamento.")
      return
    }

    onSave(
      {
        dueDate,
        status,
        paidDate: status === "paid" ? paidDate : undefined,
      },
      valueEditable ? valueCents / 100 : undefined,
    )
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
          <DialogTitle>{title ?? `Editar parcela ${installment?.number ?? ""}`}</DialogTitle>
          <DialogDescription>
            {valueEditable
              ? "Altere o valor, o vencimento, a data de pagamento e o status da cobrança do agendamento."
              : "Altere o vencimento, a data de pagamento e o status. O valor é um dado contratual."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Vencimento</Label>
              <DatePicker
                value={parseCivilDate(dueDate)}
                ariaLabel="Vencimento da parcela"
                onChange={(date) => {
                  setDueDate(date ? toCivilDateKey(date) : "")
                  setError("")
                }}
                placeholder="Selecione o vencimento"
                disabled={isSaving}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="installment-edit-value">Valor</Label>
              <CurrencyInput
                id="installment-edit-value"
                value={valueCents}
                onChange={(cents) => {
                  setValueCents(cents)
                  setError("")
                }}
                disabled={isSaving || !valueEditable}
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
