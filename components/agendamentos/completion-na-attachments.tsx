"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, CheckCircle2, Eye, FileText, FileUp, FolderOpen, ImageIcon, Loader2, Paperclip, Pencil, ScanLine, Trash2, X } from "lucide-react"
import { toast } from "sonner"

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DocumentScannerDialog } from "@/components/agendamentos/document-scanner-dialog"

interface CompletionNaAttachmentsProps {
  existingAttachments?: ScheduleNaAttachmentRecord[]
  files: File[]
  disabled?: boolean
  uploading?: boolean
  removingDocumentUrl?: string
  renamingDocumentUrl?: string
  onAddFiles: (files: File[]) => void
  onRemoveFile: (index: number) => void
  onRemoveExistingAttachment: (attachment: ScheduleNaAttachmentRecord, index: number) => void
  onRenameExistingAttachment: (attachment: ScheduleNaAttachmentRecord, fileName: string) => void
}

const MAX_ATTACHMENT_FILE_SIZE = 30 * 1024 * 1024
const SUPPORTED_ATTACHMENT_EXTENSIONS = new Set([
  ".arw", ".avif", ".bmp", ".cr2", ".cr3", ".csv", ".dng", ".doc", ".docx",
  ".gif", ".heic", ".heif", ".jfif", ".jpe", ".jpeg", ".jpg", ".nef", ".ods",
  ".odt", ".orf", ".pdf", ".png", ".raf", ".raw", ".rtf", ".rw2", ".tif", ".tiff",
  ".webp", ".xls", ".xlsb", ".xlsm", ".xlsx",
])
const SUPPORTED_DOCUMENT_MIME_TYPES = new Set([
  "application/csv",
  "application/msword",
  "application/pdf",
  "application/rtf",
  "application/vnd.ms-excel",
  "application/vnd.ms-excel.sheet.binary.macroenabled.12",
  "application/vnd.ms-excel.sheet.macroenabled.12",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/csv",
  "text/rtf",
])

function fileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".")
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : ""
}

function isSupportedAttachment(file: File) {
  const mimeType = file.type.split(";", 1)[0]?.trim().toLowerCase() ?? ""
  if (mimeType.startsWith("image/") && mimeType !== "image/svg+xml") return true
  if (SUPPORTED_DOCUMENT_MIME_TYPES.has(mimeType)) return true
  return SUPPORTED_ATTACHMENT_EXTENSIONS.has(fileExtension(file.name))
}

