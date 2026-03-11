"use client"

import { useMemo, useState } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { NotificacoesContent } from "@/components/notificacoes/notificacoes-content"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCheck } from "lucide-react"
import { notifications } from "@/lib/mock-data"
import type { Notification } from "@/lib/types"

export default function NotificacoesPage() {
  const [notificationsList, setNotificationsList] = useState<Notification[]>(notifications)

  const unreadCount = useMemo(
    () => notificationsList.filter(n => !n.isRead).length,
    [notificationsList]
  )

  const markAllAsRead = () => {
    setNotificationsList(notificationsList.map(n => ({
      ...n,
      isRead: true,
      readAt: n.readAt || new Date()
    })))
  }

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex-1 px-3 pb-4 md:px-4 lg:px-5 lg:ml-60">
        <Header
          title="Notificações"
          description="Acompanhe todas as notificações e alertas do sistema"
          titleAddon={
            unreadCount > 0 ? (
              <Badge variant="secondary" className="text-xs">
                {unreadCount} novas
              </Badge>
            ) : null
          }
          headerActions={
            unreadCount > 0 ? (
              <Button variant="outline" size="sm" onClick={markAllAsRead} className="bg-white">
                <CheckCheck className="h-4 w-4 mr-2" />
                Marcar todas como lidas
              </Button>
            ) : null
          }
        />

        <div className="mt-4 md:mt-5">
          <NotificacoesContent
            notificationsList={notificationsList}
            setNotificationsList={setNotificationsList}
          />
        </div>
      </main>
    </div>
  )
}
