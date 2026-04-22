"use client"

import { useEffect, useState } from "react"
import { Search, Bell, User, FileText, ScrollText, LogOut, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MobileNav } from "./mobile-nav"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { notifications as initialNotifications } from "@/lib/mock-data"
import { SwipeableNotification } from "./swipeable-notification"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"
import { clearSession, getStoredUser } from "@/lib/auth/session"

interface HeaderProps {
  title: string
  description: string
  titleAddon?: ReactNode
  headerActions?: ReactNode
  actions?: ReactNode
  viewToggle?: ReactNode
  filters?: ReactNode
  hasFilters?: boolean
}

const getNotificationDotColor = (type: string) => {
  const colorMap: Record<string, string> = {
    emergency: "bg-red-500",
    payment_overdue: "bg-orange-500",
    payment_due: "bg-yellow-500",
    contract_expiring: "bg-purple-500",
    new_schedule: "bg-blue-500",
    schedule_change: "bg-blue-500",
    schedule_cancel: "bg-gray-500",
    daily_services: "bg-blue-500",
  }
  return colorMap[type] || "bg-primary"
}

export function Header({ title, description, titleAddon, headerActions, actions, viewToggle, filters, hasFilters = false }: HeaderProps) {
  const router = useRouter()
  const [notifs, setNotifs] = useState(initialNotifications)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getStoredUser>>(null)
  const [mounted, setMounted] = useState(false)
  const unreadNotifications = notifs.filter((n) => !n.isRead)
  const effectiveHeaderActions = headerActions ?? actions

  useEffect(() => {
    setMounted(true)
    const sync = () => setCurrentUser(getStoredUser())
    sync()
    window.addEventListener("storage", sync)
    window.addEventListener("depclean:session", sync)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("depclean:session", sync)
    }
  }, [])

  const markAsRead = (id: string) => {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date() } : n)))
  }

  return (
    <>
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm -mx-3 md:-mx-4 lg:-mx-5 px-3 md:px-4 lg:px-5 pt-4 pb-4 border-b border-transparent [&:not(:first-child)]:border-border/50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            {mounted ? <MobileNav /> : <div className="h-9 w-9 shrink-0" aria-hidden="true" />}

            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente, contrato, serviço..."
                className="pl-9 pr-3 md:pr-16 h-9 text-sm bg-card border-border transition-all duration-300 focus:shadow-lg focus:shadow-primary/10"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 md:gap-2">
            {mounted ? (
              <>
                <DropdownMenu>
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
                  <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
                    <DropdownMenuLabel className="flex items-center justify-between">
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
                          className="flex flex-col items-start gap-1 cursor-pointer"
                          onSelect={(event) => event.preventDefault()}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${getNotificationDotColor(notification.type)} ${
                                notification.isRead ? "opacity-40" : "opacity-100"
                              }`}
                            />
                            <span className={`font-medium text-sm ${notification.isRead ? "text-muted-foreground" : "text-foreground"}`}>
                              {notification.title}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground pl-4 line-clamp-2">{notification.message}</p>
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

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 pl-2 md:pl-3 border-l border-border cursor-pointer hover:opacity-80 transition-opacity">
                      <Avatar className="h-7 w-7 md:h-8 md:w-8 ring-2 ring-primary/20 transition-all duration-300 hover:ring-primary/40">
                        <AvatarImage src={currentUser?.avatar || "/professional-avatar.jpg"} alt={currentUser?.name || "Usuário"} />
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
                    <Link href="/templates">
                      <DropdownMenuItem className="cursor-pointer">
                        <FileText className="mr-2 h-4 w-4" />
                        Templates
                      </DropdownMenuItem>
                    </Link>
                    <Link href="/logs">
                      <DropdownMenuItem className="cursor-pointer">
                        <ScrollText className="mr-2 h-4 w-4" />
                        Logs
                      </DropdownMenuItem>
                    </Link>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={(event) => {
                        event.preventDefault()
                        clearSession()
                        router.replace("/login")
                      }}
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

      <div id="header-filters-slot" className="mt-4" aria-hidden="true" />

      <div className="mb-4 mt-4 flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground md:text-2xl lg:text-3xl">{title}</h1>
              {titleAddon}
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
                onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
              >
                Filtros
                <ChevronDown className={`ml-1 h-4 w-4 transition-transform duration-200 ${mobileFiltersOpen ? "rotate-180" : ""}`} />
              </Button>
            )}
          </div>
        )}
        {hasFilters && mobileFiltersOpen && (
          <div className="rounded-lg border bg-card p-3 sm:hidden">
            {filters}
          </div>
        )}
      </div>
    </>
  )
}
