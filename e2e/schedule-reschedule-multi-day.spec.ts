import { expect, test } from "@playwright/test"

import type { ScheduleRecord } from "../lib/api/schedules"
import {
  getAvailableRescheduleTimes,
  getScheduleRescheduleDurationConfig,
  getScheduleRescheduleIgnoredIds,
} from "../lib/schedule-availability"

function schedule(input: Partial<ScheduleRecord> & Pick<ScheduleRecord, "id" | "date">): ScheduleRecord {
  return {
    contractId: null,
    contractServiceId: null,
    contractServiceIds: [],
    isManual: true,
    isClientDelinquent: false,
    clientId: "client-1",
    clientName: "Cliente",
    unitId: "unit-1",
    unitName: "Unidade",
    address: "Endereço",
    serviceTypeId: "service-1",
    serviceTypeIds: ["service-1"],
    serviceTypeName: "Serviço",
    serviceDocumentSettings: [],
    informativeTemplateId: "",
    certificateTemplateId: "",
    autoSendInformative: false,
    generateCertificateRequest: false,
    teams: [],
    additionalEmployees: [{ id: "employee-1", name: "Técnico" }],
    time: "08:00",
    duration: 480,
    durationValue: 1,
    durationType: "days",
    status: "scheduled",
    recurrence: { type: "none", daysOfWeek: [], interval: 1 },
    billable: false,
    value: 0,
    billingStatus: "cancelled",
    effectiveBillingStatus: "cancelled",
    notes: "",
    isEmergency: false,
    naAttachments: [],
    createdAt: "2026-08-18T12:00:00.000Z",
    updatedAt: "2026-08-18T12:00:00.000Z",
    ...input,
  }
}

test("o primeiro dia valida e ignora o grupo inteiro no reagendamento", () => {
  const group = [1, 2, 3].map((index) => schedule({
    id: index === 1 ? "schedule-group" : `schedule-group-day-${index}`,
    date: `2026-08-${String(18 + index).padStart(2, "0")}`,
    multiDayGroupId: "schedule-group",
    multiDayIndex: index,
    multiDayTotal: 3,
  }))
  const main = group[0]!

  expect(getScheduleRescheduleDurationConfig(main)).toEqual({ duration: 3, durationType: "days" })
  expect(getScheduleRescheduleIgnoredIds(group, main)).toEqual(group.map((item) => item.id))
})

test("um dia derivado valida somente a própria duração de um dia", () => {
  const child = schedule({
    id: "schedule-group-day-2",
    date: "2026-08-20",
    multiDayGroupId: "schedule-group",
    multiDayIndex: 2,
    multiDayTotal: 3,
  })

  expect(getScheduleRescheduleDurationConfig(child)).toEqual({ duration: 1, durationType: "days" })
  expect(getScheduleRescheduleIgnoredIds([child], child)).toEqual([child.id])
})

test("o primeiro dia considera conflito em qualquer dia futuro do grupo", () => {
  const main = schedule({
    id: "schedule-group",
    date: "2026-08-19",
    multiDayGroupId: "schedule-group",
    multiDayIndex: 1,
    multiDayTotal: 3,
  })
  const child = schedule({
    id: "schedule-group-day-2",
    date: "2026-08-20",
    multiDayGroupId: "schedule-group",
    multiDayIndex: 2,
    multiDayTotal: 3,
  })
  const externalConflict = schedule({ id: "schedule-external", date: "2026-08-25" })

  expect(getAvailableRescheduleTimes({
    schedules: [main, child, externalConflict],
    teams: [],
    schedule: main,
    date: "2026-08-24",
    now: new Date("2026-08-18T12:00:00-03:00"),
    startMinutes: 8 * 60,
    endMinutes: 8 * 60 + 1,
    mode: "manual",
  })).toEqual([])

  expect(getAvailableRescheduleTimes({
    schedules: [main, child, externalConflict],
    teams: [],
    schedule: child,
    date: "2026-08-24",
    now: new Date("2026-08-18T12:00:00-03:00"),
    startMinutes: 8 * 60,
    endMinutes: 8 * 60 + 1,
    mode: "manual",
  })).toEqual(["08:00"])
})
