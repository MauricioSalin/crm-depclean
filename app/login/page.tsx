"use client"

import { useMutation } from "@tanstack/react-query"
import { type FormEvent, useEffect, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, LoaderCircle, Lock, Mail } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { login, requestPasswordReset } from "@/lib/api/auth"
import { getApiErrorMessage } from "@/lib/api/errors"
import { isAuthenticated, persistSession } from "@/lib/auth/session"

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("teste@depclean.com")
  const [password, setPassword] = useState("teste123")
  const [rememberMe, setRememberMe] = useState(true)
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [resetSubmitting, setResetSubmitting] = useState(false)

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (response) => {
      persistSession({
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
        user: response.data.user,
        persistent: rememberMe,
      })

      toast.success(`Bem-vindo, ${response.data.user.name}.`)
      router.push("/")
      router.refresh()
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Não foi possível entrar."))
    },
  })

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/")
    }
  }, [router])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    loginMutation.mutate({
      email,
      password,
    })
  }

  const handleRequestPasswordReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setResetSubmitting(true)
    try {
      await requestPasswordReset({ email: resetEmail || email })
      toast.success("Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.")
      setForgotPasswordOpen(false)
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível solicitar a redefinição de senha."))
    } finally {
      setResetSubmitting(false)
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
              Bem vindo de volta,
              <span className="relative mx-auto block w-fit text-primary">
                colaborador!
              </span>
            </h1>
          </div>

          <Card className="w-full max-w-[420px] border-0 bg-white py-0 shadow-[0_18px_50px_rgba(0,0,0,0.14)]">
            <CardContent className="p-8 sm:p-10">
              <form autoComplete="off" onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Usuario</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email" autoComplete="off"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="seuemail@depclean.com"
                      className="h-11 rounded-none border-0 border-b border-border bg-transparent pl-7 pr-0 shadow-none focus-visible:ring-0"
                      disabled={loginMutation.isPending}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Digite sua senha"
                      className="h-11 rounded-none border-0 border-b border-border bg-transparent pl-7 pr-8 shadow-none focus-visible:ring-0"
                      disabled={loginMutation.isPending}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 text-sm">
                  <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked === true)}
                    />
                    <span>Manter conectado</span>
                  </label>
                  <button
                    type="button"
                    className="cursor-pointer font-medium text-primary transition-opacity hover:opacity-80"
                    onClick={() => {
                      setResetEmail(email)
                      setForgotPasswordOpen(true)
                    }}
                  >
                    Esqueci a senha
                  </button>
                </div>

                <Button
                  type="submit"
                  className="mt-8 h-11 w-full text-sm font-semibold"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Entrando...
                    </span>
                  ) : (
                    "Entrar"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recuperar senha</DialogTitle>
          </DialogHeader>
          <form autoComplete="off" onSubmit={handleRequestPasswordReset} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Informe seu e-mail para receber o link de redefinição.
            </p>
            <div className="space-y-2">
              <Label htmlFor="reset-email">E-mail</Label>
              <Input
                id="reset-email"
                type="email" autoComplete="off"
                value={resetEmail}
                onChange={(event) => setResetEmail(event.target.value)}
                placeholder="seuemail@depclean.com"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setForgotPasswordOpen(false)} disabled={resetSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={resetSubmitting}>
                {resetSubmitting ? "Enviando..." : "Enviar link"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  )
}
