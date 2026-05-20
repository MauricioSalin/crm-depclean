"use client"

import type { ScheduleRecord } from "@/lib/api/schedules"
import { Badge } from "@/components/ui/badge"

type ScheduleTypeInput = Pick<ScheduleRecord, "contractId" | "isEmergency" | "isManual">

function getScheduleType(schedule: ScheduleTypeInput) {
  if (schedule.isEmergency) {
    return {
      label: "Emergencial",
      className: "bg-red-100 text-red-800 hover:bg-red-100",
    }
  }

  if (schedule.contractId && !schedule.isManual) {
    return {
      label: "Recorrente",
      className: "bg-primary/10 text-primary hover:bg-primary/10",
    }
  }

  return {
    label: "Avulso",
    className: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  }
}

export function ScheduleTypeBadge({ schedule }: { schedule: ScheduleTypeInput }) {
  const type = getScheduleType(schedule)

  return <Badge className={type.className}>{type.label}</Badge>
}
