"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, Bot, Building2, FileText, Loader2, Search, Wrench, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { listClients, type ClientRecord } from "@/lib/api/clients"
import { listContracts, type ContractRecord } from "@/lib/api/contracts"
import { listServices, type ServiceRecord } from "@/lib/api/services"
import { hasAnyPermission } from "@/lib/auth/permissions"
import { getStoredUser } from "@/lib/auth/session"
import { getClicksignContractStatusLabel } from "@/lib/contract-status"
import { buildPathWithSearchParams, withReturnTo } from "@/lib/navigation"
import { cn, formatContractNumber } from "@/lib/utils"

type SearchItemKind = "client" | "contract" | "service" | "view-all" | "depai"

type SearchItem = {
  id: string
  kind: SearchItemKind
  title: string
  description?: string
  meta?: string
  href?: string
  icon: ReactNode
  section?: string
}

const MIN_QUERY_LENGTH = 1
const MAX_SECTION_RESULTS = 5

const durationTypeLabels: Record<ServiceRecord["durationType"], string> = {
  hours: "hora",
  shift: "turno",
  days: "dia",
}

function pluralize(value: number, singular: string) {
  return value === 1 ? singular : `${singular}s`
}

function formatCurrency(value?: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value ?? 0)
}

function normalizeQuery(value: string) {
  return value.trim()
}

function listUrl(path: string, query: string) {
  return `${path}?q=${encodeURIComponent(query)}`
}

function getClientDescription(client: ClientRecord) {
  const parts = [client.cnpj, client.responsibleName].filter(Boolean)
  return parts.join(" • ")
}

function getContractDescription(contract: ContractRecord) {
  const status = getClicksignContractStatusLabel(contract.status)
  return [contract.clientCompanyName, status, formatCurrency(contract.totalValue)].filter(Boolean).join(" • ")
}

function getServiceDescription(service: ServiceRecord) {
  const durationType = durationTypeLabels[service.durationType] ?? service.durationType
  const duration = `${service.defaultDuration} ${pluralize(service.defaultDuration, durationType)}`
  return [service.description || "Serviço cadastrado", duration].join(" • ")
}

