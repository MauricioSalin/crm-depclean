"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Wrench, 
  UsersRound, 
  Calendar,
  CalendarClock, 
  BarChart3,
  Award,
  HelpCircle, 
  Bell,
  Bot
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { hasAnyPermission } from "@/lib/auth/permissions"
import { getStoredUser } from "@/lib/auth/session"
import { listCertificates } from "@/lib/api/certificates"
import { listNotifications } from "@/lib/api/notifications"
import { listSchedules } from "@/lib/api/schedules"
import { listTeams } from "@/lib/api/teams"
import { toCivilDateKey } from "@/lib/date-utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useSidebarCollapse } from "./sidebar-collapse-context"

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/", permissions: ["dashboard_view"] },
  { icon: Users, label: "Clientes", href: "/clientes", permissions: ["clients_view", "clients_create", "clients_edit", "clients_delete"] },
  { icon: FileText, label: "Contratos", href: "/contratos", permissions: ["contracts_view", "contracts_create", "contracts_edit", "contracts_delete"] },
  { icon: Wrench, label: "Serviços", href: "/servicos", permissions: ["services_view", "services_manage"] },
  { icon: UsersRound, label: "Equipes", href: "/equipes", permissions: ["teams_view", "teams_manage"] },
  { icon: Users, label: "Funcionários", href: "/funcionarios", permissions: ["employees_view", "employees_create", "employees_edit", "employees_delete"] },
  { icon: Calendar, label: "Agenda", href: "/agenda", permissions: ["agenda_own_view", "agenda_view", "agenda_manage"] },
  { icon: CalendarClock, label: "Agendamentos", href: "/agendamentos", permissions: ["agenda_own_view", "agenda_view", "agenda_manage"] },
  { icon: Award, label: "Certificados", href: "/certificados", permissions: ["certificates_view", "certificates_manage"] },
  { icon: BarChart3, label: "Relatórios", href: "/relatorios", permissions: ["reports_view", "reports_export", "financial_view", "financial_manage"] },
]

const generalItems = [
  { icon: Bell, label: "Notificações", href: "/notificacoes", permissions: [] },
  { icon: Bot, label: "DepAI", href: "/depai", permissions: ["depai_access"] },
  { icon: HelpCircle, label: "Ajuda", href: "/ajuda", permissions: [] },
]

const ACTIVE_AGENDA_BADGE_STATUSES = new Set(["scheduled", "in_progress", "rescheduled"])

function getTodayDateKey() {
  return toCivilDateKey(new Date())
}

interface SidebarProps {
  onNavigate?: () => void
  forceExpanded?: boolean
}

