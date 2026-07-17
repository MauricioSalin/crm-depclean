"use client"

import { useMemo, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { addCivilDaysKey, BRASILIA_TIME_ZONE, minutesFromBrasiliaDate, parseCivilDate, toCivilDateKey } from "@/lib/date-utils"

interface TimelineEvent {
  id: string
  title: string
  subtitle: string
  date: string
  time: string
  duration: number
  teamColor: string | null
  status: string
}

interface WeekTimelineProps {
  events: TimelineEvent[]
  currentDate: Date
  selectedDate: Date | null
  onDateChange: (date: Date) => void
  onDaySelect: (date: Date) => void
  onEventClick?: (eventId: string) => void
  onSlotClick?: (date: Date, time: string) => void
}

const HOUR_HEIGHT = 60 // px per hour
const START_HOUR = 0
const END_HOUR = 24
const TOTAL_HOURS = END_HOUR - START_HOUR
const LUNCH_HOUR = 12
const EVENT_COLUMN_GUTTER = 6
const EVENT_COLUMN_GAP = 4
const MIN_EVENT_HEIGHT = 54

const DAY_LABELS_SHORT = ["DOM.", "SEG.", "TER.", "QUA.", "QUI.", "SEX.", "SÁB."]

type PositionedTimelineEvent = TimelineEvent & {
  top: number
  height: number
  columnIndex: number
  columnCount: number
}

function getWeekDays(date: Date): Date[] {
  const key = toCivilDateKey(date)
  const [year, month, dayOfMonth] = key.split("-").map((value) => Number(value))
  const weekday = new Date(Date.UTC(year, (month || 1) - 1, dayOfMonth || 1)).getUTCDay()
  const weekStartKey = addCivilDaysKey(key, -weekday)
  return Array.from({ length: 7 }, (_, index) => parseCivilDate(addCivilDaysKey(weekStartKey, index)) ?? new Date())
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

function isToday(date: Date): boolean {
  return toCivilDateKey(date) === toCivilDateKey(new Date())
}

function getEventEndMinutes(event: TimelineEvent) {
  return timeToMinutes(event.time) + Math.max(15, event.duration)
}

function positionDayEvents(events: TimelineEvent[]): PositionedTimelineEvent[] {
  const sortedEvents = [...events].sort((left, right) => {
    const startDiff = timeToMinutes(left.time) - timeToMinutes(right.time)
    if (startDiff !== 0) return startDiff
    const durationDiff = right.duration - left.duration
    if (durationDiff !== 0) return durationDiff
    return left.title.localeCompare(right.title, "pt-BR", { sensitivity: "base" })
  })

  const groups: TimelineEvent[][] = []
  let currentGroup: TimelineEvent[] = []
  let currentGroupEnd = -1

  for (const event of sortedEvents) {
    const startMinutes = timeToMinutes(event.time)
    const endMinutes = getEventEndMinutes(event)

    if (currentGroup.length === 0 || startMinutes < currentGroupEnd) {
      currentGroup.push(event)
      currentGroupEnd = Math.max(currentGroupEnd, endMinutes)
      continue
    }

    groups.push(currentGroup)
    currentGroup = [event]
    currentGroupEnd = endMinutes
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup)
  }

  return groups.flatMap((group) => {
    const laneEnds: number[] = []
    const positioned = group.map((event) => {
      const startMinutes = timeToMinutes(event.time)
      const endMinutes = getEventEndMinutes(event)
      const top = ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT
      const height = Math.max((event.duration / 60) * HOUR_HEIGHT, MIN_EVENT_HEIGHT)
      let columnIndex = laneEnds.findIndex((laneEnd) => laneEnd <= startMinutes)

      if (columnIndex === -1) {
        columnIndex = laneEnds.length
        laneEnds.push(endMinutes)
      } else {
        laneEnds[columnIndex] = endMinutes
      }

      return {
        ...event,
        top: Math.max(top, 0),
        height,
        columnIndex,
        columnCount: 1,
      }
    })

    const columnCount = Math.max(1, laneEnds.length)
    return positioned.map((event) => ({ ...event, columnCount }))
  })
}

export function WeekTimeline({
  events,
  currentDate,
  selectedDate,
  onDateChange,
  onDaySelect,
  onEventClick,
  onSlotClick,
}: WeekTimelineProps) {
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate])
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeEventId, setActiveEventId] = useState<string | null>(null)

  // Auto-scroll to 06:00 on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 6 * HOUR_HEIGHT
    }
  }, [])

  const navigateWeek = (direction: number) => {
    const newDate = parseCivilDate(addCivilDaysKey(toCivilDateKey(currentDate), direction * 7)) ?? new Date()
    onDateChange(newDate)
  }

  const goToToday = () => {
    onDateChange(new Date())
  }

  const positionedEventsByDate = useMemo(() => {
    const map: Record<string, TimelineEvent[]> = {}
    for (const ev of events) {
      if (!map[ev.date]) map[ev.date] = []
      map[ev.date].push(ev)
    }

    return Object.fromEntries(
      Object.entries(map).map(([date, dayEvents]) => [date, positionDayEvents(dayEvents)]),
    ) as Record<string, PositionedTimelineEvent[]>
  }, [events])

  // Current time indicator
  const now = new Date()
  const nowMinutes = minutesFromBrasiliaDate(now)
  const nowOffset = ((nowMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT
  const showNowLine = nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60

  // Header with week range
  const weekStart = weekDays[0]
  const weekEnd = weekDays[6]
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const weekStartKey = toCivilDateKey(weekStart)
  const weekEndKey = toCivilDateKey(weekEnd)
  const headerLabel = weekStartKey.slice(5, 7) === weekEndKey.slice(5, 7)
    ? `${cap(weekStart.toLocaleDateString("pt-BR", { month: "long", timeZone: BRASILIA_TIME_ZONE }))} ${weekStartKey.slice(0, 4)}`
    : `${cap(weekStart.toLocaleDateString("pt-BR", { month: "short", timeZone: BRASILIA_TIME_ZONE }))} - ${cap(weekEnd.toLocaleDateString("pt-BR", { month: "short", timeZone: BRASILIA_TIME_ZONE }))} ${weekEndKey.slice(0, 4)}`

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Week navigation */}
      <div className="flex items-center justify-between px-2 py-2 border-b shrink-0">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateWeek(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateWeek(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium capitalize ml-2">{headerLabel}</span>
        </div>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={goToToday}>
          Hoje
        </Button>
      </div>

      {/* Day headers */}
      <div className="flex border-b shrink-0 overflow-y-scroll [&::-webkit-scrollbar]:invisible" style={{ scrollbarColor: 'transparent transparent' }}>
        {/* Time gutter spacer */}
        <div className="w-14 shrink-0" />
        {weekDays.map((day, i) => {
          const isSelected = selectedDate?.toDateString() === day.toDateString()
          const today = isToday(day)
          return (
            <button
              key={i}
              onClick={() => onDaySelect(day)}
              className={`flex-1 py-2 text-center cursor-pointer transition-colors hover:bg-muted/50 ${
                isSelected ? "bg-muted" : ""
              }`}
            >
              <div className="text-[10px] font-medium text-muted-foreground tracking-wider">
                {DAY_LABELS_SHORT[i]}
              </div>
              <div
                className={`text-base lg:text-xl font-medium mt-0.5 w-8 h-8 lg:w-10 lg:h-10 flex items-center justify-center mx-auto rounded-full ${
                  today
                    ? "bg-primary text-primary-foreground"
                    : isSelected
                    ? "bg-muted-foreground/20"
                    : ""
                }`}
              >
                {Number(toCivilDateKey(day).slice(8, 10))}
              </div>
            </button>
          )
        })}
      </div>

      {/* Timeline grid */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-scroll overflow-x-hidden">
        <div className="relative flex pt-2 pb-4">
          {/* Time labels */}
          <div className="w-14 shrink-0">
            {Array.from({ length: TOTAL_HOURS }, (_, i) => (
              <div
                key={i}
                className="relative text-right pr-2 text-xs text-muted-foreground"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="absolute -top-2 right-2">
                  {String(START_HOUR + i).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div className="flex flex-1 relative">
            {/* Horizontal hour lines */}
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                <div
                  key={i}
                  className="absolute left-0 right-0 border-t border-border/50"
                  style={{ top: i * HOUR_HEIGHT }}
                />
              ))}
            </div>

            {/* Now indicator line */}
            {showNowLine && (
              <div
                className="absolute left-0 right-0 z-20 pointer-events-none"
                style={{ top: nowOffset }}
              >
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                  <div className="flex-1 h-[2px] bg-red-500" />
                </div>
              </div>
            )}

            {weekDays.map((day, dayIndex) => {
              const dateStr = toCivilDateKey(day)
              const dayEvents = positionedEventsByDate[dateStr] || []
              const isSelected = selectedDate?.toDateString() === day.toDateString()

              return (
                <div
                  key={dayIndex}
                  onClick={() => onDaySelect(day)}
                  className={`flex-1 relative border-l border-border/50 cursor-pointer transition-colors ${
                    isSelected ? "bg-primary/5" : "hover:bg-muted/30"
                  }`}
                  style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}
                >
                  {Array.from({ length: TOTAL_HOURS }, (_, hourIndex) => {
                    const hour = START_HOUR + hourIndex
                    const time = `${String(hour).padStart(2, "0")}:00`

                    return (
                      <button
                        key={`${dateStr}-${time}`}
                        type="button"
                        className={`absolute left-0 right-0 z-0 border-0 transition-colors focus-visible:outline-none ${
                          hour === LUNCH_HOUR
                            ? "cursor-not-allowed bg-muted/45"
                            : "cursor-pointer bg-transparent hover:bg-primary/10 focus-visible:bg-primary/10"
                        }`}
                        style={{
                          top: hourIndex * HOUR_HEIGHT,
                          height: HOUR_HEIGHT,
                        }}
                        title={hour === LUNCH_HOUR ? "Horário de almoço" : `Novo agendamento em ${time}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          if (hour === LUNCH_HOUR) return
                          onDaySelect(day)
                          onSlotClick?.(day, time)
                        }}
                      />
                    )
                  })}
                  {dayEvents.map((ev) => {
                    const color = ev.teamColor || "#9CA3AF" // gray for no team
                    const isOverlapping = ev.columnCount > 1
                    const isActive = activeEventId === ev.id
                    const fixedWidth = EVENT_COLUMN_GUTTER * 2 + Math.max(0, ev.columnCount - 1) * EVENT_COLUMN_GAP
                    const columnWidthPercent = 100 / ev.columnCount
                    const columnWidthAdjustment = fixedWidth / ev.columnCount
                    const eventWidth = `calc(${columnWidthPercent}% - ${columnWidthAdjustment}px)`
                    const eventLeft = `calc(${columnWidthPercent * ev.columnIndex}% + ${
                      EVENT_COLUMN_GUTTER + ev.columnIndex * (EVENT_COLUMN_GAP - columnWidthAdjustment)
                    }px)`
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setActiveEventId(ev.id)
                          onEventClick?.(ev.id)
                          onDaySelect(day)
                        }}
                        onPointerDown={() => setActiveEventId(ev.id)}
                        onMouseEnter={() => setActiveEventId(ev.id)}
                        onMouseLeave={() => {
                          setActiveEventId((current) => (current === ev.id ? null : current))
                        }}
                        onFocus={() => setActiveEventId(ev.id)}
                        onBlur={() => {
                          setActiveEventId((current) => (current === ev.id ? null : current))
                        }}
                        className="group absolute flex min-w-0 cursor-pointer flex-col items-start justify-start gap-0.5 overflow-hidden rounded-md border border-transparent border-l-[3px] px-1.5 py-1 text-left transition-[box-shadow,background-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.015] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 active:scale-[0.99]"
                        style={{
                          top: ev.top,
                          left: eventLeft,
                          width: eventWidth,
                          height: ev.height,
                          zIndex: isActive ? 100 : 10 + ev.columnIndex,
                          backgroundColor: "#efefef",
                          borderColor: color,
                          borderLeftColor: color,
                          boxShadow: isActive
                            ? "0 16px 36px rgba(15, 23, 42, 0.22), 0 2px 6px rgba(15, 23, 42, 0.16)"
                            : isOverlapping
                            ? "0 6px 14px rgba(15, 23, 42, 0.10), 0 1px 2px rgba(15, 23, 42, 0.10)"
                            : "0 1px 2px rgba(15, 23, 42, 0.08)",
                        }}
                        title={`${ev.title} - ${ev.subtitle}`}
                      >
                        <p className="w-full min-w-0 truncate text-[10px] font-semibold leading-tight text-foreground/90">
                          {ev.title}
                        </p>
                        {ev.height > 30 && (
                          <p className="w-full min-w-0 truncate text-[9px] leading-tight text-foreground/70">
                            {ev.time} - {formatEndTime(ev.time, ev.duration)}
                          </p>
                        )}
                        {ev.height > 45 && (
                          <p className="w-full min-w-0 truncate text-[9px] leading-tight text-foreground/65">
                            {ev.subtitle}
                          </p>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function formatEndTime(startTime: string, durationMin: number): string {
  const totalMin = timeToMinutes(startTime) + durationMin
  const h = Math.floor(totalMin / 60) % 24
  const m = totalMin % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}
