import { api } from "@/lib/api/client"

export type DepAIFile = {
  id: string
  name: string
  type: string
  size: number
  dataUrl?: string
  content?: string
  extractedText?: string
}

export type DepAIArtifactKind = "pdf" | "docx" | "xlsx" | "chart" | "report"

export type DepAIArtifact = {
  id: string
  kind: DepAIArtifactKind
  title: string
  description: string
  fileName?: string
  mimeType?: string
  downloadUrl?: string
  previewUrl?: string
  status: "ready" | "processing"
}

export type DepAIMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: string
  files?: DepAIFile[]
  artifacts?: DepAIArtifact[]
}

export type DepAIConversation = {
  id: string
  title: string
  updatedAt: string
  messages: DepAIMessage[]
}

export type SendDepAIMessagePayload = {
  conversationId?: string
  message: string
  files: DepAIFile[]
  history?: Array<Pick<DepAIMessage, "role" | "content">>
}

export type SendDepAIMessageResponse = {
  message: DepAIMessage
  conversation: DepAIConversation
}

type ApiSuccessResponse<TData> = {
  success: true
  message: string
  data: TData
}

export async function sendDepAIMessage(payload: SendDepAIMessagePayload): Promise<SendDepAIMessageResponse> {
  const response = await api.post<ApiSuccessResponse<SendDepAIMessageResponse>>("/depai/chat", payload)
  return response.data.data
}

export async function listDepAIConversations(): Promise<DepAIConversation[]> {
  const response = await api.get<ApiSuccessResponse<{ conversations: DepAIConversation[] }>>("/depai/conversations")
  return response.data.data.conversations
}
