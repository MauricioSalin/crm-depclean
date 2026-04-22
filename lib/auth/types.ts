export type AuthenticatedUser = {
  id: string
  name: string
  email: string
  isActive: boolean
  permissionProfileId: string
  permissionProfileName: string
  permissions: string[]
  employeeId: string
  employeeStatus: "active" | "inactive"
  phone: string
  cpf: string
  role: string
  avatar: string
  isSystemUser: boolean
  mustChangePassword: boolean
  createdAt: string
  updatedAt: string
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
