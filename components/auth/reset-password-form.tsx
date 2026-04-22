"use client"

import { useState, type FormEvent } from "react"
import { Eye, EyeOff, Lock, LoaderCircle } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { resetPassword } from "@/lib/api/auth"

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const [showPassword, setShowPassword] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!token) {
      toast.error("Token de redefinição inválido.")
      return
    }

    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres.")
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.")
      return
    }

    setLoading(true)
    try {
      await resetPassword({
        token,
        newPassword,
        confirmPassword,
      })
      toast.success("Senha redefinida com sucesso. Faça login novamente.")
      router.push("/login")
    } catch {
      toast.error("Não foi possível redefinir a senha.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f6f2] px-6">
      <Card className="w-full max-w-md border-0 bg-white shadow-[0_18px_50px_rgba(0,0,0,0.14)]">
        <CardContent className="p-8 sm:p-10">
          <div className="mb-6 space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Redefinir senha</h1>
            <p className="text-sm text-muted-foreground">
              Escolha uma nova senha para concluir a recuperação.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova senha</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="h-11 rounded-none border-0 border-b border-border bg-transparent pl-7 pr-8 shadow-none focus-visible:ring-0"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="h-11 rounded-none border-0 border-b border-border bg-transparent shadow-none focus-visible:ring-0"
                required
              />
            </div>

            <Button type="submit" className="h-11 w-full text-sm font-semibold" disabled={loading || !token}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Salvando...
                </span>
              ) : (
                "Redefinir senha"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
