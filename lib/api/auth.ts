import { api } from "@/lib/api/client"
import type { LoginResponse } from "@/lib/auth/types"

export type LoginPayload = {
  identifier: string
  password?: string
}

export type IdentifyLoginPayload = {
  identifier: string
}

export type IdentifyLoginResponse = {
  success: true
  data: {
    authMode: "password" | "code"
  }
}

export type RequestLoginCodePayload = {
  identifier: string
}

export type ConfirmLoginCodePayload = {
  identifier: string
  code: string
}

export type RequestPasswordResetPayload = {
  identifier: string
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

export async function identifyLogin(payload: IdentifyLoginPayload) {
  const response = await api.post<IdentifyLoginResponse>("/auth/login/identify", payload)
  return response.data
}

export async function requestLoginCode(payload: RequestLoginCodePayload) {
  const response = await api.post<{ success: true; data: null }>("/auth/login-code/request", payload)
  return response.data
}

export async function confirmLoginCode(payload: ConfirmLoginCodePayload) {
  const response = await api.post<LoginResponse>("/auth/login-code/confirm", payload)
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
