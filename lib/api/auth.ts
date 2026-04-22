import { api } from "@/lib/api/client"
import type { LoginResponse } from "@/lib/auth/types"

export type LoginPayload = {
  email: string
  password: string
}

export type RequestPasswordResetPayload = {
  email: string
}

export type ResetPasswordPayload = {
  token: string
  newPassword: string
  confirmPassword: string
}

export async function login(payload: LoginPayload) {
  const response = await api.post<LoginResponse>("/auth/login", payload)
  return response.data
}

export async function requestPasswordReset(payload: RequestPasswordResetPayload) {
  const response = await api.post<{ success: true; data: null }>("/auth/password-reset/request", payload)
  return response.data
}

export async function resetPassword(payload: ResetPasswordPayload) {
  const response = await api.post<{ success: true; data: null }>("/auth/password-reset/confirm", payload)
  return response.data
}
