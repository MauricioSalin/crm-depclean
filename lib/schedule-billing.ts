import type { ScheduleRecord } from "@/lib/api/schedules"

export function scheduleBillingItems(schedule: ScheduleRecord): NonNullable<ScheduleRecord["billingInstallments"]> {
  if (schedule.billingInstallments?.length) return schedule.billingInstallments
  return [{
    id: "", number: 1, value: schedule.value, dueDate: schedule.billingDueDate ?? schedule.date,
    status: schedule.billingStatus, effectiveStatus: schedule.effectiveBillingStatus,
    paidDate: schedule.paidDate, paidValue: schedule.paidValue,
  }]
}
