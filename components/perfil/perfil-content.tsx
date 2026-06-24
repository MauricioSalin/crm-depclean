"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Bell, Camera, CreditCard, Lock, Mail, Phone, Save, Shield, User } from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { AvatarUploadDialog } from "@/components/perfil/avatar-upload-dialog"
import { changePassword, getProfileMe, updateProfile, uploadProfileAvatar, type AvatarUploadVariant, type ChangePasswordPayload, type UpdateProfilePayload } from "@/lib/api/profile"
import { deletePushSubscription } from "@/lib/api/notifications"
import { getApiErrorMessage } from "@/lib/api/errors"
import { getSettings, type PermissionProfileRecord } from "@/lib/api/settings"
import { getStoredAccessToken, getStoredRefreshToken, getStoredUser, isPersistentSession, persistSession } from "@/lib/auth/session"
import { resolveAvatarUrl } from "@/lib/avatar"
import { formatCPF, formatPhone, isValidCPF } from "@/lib/masks"
import type { AuthenticatedUser } from "@/lib/auth/types"

type ProfileResponse = AuthenticatedUser & { profileDescription: string }

const emptyPasswordForm: ChangePasswordPayload = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
}

export function PerfilContent() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [permissionProfiles, setPermissionProfiles] = useState<PermissionProfileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [avatarDialog, setAvatarDialog] = useState(false)
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [passwordDialog, setPasswordDialog] = useState(false)
  const [passwordData, setPasswordData] = useState(emptyPasswordForm)
  const [passwordError, setPasswordError] = useState("")
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushAvailable, setPushAvailable] = useState(false)
  const [pushUpdating, setPushUpdating] = useState(false)

  const profileInitials = useMemo(() => {
    const name = profile?.name ?? "Usuario"
    return name
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
  }, [profile?.name])

  const loadProfile = async () => {
    setLoading(true)
    try {
      const profileResponse = await getProfileMe()
      setProfile({
        ...profileResponse.data,
        cpf: formatCPF(profileResponse.data.cpf),
        phone: formatPhone(profileResponse.data.phone),
      })
      const currentUser = getStoredUser()
      if (currentUser?.permissions.includes("settings_manage")) {
        const settingsResponse = await getSettings()
        setPermissionProfiles(settingsResponse.data.permissionProfiles)
      } else {
        setPermissionProfiles([])
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível carregar seu perfil."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProfile()
  }, [])

  useEffect(() => {
    const refreshPushStatus = async () => {
      if (typeof window === "undefined") return
      const available = "Notification" in window && "PushManager" in window && "serviceWorker" in navigator
      setPushAvailable(available)
      if (!available || Notification.permission !== "granted") {
        setPushEnabled(false)
        return
      }

      try {
        const registration = await navigator.serviceWorker.getRegistration()
        const subscription = await registration?.pushManager.getSubscription()
        setPushEnabled(Boolean(subscription))
      } catch {
        setPushEnabled(Notification.permission === "granted")
      }
    }

    const handlePushStatus = (event: Event) => {
      const enabled = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled
      if (typeof enabled === "boolean") {
        setPushEnabled(enabled)
        return
      }
      void refreshPushStatus()
    }

    void refreshPushStatus()
    window.addEventListener("focus", refreshPushStatus)
    window.addEventListener("depclean:push-status", handlePushStatus)

    return () => {
      window.removeEventListener("focus", refreshPushStatus)
      window.removeEventListener("depclean:push-status", handlePushStatus)
    }
  }, [])

  const formData = profile
  const activeProfile = permissionProfiles.find((item) => item.id === profile?.permissionProfileId)
  const canEditPermission = Boolean(profile?.permissions.includes("settings_manage"))
  const canEditStatus = canEditPermission
  const showProfileMeta = canEditPermission || canEditStatus || Boolean(formData?.mustChangePassword)

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!profile) return
    if (saving) return
    if (!isValidCPF(profile.cpf)) {
      toast.error("Informe um CPF válido.")
      return
    }

    setSaving(true)
    const toastId = toast.loading("Salvando perfil...")
    try {
      const payload: UpdateProfilePayload = {
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        cpf: profile.cpf,
        avatar: profile.avatar,
      }

      if (canEditPermission) payload.permissionProfileId = profile.permissionProfileId
      if (canEditStatus) payload.status = profile.employeeStatus

      const response = await updateProfile(payload)

      const updatedUser = response.data
      const { profileDescription, ...storedUser } = updatedUser
      const stored = getStoredUser()
      const accessToken = getStoredAccessToken()
      const refreshToken = getStoredRefreshToken()
      if (stored && accessToken && refreshToken) {
        persistSession({
          accessToken,
          refreshToken,
          user: { ...stored, ...storedUser },
          persistent: isPersistentSession(),
        })
      }

      setProfile(updatedUser)
      toast.success("Perfil atualizado com sucesso.", { id: toastId })
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível salvar suas alterações."), { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    setPasswordError("")

    if (passwordData.newPassword.length < 6) {
      setPasswordError("A nova senha deve ter pelo menos 6 caracteres.")
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("As senhas não coincidem.")
      return
    }

    setSaving(true)
    const toastId = toast.loading("Alterando senha...")
    try {
      await changePassword(passwordData)
      const stored = getStoredUser()
      const accessToken = getStoredAccessToken()
      const refreshToken = getStoredRefreshToken()
      if (stored && accessToken && refreshToken) {
        persistSession({
          accessToken,
          refreshToken,
          user: { ...stored, mustChangePassword: false },
          persistent: isPersistentSession(),
        })
      }
      setPasswordDialog(false)
      setPasswordData(emptyPasswordForm)
      toast.success("Senha alterada com sucesso.", { id: toastId })
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível alterar a senha."), { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const syncStoredProfile = (updatedUser: ProfileResponse) => {
    const { profileDescription, ...storedUser } = updatedUser
    const stored = getStoredUser()
    const accessToken = getStoredAccessToken()
    const refreshToken = getStoredRefreshToken()

    if (stored && accessToken && refreshToken) {
      persistSession({
        accessToken,
        refreshToken,
        user: { ...stored, ...storedUser },
        persistent: isPersistentSession(),
      })
    }
  }

  const handleAvatarSave = async (variants: AvatarUploadVariant[]) => {
    if (avatarSaving) return

    setAvatarSaving(true)
    const toastId = toast.loading("Salvando foto do perfil...")
    try {
      const response = await uploadProfileAvatar(variants)
      const updatedUser = response.data

      syncStoredProfile(updatedUser)
      setProfile({
        ...updatedUser,
        cpf: formatCPF(updatedUser.cpf),
        phone: formatPhone(updatedUser.phone),
      })
      setAvatarDialog(false)
      toast.success("Foto do perfil atualizada.", { id: toastId })
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível salvar a foto do perfil."), { id: toastId })
    } finally {
      setAvatarSaving(false)
    }
  }

  const handlePushPreferenceChange = async (checked: boolean) => {
    if (pushUpdating) return

    if (checked) {
      window.dispatchEvent(new CustomEvent("depclean:request-push-permission"))
      return
    }

    if (!pushAvailable) return

    setPushUpdating(true)
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        await deletePushSubscription(subscription.endpoint)
        await subscription.unsubscribe()
      }
      setPushEnabled(false)
      window.dispatchEvent(new CustomEvent("depclean:push-status", { detail: { enabled: false } }))
      toast.success("Notificações push desativadas neste dispositivo.")
    } catch {
      toast.error("Não foi possível desativar as notificações push neste dispositivo.")
    } finally {
      setPushUpdating(false)
    }
  }

  if (loading || !formData) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent>
            <div className="flex items-center gap-6">
              <Skeleton className="size-24 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-3">
                <Skeleton className="h-5 w-56" />
                <Skeleton className="h-4 w-72 max-w-full" />
                <Skeleton className="h-6 w-32 rounded-full" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="space-y-4 p-6">
          <Skeleton className="h-5 w-44" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="relative group shrink-0">
              <Avatar className="h-24 w-24 ring-4 ring-primary/20">
                <AvatarImage src={resolveAvatarUrl(formData.avatar)} alt={formData.name} />
                <AvatarFallback className="text-2xl">{profileInitials}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => setAvatarDialog(true)}
                aria-label="Alterar foto do perfil"
              >
                <Camera className="h-6 w-6 text-white" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold">{formData.name}</h3>
              <p className="text-sm text-muted-foreground">{formData.email}</p>
              {showProfileMeta && (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {canEditPermission && (
                    <div className="flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground/70">{activeProfile?.name ?? formData.permissionProfileName}</span>
                    </div>
                  )}
                  {canEditStatus && (
                    <Badge className={formData.isActive ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-700 hover:bg-gray-100"}>
                      {formData.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  )}
                  {formData.mustChangePassword && <Badge variant="outline">Primeiro acesso</Badge>}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notificações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <Label htmlFor="push-notifications" className="font-semibold">
                  Quero receber notificações em push
                </Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Receba avisos do sistema neste dispositivo mesmo com o app em segundo plano.
                </p>
              </div>
            </div>
            <Switch
              id="push-notifications"
              checked={pushEnabled}
              disabled={!pushAvailable || pushUpdating}
              onCheckedChange={handlePushPreferenceChange}
              aria-label="Quero receber notificações em push"
            />
          </div>
          {!pushAvailable ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Notificações push não estão disponíveis neste navegador.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informações Pessoais</CardTitle>
        </CardHeader>
        <CardContent>
          <form autoComplete="off" onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name" className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  Nome Completo
                </Label>
                <Input id="name" value={formData.name} onChange={(event) => setProfile({ ...formData, name: event.target.value })} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cpf" className="flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                  CPF *
                </Label>
                  <Input
                    id="cpf"
                    value={formData.cpf}
                    onChange={(event) => setProfile({ ...formData, cpf: formatCPF(event.target.value) })}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    maxLength={14}
                    required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  Telefone
                </Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(event) => setProfile({ ...formData, phone: formatPhone(event.target.value) })}
                  placeholder="(51) 99999-9999"
                  inputMode="numeric"
                  maxLength={15}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  E-mail
                </Label>
                <Input id="email" type="email" autoComplete="off" value={formData.email} onChange={(event) => setProfile({ ...formData, email: event.target.value })} required />
              </div>

              {canEditPermission && (
                <div className="space-y-2">
                  <Label htmlFor="permissionProfile" className="flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                    Perfil de Permissão
                  </Label>
                  <Select
                    value={formData.permissionProfileId}
                    onValueChange={(value) => setProfile({ ...formData, permissionProfileId: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {permissionProfiles.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {canEditStatus && (
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.employeeStatus}
                    onValueChange={(value) => setProfile({ ...formData, employeeStatus: value as "active" | "inactive" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <Button type="button" variant="outline" className="h-9 w-full gap-2 sm:w-auto" onClick={() => setPasswordDialog(true)} disabled={saving}>
                <Lock className="h-4 w-4" />
                Alterar Senha
              </Button>
              <Button type="submit" className="h-9 w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto" disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={passwordDialog} onOpenChange={setPasswordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Alterar Senha
            </DialogTitle>
          </DialogHeader>
          <form autoComplete="off" onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Senha Atual</Label>
              <Input id="currentPassword" type="password" autoComplete="off" value={passwordData.currentPassword} onChange={(event) => setPasswordData({ ...passwordData, currentPassword: event.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input id="newPassword" type="password" autoComplete="off" value={passwordData.newPassword} onChange={(event) => setPasswordData({ ...passwordData, newPassword: event.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input id="confirmPassword" type="password" autoComplete="off" value={passwordData.confirmPassword} onChange={(event) => setPasswordData({ ...passwordData, confirmPassword: event.target.value })} required />
            </div>
            {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setPasswordDialog(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={saving}>
                {saving ? "Salvando..." : "Alterar Senha"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AvatarUploadDialog
        open={avatarDialog}
        onOpenChange={setAvatarDialog}
        currentAvatar={formData.avatar}
        userName={formData.name}
        initials={profileInitials}
        saving={avatarSaving}
        onSave={handleAvatarSave}
      />
    </div>
  )
}
