"use client"

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
  Settings, 
  HelpCircle, 
  Bell
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Users, label: "Clientes", href: "/clientes" },
  { icon: FileText, label: "Contratos", href: "/contratos" },
  { icon: Wrench, label: "Serviços", href: "/servicos" },
  { icon: UsersRound, label: "Equipes", href: "/equipes" },
  { icon: Users, label: "Funcionários", href: "/funcionarios" },
  { icon: Calendar, label: "Agenda", badge: "3", href: "/agenda" },
  { icon: CalendarClock, label: "Agendamentos", href: "/agendamentos" },
  { icon: DollarSign, label: "Financeiro", href: "/financeiro" },
  { icon: BarChart3, label: "Relatórios", href: "/relatorios" },
  { icon: Bell, label: "Notificações", badge: "2", href: "/notificacoes" },
]

const generalItems = [
  { icon: Settings, label: "Configurações", href: "/configuracoes" },
  { icon: HelpCircle, label: "Ajuda", href: "/ajuda" },
]

interface SidebarProps {
  onNavigate?: () => void
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="fixed top-0 left-0 w-60 bg-card border-r border-border h-screen flex flex-col">
      <div className="flex items-center gap-2 p-4 pb-2 shrink-0 group cursor-pointer">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo-depclean.png"
            alt="Depclean Logo"
            width={180}
            height={52}
            className="transition-transform group-hover:scale-105 duration-300"
          />
        </Link>
      </div>

      <div className="flex flex-col flex-1 overflow-y-auto px-4 pb-4">
        <div>
          <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">Menu</p>
          <nav className="space-y-0.5">
            {menuItems.map((item) => {
              const isActive = item.href === "/" ? pathname === "/" : (pathname === item.href || pathname.startsWith(item.href + "/"))
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={onNavigate}


                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-300",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/70 hover:bg-secondary hover:text-foreground",


                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="text-sm">{item.label}</span>
                  {item.badge && (
                    <span className={cn(
                      "ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-primary text-primary-foreground"
                    )}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="mt-6">
          <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">Geral</p>
          <nav className="space-y-0.5">
            {generalItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={onNavigate}


                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-300",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/70 hover:bg-secondary hover:text-foreground",


                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="text-sm">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </aside>
  )
}
