import { api } from "@/lib/api/client"
import type { AuthenticatedUser } from "@/lib/auth/types"

export type UpdateProfilePayload = Partial<{
  name: string
  email: string
  phone: string
  cpf: string
  avatar: string
  permissionProfileId: string
  status: "active" | "inactive"
}>

export type ChangePasswordPayload = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export async function getProfileMe() {
  const response = await api.get<{ success: true; data: AuthenticatedUser & { profileDescription: string } }>("/profile/me")
  return response.data
}

export async function updateProfile(payload: UpdateProfilePayload) {
  const response = await api.patch<{ success: true; data: AuthenticatedUser & { profileDescription: string } }>("/profile/me", payload)
  return response.data
}

export async function changePassword(payload: ChangePasswordPayload) {
  const response = await api.post<{ success: true; data: null }>("/profile/me/password", payload)
  return response.data
}
