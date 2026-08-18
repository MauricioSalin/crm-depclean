"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  File,
  FileCheck2,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  clientAttachmentTypes,
  createClientAttachmentFolder,
  deleteClientAttachmentFolder,
  deleteWorkspaceClientAttachment,
  getClientAttachmentWorkspace,
  updateClientAttachment,
  updateClientAttachmentFolder,
  uploadClientAttachment,
  type ClientAttachmentFolderRecord,
  type ClientAttachmentRecord,
  type ClientAttachmentType,
} from "@/lib/api/clients"
import { getApiErrorMessage } from "@/lib/api/errors"
import { cn } from "@/lib/utils"

const typeLabels: Record<ClientAttachmentType, string> = {
  contract: "Contrato",
  schedule: "Agendamento",
  meeting_minutes: "Ata",
  bait_stations: "Porta Iscas",
  checklist: "Checklist",
  other: "Outro",
}

type EditableItem =
  | { kind: "folder"; folder: ClientAttachmentFolderRecord }
  | { kind: "file"; file: ClientAttachmentRecord }

type DeleteTarget =
  | { kind: "folder"; id: string; name: string }
  | { kind: "file"; id: string; name: string }

type DraggedWorkspaceItem =
  | { kind: "folder"; id: string; name: string; parentId: string | null }
  | { kind: "file"; id: string; name: string; parentId: string | null }

const workspaceDragDataType = "application/x-depclean-attachment-item"
const rootDropTargetId = "__attachment-root__"

type ClientAttachmentsBrowserProps = {
  clientId: string
  canEdit: boolean
  canDelete: boolean
  onDownload: (attachment: ClientAttachmentRecord) => void | Promise<void>
  isDownloadBusy?: boolean
}

