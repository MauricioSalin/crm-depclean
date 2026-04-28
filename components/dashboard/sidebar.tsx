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
  DollarSign,
  BarChart3,
  Award,
  Settings, 
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
  { icon: DollarSign, label: "Financeiro", href: "/financeiro" },
  { icon: BarChart3, label: "Relatórios", href: "/relatorios" },
  { icon: Award, label: "Certificados", href: "/certificados", permission: "certificates_view" },
  { icon: Bell, label: "Notificações", badge: "2", href: "/notificacoes" },
]

const generalItems = [
  { icon: Bot, label: "DepAI", href: "/depai" },
  { icon: Settings, label: "Configurações", href: "/configuracoes" },
  { icon: HelpCircle, label: "Ajuda", href: "/ajuda" },
]

const SIDEBAR_TRANSITION_MS = 320

interface SidebarProps {
  onNavigate?: () => void
  forceExpanded?: boolean
}

export function Sidebar({ onNavigate, forceExpanded = false }: SidebarProps) {
  const pathname = usePathname()
  const { collapsed: storedCollapsed } = useSidebarCollapse()
  const collapsed = forceExpanded ? false : storedCollapsed
  const [showExpandedLogo, setShowExpandedLogo] = useState(!collapsed)
  const [showExpandedBadges, setShowExpandedBadges] = useState(!collapsed)
  const showFullLogo = !collapsed && showExpandedLogo
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getStoredUser>>(null)

  useEffect(() => {
    if (collapsed) {
      setShowExpandedLogo(false)
      setShowExpandedBadges(false)
      return
    }

    const timeout = window.setTimeout(() => {
      setShowExpandedLogo(true)
      setShowExpandedBadges(true)
    }, SIDEBAR_TRANSITION_MS)
    return () => window.clearTimeout(timeout)
  }, [collapsed])

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

  const renderNavItem = (item: (typeof menuItems)[number] | (typeof generalItems)[number], badge?: string | null) => {
    const isActive = item.href === "/" ? pathname === "/" : (pathname === item.href || pathname.startsWith(item.href + "/"))
    const itemContent = (
      <>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center">
          <item.icon className="h-4 w-4" />
        </span>
        <span
          className={cn(
            "min-w-0 whitespace-nowrap text-sm transition-[opacity,max-width,transform] duration-200 ease-out",
            collapsed ? "max-w-0 translate-x-1 overflow-hidden opacity-0" : "max-w-36 translate-x-0 opacity-100",
          )}
        >
          {item.label}
        </span>
        {badge && (
          <span
            className={cn(
              "z-20 flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none shadow-sm transition-all duration-200",
              collapsed ? "absolute right-[-5px] top-[-5px] h-4 min-w-4 px-1" : "ml-auto mr-0.5 h-5 min-w-5 px-1.5",
              !collapsed && (showExpandedBadges ? "scale-100 opacity-100" : "pointer-events-none scale-75 opacity-0"),
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
          "relative flex h-9 items-center rounded-lg text-sm font-medium transition-[width,background-color,color,box-shadow] duration-300 ease-out",
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
        "fixed left-0 top-0 z-[70] flex h-screen flex-col border-r border-border bg-card transition-[width] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]",
        collapsed ? "w-[72px]" : "w-60",
      )}
    >
      <div className={`flex h-[86px] shrink-0 items-center justify-start px-[14px] justify-center items-center`}>
        <Link href="/" className={cn("flex h-12 items-center", showFullLogo ? "w-[170px]" : "w-[42px]")}>
          {showFullLogo ? (
            <Image
              src="/logo-depclean.png"
              alt="Depclean Logo"
              width={170}
              height={52}
              className="h-auto w-[168px] object-contain"
              priority
            />
          ) : (
            <Image
              src="/logo-depclean-d.png"
              alt="Depclean Logo"
              width={42}
              height={43}
              className="h-[43px] w-[42px] object-contain"
              priority
            />
          )}
        </Link>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-4">
        <div>
          <p
            className={cn(
              "mb-2 h-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground transition-opacity duration-200",
              collapsed ? "opacity-0" : "opacity-100",
            )}
          >
            Menu
          </p>
          <nav className="space-y-0.5">
            {menuItems.map((item) => {
              if (!canAccessPermission(item.permission)) return null
              const badge = item.label === "Agenda" ? agendaBadge : item.label === "Certificados" ? certificatesBadge : item.badge
              return renderNavItem(item, badge)
            })}
          </nav>
        </div>

        <div className="mt-6">
          <p
            className={cn(
              "mb-2 h-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground transition-opacity duration-200",
              collapsed ? "opacity-0" : "opacity-100",
            )}
          >
            Geral
          </p>
          <nav className="space-y-0.5">
            {generalItems.map((item) => {
              return renderNavItem(item)
            })}
          </nav>
        </div>
      </div>
    </aside>
  )
}
