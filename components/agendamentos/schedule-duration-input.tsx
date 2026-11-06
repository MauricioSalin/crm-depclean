import type { ComponentProps } from "react"
import { NumericInput } from "@/components/ui/numeric-input"

type ScheduleDurationInputProps = Omit<ComponentProps<typeof NumericInput>, "aria-describedby" | "className"> & {
  id: string
  unit: string
}

export function ScheduleDurationInput({ id, unit, ...props }: ScheduleDurationInputProps) {
  const unitId = `${id}-unit`

  return (
    <div className="relative">
      <NumericInput {...props} id={id} aria-describedby={unitId} className="pr-20" />
      <span id={unitId} className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm">
        {unit}
      </span>
    </div>
  )
}
