"use client"

import { useMutation } from "@tanstack/react-query"
import {
  BarChart3,
  Bot,
  ClipboardList,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  LoaderCircle,
  Plus,
  Send,
  X,
} from "lucide-react"
import { FormEvent, useEffect, useRef, useState, type RefObject } from "react"

import {
  sendDepAIMessage,
  type DepAIArtifact,
  type DepAIFile,
  type DepAIMessage,
} from "@/lib/api/depai"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

const initialMessages: DepAIMessage[] = []

const suggestions = [
  "Consultar dados de um cliente",
  "Analisar um documento anexado",
  "Resumir histórico de atendimento",
  "Ajudar com uma dúvida operacional",
]

type DepAIConversation = {
  id: string
  title: string
  updatedAt: string
  messages: DepAIMessage[]
}

const initialConversations: DepAIConversation[] = [
  {
    id: "chat-welcome",
    title: "Nova conversa",
    updatedAt: new Date().toISOString(),
    messages: initialMessages,
  },
]

function createConversation(): DepAIConversation {
  return {
    id: `chat-${Date.now()}`,
    title: "Nova conversa",
    updatedAt: new Date().toISOString(),
    messages: [],
  }
}

function getConversationTitle(message: string) {
  const trimmed = message.trim()
  if (!trimmed) return "Nova conversa"
  return trimmed.length > 44 ? `${trimmed.slice(0, 44)}...` : trimmed
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function mapFile(file: File): DepAIFile {
  return {
    id: `${file.name}-${file.lastModified}-${file.size}`,
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
  }
}

function FileIcon({ type }: { type: string }) {
  if (type.startsWith("image/")) return <ImageIcon className="h-4 w-4" />
  return <FileText className="h-4 w-4" />
}

function ArtifactIcon({ kind }: { kind: DepAIArtifact["kind"] }) {
  if (kind === "xlsx") return <FileSpreadsheet className="h-4 w-4" />
  if (kind === "chart") return <BarChart3 className="h-4 w-4" />
  if (kind === "report") return <ClipboardList className="h-4 w-4" />
  return <FileText className="h-4 w-4" />
}

function ArtifactCard({ artifact }: { artifact: DepAIArtifact }) {
  return (
    <div className="mt-3 rounded-2xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ArtifactIcon kind={artifact.kind} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{artifact.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{artifact.description}</p>
            {artifact.fileName && (
              <p className="mt-1 truncate text-[11px] text-muted-foreground">{artifact.fileName}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled={!artifact.previewUrl}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled={!artifact.downloadUrl}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function Avatar({ role }: { role: DepAIMessage["role"] }) {
  if (role === "user") {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
        VC
      </div>
    )
  }

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm shadow-primary/20">
      <Bot className="h-4 w-4" />
    </div>
  )
}

function ThinkingMessage() {
  return (
    <div className="group mx-auto flex w-full max-w-3xl gap-4 px-4 py-5">
      <Avatar role="assistant" />
      <div className="flex min-h-8 items-center">
        <span className="flex gap-1.5" aria-label="DepAI está pensando">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
        </span>
      </div>
    </div>
  )
}

function MessageRow({ message }: { message: DepAIMessage }) {
  if (message.role === "user") {
    return (
      <div className="mx-auto flex w-full max-w-3xl justify-end px-4 py-5">
        <div className="max-w-[78%] rounded-3xl bg-muted px-5 py-3 text-sm leading-7 text-foreground md:text-[15px]">
          <p className="whitespace-pre-line">{message.content}</p>
          {message.files && message.files.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.files.map((file) => (
                <span key={file.id} className="inline-flex max-w-full items-center gap-2 rounded-2xl bg-background/80 px-3 py-2 text-xs text-muted-foreground">
                  <FileIcon type={file.type} />
                  <span className="max-w-[220px] truncate text-foreground">{file.name}</span>
                  <span>{formatFileSize(file.size)}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="group mx-auto flex w-full max-w-3xl gap-4 px-4 py-5 transition-colors hover:bg-muted/20">
      <Avatar role={message.role} />
      <div className="min-w-0 flex-1 pt-1 text-sm leading-7 text-foreground md:text-[15px]">
        <p className="whitespace-pre-line">{message.content}</p>
        {message.files && message.files.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {message.files.map((file) => (
              <span key={file.id} className="inline-flex max-w-full items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-sm">
                <FileIcon type={file.type} />
                <span className="max-w-[220px] truncate text-foreground">{file.name}</span>
                <span>{formatFileSize(file.size)}</span>
              </span>
            ))}
          </div>
        )}
        {message.artifacts && message.artifacts.length > 0 && (
          <div className="mt-4 space-y-2">
            {message.artifacts.map((artifact) => (
              <ArtifactCard key={artifact.id} artifact={artifact} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function DepAIChat({ compact = false }: { compact?: boolean }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [conversations, setConversations] = useState<DepAIConversation[]>(initialConversations)
  const [activeConversationId, setActiveConversationId] = useState(initialConversations[0].id)
  const [input, setInput] = useState("")
  const [files, setFiles] = useState<DepAIFile[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? conversations[0]
  const messages = activeConversation.messages ?? []

  const sendMutation = useMutation({
    mutationFn: sendDepAIMessage,
    onSuccess: (response) => {
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === activeConversationId
            ?{
                ...conversation,
                messages: [...conversation.messages, response.message],
                updatedAt: new Date().toISOString(),
              }
            : conversation,
        ),
      )
    },
  })

  const submit = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || sendMutation.isPending) return

    const userMessage: DepAIMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
      files,
    }

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === activeConversationId
          ?{
              ...conversation,
              title: conversation.messages.length === 0 ? getConversationTitle(trimmed) : conversation.title,
              messages: [...conversation.messages, userMessage],
              updatedAt: new Date().toISOString(),
            }
          : conversation,
      ),
    )
    setInput("")
    setFiles([])
    sendMutation.mutate({ message: trimmed, files })
  }

  const addFiles = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return
    setFiles((current) => {
      const nextFiles = Array.from(selectedFiles).map(mapFile)
      const unique = new Map([...current, ...nextFiles].map((file) => [file.id, file]))
      return Array.from(unique.values()).slice(0, 6)
    })
  }

  const removeFile = (id: string) => setFiles((current) => current.filter((item) => item.id !== id))

  const startNewConversation = () => {
    const conversation = createConversation()
    setConversations((current) => [conversation, ...current])
    setActiveConversationId(conversation.id)
    setInput("")
    setFiles([])
    setHistoryOpen(false)
  }

  const openConversation = (id: string) => {
    setActiveConversationId(id)
    setInput("")
    setFiles([])
    setHistoryOpen(false)
  }


  useEffect(() => {
    const handleNewConversation = () => startNewConversation()
    const handleToggleHistory = () => setHistoryOpen((current) => !current)

    window.addEventListener("depai:new-conversation", handleNewConversation)
    window.addEventListener("depai:toggle-history", handleToggleHistory)

    return () => {
      window.removeEventListener("depai:new-conversation", handleNewConversation)
      window.removeEventListener("depai:toggle-history", handleToggleHistory)
    }
  })
  if (compact) {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="h-[330px] overflow-y-auto">
          {messages.map((message) => <MessageRow key={message.id} message={message} />)}
          {sendMutation.isPending && <ThinkingMessage />}
        </div>
        <ChatComposer input={input} files={files} isPending={sendMutation.isPending} fileInputRef={fileInputRef} onInputChange={setInput} onSubmit={submit} onAddFiles={addFiles} onRemoveFile={removeFile} />
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden bg-background">
      <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden">

        <div className="flex-1 overflow-y-auto pb-36 pt-4">
          {messages.length === 0 && (
            <div className="mx-auto flex max-w-3xl flex-col items-center px-4 pb-4 pt-12 text-center">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <Bot className="h-7 w-7" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Como posso ajudar hoje</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                {"Pergunte algo para a DepAI ou envie um arquivo para preparar a análise quando a integração estiver ativa."}
              </p>
              <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                {suggestions.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => setInput(suggestion)} className="rounded-2xl border border-border bg-card px-4 py-3 text-left text-sm text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground hover:shadow-sm">
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            {messages.map((message) => <MessageRow key={message.id} message={message} />)}
            {sendMutation.isPending && <ThinkingMessage />}
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background to-background/0 px-4 pb-4 pt-10">
          <div className="mx-auto max-w-3xl">
            <ChatComposer input={input} files={files} isPending={sendMutation.isPending} fileInputRef={fileInputRef} onInputChange={setInput} onSubmit={submit} onAddFiles={addFiles} onRemoveFile={removeFile} />
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              {"A DepAI pode cometer erros. Confirme informações importantes antes de usar operacionalmente."}
            </p>
          </div>
        </div>
      </section>

      <aside className={`h-full shrink-0 overflow-hidden border-l border-border/70 bg-background/95 transition-[width] duration-300 ease-out ${historyOpen ? "w-[340px]" : "w-0"}`}>
        <div className="flex h-full w-[340px] flex-col p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{"Histórico"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Continue uma conversa ou comece outra.</p>
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setHistoryOpen(false)} aria-label={"Fechar histórico"}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Button type="button" className="mb-4 w-full gap-2 rounded-2xl" onClick={startNewConversation}>
            <Plus className="h-4 w-4" />
            Nova conversa
          </Button>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {conversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId
              return (
                <button key={conversation.id} type="button" onClick={() => openConversation(conversation.id)} className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${isActive ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted/60"}`}>
                  <p className="truncate text-sm font-medium text-foreground">{conversation.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{conversation.messages.length} mensagem(ns)</p>
                </button>
              )
            })}
          </div>
        </div>
      </aside>
    </div>
  )
}

function ChatComposer({
  input,
  files,
  isPending,
  fileInputRef,
  onInputChange,
  onSubmit,
  onAddFiles,
  onRemoveFile,
}: {
  input: string
  files: DepAIFile[]
  isPending: boolean
  fileInputRef: RefObject<HTMLInputElement | null>
  onInputChange: (value: string) => void
  onSubmit: (event?: FormEvent<HTMLFormElement>) => void
  onAddFiles: (files: FileList | null) => void
  onRemoveFile: (id: string) => void
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-3xl border border-border bg-card p-2 shadow-xl shadow-black/5">
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 px-2 pt-1">
          {files.map((file) => (
            <span key={file.id} className="inline-flex items-center gap-2 rounded-2xl bg-muted px-3 py-1.5 text-xs text-muted-foreground">
              <FileIcon type={file.type} />
              <span className="max-w-[180px] truncate text-foreground">{file.name}</span>
              <span>{formatFileSize(file.size)}</span>
              <button type="button" onClick={() => onRemoveFile(file.id)} className="rounded-full p-0.5 transition-colors hover:bg-background" aria-label={`Remover ${file.name}`}>
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <input ref={fileInputRef} type="file" className="hidden" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={(event) => onAddFiles(event.target.files)} />
        <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full" onClick={() => fileInputRef.current?.click()}>
          <Plus className="h-5 w-5" />
        </Button>
        <Textarea value={input} onChange={(event) => onInputChange(event.target.value)} placeholder="Pergunte alguma coisa" className="max-h-40 min-h-10 flex-1 resize-none border-0 bg-transparent px-0 py-2 shadow-none focus-visible:ring-0" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSubmit() } }} />
        <Button type="submit" size="icon" className="h-10 w-10 shrink-0 rounded-full" disabled={!input.trim() || isPending}>
          {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </form>
  )
}