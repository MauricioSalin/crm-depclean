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
import { getStoredUser } from "@/lib/auth/session"
import { listCertificates } from "@/lib/api/certificates"
import { listNotifications } from "@/lib/api/notifications"
import { listSchedules } from "@/lib/api/schedules"
import { listTeams } from "@/lib/api/teams"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useSidebarCollapse } from "./sidebar-collapse-context"

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Users, label: "Clientes", href: "/clientes" },
  { icon: FileText, label: "Contratos", href: "/contratos" },
  { icon: Wrench, label: "Serviços", href: "/servicos" },
  { icon: UsersRound, label: "Equipes", href: "/equipes" },
  { icon: Users, label: "Funcionários", href: "/funcionarios" },
  { icon: Calendar, label: "Agenda", href: "/agenda" },
  { icon: CalendarClock, label: "Agendamentos", href: "/agendamentos" },
  { icon: Award, label: "Certificados", href: "/certificados", permission: "certificates_view" },
  { icon: BarChart3, label: "Relatórios", href: "/relatorios" },
]

const generalItems = [
  { icon: Bell, label: "Notificações", href: "/notificacoes" },
  { icon: Bot, label: "DepAI", href: "/depai" },
  { icon: HelpCircle, label: "Ajuda", href: "/ajuda" },
]

interface SidebarProps {
  onNavigate?: () => void
  forceExpanded?: boolean
}

export function Sidebar({ onNavigate, forceExpanded = false }: SidebarProps) {
  const pathname = usePathname()
  const { collapsed: storedCollapsed } = useSidebarCollapse()
  const collapsed = forceExpanded ? false : storedCollapsed
  const showFullLogo = !collapsed
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getStoredUser>>(null)

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

  const canAccessPermission = (permission?: string) => {
    if (!permission) return true
    if (!currentUser) return true
    return (
      currentUser.permissions.includes(permission) ||
      currentUser.permissions.includes("certificates_manage") ||
      currentUser.permissions.includes("settings_manage")
    )
  }

  const schedulesQuery = useQuery({
    queryKey: ["schedules", "sidebar-agenda-count"],
    queryFn: () => listSchedules(),
    enabled: Boolean(currentUser?.employeeId),
  })

  const teamsQuery = useQuery({
    queryKey: ["teams", "sidebar-agenda-count"],
    queryFn: () => listTeams(),
    enabled: Boolean(currentUser?.employeeId),
  })

  const certificatesQuery = useQuery({
    queryKey: ["certificates", "sidebar-pending-count"],
    queryFn: () => listCertificates(),
    enabled: Boolean(currentUser && canAccessPermission("certificates_view")),
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

    const userTeamIds = new Set(
      (teamsQuery.data?.data ?? [])
        .filter((team) => team.memberIds.includes(employeeId))
        .map((team) => team.id),
    )

    const assignedCount = (schedulesQuery.data?.data ?? []).filter((schedule) => {
      const isActiveSchedule = schedule.status === "scheduled" || schedule.status === "in_progress"
      if (!isActiveSchedule) return false

      const assignedAsEmployee = schedule.additionalEmployees.some((employee) => employee.id === employeeId)
      const assignedByTeam = schedule.teams.some((team) => userTeamIds.has(team.id))
      return assignedAsEmployee || assignedByTeam
    }).length

    return assignedCount > 0 ? String(assignedCount) : null
  }, [currentUser?.employeeId, schedulesQuery.data?.data, teamsQuery.data?.data])

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
            "min-w-0 whitespace-nowrap text-sm",
            collapsed ? "max-w-0 overflow-hidden opacity-0" : "max-w-36 opacity-100",
          )}
        >
          {item.label}
        </span>
        {badge && (
          <span
            className={cn(
              "z-20 flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none shadow-sm",
              collapsed ? "absolute right-[-5px] top-[-5px] h-4 min-w-4 px-1" : "ml-auto mr-0.5 h-5 min-w-5 px-1.5",
              isActive
                ? "bg-primary-foreground text-primary"
                : "bg-primary text-primary-foreground",
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
          "relative flex h-9 items-center rounded-lg text-sm font-medium transition-colors duration-200",
          collapsed ? "w-9" : "w-full pr-2",
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
        "fixed left-0 top-0 z-[70] flex h-screen flex-col overflow-hidden border-r border-border bg-card transition-[width] duration-300 ease-out",
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
              if (!canAccessPermission(item.permission)) return null
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
              const badge = item.label === "Notificações" ? notificationsBadge : null
              return renderNavItem(item, badge)
            })}
          </nav>
        </div>
      </div>
    </aside>
  )
}
