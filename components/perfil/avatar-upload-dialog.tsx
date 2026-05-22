"use client"

import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react"
import { ImagePlus, Loader2, Upload, ZoomIn } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { resolveAvatarUrl } from "@/lib/avatar"
import type { AvatarUploadVariant } from "@/lib/api/profile"

const CROP_SIZE = 300
const AVATAR_SIZES = [96, 192, 512]

type Point = {
  x: number
  y: number
}

type ImageSize = {
  width: number
  height: number
}

interface AvatarUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentAvatar?: string | null
  userName: string
  initials: string
  saving?: boolean
  onSave: (variants: AvatarUploadVariant[]) => Promise<void>
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
}

export function AvatarUploadDialog({
  open,
  onOpenChange,
  currentAvatar,
  userName,
  initials,
  saving = false,
  onSave,
}: AvatarUploadDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const dragRef = useRef<{ pointerId: number; start: Point; offset: Point } | null>(null)
  const [imageUrl, setImageUrl] = useState("")
  const [imageName, setImageName] = useState("")
  const [naturalSize, setNaturalSize] = useState<ImageSize | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    if (open) return
    setImageUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return ""
    })
    setImageName("")
    setNaturalSize(null)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setErrorMessage("")
    if (inputRef.current) inputRef.current.value = ""
  }, [open])

  const baseDisplaySize = useMemo(() => {
    if (!naturalSize) return null
    const aspect = naturalSize.width / naturalSize.height
    return aspect >= 1
      ? { width: CROP_SIZE * aspect, height: CROP_SIZE }
      : { width: CROP_SIZE, height: CROP_SIZE / aspect }
  }, [naturalSize])

  const displaySize = useMemo(() => {
    if (!baseDisplaySize) return null
    return {
      width: baseDisplaySize.width * zoom,
      height: baseDisplaySize.height * zoom,
    }
  }, [baseDisplaySize, zoom])

  const clampOffset = (nextOffset: Point, nextZoom = zoom) => {
    if (!baseDisplaySize) return nextOffset

    const width = baseDisplaySize.width * nextZoom
    const height = baseDisplaySize.height * nextZoom
    const maxX = Math.max(0, (width - CROP_SIZE) / 2)
    const maxY = Math.max(0, (height - CROP_SIZE) / 2)

    return {
      x: clamp(nextOffset.x, -maxX, maxX),
      y: clamp(nextOffset.y, -maxY, maxY),
    }
  }

  const handleFileChange = (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return

    setImageUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return URL.createObjectURL(file)
    })
    setImageName(file.name)
    setNaturalSize(null)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setErrorMessage("")
  }

  const handleZoomChange = (value: number) => {
    setZoom(value)
    setOffset((current) => clampOffset(current, value))
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!imageUrl || !displaySize) return
    dragRef.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      offset,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    setOffset(
      clampOffset({
        x: drag.offset.x + event.clientX - drag.start.x,
        y: drag.offset.y + event.clientY - drag.start.y,
      }),
    )
  }

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null
    }
  }

  const createVariants = async () => {
    const image = imageRef.current
    if (!image || !naturalSize || !displaySize) {
      throw new Error("Selecione uma imagem antes de salvar.")
    }

    const left = (CROP_SIZE - displaySize.width) / 2 + offset.x
    const top = (CROP_SIZE - displaySize.height) / 2 + offset.y
    const sourceX = Math.max(0, (0 - left) * (naturalSize.width / displaySize.width))
    const sourceY = Math.max(0, (0 - top) * (naturalSize.height / displaySize.height))
    const sourceWidth = Math.min(naturalSize.width - sourceX, CROP_SIZE * (naturalSize.width / displaySize.width))
    const sourceHeight = Math.min(naturalSize.height - sourceY, CROP_SIZE * (naturalSize.height / displaySize.height))

    const variants: AvatarUploadVariant[] = []

    for (const size of AVATAR_SIZES) {
      const canvas = document.createElement("canvas")
      canvas.width = size
      canvas.height = size

      const context = canvas.getContext("2d")
      if (!context) continue

      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = "high"
      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, size, size)

      const webpBlob = await canvasToBlob(canvas, "image/webp", 0.9)
      const blob = webpBlob ?? (await canvasToBlob(canvas, "image/png"))
      if (!blob) continue

      const extension = blob.type === "image/webp" ? "webp" : "png"
      variants.push({
        size,
        file: new File([blob], `avatar-${size}.${extension}`, { type: blob.type }),
      })
    }

    if (variants.length === 0) {
      throw new Error("Não foi possível processar a imagem.")
    }

    return variants
  }

  const handleSave = async () => {
    setErrorMessage("")
    try {
      const variants = await createVariants()
      await onSave(variants)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível salvar a imagem.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={saving ? undefined : onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader className="pr-6">
          <DialogTitle>Alterar foto do perfil</DialogTitle>
          <DialogDescription>
            Escolha uma imagem, ajuste o corte quadrado e salve a foto otimizada.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => handleFileChange(event.target.files)}
        />

        <div className="grid gap-5 md:grid-cols-[1fr_150px]">
          <div className="space-y-4">
            {imageUrl ? (
              <div
                className="relative mx-auto h-[300px] w-[300px] touch-none overflow-hidden rounded-2xl bg-muted shadow-inner"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
              >
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt="Imagem selecionada"
                  draggable={false}
                  className="absolute left-1/2 top-1/2 max-w-none select-none"
                  style={{
                    width: displaySize?.width,
                    height: displaySize?.height,
                    transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                  }}
                  onLoad={(event) => {
                    const target = event.currentTarget
                    setNaturalSize({
                      width: target.naturalWidth,
                      height: target.naturalHeight,
                    })
                    setOffset({ x: 0, y: 0 })
                    setZoom(1)
                  }}
                />
                <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/10" />
              </div>
            ) : (
              <button
                type="button"
                className="flex h-[300px] w-full flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 text-center transition-colors hover:bg-muted/40"
                onClick={() => inputRef.current?.click()}
              >
                <ImagePlus className="mb-3 h-9 w-9 text-primary" />
                <span className="font-semibold">Selecionar imagem</span>
                <span className="mt-1 text-sm text-muted-foreground">PNG, JPG ou WEBP</span>
              </button>
            )}

            {imageUrl ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <ZoomIn className="h-4 w-4 text-muted-foreground" />
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.01"
                    value={zoom}
                    onChange={(event) => handleZoomChange(Number(event.target.value))}
                    className="h-2 flex-1 accent-primary"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span className="truncate">{imageName}</span>
                  <button type="button" className="font-medium text-primary hover:opacity-80" onClick={() => inputRef.current?.click()}>
                    Trocar imagem
                  </button>
                </div>
              </div>
            ) : null}

            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          </div>

          <div className="flex flex-col items-center justify-center rounded-2xl border bg-muted/20 p-4 text-center">
            {imageUrl && displaySize ? (
              <div className="relative h-24 w-24 overflow-hidden rounded-full bg-muted ring-4 ring-primary/15">
                <img
                  src={imageUrl}
                  alt={userName}
                  draggable={false}
                  className="absolute left-1/2 top-1/2 max-w-none select-none"
                  style={{
                    width: displaySize.width * (96 / CROP_SIZE),
                    height: displaySize.height * (96 / CROP_SIZE),
                    transform: `translate(calc(-50% + ${offset.x * (96 / CROP_SIZE)}px), calc(-50% + ${offset.y * (96 / CROP_SIZE)}px))`,
                  }}
                />
              </div>
            ) : (
              <Avatar className="h-24 w-24 ring-4 ring-primary/15">
                <AvatarImage src={resolveAvatarUrl(currentAvatar)} alt={userName} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            )}
            <p className="mt-3 text-sm font-semibold">{userName}</p>
            <p className="mt-1 text-xs text-muted-foreground">Prévia circular</p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={!imageUrl || !naturalSize || saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Salvar foto
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
