"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Camera, CreditCard, Lock, Mail, Phone, Save, Shield, User } from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { changePassword, getProfileMe, updateProfile, type ChangePasswordPayload } from "@/lib/api/profile"
import { getSettings, type PermissionProfileRecord } from "@/lib/api/settings"
import { getStoredAccessToken, getStoredRefreshToken, getStoredUser, isPersistentSession, persistSession } from "@/lib/auth/session"
import { formatCPF, formatPhone } from "@/lib/masks"
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
  const [passwordDialog, setPasswordDialog] = useState(false)
  const [passwordData, setPasswordData] = useState(emptyPasswordForm)
  const [passwordError, setPasswordError] = useState("")
  const [saved, setSaved] = useState(false)

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
    } catch {
      toast.error("Nao foi possivel carregar seu perfil.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProfile()
  }, [])

  const formData = profile
  const activeProfile = permissionProfiles.find((item) => item.id === profile?.permissionProfileId)
  const canEditPermission = Boolean(profile?.permissions.includes("settings_manage"))
  const canEditStatus = canEditPermission

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!profile) return

    setSaving(true)
    try {
      const response = await updateProfile({
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        cpf: profile.cpf,
        avatar: profile.avatar,
        permissionProfileId: profile.permissionProfileId,
        status: profile.employeeStatus,
      })

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
      setSaved(true)
      toast.success("Perfil atualizado com sucesso.")
      window.setTimeout(() => setSaved(false), 1800)
    } catch {
      toast.error("Nao foi possivel salvar suas alteracoes.")
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPasswordError("")

    if (passwordData.newPassword.length < 6) {
      setPasswordError("A nova senha deve ter pelo menos 6 caracteres.")
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("As senhas nao coincidem.")
      return
    }

    setSaving(true)
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
      toast.success("Senha alterada com sucesso.")
    } catch {
      toast.error("Nao foi possivel alterar a senha.")
    } finally {
      setSaving(false)
    }
  }

  if (loading || !formData) {
    return <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Carregando perfil...</div>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="relative group shrink-0">
              <Avatar className="h-20 w-20 ring-4 ring-primary/20">
                <AvatarImage src={formData.avatar || "/professional-avatar.jpg"} alt={formData.name} />
                <AvatarFallback className="text-xl">{profileInitials}</AvatarFallback>
              </Avatar>
              <button type="button" className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="h-5 w-5 text-white" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold">{formData.name}</h3>
              <p className="text-sm text-muted-foreground">{formData.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground/70">{activeProfile?.name ?? formData.permissionProfileName}</span>
                </div>
                <Badge className={formData.isActive ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-700 hover:bg-gray-100"}>
                  {formData.isActive ? "Ativo" : "Inativo"}
                </Badge>
                {formData.mustChangePassword && <Badge variant="outline">Primeiro acesso</Badge>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informacoes Pessoais</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
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
                  CPF
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
                <Input id="email" type="email" value={formData.email} onChange={(event) => setProfile({ ...formData, email: event.target.value })} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="permissionProfile" className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  Perfil de Permissao
                </Label>
                <Select
                  value={formData.permissionProfileId}
                  onValueChange={(value) => setProfile({ ...formData, permissionProfileId: value })}
                  disabled={!canEditPermission}
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
                {!canEditPermission && (
                  <p className="text-[10px] text-muted-foreground">Somente administradores podem alterar o perfil de permissao.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.employeeStatus}
                  onValueChange={(value) => setProfile({ ...formData, employeeStatus: value as "active" | "inactive" })}
                  disabled={!canEditStatus}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
                {!canEditStatus && (
                  <p className="text-[10px] text-muted-foreground">Somente administradores podem alterar o status.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="h-9 gap-2" onClick={() => setPasswordDialog(true)}>
                <Lock className="h-4 w-4" />
                Alterar Senha
              </Button>
              <Button type="submit" className="h-9 gap-2 bg-primary text-primary-foreground hover:bg-primary/90" disabled={saving}>
                <Save className="h-4 w-4" />
                {saved ? "Salvo!" : "Salvar Alteracoes"}
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
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Senha Atual</Label>
              <Input id="currentPassword" type="password" value={passwordData.currentPassword} onChange={(event) => setPasswordData({ ...passwordData, currentPassword: event.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input id="newPassword" type="password" value={passwordData.newPassword} onChange={(event) => setPasswordData({ ...passwordData, newPassword: event.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input id="confirmPassword" type="password" value={passwordData.confirmPassword} onChange={(event) => setPasswordData({ ...passwordData, confirmPassword: event.target.value })} required />
            </div>
            {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setPasswordDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={saving}>
                {saving ? "Salvando..." : "Alterar Senha"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
