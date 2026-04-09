export type AuthenticatedUser = {
  id: string
  name: string
  email: string
  isActive: boolean
  permissionProfileId: string
  permissionProfileName: string
  permissions: string[]
  createdAt: string
}

export type LoginResponse = {
  success: true
  message: string
  data: {
    accessToken: string
    refreshToken: string
    user: AuthenticatedUser
  }
  meta: {
    version: string
    timestamp: string
  }
}
