import { AxiosError } from "axios"

type ApiErrorBody = {
  message?: string | string[]
  error?: string
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  const axiosError = error as AxiosError<ApiErrorBody>
  const status = axiosError.response?.status
  const requestUrl = axiosError.config?.url ?? ""

  if (axiosError.isAxiosError && status === 401 && !requestUrl.includes("/auth/")) {
    return "Sua sessão expirou. Entre novamente para continuar."
  }

  const responseData = axiosError.response?.data
  const message = responseData?.message

  if (Array.isArray(message) && message.length > 0) {
    return message.join(" ")
  }

  if (typeof message === "string" && message.trim().length > 0) {
    return message
  }

  if (typeof responseData?.error === "string" && responseData.error.trim().length > 0) {
    return responseData.error
  }

  if (axiosError.isAxiosError) {
    switch (status) {
      case 400:
        return "Verifique os dados enviados e tente novamente."
      case 401:
        return "Sua sessão expirou. Entre novamente para continuar."
      case 403:
        return "Você não tem permissão para realizar esta ação."
      case 404:
        return "O registro solicitado não foi encontrado."
      case 409:
        return "Já existe um registro com estes dados."
      case 422:
        return "Revise os campos informados antes de salvar."
      default:
        break
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return fallback
}
