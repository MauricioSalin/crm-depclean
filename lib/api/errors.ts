import { AxiosError } from "axios"

type ApiErrorBody = {
  message?: string | string[]
  error?: string
}

function normalizeTechnicalErrorMessage(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes("reach files limit")) {
    return "Não foi possível enviar o arquivo porque o limite de arquivos foi atingido. Tente novamente."
  }

  if (normalized.includes("file too large") || normalized.includes("request body is too large")) {
    return "O arquivo enviado é muito grande. Escolha um arquivo menor e tente novamente."
  }

  return message
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
    return normalizeTechnicalErrorMessage(message.join(" "))
  }

  if (typeof message === "string" && message.trim().length > 0) {
    return normalizeTechnicalErrorMessage(message)
  }

  if (typeof responseData?.error === "string" && responseData.error.trim().length > 0) {
    return normalizeTechnicalErrorMessage(responseData.error)
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
