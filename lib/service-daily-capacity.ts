export function normalizeDailyScheduleLimitHours(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function legacyDailyScheduleLimitToHours(value: unknown): number | null {
  const parsed = Number(value)
  if (parsed === 1) return 8
  if (parsed === 2) return 16
  return null
}

export function resolveDailyScheduleLimitHours(
  dailyScheduleLimitHours: unknown,
  legacyDailyScheduleLimit?: unknown,
) {
  if (dailyScheduleLimitHours !== null && dailyScheduleLimitHours !== undefined && dailyScheduleLimitHours !== "") {
    return normalizeDailyScheduleLimitHours(dailyScheduleLimitHours)
  }
  return legacyDailyScheduleLimitToHours(legacyDailyScheduleLimit)
}
