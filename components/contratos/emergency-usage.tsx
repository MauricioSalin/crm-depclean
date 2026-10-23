"use client"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api/client"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

export type EmergencyUsageRecord = { contractId: string; clientId: string; contractNumber: string; isActive?: boolean; limit: number; unlimited?: boolean; used: number; remaining: number | null; exhausted: boolean }
export function useEmergencyUsage() {
  return useQuery({ queryKey: ["emergency-usage"], staleTime: 30_000, queryFn: async () => (await api.get<{ success: true; data: EmergencyUsageRecord[] }>("/emergencies")).data.data })
}
export function EmergencyExhaustedBadge({ clientId, contractId }: { clientId?: string; contractId?: string | null }) {
  const usage = useEmergencyUsage()
  const exhausted = usage.data?.some((item) => (contractId ? item.contractId === contractId : item.clientId === clientId) && item.exhausted)
  return exhausted ? <Badge className="shrink-0 bg-red-100 text-red-700 hover:bg-red-100">Emergencias esgotadas</Badge> : null
}
export function EmergencyUsageCounter({ clientId, contractId, sideBySide = false }: { clientId?: string; contractId?: string; sideBySide?: boolean }) {
  const usage = useEmergencyUsage()
  const items = usage.data?.filter((item) => contractId ? item.contractId === contractId : item.clientId === clientId && item.isActive !== false) ?? []
  return <div className={sideBySide ? "grid min-w-0 grid-cols-2 items-end gap-4" : "min-w-0 space-y-3"}>{items.map((item) => <div key={item.contractId} className={`min-w-0 space-y-1${sideBySide && items.length === 1 ? " col-start-2" : ""}`}>
    {sideBySide && items.length > 1 ? <p className="truncate text-xs font-medium" title={item.contractNumber}>{item.contractNumber}</p> : null}
    <div className="flex justify-between gap-3 text-xs text-muted-foreground"><span>{item.unlimited ? `${item.used} emergências utilizadas` : `${item.used}/${item.limit} emergências utilizadas`}{!sideBySide && !contractId && items.length > 1 ? ` · ${item.contractNumber}` : ""}</span><span className="font-medium text-destructive">{item.unlimited ? "Sem limite" : `${item.limit > 0 ? Math.round(item.used / item.limit * 100) : 100}%`}</span></div>
    {!item.unlimited ? <Progress value={item.limit > 0 ? Math.min(100, item.used / item.limit * 100) : 100} className="h-2 bg-destructive/20 [&_[data-slot=progress-indicator]]:bg-destructive" /> : null}
  </div>)}</div>
}
