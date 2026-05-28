"use client"

import { type PointerEvent, type WheelEvent, useEffect, useMemo, useRef, useState } from "react"
import { ImagePlus, Loader2, Upload, ZoomIn } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { AvatarUploadVariant } from "@/lib/api/profile"

const CROP_SIZE = 300
const AVATAR_SIZES = [96, 192, 512]
const SOURCE_IMAGE_MAX_FILE_SIZE = 10 * 1024 * 1024
const AVATAR_VARIANT_MAX_FILE_SIZE = 2 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"])

type Point = {
  x: number
  y: number
}

type ImageSize = {
  width: number
  height: number
}

type GestureState =
  | {
      mode: "drag"
      pointerId: number
      start: Point
      offset: Point
    }
  | {
      mode: "pinch"
      startDistance: number
      startZoom: number
      startOffset: Point
      startCenter: Point
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

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / 1024 / 1024)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function distanceBetween(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function centerBetween(a: Point, b: Point): Point {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  }
}

export function AvatarUploadDialog({
  open,
  onOpenChange,
  saving = false,
  onSave,
}: AvatarUploadDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const activePointersRef = useRef<Map<number, Point>>(new Map())
  const gestureRef = useRef<GestureState | null>(null)
  const zoomRef = useRef(1)
  const offsetRef = useRef<Point>({ x: 0, y: 0 })
  const [imageUrl, setImageUrl] = useState("")
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
    activePointersRef.current.clear()
    gestureRef.current = null
    zoomRef.current = 1
    offsetRef.current = { x: 0, y: 0 }
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

    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      setErrorMessage("Escolha uma imagem PNG, JPG ou WEBP.")
      if (inputRef.current) inputRef.current.value = ""
      return
    }

    if (file.size > SOURCE_IMAGE_MAX_FILE_SIZE) {
      setErrorMessage(`Imagem muito grande. Envie uma foto de até ${formatFileSize(SOURCE_IMAGE_MAX_FILE_SIZE)}.`)
      if (inputRef.current) inputRef.current.value = ""
      return
    }

    setImageUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return URL.createObjectURL(file)
    })
    activePointersRef.current.clear()
    gestureRef.current = null
    zoomRef.current = 1
    offsetRef.current = { x: 0, y: 0 }
    setNaturalSize(null)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setErrorMessage("")
  }

  const getRelativePoint = (element: HTMLDivElement, point: Point) => {
    const rect = element.getBoundingClientRect()
    return {
      x: point.x - rect.left - rect.width / 2,
      y: point.y - rect.top - rect.height / 2,
    }
  }

  const updateZoomAndOffset = (nextZoom: number, nextOffset = offsetRef.current) => {
    const clampedZoom = clamp(nextZoom, 1, 3)
    const clampedOffset = clampOffset(nextOffset, clampedZoom)

    zoomRef.current = clampedZoom
    offsetRef.current = clampedOffset
    setZoom(clampedZoom)
    setOffset(clampedOffset)
  }

  const handleZoomChange = (value: number) => {
    updateZoomAndOffset(value)
  }

  const startPinchGesture = (element: HTMLDivElement) => {
    const points = Array.from(activePointersRef.current.values()).slice(0, 2)
    if (points.length < 2) return

    const center = centerBetween(points[0], points[1])
    gestureRef.current = {
      mode: "pinch",
      startDistance: Math.max(1, distanceBetween(points[0], points[1])),
      startZoom: zoomRef.current,
      startOffset: offsetRef.current,
      startCenter: getRelativePoint(element, center),
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!imageUrl || !displaySize) return

    event.preventDefault()
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    event.currentTarget.setPointerCapture(event.pointerId)

    if (activePointersRef.current.size >= 2) {
      startPinchGesture(event.currentTarget)
      return
    }

    gestureRef.current = {
      mode: "drag",
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      offset: offsetRef.current,
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(event.pointerId)) return
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    const gesture = gestureRef.current
    if (!gesture) return

    event.preventDefault()

    if (gesture.mode === "pinch" && activePointersRef.current.size >= 2) {
      const points = Array.from(activePointersRef.current.values()).slice(0, 2)
      const nextDistance = Math.max(1, distanceBetween(points[0], points[1]))
      const nextZoom = clamp(gesture.startZoom * (nextDistance / gesture.startDistance), 1, 3)
      const zoomRatio = nextZoom / gesture.startZoom
      const center = getRelativePoint(event.currentTarget, centerBetween(points[0], points[1]))

      updateZoomAndOffset(nextZoom, {
        x: center.x - (gesture.startCenter.x - gesture.startOffset.x) * zoomRatio,
        y: center.y - (gesture.startCenter.y - gesture.startOffset.y) * zoomRatio,
      })
      return
    }

    if (gesture.mode !== "drag" || gesture.pointerId !== event.pointerId || activePointersRef.current.size > 1) return

    const nextOffset = clampOffset({
      x: gesture.offset.x + event.clientX - gesture.start.x,
      y: gesture.offset.y + event.clientY - gesture.start.y,
    })
    offsetRef.current = nextOffset
    setOffset(nextOffset)
  }

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(event.pointerId)

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (activePointersRef.current.size === 1) {
      const [remainingPointerId, remainingPoint] = Array.from(activePointersRef.current.entries())[0]
      gestureRef.current = {
        mode: "drag",
        pointerId: remainingPointerId,
        start: remainingPoint,
        offset: offsetRef.current,
      }
      return
    }

    if (activePointersRef.current.size >= 2) {
      startPinchGesture(event.currentTarget)
      return
    }

    gestureRef.current = null
  }

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!imageUrl || !displaySize) return

    event.preventDefault()
    const nextZoom = clamp(zoomRef.current + (event.deltaY < 0 ? 0.08 : -0.08), 1, 3)
    handleZoomChange(nextZoom)
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

      if (blob.size > AVATAR_VARIANT_MAX_FILE_SIZE) {
        throw new Error(`A foto otimizada ficou acima de ${formatFileSize(AVATAR_VARIANT_MAX_FILE_SIZE)}. Reduza o zoom ou escolha uma imagem menor.`)
      }

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
      <DialogContent className="max-w-md">
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

        <div className="space-y-4">
            {imageUrl ? (
              <div
                className="relative mx-auto h-[300px] w-[300px] touch-none overflow-hidden rounded-2xl bg-muted shadow-inner"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onWheel={handleWheel}
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
                    zoomRef.current = 1
                    offsetRef.current = { x: 0, y: 0 }
                    setOffset({ x: 0, y: 0 })
                    setZoom(1)
                  }}
                  onError={() => {
                    setErrorMessage("Não foi possível abrir essa imagem. Escolha outra foto em PNG, JPG ou WEBP.")
                    setNaturalSize(null)
                  }}
                />
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-[286px] w-[286px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.45)]" />
                <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/10" />
              </div>
            ) : (
              <button
                type="button"
                className="group mx-auto flex h-[210px] w-full max-w-[360px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 text-center transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5 hover:shadow-md"
                onClick={() => inputRef.current?.click()}
              >
                <ImagePlus className="mb-3 h-9 w-9 text-primary transition-transform duration-300 group-hover:scale-105" />
                <span className="font-semibold">Selecionar imagem</span>
                <span className="mt-1 text-sm text-muted-foreground">PNG, JPG ou WEBP até {formatFileSize(SOURCE_IMAGE_MAX_FILE_SIZE)}</span>
              </button>
            )}

            {imageUrl ? (
              <div>
                <div className="flex items-center gap-3">
                  <ZoomIn className="h-4 w-4 text-muted-foreground" />
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.01"
                    value={zoom}
                    onChange={(event) => handleZoomChange(Number(event.target.value))}
                    className="h-2 flex-1 cursor-pointer accent-primary"
                  />
                </div>
              </div>
            ) : null}

            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
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
