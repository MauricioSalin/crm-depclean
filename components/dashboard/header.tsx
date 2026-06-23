"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bell, User, FileText, History, LogOut, ChevronDown, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MobileNav } from "./mobile-nav"
import { Badge } from "@/components/ui/badge"
import { GlobalSearch } from "./global-search"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SwipeableNotification } from "./swipeable-notification"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { ReactNode } from "react"
import { listNotifications, markNotificationAsRead } from "@/lib/api/notifications"
import { getApiErrorMessage } from "@/lib/api/errors"
import { hasAnyPermission } from "@/lib/auth/permissions"
import { clearSession, getStoredAccessToken, getStoredUser } from "@/lib/auth/session"
import { resolveAvatarUrl } from "@/lib/avatar"
import { buildPathWithSearchParams } from "@/lib/navigation"
import { getNotificationHref } from "@/lib/notification-navigation"
import { setMobileFiltersOpen as notifyMobileFiltersOpen } from "@/lib/hooks/use-mobile-filters"
import { useSidebarCollapse } from "./sidebar-collapse-context"

interface HeaderProps {
  title: string
  description: string
  titleAddon?: ReactNode
  headerActions?: ReactNode
  actions?: ReactNode
  viewToggle?: ReactNode
  filters?: ReactNode
  hasFilters?: boolean
  showDivider?: boolean
}

const getNotificationDotColor = (type: string) => {
  const colorMap: Record<string, string> = {
    emergency: "bg-red-500",
    payment_overdue: "bg-orange-500",
    payment_due: "bg-yellow-500",
    contract_expiring: "bg-purple-500",
    new_schedule: "bg-blue-500",
    schedule_assigned: "bg-blue-500",
    schedule_unassigned: "bg-gray-500",
    schedule_change: "bg-blue-500",
    schedule_cancel: "bg-gray-500",
    daily_services: "bg-blue-500",
    contract_signature: "bg-emerald-500",
    informative: "bg-emerald-500",
    certificate: "bg-emerald-500",
    certificate_ready: "bg-emerald-500",
  }
  return colorMap[type] || "bg-primary"
}

