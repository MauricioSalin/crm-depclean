"use client"

import { useEffect, useRef, useState } from "react"

type BlockLayoutSeed = {
  id: number
  sizeFactor: number
  xRatio: number
  yRatio: number
  rotation: number
  radius: string
  opacity: number
}

type BlockState = {
  id: number
  size: number
  x: number
  y: number
  rotation: number
  radius: string
  opacity: number
}

export type FloatingBlockSnapshot = Pick<
  BlockState,
  "id" | "size" | "x" | "y" | "radius" | "rotation"
>

const BLOCK_SEEDS: BlockLayoutSeed[] = [
  { id: 1, sizeFactor: 0.2, xRatio: -0.1, yRatio: -0.08, rotation: -14, radius: "42px", opacity: 1 },
  { id: 2, sizeFactor: 0.185, xRatio: 0.04, yRatio: 0.66, rotation: -12, radius: "42px", opacity: 0.98 },
  { id: 3, sizeFactor: 0.17, xRatio: 0.78, yRatio: 0.1, rotation: -11, radius: "42px", opacity: 0.98 },
  { id: 4, sizeFactor: 0.165, xRatio: 0.9, yRatio: 0.63, rotation: 14, radius: "42px", opacity: 1 },
  { id: 5, sizeFactor: 0.18, xRatio: 0.29, yRatio: 0.14, rotation: 10, radius: "42px", opacity: 0.98 },
  { id: 6, sizeFactor: 0.175, xRatio: 0.63, yRatio: 0.72, rotation: 10, radius: "42px", opacity: 0.98 },
]

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function buildBlocks(width: number, height: number) {
  const reference = Math.min(width, height)

  return BLOCK_SEEDS.map((seed) => {
    const size = clamp(reference * seed.sizeFactor, 170, 250)

    return {
      id: seed.id,
      size,
      x: width * seed.xRatio - size / 2,
      y: height * seed.yRatio - size / 2,
      rotation: seed.rotation,
      radius: seed.radius,
      opacity: seed.opacity,
    }
  })
}

export function FloatingBlocks({
  onBlocksChange,
}: {
  onBlocksChange?: (blocks: FloatingBlockSnapshot[]) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [blocks, setBlocks] = useState<BlockState[]>([])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateBlocks = () => {
      const bounds = container.getBoundingClientRect()
      const nextBlocks = buildBlocks(bounds.width, bounds.height)
      setBlocks(nextBlocks)
      onBlocksChange?.(nextBlocks)
    }

    updateBlocks()

    const observer = new ResizeObserver(() => {
      updateBlocks()
    })

    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [onBlocksChange])

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      {blocks.map((block) => (
        <div
          key={block.id}
          className="absolute bg-primary shadow-[0_14px_28px_rgba(149,193,30,0.24)] will-change-transform"
          style={{
            width: block.size,
            height: block.size,
            transform: `translate3d(${block.x}px, ${block.y}px, 0) rotate(${block.rotation}deg)`,
            borderRadius: block.radius,
            opacity: block.opacity,
          }}
        />
      ))}
    </div>
  )
}
