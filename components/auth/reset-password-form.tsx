"use client"

import { useState, type FormEvent } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, Lock, LoaderCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { resetPassword } from "@/lib/api/auth"
import { getApiErrorMessage } from "@/lib/api/errors"

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
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível redefinir a senha."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative h-screen overflow-hidden bg-[#f6f6f2]">
      <div className="absolute inset-x-0 bottom-0 h-12 bg-primary/95" />

      <div className="relative z-10 flex h-full items-center justify-center px-6 py-6">
        <div className="flex w-full max-w-5xl -translate-y-10 flex-col items-center justify-center sm:-translate-y-14">
          <div className="mb-12 text-center">
            <Image
              src="/logo-depclean.png"
              alt="Depclean"
              width={240}
              height={78}
              priority
              className="mx-auto h-auto w-[220px] sm:w-[220px]"
            />
            <h1 className="mt-8 text-3xl font-extrabold leading-tight text-gray-800">
              Redefina sua senha,
              <span className="relative mx-auto block w-fit text-primary">
                colaborador!
              </span>
            </h1>
          </div>

          <Card className="w-full max-w-[420px] border-0 bg-white py-0 shadow-[0_18px_50px_rgba(0,0,0,0.14)]">
            <CardContent className="p-8 sm:p-10">
              <form autoComplete="off" noValidate onSubmit={handleSubmit} className="space-y-6">
                {!token && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    Link inválido ou expirado. Solicite uma nova recuperação de senha.
                  </p>
                )}

                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova senha</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder="Digite a nova senha"
                      className="h-11 rounded-none border-0 border-b border-border bg-transparent pl-7 pr-8 shadow-none focus-visible:ring-0"
                      disabled={loading || !token}
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
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Confirme a nova senha"
                      className="h-11 rounded-none border-0 border-b border-border bg-transparent pl-7 pr-0 shadow-none focus-visible:ring-0"
                      disabled={loading || !token}
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="mt-8 h-11 w-full text-sm font-semibold" disabled={loading || !token}>
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Salvando...
                    </span>
                  ) : (
                    "Redefinir senha"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 w-full text-sm font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => router.push("/login")}
                  disabled={loading}
                >
                  Voltar ao login
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