export function GlobalSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentHref = buildPathWithSearchParams(pathname, searchParams)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getStoredUser>>(null)
  const canSearchClients = hasAnyPermission(currentUser, ["clients_view", "clients_create", "clients_edit", "clients_delete"])
  const canSearchContracts = hasAnyPermission(currentUser, ["contracts_view", "contracts_create", "contracts_edit", "contracts_delete"])
  const canSearchServices = hasAnyPermission(currentUser, ["services_view", "services_manage"])
  const canAskDepAI = hasAnyPermission(currentUser, ["depai_access"])

  useEffect(() => {
    const sync = () => setCurrentUser(getStoredUser())
    sync()
    window.addEventListener("storage", sync)
    window.addEventListener("depclean:session", sync)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("depclean:session", sync)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(normalizeQuery(query)), 220)
    return () => window.clearTimeout(timeout)
  }, [query])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [])

  const searchQuery = useQuery({
    queryKey: ["global-search", debouncedQuery, canSearchClients, canSearchContracts, canSearchServices],
    enabled: open && debouncedQuery.length >= MIN_QUERY_LENGTH && Boolean(currentUser),
    staleTime: 20_000,
    queryFn: async () => {
      const [clients, contracts, services] = await Promise.all([
        canSearchClients ? listClients(debouncedQuery) : Promise.resolve({ data: [] as ClientRecord[] }),
        canSearchContracts ? listContracts(debouncedQuery) : Promise.resolve({ data: [] as ContractRecord[] }),
        canSearchServices ? listServices(debouncedQuery) : Promise.resolve({ data: [] as ServiceRecord[] }),
      ])

      return {
        clients: clients.data,
        contracts: contracts.data,
        services: services.data,
      }
    },
  })

  const sections = useMemo(() => {
    const currentQuery = normalizeQuery(query)
    const data = searchQuery.data

    return [
      canSearchClients ? {
        key: "clients",
        title: "Clientes",
        viewAllHref: listUrl("/clientes", currentQuery),
        items: (data?.clients ?? []).slice(0, MAX_SECTION_RESULTS).map<SearchItem>((client) => ({
          id: `client-${client.id}`,
          kind: "client",
          title: client.companyName,
          description: getClientDescription(client),
          meta: client.isActive ? "Ativo" : "Inativo",
          href: withReturnTo(`/clientes/${client.id}`, currentHref),
          icon: <Building2 className="h-4 w-4" />,
          section: "Clientes",
        })),
      } : null,
      canSearchContracts ? {
        key: "contracts",
        title: "Contratos",
        viewAllHref: listUrl("/contratos", currentQuery),
        items: (data?.contracts ?? []).slice(0, MAX_SECTION_RESULTS).map<SearchItem>((contract) => ({
          id: `contract-${contract.id}`,
          kind: "contract",
          title: formatContractNumber(contract.contractNumber),
          description: getContractDescription(contract),
          href: withReturnTo(`/contratos/${contract.id}`, currentHref),
          icon: <FileText className="h-4 w-4" />,
          section: "Contratos",
        })),
      } : null,
      canSearchServices ? {
        key: "services",
        title: "Serviços",
        viewAllHref: listUrl("/servicos", currentQuery),
        items: (data?.services ?? []).slice(0, MAX_SECTION_RESULTS).map<SearchItem>((service) => ({
          id: `service-${service.id}`,
          kind: "service",
          title: service.name,
          description: getServiceDescription(service),
          meta: service.isActive ? "Ativo" : "Inativo",
          href: listUrl("/servicos", service.name),
          icon: <Wrench className="h-4 w-4" />,
          section: "Serviços",
        })),
      } : null,
    ].filter((section): section is NonNullable<typeof section> => Boolean(section))
  }, [canSearchClients, canSearchContracts, canSearchServices, currentHref, query, searchQuery.data])

  const flatItems = useMemo(() => {
    const currentQuery = normalizeQuery(query)
    const items: SearchItem[] = []

    sections.forEach((section) => {
      items.push(...section.items)
      if (section.items.length > 0) {
        items.push({
          id: `view-all-${section.key}`,
          kind: "view-all",
          title: `Ver todos em ${section.title}`,
          description: `Abrir ${section.title.toLowerCase()} filtrados por "${currentQuery}"`,
          href: section.viewAllHref,
          icon: <ArrowRight className="h-4 w-4" />,
          section: section.title,
        })
      }
    })

    if (currentQuery && canAskDepAI) {
      items.push({
        id: "ask-depai",
        kind: "depai",
        title: `Perguntar "${currentQuery}" à DepAI`,
        description: "Abrir uma nova conversa com esta pergunta.",
        icon: <Bot className="h-4 w-4" />,
      })
    }

    return items
  }, [canAskDepAI, query, sections])

  useEffect(() => {
    setActiveIndex(flatItems.length > 0 ? 0 : -1)
  }, [flatItems.length, debouncedQuery])

  useEffect(() => {
    if (activeIndex < 0) return
    itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  const closeSearch = () => setOpen(false)

  const askDepAI = () => {
    const currentQuery = normalizeQuery(query)
    if (!currentQuery) return
    if (!canAskDepAI) return

    closeSearch()
    setQuery("")

    if (pathname === "/depai") {
      window.dispatchEvent(new CustomEvent("depai:ask", { detail: { message: currentQuery } }))
      return
    }

    router.push(`/depai?ask=${encodeURIComponent(currentQuery)}`)
  }

  const runItem = (item: SearchItem) => {
    if (item.kind === "depai") {
      askDepAI()
      return
    }

    if (!item.href) return
    closeSearch()
    router.push(item.href)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!open && ["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) {
      setOpen(true)
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((current) => Math.min(current + 1, flatItems.length - 1))
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((current) => Math.max(current - 1, 0))
      return
    }

    if (event.key === "Enter") {
      const activeItem = flatItems[activeIndex]
      if (open && activeItem) {
        event.preventDefault()
        runItem(activeItem)
      }
      return
    }

    if (event.key === "Escape") {
      event.preventDefault()
      closeSearch()
    }
  }

  const currentQuery = normalizeQuery(query)
  const totalResults = sections.reduce((total, section) => total + section.items.length, 0)
  const showResults = open && currentQuery.length >= MIN_QUERY_LENGTH
  const searchableLabels = [
    canSearchClients ? "clientes" : null,
    canSearchContracts ? "contratos" : null,
    canSearchServices ? "serviços" : null,
  ].filter(Boolean)

  return (
    <div ref={rootRef} className="relative flex-1 max-w-md">
      <Search className="absolute left-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={searchableLabels.length > 0 ? `Pesquise por ${searchableLabels.join(", ")}` : "Pesquise no sistema"}
        className="h-9 bg-card pl-9 pr-9 text-base transition-all duration-300 focus:shadow-lg focus:shadow-primary/10 md:pr-20 md:text-sm"
        role="combobox"
        aria-expanded={showResults}
        aria-controls="global-search-results"
      />

      {query ? (
        <button
          type="button"
          aria-label="Limpar busca"
          className="absolute right-2 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => {
            setQuery("")
            inputRef.current?.focus()
          }}
        >
          <X className="h-4 w-4" />
        </button>
      ) : (
        <div className="pointer-events-none absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 items-center gap-1 text-[9px] text-muted-foreground md:flex">
          <kbd className="rounded border border-border bg-muted px-1 py-px font-medium leading-none">Ctrl</kbd>
          <kbd className="rounded border border-border bg-muted px-1 py-px font-medium leading-none">K</kbd>
        </div>
      )}

      {showResults && (
        <div
          id="global-search-results"
          className="fixed left-3 right-3 top-[3.75rem] z-50 overflow-hidden rounded-2xl border border-border bg-popover shadow-xl shadow-black/10 md:absolute md:left-0 md:right-0 md:top-[calc(100%+0.5rem)]"
        >
          <div className="max-h-[min(70vh,34rem)] overflow-y-auto p-2">
            {searchQuery.isLoading && (
              <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando resultados...
              </div>
            )}

            {!searchQuery.isLoading && totalResults === 0 && (
              <div className="px-3 py-4 text-sm text-muted-foreground">
                Nenhum resultado encontrado para "{currentQuery}".
              </div>
            )}

            {!searchQuery.isLoading && sections.map((section) => (
              <div key={section.key} className={cn("space-y-1", section.items.length === 0 && "hidden")}>
                <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {section.title}
                </div>

                {section.items.map((item) => {
                  const itemIndex = flatItems.findIndex((flatItem) => flatItem.id === item.id)
                  return (
                    <button
                      key={item.id}
                      ref={(node) => {
                        itemRefs.current[itemIndex] = node
                      }}
                      type="button"
                      className={cn(
                        "flex w-full cursor-pointer items-start gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                        activeIndex === itemIndex ? "bg-primary/10" : "hover:bg-muted",
                      )}
                      onMouseEnter={() => setActiveIndex(itemIndex)}
                      onClick={() => runItem(item)}
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">{item.title}</span>
                        {item.description && (
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.description}</span>
                        )}
                      </span>
                      {item.meta && (
                        <Badge variant="secondary" className="mt-1 shrink-0 rounded-full">
                          {item.meta}
                        </Badge>
                      )}
                    </button>
                  )
                })}

                <button
                  type="button"
                  ref={(node) => {
                    const itemIndex = flatItems.findIndex((flatItem) => flatItem.id === `view-all-${section.key}`)
                    if (itemIndex >= 0) itemRefs.current[itemIndex] = node
                  }}
                  className={cn(
                    "mb-2 flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/10",
                    activeIndex === flatItems.findIndex((flatItem) => flatItem.id === `view-all-${section.key}`) && "bg-primary/10",
                  )}
                  onMouseEnter={() => setActiveIndex(flatItems.findIndex((flatItem) => flatItem.id === `view-all-${section.key}`))}
                  onClick={() => {
                    closeSearch()
                    router.push(section.viewAllHref)
                  }}
                >
                  Ver todos
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ))}

            {canAskDepAI ? (
            <div className="border-t border-border pt-2">
              <button
                type="button"
                ref={(node) => {
                  const itemIndex = flatItems.findIndex((item) => item.id === "ask-depai")
                  if (itemIndex >= 0) itemRefs.current[itemIndex] = node
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-primary/10",
                  activeIndex === flatItems.findIndex((item) => item.id === "ask-depai") && "bg-primary/10",
                )}
                onMouseEnter={() => setActiveIndex(flatItems.findIndex((item) => item.id === "ask-depai"))}
                onClick={askDepAI}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Bot className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">Perguntar "{currentQuery}" à DepAI</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">Abrir uma nova conversa automaticamente.</span>
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
