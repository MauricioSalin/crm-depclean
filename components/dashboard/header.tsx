"use client"

import { useState } from "react"
import { Search, Bell, User, FileText, ScrollText, LogOut } from "lucide-react"
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
import type { ReactNode } from "react"

interface HeaderProps {
  title: string
  description: string
  titleAddon?: ReactNode
  headerActions?: ReactNode
  actions?: ReactNode
  viewToggle?: ReactNode
}

const getNotificationDotColor = (type: string, isRead: boolean) => {
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

export function Header({ title, description, titleAddon, headerActions, actions, viewToggle }: HeaderProps) {
  const [notifs, setNotifs] = useState(initialNotifications)
  const unreadNotifications = notifs.filter(n => !n.isRead)
  const effectiveHeaderActions = headerActions ?? actions

  const markAsRead = (id: string) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, isRead: true, readAt: new Date() } : n))
  }

  return (
    <>
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm -mx-3 md:-mx-4 lg:-mx-5 px-3 md:px-4 lg:px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <MobileNav />

            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente, contrato, serviço..."
                className="pl-9 pr-3 md:pr-16 h-9 text-sm bg-card border-border transition-all duration-300 focus:shadow-lg focus:shadow-primary/10"
              />
              {/* <span className="hidden md:inline-flex items-center gap-0.5 absolute right-2.5 top-1/2 -translate-y-1/2">
                <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground bg-gray-100 rounded border border-border">Ctrl</kbd>
                <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground bg-gray-100 rounded border border-border">K</kbd>
              </span> */}
            </div>
          </div>

          <div className="flex items-center gap-1.5 md:gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative hover:bg-secondary transition-all duration-300 hover:scale-110 h-8 w-8"
                >
                  <Bell className="w-4 h-4" />
                  {unreadNotifications.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full text-[10px] font-bold flex items-center justify-center">
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
                    <DropdownMenuItem key={notification.id} className="flex flex-col items-start gap-1 cursor-pointer" onSelect={(e) => e.preventDefault()}>
                      <div className="flex items-center gap-2 w-full">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${getNotificationDotColor(notification.type, notification.isRead)} ${
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
                <DropdownMenuItem className="text-center justify-center text-foreground font-medium cursor-pointer">
                  Ver todas
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 pl-2 md:pl-3 border-l border-border cursor-pointer hover:opacity-80 transition-opacity">
                  <Avatar className="w-7 h-7 md:w-8 md:h-8 ring-2 ring-primary/20 transition-all duration-300 hover:ring-primary/40">
                    <AvatarImage src="/professional-avatar.jpg" alt="Administrador" />
                    <AvatarFallback className="text-xs">AD</AvatarFallback>
                  </Avatar>
                  <div className="text-xs hidden sm:block text-left">
                    <p className="font-semibold text-foreground">Melina Costa</p>
                    <p className="text-muted-foreground text-[10px]">Administradora</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">Melina Costa</p>
                    <p className="text-xs text-muted-foreground">melina@depclean.com</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Link href="/perfil">
                  <DropdownMenuItem className="cursor-pointer">
                    <User className="w-4 h-4 mr-2" />
                    Perfil
                  </DropdownMenuItem>
                </Link>
                <Link href="/templates">
                  <DropdownMenuItem className="cursor-pointer">
                    <FileText className="w-4 h-4 mr-2" />
                    Templates
                  </DropdownMenuItem>
                </Link>
                <Link href="/logs">
                  <DropdownMenuItem className="cursor-pointer">
                    <ScrollText className="w-4 h-4 mr-2" />
                    Logs
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <Link href="/logout">
                  <DropdownMenuItem className="cursor-pointer">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="mb-4 mt-4 flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-foreground">{title}</h1>
              {titleAddon}
            </div>
            <p className="text-xs md:text-sm text-muted-foreground">{description}</p>
          </div>
          {/* Mobile: viewToggle ao lado do título */}
          {viewToggle && <div className="shrink-0 sm:hidden">{viewToggle}</div>}
          {/* Desktop: botão de ação ao lado do título */}
          {effectiveHeaderActions && (
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              {effectiveHeaderActions}
            </div>
          )}
        </div>
        {/* Mobile: botão de ação full-width abaixo */}
        {effectiveHeaderActions && (
          <div className="flex gap-2 overflow-x-auto [&>*]:flex-1 sm:hidden">
            {effectiveHeaderActions}
          </div>
        )}
      </div>
    </>
  )
}
