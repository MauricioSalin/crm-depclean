"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  /** Value in cents (integer) */
  value: number
  /** Callback with value in cents */
  onChange: (valueInCents: number) => void
}

/**
 * Brazilian bank-style currency input.
 * User types digits only, value fills from right to left.
 * Example: typing 1 2 3 4 5 → R$ 123,45
 */
const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, ...props }, ref) => {
    const formatDisplay = (cents: number): string => {
      const abs = Math.abs(cents)
      const reais = Math.floor(abs / 100)
      const centavos = abs % 100
      const reaisStr = reais.toLocaleString("pt-BR")
      return `R$ ${reaisStr},${String(centavos).padStart(2, "0")}`
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Allow navigation keys
      if (["Tab", "Escape", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return

      e.preventDefault()

      if (e.key === "Backspace" || e.key === "Delete") {
        onChange(Math.floor(value / 10))
        return
      }

      const digit = e.key
      if (/^\d$/.test(digit)) {
        const newValue = value * 10 + parseInt(digit)
        // Cap at 999.999.999,99 (99999999999 cents)
        if (newValue <= 99999999999) {
          onChange(newValue)
        }
      }
    }

    const handlePaste = (e: React.ClipboardEvent) => {
      e.preventDefault()
      const text = e.clipboardData.getData("text")
      const digits = text.replace(/\D/g, "")
      if (digits) {
        const parsed = parseInt(digits)
        if (parsed <= 99999999999) {
          onChange(parsed)
        }
      }
    }

    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={formatDisplay(value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onChange={() => {}} // controlled via keyDown
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        {...props}
      />
    )
  }
)
CurrencyInput.displayName = "CurrencyInput"

export { CurrencyInput }
