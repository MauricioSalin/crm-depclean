"use client"

import { useRef, useState } from "react"
import { Camera, CheckCircle2, Eye, FileText, FileUp, ImageIcon, Loader2, Paperclip, Trash2, X } from "lucide-react"

import { buildApiFileUrl } from "@/lib/api/client"
import type { ScheduleNaAttachmentRecord } from "@/lib/api/schedules"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

interface CompletionNaAttachmentsProps {
  existingAttachments?: ScheduleNaAttachmentRecord[]
  files: File[]
  disabled?: boolean
  uploading?: boolean
  removingDocumentUrl?: string
  onAddFiles: (files: File[]) => void
  onRemoveFile: (index: number) => void
  onRemoveExistingAttachment: (attachment: ScheduleNaAttachmentRecord, index: number) => void
}

function formatFileSize(size?: number) {
  if (!size) return ""
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(fileName: string, mimeType?: string) {
  const normalized = `${mimeType ?? ""} ${fileName}`.toLowerCase()
  if (normalized.includes("image") || /\.(png|jpe?g|webp|heic)$/i.test(fileName)) {
    return <ImageIcon className="h-4 w-4" />
  }
  return <FileText className="h-4 w-4" />
}

export function CompletionNaAttachments({
  existingAttachments = [],
  files,
  disabled,
  uploading = false,
  removingDocumentUrl,
  onAddFiles,
  onRemoveFile,
  onRemoveExistingAttachment,
}: CompletionNaAttachmentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [pendingRemoval, setPendingRemoval] = useState<{
    attachment: ScheduleNaAttachmentRecord
    index: number
  } | null>(null)
  const totalItems = existingAttachments.length + files.length

  const addFilesFromInput = (fileList: FileList | null) => {
    const selectedFiles = Array.from(fileList ?? [])
    if (selectedFiles.length > 0) {
      onAddFiles(selectedFiles)
    }
  }

  return (
    <div className="min-w-0 overflow-visible rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Paperclip className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">NAs da visita</p>
              <p className="text-xs text-muted-foreground">
                Adicione uma NA por dia executado. Cada arquivo é salvo imediatamente.
              </p>
            </div>
          </div>
        </div>
        <span className="w-fit shrink-0 rounded-full bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs">
          {totalItems} {totalItems === 1 ? "anexo" : "anexos"}
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
        disabled={disabled}
        onChange={(event) => {
          addFilesFromInput(event.target.files)
          event.currentTarget.value = ""
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        capture="environment"
        disabled={disabled}
        onChange={(event) => {
          addFilesFromInput(event.target.files)
          event.currentTarget.value = ""
        }}
      />

      <div className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="ghost"
          className="min-w-0 flex-1 rounded-full border border-primary/20 bg-primary/10 text-primary shadow-none hover:border-primary/35 hover:bg-primary/15 hover:text-primary"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
        >
          <FileUp className="mr-2 h-4 w-4 shrink-0 text-primary" />
          <span className="truncate">Anexar arquivos</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-w-0 flex-1 rounded-full border border-primary/20 bg-primary/10 text-primary shadow-none hover:border-primary/35 hover:bg-primary/15 hover:text-primary"
          disabled={disabled}
          onClick={() => cameraInputRef.current?.click()}
        >
          <Camera className="mr-2 h-4 w-4 shrink-0 text-primary" />
          <span className="truncate">Usar câmera</span>
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {totalItems === 0 ? (
          <div className="rounded-xl border bg-background/60 px-4 py-5 text-center text-sm text-muted-foreground">
            Nenhuma NA adicionada ainda.
          </div>
        ) : null}

        {existingAttachments.map((attachment, index) => (
          <div key={`${attachment.documentUrl}-${index}`} className="flex min-w-0 items-center gap-3 rounded-xl bg-background px-3 py-2 shadow-none">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{attachment.fileName || `NA salva ${index + 1}`}</p>
              <p className="text-xs text-muted-foreground">
                Salva no agendamento{formatFileSize(attachment.fileSize) ? ` • ${formatFileSize(attachment.fileSize)}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" asChild>
                <a
                  href={buildApiFileUrl(attachment.documentUrl)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Visualizar ${attachment.fileName || `NA salva ${index + 1}`}`}
                  title="Visualizar anexo"
                >
                  <Eye className="h-4 w-4" />
                </a>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={disabled || Boolean(removingDocumentUrl)}
                aria-label={`Remover ${attachment.fileName || `NA salva ${index + 1}`}`}
                title="Remover anexo"
                onClick={() => setPendingRemoval({ attachment, index })}
              >
                {removingDocumentUrl === attachment.documentUrl ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        ))}

        {files.map((file, index) => (
          <div key={`${file.name}-${file.size}-${file.lastModified}-${index}`} className="flex min-w-0 items-center gap-3 rounded-xl bg-background px-3 py-2 shadow-none">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              {getFileIcon(file.name, file.type)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {uploading ? "Salvando no agendamento" : "Aguardando envio"} • {formatFileSize(file.size)}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full"
              disabled={disabled || uploading}
              aria-label={`Remover ${file.name}`}
              onClick={() => onRemoveFile(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <AlertDialog
        open={Boolean(pendingRemoval)}
        onOpenChange={(open) => {
          if (!open) setPendingRemoval(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover NA?</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo {pendingRemoval?.attachment.fileName || "selecionado"} será removido do agendamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingRemoval) {
                  onRemoveExistingAttachment(pendingRemoval.attachment, pendingRemoval.index)
                }
                setPendingRemoval(null)
              }}
            >
              Remover NA
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
