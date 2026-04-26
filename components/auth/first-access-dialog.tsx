"use client"

import { useEffect, useState } from "react"
import { Lock } from "lucide-react"
import { toast } from "sonner"

import { changePassword } from "@/lib/api/profile"
import { getStoredAccessToken, getStoredRefreshToken, getStoredUser, isPersistentSession, persistSession } from "@/lib/auth/session"
import type { AuthenticatedUser } from "@/lib/auth/types"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function FirstAccessDialog() {
  const [user, setUser] = useState<AuthenticatedUser | null>(null)
  const [mounted, setMounted] = useState(false)
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const sync = () => setUser(getStoredUser())
    sync()
    setMounted(true)
    window.addEventListener("storage", sync)
    window.addEventListener("depclean:session", sync)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("depclean:session", sync)
    }
  }, [])

  const open = mounted && Boolean(user?.mustChangePassword)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (formData.newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres.")
      return
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error("As senhas não coincidem.")
      return
    }

    if (!getStoredAccessToken()) {
      toast.error("Sessão expirada.")
      return
    }

    setLoading(true)
    try {
      await changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
        confirmPassword: formData.confirmPassword,
      })

      const storedUser = getStoredUser()
      const accessToken = getStoredAccessToken()
      const refreshToken = getStoredRefreshToken()

      if (storedUser && accessToken && refreshToken) {
        persistSession({
          accessToken,
          refreshToken,
          user: { ...storedUser, mustChangePassword: false },
          persistent: isPersistentSession(),
        })
        setUser({ ...storedUser, mustChangePassword: false })
      }

      setFormData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
      toast.success("Senha alterada com sucesso.")
    } catch (error) {
      toast.error("Não foi possível alterar a senha.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Primeiro acesso
          </DialogTitle>
        </DialogHeader>
        <form autoComplete="off" onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Você precisa definir uma nova senha antes de continuar.
          </p>
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Senha temporária</Label>
            <Input
              id="currentPassword"
              type="password" autoComplete="off"
              value={formData.currentPassword}
              onChange={(event) => setFormData({ ...formData, currentPassword: event.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nova senha</Label>
            <Input
              id="newPassword"
              type="password" autoComplete="off"
              value={formData.newPassword}
              onChange={(event) => setFormData({ ...formData, newPassword: event.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
            <Input
              id="confirmPassword"
              type="password" autoComplete="off"
              value={formData.confirmPassword}
              onChange={(event) => setFormData({ ...formData, confirmPassword: event.target.value })}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvando..." : "Salvar nova senha"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
