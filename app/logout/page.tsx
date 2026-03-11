"use client"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"

export default function LogoutPage() {
  const router = useRouter()

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex-1 px-3 pb-4 md:px-4 lg:px-5 lg:ml-60">
        <Header
          title="Sair"
          description="Encerrar sessão do sistema Depclean"
        />

        <div className="flex items-center justify-center min-h-[calc(100vh-200px)] mt-4 md:mt-5">
          <Card className="p-8 max-w-md w-full text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <LogOut className="w-8 h-8 text-primary" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Confirmar Logout</h1>
              <p className="text-muted-foreground">Tem certeza que deseja sair do sistema?</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={() => router.back()}>
                Cancelar
              </Button>
              <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={() => router.push("/")}>
                Sair
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}
