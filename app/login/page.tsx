"use client"

import { useMutation } from "@tanstack/react-query"
import { type FormEvent, useEffect, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ArrowRight, Eye, EyeOff, LoaderCircle, Lock, Mail, UserRound, UserRoundCog } from "lucide-react"
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
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
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
    <main
      className="relative min-h-dvh overflow-x-hidden bg-[#f4f5f2] bg-cover bg-[position:86%_center] sm:bg-[position:78%_center] lg:h-dvh lg:overflow-hidden lg:bg-[position:center_44%]"
      style={{
        backgroundImage:
          "url('/login_background.png'), radial-gradient(circle at 24% 76%, rgba(132,199,0,0.18), transparent 24%), linear-gradient(108deg, #eef4f7 0%, #f8f8f6 52%, #fbfaf8 100%)",
      }}
    >
      <div className="absolute inset-0 bg-white/10 lg:bg-transparent" />

      <div className="relative z-10 grid min-h-dvh grid-cols-1 px-5 py-7 sm:px-8 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(500px,52vw)_1fr] lg:px-0 lg:py-0">
        <section className="hidden h-full items-start justify-center px-8 pt-[clamp(2.75rem,7vh,5rem)] lg:flex">
          <div className="w-full max-w-[470px]">
            <Image
              src="/logo-depclean.png"
              alt="Depclean"
              width={280}
              height={91}
              priority
              className="h-auto w-[210px] xl:w-[235px]"
            />
            <div className="mt-[clamp(2rem,5vh,3.3rem)]">
              <h1 className="max-w-[430px] text-[clamp(2.65rem,3.7vw,4.35rem)] font-extrabold leading-[1.02] tracking-[0] text-[#101824]">
                <span className="block whitespace-nowrap">Bem-vindo</span>
                <span className="block whitespace-nowrap">
                  de <span className="text-primary">volta</span>
                </span>
              </h1>
              <div className="mt-[clamp(1.1rem,2.8vh,1.6rem)] h-[3px] w-[52px] bg-primary" />
              <p className="mt-[clamp(1rem,2.5vh,1.35rem)] max-w-[300px] text-[clamp(0.98rem,1.05vw,1.14rem)] leading-[1.55] text-[#2f3a49]">
                Acesse o portal e conecte-se ao que transforma nosso futuro todos os dias.
              </p>
            </div>
          </div>
        </section>

        <section className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center lg:h-full lg:min-h-0 lg:px-[4vw] xl:px-[5vw]">
          <div className="w-full max-w-[430px] text-center lg:hidden">
            <Image
              src="/logo-depclean.png"
              alt="Depclean"
              width={220}
              height={72}
              priority
              className="mx-auto h-auto w-[190px] sm:w-[220px]"
            />
          </div>

          <div className="flex w-full flex-1 flex-col items-center justify-center gap-6 py-5 lg:gap-8 lg:py-6">
            <Card className="w-full max-w-[400px] rounded-[24px] border border-[#dfe3df] bg-white/90 py-0 shadow-[0_20px_52px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:max-w-[430px] sm:rounded-[28px] lg:max-w-[440px] xl:max-w-[470px] 2xl:max-w-[520px]">
              <CardContent className="px-5 pb-6 pt-8 sm:px-7 sm:pb-7 sm:pt-9 lg:px-8 lg:pb-7 lg:pt-10 xl:px-9 xl:pb-8 xl:pt-10 2xl:px-12 2xl:pb-10 2xl:pt-12">
                <div className="mb-5 flex justify-center 2xl:mb-6">
                  <UserRound className="h-7 w-7 text-muted-foreground 2xl:h-8 2xl:w-8" strokeWidth={1.8} />
                </div>
                <form autoComplete="off" onSubmit={handleSubmit} className="space-y-4 2xl:space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email">Usuário</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email" autoComplete="off"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="seuemail@depcleanrs.com.br"
                        className="h-12 rounded-xl border-border bg-white/70 pl-12 pr-4 text-base shadow-none focus-visible:ring-2 focus-visible:ring-primary/20 2xl:h-[54px]"
                        disabled={loginMutation.isPending}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Digite sua senha"
                        className="h-12 rounded-xl border-border bg-white/70 pl-12 pr-12 text-base shadow-none focus-visible:ring-2 focus-visible:ring-primary/20 2xl:h-[54px]"
                        disabled={loginMutation.isPending}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
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
                    className="mt-5 h-12 w-full rounded-xl text-base font-semibold shadow-none 2xl:mt-7 2xl:h-14"
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? (
                      <span className="inline-flex items-center gap-2">
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        Entrando...
                      </span>
                    ) : (
                      <span className="relative flex w-full items-center justify-center">
                        Entrar
                        <ArrowRight className="absolute right-0 h-5 w-5" />
                      </span>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="flex w-full max-w-[400px] items-center gap-5 text-center text-sm leading-relaxed text-muted-foreground sm:max-w-[430px] lg:max-w-[440px] xl:max-w-[470px] 2xl:max-w-[520px]">
              <div className="h-px flex-1 bg-border" />
              <div className="max-w-[330px]">
                <UserRoundCog className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                <p>Caso não tenha conta, entre em contato com um Administrador.</p>
              </div>
              <div className="h-px flex-1 bg-border" />
            </div>
          </div>

          <div className="flex w-full justify-center pb-4 lg:pb-7">
            <Image
              src="/logo-depclean-d.png"
              alt="Depclean"
              width={44}
              height={44}
              className="h-9 w-9 object-contain opacity-90 lg:h-10 lg:w-10"
            />
          </div>
        </section>
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
                placeholder="seuemail@depcleanrs.com.br"
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
