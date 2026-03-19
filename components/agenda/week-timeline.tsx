"use client"

import { useMemo, useEffect, useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

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
}

const HOUR_HEIGHT = 60 // px per hour
const START_HOUR = 0
const END_HOUR = 24
const TOTAL_HOURS = END_HOUR - START_HOUR

const DAY_LABELS_SHORT = ["DOM.", "SEG.", "TER.", "QUA.", "QUI.", "SEX.", "SÁB."]

function getWeekDays(date: Date): Date[] {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day
  return Array.from({ length: 7 }, (_, i) => {
    const dayDate = new Date(d)
    dayDate.setDate(diff + i)
    return dayDate
  })
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

function isToday(date: Date): boolean {
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

export function WeekTimeline({
  events,
  currentDate,
  selectedDate,
  onDateChange,
  onDaySelect,
  onEventClick,
}: WeekTimelineProps) {
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate])
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to 06:00 on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 6 * HOUR_HEIGHT
    }
  }, [])

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + direction * 7)
    onDateChange(newDate)
  }

  const goToToday = () => {
    onDateChange(new Date())
  }

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, TimelineEvent[]> = {}
    for (const ev of events) {
      if (!map[ev.date]) map[ev.date] = []
      map[ev.date].push(ev)
    }
    return map
  }, [events])

  // Current time indicator
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const nowOffset = ((nowMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT
  const showNowLine = nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60

  // Header with week range
  const weekStart = weekDays[0]
  const weekEnd = weekDays[6]
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const headerLabel = weekStart.getMonth() === weekEnd.getMonth()
    ? `${cap(weekStart.toLocaleDateString("pt-BR", { month: "long" }))} ${weekStart.getFullYear()}`
    : `${cap(weekStart.toLocaleDateString("pt-BR", { month: "short" }))} - ${cap(weekEnd.toLocaleDateString("pt-BR", { month: "short" }))} ${weekEnd.getFullYear()}`

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
                {day.getDate()}
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
              const dateStr = day.toISOString().split("T")[0]
              const dayEvents = eventsByDate[dateStr] || []
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
                  {dayEvents.map((ev) => {
                    const startMinutes = timeToMinutes(ev.time)
                    const top = ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT
                    const height = Math.max((ev.duration / 60) * HOUR_HEIGHT, 20)
                    const color = ev.teamColor || "#9CA3AF" // gray for no team

                    return (
                      <div
                        key={ev.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          onEventClick?.(ev.id)
                          onDaySelect(day)
                        }}
                        className="absolute left-0.5 right-0.5 rounded-md px-1.5 py-0.5 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity z-10 border-l-[3px]"
                        style={{
                          top: Math.max(top, 0),
                          height,
                          backgroundColor: `${color}20`,
                          borderLeftColor: color,
                        }}
                        title={`${ev.title} - ${ev.subtitle}`}
                      >
                        <p className="text-[10px] font-medium text-foreground/80 truncate leading-tight">
                          {ev.title}
                        </p>
                        {height > 30 && (
                          <p className="text-[9px] text-muted-foreground truncate leading-tight">
                            {ev.time} - {formatEndTime(ev.time, ev.duration)}
                          </p>
                        )}
                        {height > 45 && (
                          <p className="text-[9px] text-muted-foreground truncate leading-tight">
                            {ev.subtitle}
                          </p>
                        )}
                      </div>
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
