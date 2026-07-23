"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface SearchableSelectProps {
  id?: string
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string; icon?: React.ReactNode }[]
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  allLabel?: string
  includeAll?: boolean
  className?: string
  disabled?: boolean
}

export function SearchableSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhum resultado.",
  allLabel = "Todos",
  includeAll = true,
  className,
  disabled = false,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const selectionInProgressRef = React.useRef<string | null>(null)

  const allOptions = React.useMemo(
    () => includeAll ? [{ value: "all", label: allLabel }, ...options] : options,
    [allLabel, includeAll, options],
  )
  const selectedOption = React.useMemo(
    () => allOptions.find(o => o.value === value),
    [allOptions, value],
  )
  const selectOption = React.useCallback((nextValue: string) => {
    if (selectionInProgressRef.current === nextValue) return

    selectionInProgressRef.current = nextValue
    onValueChange(nextValue)
    setOpen(false)
    queueMicrotask(() => {
      if (selectionInProgressRef.current === nextValue) {
        selectionInProgressRef.current = null
      }
    })
  }, [onValueChange])

  return (
    <Popover open={disabled ? false : open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={!disabled && open}
          disabled={disabled}
          className={cn(
            "justify-between font-normal h-9 text-sm",
            !value || value === "all" ? "text-muted-foreground" : "",
            disabled ? "cursor-not-allowed opacity-60" : "",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selectedOption?.icon}
            <span className="truncate">{selectedOption?.label || placeholder}</span>
          </span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {allOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.value}`}
                  className="cursor-pointer"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    selectOption(option.value)
                  }}
                  onSelect={() => selectOption(option.value)}
                >
                  {option.icon}
                  {option.label}
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