export function Sidebar({ onNavigate, forceExpanded = false }: SidebarProps) {
  const pathname = usePathname()
  const { collapsed: storedCollapsed } = useSidebarCollapse()
  const collapsed = forceExpanded ? false : storedCollapsed
  const showFullLogo = !collapsed
  const todayDateKey = getTodayDateKey()
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getStoredUser>>(null)
  const [showExpandedBadgeTone, setShowExpandedBadgeTone] = useState(!collapsed)

  useEffect(() => {
    const sync = () => setCurrentUser(getStoredUser())
    sync()
    window.addEventListener("storage", sync)
    window.addEventListener("depclean:session", sync)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("depclean:session", sync)
    }
  }, [])

  useEffect(() => {
    if (collapsed) {
      setShowExpandedBadgeTone(false)
      return
    }

    const timeout = window.setTimeout(() => setShowExpandedBadgeTone(true), 180)
    return () => window.clearTimeout(timeout)
  }, [collapsed])

  const canAccessPermissions = (permissions?: string[]) => {
    if (!permissions || permissions.length === 0) return true
    return hasAnyPermission(currentUser, permissions)
  }

  const schedulesQuery = useQuery({
    queryKey: ["schedules", "sidebar-agenda-count", todayDateKey],
    queryFn: () => listSchedules({ dateFrom: todayDateKey, dateTo: todayDateKey }),
    enabled: Boolean(currentUser?.employeeId && hasAnyPermission(currentUser, ["agenda_own_view", "agenda_view", "agenda_manage"])),
  })

  const teamsQuery = useQuery({
    queryKey: ["teams", "sidebar-agenda-count"],
    queryFn: () => listTeams(),
    enabled: Boolean(currentUser?.employeeId && hasAnyPermission(currentUser, ["teams_view", "teams_manage"])),
  })

  const certificatesQuery = useQuery({
    queryKey: ["certificates", "sidebar-pending-count"],
    queryFn: () => listCertificates(),
    enabled: Boolean(currentUser && hasAnyPermission(currentUser, ["certificates_view", "certificates_manage"])),
  })

  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: listNotifications,
    enabled: Boolean(currentUser),
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  })

  const agendaBadge = useMemo(() => {
    const employeeId = currentUser?.employeeId
    if (!employeeId) return null

    const activeSchedules = (schedulesQuery.data?.data ?? []).filter(
      (schedule) => schedule.date === todayDateKey && ACTIVE_AGENDA_BADGE_STATUSES.has(schedule.status),
    )
    const permissions = currentUser?.permissions ?? []
    const isScopedAgendaOnly =
      permissions.includes("agenda_own_view") &&
      !permissions.includes("agenda_view") &&
      !permissions.includes("agenda_manage") &&
      !permissions.includes("settings_manage")

    if (isScopedAgendaOnly) {
      return activeSchedules.length > 0 ? String(activeSchedules.length) : null
    }

    const userTeamIds = new Set(
      (teamsQuery.data?.data ?? [])
        .filter((team) => team.memberIds.includes(employeeId))
        .map((team) => team.id),
    )

    const assignedCount = activeSchedules.filter((schedule) => {
      const assignedAsEmployee = schedule.additionalEmployees.some((employee) => employee.id === employeeId)
      const assignedByTeam = schedule.teams.some((team) => userTeamIds.has(team.id))
      return assignedAsEmployee || assignedByTeam
    }).length

    return assignedCount > 0 ? String(assignedCount) : null
  }, [currentUser?.employeeId, currentUser?.permissions, schedulesQuery.data?.data, teamsQuery.data?.data, todayDateKey])

  const certificatesBadge = useMemo(() => {
    const pendingCount = (certificatesQuery.data?.data ?? []).filter((certificate) => certificate.status === "pending").length
    return pendingCount > 0 ? String(pendingCount) : null
  }, [certificatesQuery.data?.data])

  const notificationsBadge = useMemo(() => {
    const unreadCount = (notificationsQuery.data?.data ?? []).filter((notification) => !notification.isRead).length
    return unreadCount > 0 ? String(unreadCount) : null
  }, [notificationsQuery.data?.data])

  const renderNavItem = (item: (typeof menuItems)[number] | (typeof generalItems)[number], badge?: string | null) => {
    const isActive = item.href === "/" ? pathname === "/" : (pathname === item.href || pathname.startsWith(item.href + "/"))
    const itemContent = (
      <>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center">
          <item.icon className="h-4 w-4" />
        </span>
        <span
          className={cn(
            "min-w-0 whitespace-nowrap text-sm transition-[max-width,opacity] duration-300 ease-out",
            collapsed ? "max-w-0 overflow-hidden opacity-0" : "max-w-36 opacity-100",
          )}
        >
          {item.label}
        </span>
        {badge && (
          <span
            className={cn(
              "pointer-events-none absolute z-20 flex shrink-0 items-center justify-center rounded-full border-0 text-[10px] font-bold leading-none shadow-none transition-[background-color,color,height,min-width,padding,right,top,transform] duration-300 ease-out",
              collapsed ? "-right-1 -top-1 h-4 min-w-4 translate-y-0 px-1" : "right-2 top-1/2 h-5 min-w-5 -translate-y-1/2 px-1.5",
              isActive && showExpandedBadgeTone ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground",
            )}
          >
            {badge}
          </span>
        )}
      </>
    )

    const link = (
      <Link
        key={item.label}
        href={item.href}
        onClick={onNavigate}
        aria-label={item.label}
        className={cn(
          "relative flex h-9 items-center text-sm font-medium transition-[width,padding,color,background-color,box-shadow,border-radius] duration-300 ease-out",
          collapsed ? "w-9 rounded-full p-0" : cn("w-full rounded-lg", badge ? "pr-8" : "pr-2"),
          isActive
            ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
            : "text-foreground/70 hover:bg-secondary hover:text-foreground",
        )}
      >
        {itemContent}
      </Link>
    )

    if (!collapsed) return link

    return (
      <Tooltip key={item.label}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent
          side="right"
          align="center"
          sideOffset={12}
          className="z-[300] bg-primary text-primary-foreground shadow-none"
          arrowClassName="bg-primary fill-primary"
        >
          {item.label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <aside
      className={cn(
        "flex flex-col overflow-hidden border-r border-border bg-card transition-[width] duration-300 ease-out",
        forceExpanded ? "relative z-auto h-full" : "fixed left-0 top-0 z-[70] h-screen",
        collapsed ? "w-[72px]" : "w-60",
      )}
    >
      <div className="relative h-[86px] shrink-0">
        <Link
          href="/"
          className="absolute inset-0"
          aria-label="Ir para o Dashboard"
        >
          <span
            className={cn(
              "absolute left-[14px] top-[45px] h-12 w-[170px] -translate-y-1/2 overflow-hidden transition-opacity duration-150",
              showFullLogo ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <Image
              src="/logo-depclean.png"
              alt="Depclean Logo"
              width={170}
              height={52}
              className="h-auto w-[168px] max-w-none shrink-0 object-contain"
              priority
            />
          </span>
          <span
            className={cn(
              "absolute left-[14px] top-[41px] h-[42px] w-[42px] -translate-y-1/2 transition-opacity duration-150",
              showFullLogo ? "pointer-events-none opacity-0" : "opacity-100",
            )}
          >
            <Image
              src="/logo-depclean-d.png"
              alt="Depclean Logo"
              width={42}
              height={43}
              className="h-[43px] w-[42px] max-w-none shrink-0 object-contain"
              priority
            />
          </span>
        </Link>
      </div>

      <div className={cn("flex flex-1 flex-col overflow-y-auto pb-4 transition-[padding] duration-300 ease-out", collapsed ? "px-[16px]" : "px-4")}>
        <div>
          <p
            className={cn(
              "mb-2 h-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground",
              collapsed ? "opacity-0" : "opacity-100",
            )}
          >
            Menu
          </p>
          <nav className="space-y-0.5">
            {menuItems.map((item) => {
              if (!canAccessPermissions(item.permissions)) return null
              const badge =
                item.label === "Agenda"
                  ? agendaBadge
                  : item.label === "Certificados"
                    ? certificatesBadge
                    : item.label === "Notificações"
                      ? notificationsBadge
                      : null
              return renderNavItem(item, badge)
            })}
          </nav>
        </div>

        <div className="mt-6">
          <p
            className={cn(
              "mb-2 h-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground",
              collapsed ? "opacity-0" : "opacity-100",
            )}
          >
            Geral
          </p>
          <nav className="space-y-0.5">
            {generalItems.map((item) => {
              if (!canAccessPermissions(item.permissions)) return null
              const badge = item.label === "Notificações" ? notificationsBadge : null
              return renderNavItem(item, badge)
            })}
          </nav>
        </div>
      </div>
    </aside>
  )
}