function formatFileSize(value?: number) {
  if (!value) return "Tamanho não informado"
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function displayFileName(file: ClientAttachmentRecord) {
  return file.title.trim() || file.fileName.trim() || "Arquivo"
}

function formatFolderFileCount(count: number) {
  return `${count} ${count === 1 ? "arquivo" : "arquivos"}`
}

function hasWorkspaceDrag(dataTransfer: DataTransfer) {
  return Array.from(dataTransfer.types).includes(workspaceDragDataType)
}

function readWorkspaceDrag(dataTransfer: DataTransfer): DraggedWorkspaceItem | null {
  try {
    const parsed = JSON.parse(dataTransfer.getData(workspaceDragDataType)) as DraggedWorkspaceItem
    if ((parsed.kind === "folder" || parsed.kind === "file") && parsed.id && parsed.name) return parsed
  } catch {
    // Dados de arraste externos não pertencem ao workspace.
  }
  return null
}

export function ClientAttachmentsBrowser({
  clientId,
  canEdit,
  canDelete,
  onDownload,
  isDownloadBusy = false,
}: ClientAttachmentsBrowserProps) {
  const queryClient = useQueryClient()
  const nativeFileInputRef = useRef<HTMLInputElement | null>(null)
  const [folderNavigation, setFolderNavigation] = useState<{
    entries: Array<string | null>
    index: number
  }>({ entries: [null], index: 0 })
  const currentFolderId = folderNavigation.entries[folderNavigation.index] ?? null
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<ClientAttachmentType | "all">("all")
  const [isDragging, setIsDragging] = useState(false)
  const [operationProgress, setOperationProgress] = useState<number | null>(null)
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [editableItem, setEditableItem] = useState<EditableItem | null>(null)
  const [editName, setEditName] = useState("")
  const [editType, setEditType] = useState<ClientAttachmentType>("other")
  const [draggedItem, setDraggedItem] = useState<DraggedWorkspaceItem | null>(null)
  const [activeDropTargetId, setActiveDropTargetId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [uploadType, setUploadType] = useState<ClientAttachmentType>("other")
  const [uploadScheduleId, setUploadScheduleId] = useState("")
  const dragAutoScrollActiveRef = useRef(false)

  useEffect(() => {
    const edgeSize = 120
    const maximumSpeed = 22
    let velocity = 0
    let animationFrame: number | null = null

    const stopScrolling = () => {
      velocity = 0
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame)
      animationFrame = null
    }

    const scrollFrame = () => {
      if (!dragAutoScrollActiveRef.current || velocity === 0) {
        stopScrolling()
        return
      }
      window.scrollBy(0, velocity)
      animationFrame = window.requestAnimationFrame(scrollFrame)
    }

    const updateScrolling = (event: DragEvent) => {
      if (!dragAutoScrollActiveRef.current) return
      const distanceFromTop = event.clientY
      const distanceFromBottom = window.innerHeight - event.clientY
      const nextVelocity = distanceFromTop < edgeSize
        ? -Math.min(maximumSpeed, Math.max(4, Math.round(maximumSpeed * (1 - distanceFromTop / edgeSize))))
        : distanceFromBottom < edgeSize
          ? Math.min(maximumSpeed, Math.max(4, Math.round(maximumSpeed * (1 - distanceFromBottom / edgeSize))))
          : 0

      velocity = nextVelocity
      if (velocity === 0) {
        stopScrolling()
      } else if (animationFrame === null) {
        animationFrame = window.requestAnimationFrame(scrollFrame)
      }
    }

    const finishDrag = () => {
      dragAutoScrollActiveRef.current = false
      stopScrolling()
    }

    document.addEventListener("dragover", updateScrolling)
    document.addEventListener("drop", finishDrag)
    document.addEventListener("dragend", finishDrag)
    window.addEventListener("blur", finishDrag)
    return () => {
      document.removeEventListener("dragover", updateScrolling)
      document.removeEventListener("drop", finishDrag)
      document.removeEventListener("dragend", finishDrag)
      window.removeEventListener("blur", finishDrag)
      finishDrag()
    }
  }, [])

  const workspaceQuery = useQuery({
    queryKey: ["client-attachment-workspace", clientId],
    queryFn: () => getClientAttachmentWorkspace(clientId),
  })
  const workspace = workspaceQuery.data?.data
  const folders = workspace?.folders ?? []
  const files = workspace?.files ?? []
  const folderById = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders])
  const folderFileCounts = useMemo(() => {
    const counts = new Map<string, number>()

    files.forEach((file) => {
      const visitedFolderIds = new Set<string>()
      let folderId = file.parentId

      while (folderId && !visitedFolderIds.has(folderId)) {
        visitedFolderIds.add(folderId)
        counts.set(folderId, (counts.get(folderId) ?? 0) + 1)
        folderId = folderById.get(folderId)?.parentId ?? null
      }
    })

    return counts
  }, [files, folderById])
  const currentFolder = currentFolderId ? folderById.get(currentFolderId) : undefined

  const breadcrumbs = useMemo(() => {
    const items: ClientAttachmentFolderRecord[] = []
    const seen = new Set<string>()
    let cursor = currentFolder
    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id)
      items.unshift(cursor)
      cursor = cursor.parentId ? folderById.get(cursor.parentId) : undefined
    }
    return items
  }, [currentFolder, folderById])

  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR")
  const visibleFolders = folders.filter((folder) => {
    if (normalizedSearch) return folder.name.toLocaleLowerCase("pt-BR").includes(normalizedSearch)
    return folder.parentId === currentFolderId
  })
  const visibleFiles = files.filter((file) => {
    if (typeFilter !== "all" && file.type !== typeFilter) return false
    if (normalizedSearch) {
      return [file.title, file.fileName, typeLabels[file.type]]
        .some((value) => value.toLocaleLowerCase("pt-BR").includes(normalizedSearch))
    }
    return file.parentId === currentFolderId
  })
  const scheduleFolders = folders.filter((folder) => folder.systemKind === "schedule")
  const rootFolders = folders.filter((folder) => folder.parentId === null)
  const isBusy = operationProgress !== null

  const attachmentPathForFolder = (folderId: string | null) => {
    const items: string[] = []
    const seen = new Set<string>()
    let cursorId = folderId

    while (cursorId && !seen.has(cursorId)) {
      seen.add(cursorId)
      const folder = folderById.get(cursorId)
      if (!folder) break
      items.unshift(folder.name)
      cursorId = folder.parentId
    }

    return ["Anexos", ...items]
  }

  const uploadScheduledServiceId = currentFolder?.scheduledServiceId
    || (uploadType === "schedule" ? uploadScheduleId : "")
  const uploadScheduleAttachmentsFolder = uploadScheduledServiceId
    ? folders.find((folder) => (
        folder.systemKind === "schedule_attachments"
        && folder.scheduledServiceId === uploadScheduledServiceId
      ))
    : undefined
  const uploadDestinationFolderId = uploadScheduleAttachmentsFolder?.id ?? currentFolderId
  const uploadDestinationPath = attachmentPathForFolder(uploadDestinationFolderId)
  const currentDestinationPath = attachmentPathForFolder(currentFolderId)

  const navigateToFolder = (folderId: string | null) => {
    setFolderNavigation((current) => {
      const currentFolder = current.entries[current.index] ?? null
      if (currentFolder === folderId) return current

      const entries = [...current.entries.slice(0, current.index + 1), folderId]
      return { entries, index: entries.length - 1 }
    })
  }

  const navigateBack = () => {
    setFolderNavigation((current) => ({
      ...current,
      index: Math.max(0, current.index - 1),
    }))
  }

  const navigateForward = () => {
    setFolderNavigation((current) => ({
      ...current,
      index: Math.min(current.entries.length - 1, current.index + 1),
    }))
  }

  const invalidateWorkspace = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["client-attachment-workspace", clientId] }),
      queryClient.invalidateQueries({ queryKey: ["client-attachments", clientId] }),
    ])
  }

  const runOperation = async <T,>(message: string, successMessage: string, operation: () => Promise<T>) => {
    const toastId = toast.loading(message)
    setOperationProgress(42)
    try {
      const result = await operation()
      setOperationProgress(88)
      await invalidateWorkspace()
      setOperationProgress(100)
      toast.success(successMessage, { id: toastId })
      return result
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível concluir a operação."), { id: toastId })
      throw error
    } finally {
      window.setTimeout(() => setOperationProgress(null), 220)
    }
  }

  const openUpload = (selectedFiles: File[] = []) => {
    setUploadFiles(selectedFiles)
    const folderType = currentFolder?.systemKind as ClientAttachmentType | undefined
    setUploadType(currentFolder?.scheduledServiceId
      ? "schedule"
      : folderType && clientAttachmentTypes.includes(folderType) ? folderType : "other")
    setUploadScheduleId(currentFolder?.scheduledServiceId ?? "")
    setIsUploadOpen(true)
  }

  const addUploadFiles = (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return
    setUploadFiles((current) => [...current, ...selectedFiles])
  }

  const submitUpload = async () => {
    if (uploadFiles.length === 0) {
      toast.error("Selecione pelo menos um arquivo.")
      return
    }
    if (uploadType === "schedule" && !currentFolder?.scheduledServiceId && !uploadScheduleId) {
      toast.error("Selecione o agendamento deste arquivo.")
      return
    }

    const filesToUpload = [...uploadFiles]
    const selectedType = uploadType
    const selectedParentId = uploadDestinationFolderId
    const selectedScheduleId = currentFolder?.scheduledServiceId || uploadScheduleId || undefined
    setIsUploadOpen(false)
    setUploadFiles([])
    const toastId = toast.loading(`Enviando ${filesToUpload.length} arquivo(s)...`)
    setOperationProgress(5)
    try {
      for (const [index, file] of filesToUpload.entries()) {
        await uploadClientAttachment(clientId, file, {
          title: file.name,
          type: selectedType,
          parentId: selectedParentId,
          scheduledServiceId: selectedScheduleId,
        })
        setOperationProgress(Math.round(((index + 1) / filesToUpload.length) * 100))
      }
      await invalidateWorkspace()
      toast.success("Upload concluído com sucesso.", { id: toastId })
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível enviar os arquivos."), { id: toastId })
    } finally {
      window.setTimeout(() => setOperationProgress(null), 220)
    }
  }

  const submitCreateFolder = async () => {
    try {
      await runOperation("Criando pasta...", "Pasta criada.", () => createClientAttachmentFolder(clientId, {
        name: newFolderName,
        parentId: currentFolderId,
      }))
      setNewFolderName("")
      setIsCreateFolderOpen(false)
    } catch {
      // O toast da operação já apresenta o erro da API.
    }
  }

  const openEditor = (item: EditableItem) => {
    setEditableItem(item)
    if (item.kind === "folder") {
      setEditName(item.folder.name)
      setEditType("other")
    } else {
      setEditName(displayFileName(item.file))
      setEditType(item.file.type)
    }
  }

  const submitEdit = async () => {
    if (!editableItem) return
    try {
      if (editableItem.kind === "folder") {
        await runOperation("Renomeando pasta...", "Pasta atualizada.", () => updateClientAttachmentFolder(
          clientId,
          editableItem.folder.id,
          { name: editName },
        ))
      } else {
        await runOperation("Salvando arquivo...", "Arquivo atualizado.", () => updateClientAttachment(
          clientId,
          editableItem.file.id,
          { name: editName, type: editType },
        ))
      }
      setEditableItem(null)
    } catch {
      // O toast da operação já apresenta o erro da API.
    }
  }

  const confirmDelete = async () => {
    const target = deleteTarget
    if (!target) return
    setDeleteTarget(null)
    try {
      if (target.kind === "folder") {
        await runOperation("Removendo pasta e conteúdo...", "Pasta removida.", () =>
          deleteClientAttachmentFolder(clientId, target.id))
        if (currentFolderId === target.id) navigateToFolder(null)
      } else {
        await runOperation("Removendo arquivo...", "Arquivo removido.", () =>
          deleteWorkspaceClientAttachment(clientId, target.id))
      }
    } catch {
      // O toast da operação já apresenta o erro da API.
    }
  }

  const dropTargetKey = (folderId: string | null) => folderId ?? rootDropTargetId

  const isInvalidFolderDestination = (item: DraggedWorkspaceItem, targetFolderId: string | null) => {
    if (item.kind !== "folder" || !targetFolderId) return false
    if (item.id === targetFolderId) return true

    const visitedFolderIds = new Set<string>()
    let cursorId: string | null = targetFolderId
    while (cursorId && !visitedFolderIds.has(cursorId)) {
      if (cursorId === item.id) return true
      visitedFolderIds.add(cursorId)
      cursorId = folderById.get(cursorId)?.parentId ?? null
    }
    return false
  }

  const moveWorkspaceItem = async (item: DraggedWorkspaceItem, targetFolderId: string | null) => {
    setActiveDropTargetId(null)
    setDraggedItem(null)
    if (item.parentId === targetFolderId) return
    if (isInvalidFolderDestination(item, targetFolderId)) {
      toast.error("Não é possível mover uma pasta para dentro dela mesma ou de uma subpasta.")
      return
    }

    try {
      if (item.kind === "folder") {
        await runOperation("Movendo pasta e seus arquivos...", "Pasta movida com sucesso.", () =>
          updateClientAttachmentFolder(clientId, item.id, { parentId: targetFolderId }))
      } else {
        await runOperation("Movendo arquivo...", "Arquivo movido com sucesso.", () =>
          updateClientAttachment(clientId, item.id, { parentId: targetFolderId }))
      }
    } catch {
      // O toast da operação já apresenta o erro da API.
    }
  }

  const renderMoveShortcut = (item: DraggedWorkspaceItem) => (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <FolderInput /> Mover
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent sideOffset={-2} className="z-[230] max-h-72 min-w-56 overflow-y-auto">
        <DropdownMenuItem
          disabled={item.parentId === null}
          onSelect={() => void moveWorkspaceItem(item, null)}
        >
          Raiz
        </DropdownMenuItem>
        {rootFolders
          .filter((folder) => !isInvalidFolderDestination(item, folder.id))
          .map((folder) => (
            <DropdownMenuItem
              key={folder.id}
              disabled={item.parentId === folder.id}
              onSelect={() => void moveWorkspaceItem(item, folder.id)}
            >
              {folder.name}
            </DropdownMenuItem>
          ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )

  const handleWorkspaceDragStart = (event: React.DragEvent, item: DraggedWorkspaceItem) => {
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData(workspaceDragDataType, JSON.stringify(item))
    dragAutoScrollActiveRef.current = true
    setDraggedItem(item)
  }

  const handleWorkspaceDragEnd = () => {
    dragAutoScrollActiveRef.current = false
    setDraggedItem(null)
    setActiveDropTargetId(null)
  }

  const handleWorkspaceDragOver = (event: React.DragEvent, targetFolderId: string | null) => {
    const item = draggedItem || readWorkspaceDrag(event.dataTransfer)
    if (!canEdit || isBusy || !item || isInvalidFolderDestination(item, targetFolderId)) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = "move"
    setActiveDropTargetId(dropTargetKey(targetFolderId))
  }

  const handleWorkspaceDrop = (event: React.DragEvent, targetFolderId: string | null) => {
    const item = draggedItem || readWorkspaceDrag(event.dataTransfer)
    if (!item) return
    event.preventDefault()
    event.stopPropagation()
    void moveWorkspaceItem(item, targetFolderId)
  }

  const handleWorkspaceDragLeave = (event: React.DragEvent, targetFolderId: string | null) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    const targetId = dropTargetKey(targetFolderId)
    setActiveDropTargetId((current) => current === targetId ? null : current)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    if (!canEdit || isBusy) return
    const workspaceItem = draggedItem || readWorkspaceDrag(event.dataTransfer)
    if (workspaceItem) {
      void moveWorkspaceItem(workspaceItem, currentFolderId)
      return
    }
    const droppedFiles = Array.from(event.dataTransfer.files)
    if (droppedFiles.length > 0) openUpload(droppedFiles)
  }

  return (
    <div className="space-y-4">
      <div data-client-attachments-toolbar className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisar em todas as pastas..."
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as ClientAttachmentType | "all")}>
          <SelectTrigger className="w-full lg:w-52">
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {clientAttachmentTypes.map((type) => <SelectItem key={type} value={type}>{typeLabels[type]}</SelectItem>)}
          </SelectContent>
        </Select>
        {canEdit ? (
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsCreateFolderOpen(true)} disabled={isBusy}>
              <FolderPlus className="mr-2 h-4 w-4" /> Nova pasta
            </Button>
            <Button type="button" onClick={() => openUpload()} disabled={isBusy}>
              <Upload className="mr-2 h-4 w-4" /> Upload
            </Button>
          </div>
        ) : null}
      </div>

      {operationProgress !== null ? (
        <div className="rounded-xl bg-muted/40 px-4 py-3">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Processando arquivos com segurança...</span>
            <span>{operationProgress}%</span>
          </div>
          <Progress value={operationProgress} />
        </div>
      ) : null}

      <div className="space-y-4">
        <div data-client-attachments-breadcrumb className="flex min-h-9 flex-wrap items-center gap-1 text-sm">
            <div className="mr-1 flex shrink-0 items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 cursor-pointer disabled:cursor-not-allowed"
                aria-label="Voltar na navegação de pastas"
                title="Voltar"
                disabled={folderNavigation.index === 0}
                onClick={navigateBack}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 cursor-pointer disabled:cursor-not-allowed"
                aria-label="Avançar na navegação de pastas"
                title="Avançar"
                disabled={folderNavigation.index >= folderNavigation.entries.length - 1}
                onClick={navigateForward}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <button
              type="button"
              data-breadcrumb-item
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 font-medium transition-colors hover:bg-muted",
                activeDropTargetId === rootDropTargetId && "bg-primary/10 text-primary ring-1 ring-primary/30",
              )}
              onClick={() => navigateToFolder(null)}
              onDragOver={(event) => handleWorkspaceDragOver(event, null)}
              onDragLeave={(event) => handleWorkspaceDragLeave(event, null)}
              onDrop={(event) => handleWorkspaceDrop(event, null)}
            >
              Anexos
            </button>
            {breadcrumbs.map((folder) => (
              <span key={folder.id} className="flex items-center gap-1">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <button
                  type="button"
                  data-breadcrumb-item
                  className={cn(
                    "max-w-48 cursor-pointer truncate rounded-md px-2 py-1 transition-colors hover:bg-muted",
                    activeDropTargetId === folder.id && "bg-primary/10 text-primary ring-1 ring-primary/30",
                  )}
                  onClick={() => navigateToFolder(folder.id)}
                  onDragOver={(event) => handleWorkspaceDragOver(event, folder.id)}
                  onDragLeave={(event) => handleWorkspaceDragLeave(event, folder.id)}
                  onDrop={(event) => handleWorkspaceDrop(event, folder.id)}
                >
                  {folder.name}
                </button>
              </span>
            ))}
        </div>

        <div
          data-client-attachments-dropzone
          className={cn(
            "relative min-h-72 overflow-hidden rounded-xl border transition-colors",
            isDragging && "border-primary bg-primary/5 ring-2 ring-primary/20",
            draggedItem && activeDropTargetId === dropTargetKey(currentFolderId) && "border-primary bg-primary/[0.03] ring-2 ring-primary/20",
          )}
          onDragEnter={(event) => {
            event.preventDefault()
            if (!canEdit) return
            dragAutoScrollActiveRef.current = true
            if (hasWorkspaceDrag(event.dataTransfer)) {
              handleWorkspaceDragOver(event, currentFolderId)
            } else if (Array.from(event.dataTransfer.types).includes("Files")) {
              setIsDragging(true)
            }
          }}
          onDragOver={(event) => {
            if (hasWorkspaceDrag(event.dataTransfer)) handleWorkspaceDragOver(event, currentFolderId)
            else event.preventDefault()
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setIsDragging(false)
              handleWorkspaceDragLeave(event, currentFolderId)
            }
          }}
          onDrop={handleDrop}
        >
            {isDragging ? (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/90 backdrop-blur-sm">
                <div className="rounded-2xl border border-dashed border-primary bg-primary/5 px-10 py-8 text-center">
                  <Upload className="mx-auto mb-3 h-9 w-9 text-primary" />
                  <p className="font-semibold">Solte para classificar e enviar</p>
                  <p className="mt-1 text-sm text-muted-foreground">A modal abrirá com os arquivos anexados.</p>
                </div>
              </div>
            ) : null}

            {workspaceQuery.isLoading ? (
              <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-xl" />)}
              </div>
            ) : null}

            {!workspaceQuery.isLoading && visibleFolders.length + visibleFiles.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
                <div className="mb-3 rounded-2xl bg-muted p-4"><FolderOpen className="h-8 w-8 text-muted-foreground" /></div>
                <p className="font-semibold">{normalizedSearch ? "Nenhum resultado encontrado" : "Esta pasta está vazia"}</p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  {normalizedSearch ? "Tente outro termo ou remova o filtro de tipo." : "Crie uma pasta, faça upload ou arraste arquivos para cá."}
                </p>
              </div>
            ) : null}

            {!workspaceQuery.isLoading && visibleFolders.length + visibleFiles.length > 0 ? (
              <div className="divide-y">
                {visibleFolders.map((folder) => (
                  <div
                    key={folder.id}
                    data-workspace-item-id={folder.id}
                    data-folder-drop-target={folder.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${folder.name} Pasta${folder.systemKind === "schedule" ? " do agendamento" : ""} · ${formatFolderFileCount(folderFileCounts.get(folder.id) ?? 0)}`}
                    draggable={canEdit && !isBusy}
                    title={canEdit ? "Clique para abrir ou arraste para mover esta pasta" : "Clique para abrir esta pasta"}
                    className={cn(
                      "group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50",
                      canEdit && "select-none active:cursor-grabbing",
                      draggedItem?.kind === "folder" && draggedItem.id === folder.id && "opacity-50",
                      activeDropTargetId === folder.id && "bg-primary/10 ring-2 ring-inset ring-primary/30",
                    )}
                    onClick={(event) => {
                      if (!event.currentTarget.contains(event.target as Node)) return
                      navigateToFolder(folder.id)
                      setSearch("")
                    }}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return
                      event.preventDefault()
                      navigateToFolder(folder.id)
                      setSearch("")
                    }}
                    onDragStart={(event) => handleWorkspaceDragStart(event, {
                      kind: "folder",
                      id: folder.id,
                      name: folder.name,
                      parentId: folder.parentId,
                    })}
                    onDragEnd={handleWorkspaceDragEnd}
                    onDragOver={(event) => handleWorkspaceDragOver(event, folder.id)}
                    onDragLeave={(event) => handleWorkspaceDragLeave(event, folder.id)}
                    onDrop={(event) => handleWorkspaceDrop(event, folder.id)}
                  >
                    <div className="pointer-events-none flex min-w-0 flex-1 items-center gap-3 text-left">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/25">
                        <Folder className="h-5 w-5 fill-amber-200 text-amber-400 dark:fill-amber-300/70 dark:text-amber-300" strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{folder.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Pasta{folder.systemKind === "schedule" ? " do agendamento" : ""} · {formatFolderFileCount(folderFileCounts.get(folder.id) ?? 0)}
                        </p>
                      </div>
                    </div>
                    {canEdit || canDelete ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" aria-label={`Ações da pasta ${folder.name}`} onClick={(event) => event.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {canEdit ? renderMoveShortcut({
                            kind: "folder",
                            id: folder.id,
                            name: folder.name,
                            parentId: folder.parentId,
                          }) : null}
                          {canEdit ? <DropdownMenuItem onSelect={() => openEditor({ kind: "folder", folder })}><Pencil /> Renomear</DropdownMenuItem> : null}
                          {canDelete ? <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget({ kind: "folder", id: folder.id, name: folder.name })}><Trash2 /> Remover</DropdownMenuItem> : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                ))}
                {visibleFiles.map((file) => (
                  <div
                    key={file.id}
                    data-workspace-item-id={file.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Baixar ${displayFileName(file)}`}
                    draggable={canEdit && !isBusy}
                    title={canEdit ? "Clique para baixar ou arraste para mover este arquivo" : "Clique para baixar este arquivo"}
                    className={cn(
                      "group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50",
                      canEdit && "select-none active:cursor-grabbing",
                      draggedItem?.kind === "file" && draggedItem.id === file.id && "opacity-50",
                    )}
                    aria-disabled={isDownloadBusy}
                    onClick={(event) => {
                      if (!event.currentTarget.contains(event.target as Node)) return
                      if (!isDownloadBusy) void onDownload(file)
                    }}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget || isDownloadBusy || (event.key !== "Enter" && event.key !== " ")) return
                      event.preventDefault()
                      void onDownload(file)
                    }}
                    onDragStart={(event) => handleWorkspaceDragStart(event, {
                      kind: "file",
                      id: file.id,
                      name: displayFileName(file),
                      parentId: file.parentId ?? null,
                    })}
                    onDragEnd={handleWorkspaceDragEnd}
                  >
                    <div className="pointer-events-none flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <FileCheck2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="pointer-events-none min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="max-w-full truncate font-medium">{displayFileName(file)}</p>
                        <Badge variant="secondary" className="font-normal">{typeLabels[file.type]}</Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {formatFileSize(file.fileSize)} · {new Date(file.uploadedAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" title="Baixar arquivo" onClick={(event) => { event.stopPropagation(); void onDownload(file) }} disabled={isDownloadBusy}>
                      <Download className="h-4 w-4" />
                    </Button>
                    {canEdit || canDelete ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" aria-label={`Ações do arquivo ${displayFileName(file)}`} onClick={(event) => event.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {canEdit ? renderMoveShortcut({
                            kind: "file",
                            id: file.id,
                            name: displayFileName(file),
                            parentId: file.parentId ?? null,
                          }) : null}
                          {canEdit ? <DropdownMenuItem onSelect={() => openEditor({ kind: "file", file })}><Pencil /> Editar</DropdownMenuItem> : null}
                          {canDelete ? <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget({ kind: "file", id: file.id, name: displayFileName(file) })}><Trash2 /> Remover</DropdownMenuItem> : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
        </div>
      </div>

      <Dialog open={isUploadOpen} onOpenChange={(open) => { if (!isBusy) setIsUploadOpen(open) }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Enviar e classificar arquivos</DialogTitle>
            <DialogDescription>Escolha o tipo para que cada documento fique na pasta correta.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo do arquivo</Label>
              <Select value={uploadType} onValueChange={(value) => setUploadType(value as ClientAttachmentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{clientAttachmentTypes.map((type) => <SelectItem key={type} value={type}>{typeLabels[type]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div data-upload-destination className="min-w-0 space-y-2">
              <Label htmlFor="upload-destination">Destino</Label>
              <Input
                id="upload-destination"
                value={uploadDestinationPath.join(" / ")}
                readOnly
                title={uploadDestinationPath.join(" / ")}
                className="font-medium"
              />
            </div>
            {uploadType === "schedule" && !currentFolder?.scheduledServiceId ? (
              <div className="space-y-2">
                <Label>Agendamento</Label>
                <Select value={uploadScheduleId} onValueChange={setUploadScheduleId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o agendamento" /></SelectTrigger>
                  <SelectContent>{scheduleFolders.map((folder) => <SelectItem key={folder.id} value={folder.scheduledServiceId!}>{folder.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <input
            ref={nativeFileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              addUploadFiles(Array.from(event.target.files ?? []))
              event.currentTarget.value = ""
            }}
          />
          <button
            type="button"
            className="flex min-h-40 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 text-center transition-colors hover:border-primary/60 hover:bg-primary/10"
            onClick={() => nativeFileInputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); addUploadFiles(Array.from(event.dataTransfer.files)) }}
          >
            <Upload className="mb-3 h-8 w-8 text-primary" />
            <span className="font-semibold">Clique para escolher ou arraste os arquivos</span>
            <span className="mt-1 text-sm text-muted-foreground">Fotos, PDFs, documentos e planilhas</span>
          </button>
          {uploadFiles.length > 0 ? (
            <div data-upload-file-list className="max-h-40 space-y-2 overflow-y-auto">
              {uploadFiles.map((file, index) => (
                <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <File className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <button type="button" className="cursor-pointer" aria-label={`Remover ${file.name}`} onClick={() => setUploadFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setIsUploadOpen(false)} disabled={isBusy}>Cancelar</Button>
            <Button type="button" onClick={() => void submitUpload()} disabled={isBusy || uploadFiles.length === 0}>Enviar arquivos</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nova pasta</DialogTitle><DialogDescription>A pasta será criada no local atual.</DialogDescription></DialogHeader>
          <div data-create-folder-destination className="flex items-center gap-3 rounded-xl border bg-muted/35 px-4 py-3">
            <FolderOpen className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Criar em</p>
              <p className="truncate text-sm font-medium">{currentDestinationPath.join(" / ")}</p>
            </div>
          </div>
          <div className="space-y-2"><Label htmlFor="new-folder-name">Nome</Label><Input id="new-folder-name" value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} autoFocus /></div>
          <DialogFooter className="gap-2 sm:gap-2"><Button type="button" variant="outline" onClick={() => setIsCreateFolderOpen(false)}>Cancelar</Button><Button type="button" onClick={() => void submitCreateFolder()} disabled={!newFolderName.trim() || isBusy}>Criar pasta</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editableItem)} onOpenChange={(open) => { if (!open && !isBusy) setEditableItem(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editableItem?.kind === "folder" ? "Renomear pasta" : "Editar arquivo"}</DialogTitle>
            <DialogDescription>{editableItem?.kind === "folder" ? "Altere o nome da pasta." : "Altere o nome ou a classificação do arquivo."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="edit-item-name">Nome</Label><Input id="edit-item-name" value={editName} onChange={(event) => setEditName(event.target.value)} /></div>
            {editableItem?.kind === "file" ? (
              <div className="space-y-2"><Label>Tipo</Label><Select value={editType} onValueChange={(value) => setEditType(value as ClientAttachmentType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{clientAttachmentTypes.map((type) => <SelectItem key={type} value={type}>{typeLabels[type]}</SelectItem>)}</SelectContent></Select></div>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-2"><Button type="button" variant="outline" onClick={() => setEditableItem(null)} disabled={isBusy}>Cancelar</Button><Button type="button" onClick={() => void submitEdit()} disabled={!editName.trim() || isBusy}>Salvar alterações</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title={deleteTarget?.kind === "folder" ? "Remover pasta" : "Remover arquivo"}
        description={deleteTarget?.kind === "folder"
          ? `A pasta “${deleteTarget.name}”, suas subpastas e todos os arquivos serão removidos. Essa ação não pode ser desfeita.`
          : `O arquivo “${deleteTarget?.name ?? ""}” será removido do sistema e do armazenamento. Essa ação não pode ser desfeita.`}
        confirmLabel="Remover"
        busy={isBusy}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
