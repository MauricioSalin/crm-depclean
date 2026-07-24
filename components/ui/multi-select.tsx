"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn, getColorFromClass } from "@/lib/utils"
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
import { Badge } from "@/components/ui/badge"

export interface MultiSelectOption {
  id: string
  name: string
  subtitle?: string
  color?: string
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  className?: string
  showSelectedTags?: boolean
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Selecionar...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhum item encontrado.",
  className,
  showSelectedTags = true,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState("")

  const filteredOptions = options.filter(
    (option) =>
      option.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.subtitle?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const toggleOption = (optionId: string) => {
    if (selected.includes(optionId)) {
      onChange(selected.filter((id) => id !== optionId))
    } else {
      onChange([...selected, optionId])
    }
  }

  const removeOption = (optionId: string) => {
    onChange(selected.filter((id) => id !== optionId))
  }

  const selectedOptions = options.filter((option) => selected.includes(option.id))

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="text-muted-foreground">{placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput
              placeholder={searchPlaceholder}
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.name}
                    onSelect={() => toggleOption(option.id)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selected.includes(option.id) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.color ? (
                      <span
                        className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: getColorFromClass(option.color) }}
                        aria-hidden="true"
                      />
                    ) : null}
                    <div className="flex flex-col">
                      <span>{option.name}</span>
                      {option.subtitle && (
                        <span className="text-sm text-muted-foreground">
                          {option.subtitle}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {showSelectedTags && selectedOptions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedOptions.map((option) => {
            const hasColor = Boolean(option.color)
            const resolvedColor = option.color ? getColorFromClass(option.color) : undefined

            return (
              <Badge
                key={option.id}
                variant={hasColor ? "secondary" : "outline"}
                className="flex items-center gap-2 px-3 py-1 text-foreground/80"
                style={hasColor ? { backgroundColor: `${resolvedColor}1A` } : undefined}
              >
                {hasColor ? (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: resolvedColor }}
                  />
                ) : null}
                <span>{option.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 shrink-0 rounded-full p-0 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                  onClick={() => removeOption(option.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )
          })}
        </div>
      )}
    </div>
  )
}
