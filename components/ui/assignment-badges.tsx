import { Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn, getColorFromClass } from "@/lib/utils"

type AssignmentTeam = {
  id: string
  name: string
  color?: string | null
}

type AssignmentEmployee = {
  id: string
  name: string
}

interface AssignmentBadgesProps {
  teams?: AssignmentTeam[]
  employees?: AssignmentEmployee[]
  emptyLabel?: string
  className?: string
}

export function AssignmentBadges({
  teams = [],
  employees = [],
  emptyLabel = "Não definida",
  className,
}: AssignmentBadgesProps) {
  if (teams.length === 0 && employees.length === 0) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Users className="h-4 w-4" />
        <span>{emptyLabel}</span>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {teams.map((team) => {
        const color = getColorFromClass(team.color || "")

        return (
          <Badge
            key={team.id}
            variant="secondary"
            className="flex items-center gap-2 px-3 py-1 text-xs text-foreground/80"
            style={{ backgroundColor: `${color}1A` }}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            {team.name}
          </Badge>
        )
      })}

      {employees.map((employee) => (
        <Badge key={employee.id} variant="outline" className="px-3 py-1 text-xs">
          {employee.name}
        </Badge>
      ))}
    </div>
  )
}