export function Header({ title, description, titleAddon, headerActions, actions, viewToggle, filters, hasFilters = false, showDivider = false }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentHref = buildPathWithSearchParams(pathname, searchParams)
  const queryClient = useQueryClient()
  const { collapsed, toggleCollapsed } = useSidebarCollapse()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getStoredUser>>(null)
  const [hasSession, setHasSession] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: listNotifications,
    enabled: mounted && hasSession,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })
  const notifs = notificationsQuery.data?.data ?? []
  const unreadNotifications = notifs.filter((n) => !n.isRead)
  const effectiveHeaderActions = headerActions ?? actions
  const canViewTemplates = hasAnyPermission(currentUser, ["templates_view", "templates_manage"])
  const canViewSettings = hasAnyPermission(currentUser, ["settings_view", "settings_manage"])
  const canViewLogs = hasAnyPermission(currentUser, ["logs_view", "logs_manage"])
  const markAsReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Não foi possível marcar a notificação como lida."))
    },
  })

  useEffect(() => {
    setMounted(true)
    setMobileFiltersOpen(false)
    notifyMobileFiltersOpen(false)
    const sync = () => {
      setCurrentUser(getStoredUser())
      setHasSession(Boolean(getStoredAccessToken()))
    }
    sync()
    window.addEventListener("storage", sync)
    window.addEventListener("depclean:session", sync)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("depclean:session", sync)
    }
  }, [])

  const markAsRead = (id: string) => {
    markAsReadMutation.mutate(id)
  }

  const setMobileFiltersState = (open: boolean) => {
    setMobileFiltersOpen(open)
    notifyMobileFiltersOpen(open)
  }

  const openNotification = (notification: (typeof notifs)[number]) => {
    if (!notification.isRead) {
      markAsRead(notification.id)
    }
    router.push(getNotificationHref(notification, currentHref))
  }

  const handleLogout = () => {
    setUserMenuOpen(false)
    setIsLoggingOut(true)
    clearSession()
    queryClient.clear()
    router.replace("/login")
  }

  return (
    <>
      <div className="h-[68px] shrink-0" aria-hidden="true" />
      <div className={`fixed inset-x-0 top-0 z-[80] border-b border-transparent bg-background/95 px-3 pb-4 pt-4 backdrop-blur-sm md:px-4 lg:left-60 lg:px-5 ${showDivider ? "[&:not(:first-child)]:border-border/50" : ""}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            {mounted ? <MobileNav /> : <div className="h-9 w-9 shrink-0" aria-hidden="true" />}

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-ml-1 hidden h-8 w-8 shrink-0 rounded-lg text-muted-foreground/55 transition-colors duration-200 hover:bg-secondary/60 hover:text-muted-foreground lg:inline-flex"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Abrir menu" : "Recolher menu"}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>

            <GlobalSearch />
          </div>

          <div className="flex items-center gap-1.5 md:gap-2">
            {mounted && hasSession && !isLoggingOut ? (
              <>
                <DropdownMenu onOpenChange={(open) => {
                  if (open) void notificationsQuery.refetch()
                }}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative h-8 w-8 transition-all duration-300 hover:scale-110 hover:bg-secondary"
                    >
                      <Bell className="w-4 h-4" />
                      {unreadNotifications.length > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                          {unreadNotifications.length}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    collisionPadding={12}
                    className="w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] overflow-hidden sm:w-80 sm:max-w-[calc(100vw-2rem)]"
                  >
                    <DropdownMenuLabel className="flex items-center justify-between px-4">
                      <span>Notificações</span>
                      <Badge variant="secondary" className="text-xs">
                        {unreadNotifications.length} novas
                      </Badge>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {unreadNotifications.length === 0 && (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        Nenhuma notificação pendente
                      </div>
                    )}
                    {unreadNotifications.slice(0, 5).map((notification) => (
                      <SwipeableNotification
                        key={notification.id}
                        isRead={notification.isRead}
                        onMarkRead={() => markAsRead(notification.id)}
                      >
                        <DropdownMenuItem
                          key={notification.id}
                          className="flex flex-col items-start gap-1 cursor-pointer py-2.5 pl-4 pr-6"
                          onSelect={() => openNotification(notification)}
                        >
                          <div className="flex w-full min-w-0 items-center gap-2 pr-1">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${getNotificationDotColor(notification.type)} ${
                                notification.isRead ? "opacity-40" : "opacity-100"
                              }`}
                            />
                            <span className={`min-w-0 font-medium text-sm ${notification.isRead ? "text-muted-foreground" : "text-foreground"}`}>
                              {notification.title}
                            </span>
                          </div>
                          <p className="pl-4 pr-2 text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
                        </DropdownMenuItem>
                      </SwipeableNotification>
                    ))}
                    <DropdownMenuSeparator />
                    <Link href="/notificacoes">
                      <DropdownMenuItem className="text-center justify-center text-foreground font-medium cursor-pointer">
                        Ver todas
                      </DropdownMenuItem>
                    </Link>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 pl-2 md:pl-3 border-l border-border cursor-pointer hover:opacity-80 transition-opacity">
                      <Avatar className="h-7 w-7 md:h-8 md:w-8 ring-2 ring-primary/20 transition-all duration-300 hover:ring-primary/40">
                        <AvatarImage src={resolveAvatarUrl(currentUser?.avatar)} alt={currentUser?.name || "Usuário"} />
                        <AvatarFallback className="text-xs">
                          {(currentUser?.name || "Usuário")
                            .split(" ")
                            .slice(0, 2)
                            .map((part) => part[0])
                            .join("")
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="hidden text-left text-xs sm:block">
                        <p className="font-semibold text-foreground">{currentUser?.name ?? "Usuário"}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {currentUser?.role ?? currentUser?.permissionProfileName ?? "Perfil"}
                        </p>
                      </div>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">{currentUser?.name ?? "Usuário"}</p>
                        <p className="text-xs text-muted-foreground">{currentUser?.email ?? ""}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <Link href="/perfil">
                      <DropdownMenuItem className="cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        Perfil
                      </DropdownMenuItem>
                    </Link>
                    {canViewTemplates ? (
                      <Link href="/templates">
                        <DropdownMenuItem className="cursor-pointer">
                          <FileText className="mr-2 h-4 w-4" />
                          Templates
                        </DropdownMenuItem>
                      </Link>
                    ) : null}
                    {canViewSettings ? (
                      <Link href="/configuracoes">
                        <DropdownMenuItem className="cursor-pointer">
                          <Settings className="mr-2 h-4 w-4" />
                          Configurações
                        </DropdownMenuItem>
                      </Link>
                    ) : null}
                    {canViewLogs ? (
                      <Link href="/logs">
                        <DropdownMenuItem className="cursor-pointer">
                          <History className="mr-2 h-4 w-4" />
                          Logs
                        </DropdownMenuItem>
                      </Link>
                    ) : null}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={handleLogout}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="h-8 w-20" aria-hidden="true" />
            )}
          </div>
        </div>
      </div>

      <div className="mb-4 mt-4 flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <h1 className="text-xl font-bold leading-none text-foreground md:text-2xl lg:text-3xl">{title}</h1>
              {titleAddon && <div className="flex items-center pt-0.5">{titleAddon}</div>}
            </div>
            <p className="text-xs text-muted-foreground md:text-sm">{description}</p>
          </div>
          {effectiveHeaderActions && (
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              {effectiveHeaderActions}
            </div>
          )}
          {viewToggle && <div className="shrink-0 sm:hidden">{viewToggle}</div>}
        </div>
        {(effectiveHeaderActions || hasFilters) && (
          <div className="flex gap-2 sm:hidden">
            {effectiveHeaderActions && (
              <div className="flex flex-1 gap-2 overflow-x-auto [&>*]:flex-1">
                {effectiveHeaderActions}
              </div>
            )}
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-muted-foreground h-9"
                onClick={() => setMobileFiltersState(!mobileFiltersOpen)}
              >
                Filtros
                <ChevronDown className={`ml-1 h-4 w-4 transition-transform duration-200 ${mobileFiltersOpen ? "rotate-180" : ""}`} />
              </Button>
            )}
          </div>
        )}
        {hasFilters && mobileFiltersOpen && filters && (
          <div className="sm:hidden">
            {filters}
          </div>
        )}
      </div>
    </>
  )
}
