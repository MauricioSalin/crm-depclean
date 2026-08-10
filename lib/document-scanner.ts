export type DocumentPoint = {
  x: number
  y: number
}

export type DocumentCorners = {
  topLeft: DocumentPoint
  topRight: DocumentPoint
  bottomRight: DocumentPoint
  bottomLeft: DocumentPoint
}

export type DocumentScanFilter = "document" | "color" | "original"

export type PixelImage = {
  data: Uint8ClampedArray
  width: number
  height: number
}

const MAX_OUTPUT_EDGE = 2200

function distance(a: DocumentPoint, b: DocumentPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function defaultDocumentCorners(): DocumentCorners {
  return {
    topLeft: { x: 0.025, y: 0.025 },
    topRight: { x: 0.975, y: 0.025 },
    bottomRight: { x: 0.975, y: 0.975 },
    bottomLeft: { x: 0.025, y: 0.975 },
  }
}

function resolveOutputSize(width: number, height: number, corners: DocumentCorners) {
  const pixels = {
    topLeft: { x: corners.topLeft.x * width, y: corners.topLeft.y * height },
    topRight: { x: corners.topRight.x * width, y: corners.topRight.y * height },
    bottomRight: { x: corners.bottomRight.x * width, y: corners.bottomRight.y * height },
    bottomLeft: { x: corners.bottomLeft.x * width, y: corners.bottomLeft.y * height },
  }
  const outputWidth = Math.max(distance(pixels.topLeft, pixels.topRight), distance(pixels.bottomLeft, pixels.bottomRight))
  const outputHeight = Math.max(distance(pixels.topLeft, pixels.bottomLeft), distance(pixels.topRight, pixels.bottomRight))
  const scale = Math.min(1, MAX_OUTPUT_EDGE / Math.max(outputWidth, outputHeight))

  return {
    corners: pixels,
    width: Math.max(1, Math.round(outputWidth * scale)),
    height: Math.max(1, Math.round(outputHeight * scale)),
  }
}

function sampleBilinear(source: PixelImage, x: number, y: number, channel: number) {
  const x0 = clamp(Math.floor(x), 0, source.width - 1)
  const y0 = clamp(Math.floor(y), 0, source.height - 1)
  const x1 = Math.min(x0 + 1, source.width - 1)
  const y1 = Math.min(y0 + 1, source.height - 1)
  const fx = x - x0
  const fy = y - y0
  const top = source.data[(y0 * source.width + x0) * 4 + channel] * (1 - fx) + source.data[(y0 * source.width + x1) * 4 + channel] * fx
  const bottom = source.data[(y1 * source.width + x0) * 4 + channel] * (1 - fx) + source.data[(y1 * source.width + x1) * 4 + channel] * fx
  return top * (1 - fy) + bottom * fy
}

function createPerspectiveMapper(corners: DocumentCorners) {
  const p0 = corners.topLeft
  const p1 = corners.topRight
  const p2 = corners.bottomRight
  const p3 = corners.bottomLeft
  const dx1 = p1.x - p2.x
  const dx2 = p3.x - p2.x
  const dx3 = p0.x - p1.x + p2.x - p3.x
  const dy1 = p1.y - p2.y
  const dy2 = p3.y - p2.y
  const dy3 = p0.y - p1.y + p2.y - p3.y
  const denominator = dx1 * dy2 - dx2 * dy1
  const g = Math.abs(denominator) < 0.000001 ? 0 : (dx3 * dy2 - dx2 * dy3) / denominator
  const h = Math.abs(denominator) < 0.000001 ? 0 : (dx1 * dy3 - dx3 * dy1) / denominator
  const a = p1.x - p0.x + g * p1.x
  const b = p3.x - p0.x + h * p3.x
  const c = p0.x
  const d = p1.y - p0.y + g * p1.y
  const e = p3.y - p0.y + h * p3.y
  const f = p0.y

  return (u: number, v: number) => {
    const divisor = g * u + h * v + 1
    return {
      x: (a * u + b * v + c) / divisor,
      y: (d * u + e * v + f) / divisor,
    }
  }
}

function normalizeLighting(image: PixelImage, filter: Exclude<DocumentScanFilter, "original">) {
  const { data, width, height } = image
  const luminance = new Uint8ClampedArray(width * height)
  const integral = new Float64Array((width + 1) * (height + 1))

  for (let y = 0; y < height; y += 1) {
    let rowSum = 0
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const value = Math.round(data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114)
      luminance[y * width + x] = value
      rowSum += value
      integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1] + rowSum
    }
  }

  const radius = Math.max(12, Math.round(Math.min(width, height) * 0.018))
  for (let y = 0; y < height; y += 1) {
    const top = Math.max(0, y - radius)
    const bottom = Math.min(height - 1, y + radius)
    for (let x = 0; x < width; x += 1) {
      const left = Math.max(0, x - radius)
      const right = Math.min(width - 1, x + radius)
      const sum = integral[(bottom + 1) * (width + 1) + right + 1]
        - integral[top * (width + 1) + right + 1]
        - integral[(bottom + 1) * (width + 1) + left]
        + integral[top * (width + 1) + left]
      const area = (right - left + 1) * (bottom - top + 1)
      const current = luminance[y * width + x]
      const corrected = clamp(238 + (current - sum / area) * 2.05, 0, 255)
      const offset = (y * width + x) * 4

      if (filter === "document") {
        const gray = corrected > 244 ? 255 : corrected < 52 ? corrected * 0.72 : corrected
        data[offset] = gray
        data[offset + 1] = gray
        data[offset + 2] = gray
      } else {
        const ratio = corrected / Math.max(1, current)
        data[offset] = clamp(data[offset] * ratio * 1.03, 0, 255)
        data[offset + 1] = clamp(data[offset + 1] * ratio * 1.03, 0, 255)
        data[offset + 2] = clamp(data[offset + 2] * ratio * 1.03, 0, 255)
      }
    }
  }
}