function formatFileSize(size?: number) {
  if (!size) return ""
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(fileName: string, mimeType?: string) {
  const normalized = `${mimeType ?? ""} ${fileName}`.toLowerCase()
  if (normalized.includes("image") || /\.(arw|avif|bmp|cr2|cr3|dng|gif|heic|heif|jfif|jpe?g|nef|orf|png|raf|raw|rw2|tiff?|webp)$/i.test(fileName)) {
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
  renamingDocumentUrl,
  onAddFiles,
  onRemoveFile,
  onRemoveExistingAttachment,
  onRenameExistingAttachment,
}: CompletionNaAttachmentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const scannerCameraInputRef = useRef<HTMLInputElement>(null)
  const scannerGalleryInputRef = useRef<HTMLInputElement>(null)
  const scannerFileInputRef = useRef<HTMLInputElement>(null)
  const [isAndroid, setIsAndroid] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerSourceFile, setScannerSourceFile] = useState<File | null>(null)
  const [pendingRemoval, setPendingRemoval] = useState<{
    attachment: ScheduleNaAttachmentRecord
    index: number
  } | null>(null)
  const [pendingRename, setPendingRename] = useState<ScheduleNaAttachmentRecord | null>(null)
  const [renamedFileName, setRenamedFileName] = useState("")
  const totalItems = existingAttachments.length + files.length

  useEffect(() => {
    setIsAndroid(/Android/i.test(navigator.userAgent))
  }, [])

  const openRenameDialog = (attachment: ScheduleNaAttachmentRecord) => {
    setPendingRename(attachment)
    setRenamedFileName(attachment.fileName)
  }

  const closeRenameDialog = () => {
    setPendingRename(null)
    setRenamedFileName("")
  }

  const addFilesFromInput = (fileList: FileList | null) => {
    const selectedFiles = Array.from(fileList ?? [])
    const oversizedFiles = selectedFiles.filter((file) => file.size > MAX_ATTACHMENT_FILE_SIZE)
    const unsupportedFiles = selectedFiles.filter((file) => !isSupportedAttachment(file))
    const acceptedFiles = selectedFiles.filter(
      (file) => file.size <= MAX_ATTACHMENT_FILE_SIZE && isSupportedAttachment(file),
    )

    if (unsupportedFiles.length > 0) {
      toast.error("Formato não permitido. Anexe fotos, PDF, Word ou planilhas.")
    }
    if (oversizedFiles.length > 0) {
      toast.error("Cada anexo deve ter no máximo 30 MB.")
    }
    if (acceptedFiles.length > 0) onAddFiles(acceptedFiles)
  }

  const openScannerFromFile = (file?: File) => {
    if (!file) return
    if (!file.type.toLowerCase().startsWith("image/")) {
      toast.error("Escolha uma imagem para digitalizar.")
      return
    }
    setScannerSourceFile(file)
    setScannerOpen(true)
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
              <p className="text-sm font-semibold">NAs e evidências</p>
              <p className="text-xs text-muted-foreground">
                Aceita fotos, PDF, Word e planilhas de até 30 MB. Cada arquivo é salvo imediatamente.
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
        data-testid="schedule-attachment-file-input"
        type="file"
        multiple
        className="hidden"
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
      <input
        ref={scannerCameraInputRef}
        data-testid="document-scanner-camera-input"
        type="file"
        className="hidden"
        accept="image/*"
        capture="environment"
        disabled={disabled}
        onChange={(event) => {
          openScannerFromFile(event.target.files?.[0])
          event.currentTarget.value = ""
        }}
      />
      <input
        ref={scannerGalleryInputRef}
        data-testid="document-scanner-gallery-input"
        type="file"
        className="hidden"
        accept="image/*"
        disabled={disabled}
        onChange={(event) => {
          openScannerFromFile(event.target.files?.[0])
          event.currentTarget.value = ""
        }}
      />
      <input
        ref={scannerFileInputRef}
        data-testid="document-scanner-file-input"
        type="file"
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          openScannerFromFile(event.target.files?.[0])
          event.currentTarget.value = ""
        }}
      />

      <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-3">
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
        {isAndroid ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="min-w-0 rounded-full border border-primary/20 bg-primary/10 text-primary shadow-none hover:border-primary/35 hover:bg-primary/15 hover:text-primary"
                disabled={disabled}
              >
                <ScanLine className="mr-2 h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">Digitalizar</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuItem onSelect={() => scannerCameraInputRef.current?.click()}>
                <Camera />
                Câmera
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => scannerGalleryInputRef.current?.click()}>
                <ImageIcon />
                Galeria
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => scannerFileInputRef.current?.click()}>
                <FolderOpen />
                Arquivos
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className="min-w-0 rounded-full border border-primary/20 bg-primary/10 text-primary shadow-none hover:border-primary/35 hover:bg-primary/15 hover:text-primary"
            disabled={disabled}
            onClick={() => scannerGalleryInputRef.current?.click()}
          >
            <ScanLine className="mr-2 h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">Digitalizar</span>
          </Button>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {totalItems === 0 ? (
          <div className="rounded-xl border bg-background/60 px-4 py-5 text-center text-sm text-muted-foreground">
            Nenhum anexo adicionado ainda.
          </div>
        ) : null}

        {existingAttachments.map((attachment, index) => (
          <div key={`${attachment.documentUrl}-${index}`} className="flex min-w-0 items-center gap-3 rounded-xl bg-background px-3 py-2 shadow-none">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{attachment.fileName || `Anexo salvo ${index + 1}`}</p>
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
                  aria-label={`Visualizar ${attachment.fileName || `anexo salvo ${index + 1}`}`}
                  title="Visualizar anexo"
                >
                  <Eye className="h-4 w-4" />
                </a>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                disabled={disabled || Boolean(renamingDocumentUrl)}
                aria-label={`Editar nome de ${attachment.fileName || `anexo salvo ${index + 1}`}`}
                title="Editar nome"
                onClick={() => openRenameDialog(attachment)}
              >
                {renamingDocumentUrl === attachment.documentUrl ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Pencil className="h-4 w-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={disabled || Boolean(removingDocumentUrl)}
                aria-label={`Remover ${attachment.fileName || `anexo salvo ${index + 1}`}`}
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
            <AlertDialogTitle>Remover anexo?</AlertDialogTitle>
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
              Remover anexo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={Boolean(pendingRename)}
        onOpenChange={(open) => {
          if (!open) closeRenameDialog()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault()
              const nextFileName = renamedFileName.trim()
              if (!pendingRename || !nextFileName || nextFileName === pendingRename.fileName) return
              onRenameExistingAttachment(pendingRename, nextFileName)
              closeRenameDialog()
            }}
          >
            <DialogHeader>
              <DialogTitle>Editar nome do arquivo</DialogTitle>
              <DialogDescription>
                Escolha o novo nome exibido para este anexo do agendamento.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="schedule-attachment-file-name">Novo nome do arquivo</Label>
              <Input
                id="schedule-attachment-file-name"
                value={renamedFileName}
                maxLength={255}
                autoFocus
                onChange={(event) => setRenamedFileName(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">Inclua a extensão, como .pdf, .jpg ou .docx.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeRenameDialog}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  !renamedFileName.trim() ||
                  renamedFileName.trim() === pendingRename?.fileName ||
                  Boolean(renamingDocumentUrl)
                }
              >
                Salvar nome
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <DocumentScannerDialog
        open={scannerOpen}
        sourceFile={scannerSourceFile}
        onOpenChange={(open) => {
          setScannerOpen(open)
          if (!open) setScannerSourceFile(null)
        }}
        onScan={(file) => onAddFiles([file])}
      />
    </div>
  )
}
