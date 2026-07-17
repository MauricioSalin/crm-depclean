"use client"

import { forwardRef, useImperativeHandle, useRef, type InputHTMLAttributes } from "react"
import { Search, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type FilterSearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: string
  onValueChange: (value: string) => void
  onClear?: () => void
  wrapperClassName?: string
  clearLabel?: string
}

export const FilterSearchInput = forwardRef<HTMLInputElement, FilterSearchInputProps>(
  ({ value, onValueChange, onClear, wrapperClassName, clearLabel = "Limpar busca", className, disabled, readOnly, ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement | null>(null)

    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

    const clear = () => {
      onValueChange("")
      onClear?.()
      window.requestAnimationFrame(() => inputRef.current?.focus())
    }

    return (
      <div className={cn("relative focus-within:z-[70]", wrapperClassName)}>
        <Search className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value}
          disabled={disabled}
          readOnly={readOnly}
          onChange={(event) => onValueChange(event.target.value)}
          className={cn("pl-10 pr-9", className)}
          {...props}
        />

        {value && !disabled && !readOnly ? (
          <button
            type="button"
            aria-label={clearLabel}
            className="absolute right-2 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={clear}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    )
  },
)

FilterSearchInput.displayName = "FilterSearchInput"
