'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'

import { cn } from '@/lib/utils'

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  const listRef = React.useRef<React.ElementRef<typeof TabsPrimitive.List>>(null)
  const [indicatorStyle, setIndicatorStyle] = React.useState<React.CSSProperties>({
    opacity: 0,
    transform: 'translate3d(0, 0, 0)',
  })

  React.useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return

    let frame = 0

    const updateIndicator = () => {
      cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const activeTrigger = list.querySelector<HTMLElement>('[role="tab"][data-state="active"]')

        if (!activeTrigger) {
          setIndicatorStyle((current) => ({ ...current, opacity: 0 }))
          return
        }

        const listRect = list.getBoundingClientRect()
        const triggerRect = activeTrigger.getBoundingClientRect()

        setIndicatorStyle({
          opacity: 1,
          width: triggerRect.width,
          height: triggerRect.height,
          transform: `translate3d(${triggerRect.left - listRect.left}px, ${triggerRect.top - listRect.top}px, 0)`,
        })
      })
    }

    updateIndicator()

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateIndicator)
    resizeObserver?.observe(list)
    list.querySelectorAll('[role="tab"]').forEach((tab) => resizeObserver?.observe(tab))

    const mutationObserver = typeof MutationObserver === 'undefined' ? null : new MutationObserver(updateIndicator)
    mutationObserver?.observe(list, {
      attributes: true,
      attributeFilter: ['data-state'],
      childList: true,
      subtree: true,
    })

    window.addEventListener('resize', updateIndicator)

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
      window.removeEventListener('resize', updateIndicator)
    }
  }, [children])

  return (
    <TabsPrimitive.List
      ref={listRef}
      data-slot="tabs-list"
      className={cn(
        'bg-muted/50 text-muted-foreground relative isolate inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 z-0 rounded-md border border-transparent bg-white shadow-sm transition-[transform,width,height,opacity] duration-300 ease-out will-change-transform dark:border-input dark:bg-input/30"
        style={indicatorStyle}
      />
      {children}
    </TabsPrimitive.List>
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring data-[state=active]:text-foreground dark:data-[state=active]:text-foreground text-foreground dark:text-muted-foreground relative z-10 inline-flex h-[calc(100%-1px)] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-300 ease-out focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