export function scanDocumentPixels(source: PixelImage, corners: DocumentCorners, filter: DocumentScanFilter): PixelImage {
  const output = resolveOutputSize(source.width, source.height, corners)
  const data = new Uint8ClampedArray(output.width * output.height * 4)
  const mapPoint = createPerspectiveMapper(output.corners)

  for (let y = 0; y < output.height; y += 1) {
    const v = output.height === 1 ? 0 : y / (output.height - 1)
    for (let x = 0; x < output.width; x += 1) {
      const u = output.width === 1 ? 0 : x / (output.width - 1)
      const sourcePoint = mapPoint(u, v)
      const offset = (y * output.width + x) * 4
      data[offset] = sampleBilinear(source, sourcePoint.x, sourcePoint.y, 0)
      data[offset + 1] = sampleBilinear(source, sourcePoint.x, sourcePoint.y, 1)
      data[offset + 2] = sampleBilinear(source, sourcePoint.x, sourcePoint.y, 2)
      data[offset + 3] = 255
    }
  }

  const result = { data, width: output.width, height: output.height }
  if (filter !== "original") normalizeLighting(result, filter)
  return result
}

export function renderScannedDocument(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  corners: DocumentCorners,
  filter: DocumentScanFilter,
) {
  const sourceCanvas = document.createElement("canvas")
  sourceCanvas.width = sourceWidth
  sourceCanvas.height = sourceHeight
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true })
  if (!sourceContext) throw new Error("Não foi possível preparar a imagem para digitalização.")
  sourceContext.drawImage(source, 0, 0, sourceWidth, sourceHeight)

  const scanned = scanDocumentPixels(sourceContext.getImageData(0, 0, sourceWidth, sourceHeight), corners, filter)
  const outputCanvas = document.createElement("canvas")
  outputCanvas.width = scanned.width
  outputCanvas.height = scanned.height
  const outputContext = outputCanvas.getContext("2d")
  if (!outputContext) throw new Error("Não foi possível gerar a imagem digitalizada.")
  outputContext.putImageData(new ImageData(new Uint8ClampedArray(scanned.data), scanned.width, scanned.height), 0, 0)
  return outputCanvas
}
