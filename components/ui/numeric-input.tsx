"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"

type NumericInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "inputMode" | "onChange" | "type" | "value"
> & {
  allowDecimal?: boolean
  allowEmpty?: boolean
  onEmpty?: () => void
  onValueChange: (value: number) => void
  value: number | string | null | undefined
}

function toNumericText(value: NumericInputProps["value"]) {
  return value === null || value === undefined ? "" : String(value)
}

function sanitizeNumericText(value: string, allowDecimal: boolean) {
  if (!allowDecimal) return value.replace(/\D/g, "")

  const sanitized = value.replace(/[^\d.,]/g, "")
  const separatorIndex = sanitized.search(/[.,]/)
  if (separatorIndex < 0) return sanitized

  const integerPart = sanitized.slice(0, separatorIndex)
  const separator = sanitized[separatorIndex]
  const decimalPart = sanitized.slice(separatorIndex + 1).replace(/[.,]/g, "")
  return `${integerPart}${separator}${decimalPart}`
}

function parseNumericText(value: string) {
  if (!value || value === "." || value === ",") return null
  const parsed = Number(value.replace(",", "."))
  return Number.isFinite(parsed) ? parsed : null
}

function parseBound(value: string | number | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  (
    {
      allowDecimal = false,
      allowEmpty = false,
      max,
      min,
      onBlur,
      onEmpty,
      onFocus,
      onValueChange,
      value,
      ...props
    },
    ref,
  ) => {
    const [draft, setDraft] = React.useState(() => toNumericText(value))
    const focusedRef = React.useRef(false)
    const valueRef = React.useRef(value)

    React.useEffect(() => {
      valueRef.current = value
      if (!focusedRef.current) setDraft(toNumericText(value))
    }, [value])

    const minimum = parseBound(min)
    const maximum = parseBound(max)

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextDraft = sanitizeNumericText(event.target.value, allowDecimal)
      setDraft(nextDraft)

      if (!nextDraft) {
        if (allowEmpty) onEmpty?.()
        return
      }

      const parsed = parseNumericText(nextDraft)
      if (parsed === null) return
      if (minimum !== undefined && parsed < minimum) return
      if (maximum !== undefined && parsed > maximum) return
      onValueChange(parsed)
    }

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      focusedRef.current = false
      const parsed = parseNumericText(draft)

      if (parsed === null && allowEmpty) {
        setDraft("")
        onEmpty?.()
        onBlur?.(event)
        return
      }

      const fallback = parseNumericText(toNumericText(valueRef.current)) ?? minimum ?? 0
      const normalized = Math.min(
        maximum ?? Number.POSITIVE_INFINITY,
        Math.max(minimum ?? Number.NEGATIVE_INFINITY, parsed ?? fallback),
      )

      setDraft(String(normalized))
      onValueChange(normalized)
      onBlur?.(event)
    }

    return (
      <Input
        {...props}
        ref={ref}
        type="tel"
        inputMode={allowDecimal ? "decimal" : "numeric"}
        min={min}
        max={max}
        value={draft}
        onChange={handleChange}
        onFocus={(event) => {
          focusedRef.current = true
          onFocus?.(event)
        }}
        onBlur={handleBlur}
      />
    )
  },
)

NumericInput.displayName = "NumericInput"

export { NumericInput }
