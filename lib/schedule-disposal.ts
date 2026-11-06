export type ScheduleDisposalType = string
export type DisposalStation = { id: string; name: string; unitPrice: number }
export type DisposalType = { id: string; name: string; items: DisposalStation[] }

export type ScheduleDisposalRecord = {
  mtrNumber?: string
  mtrNumbers?: string[]
  type: ScheduleDisposalType
  typeName?: string
  stationId: string
  stationName: string
  unitPrice: number
  quantityM3: number
  totalValue: number
}

export const SCHEDULE_DISPOSAL_STATIONS = {
  fossa: [
    { id: "green-service", name: "GREEN SERVICE TRATAMENTO DE RESIDUOS", unitPrice: 19 },
    { id: "tratho-efluentes", name: "TRATHO EFLUENTES", unitPrice: 19 },
    { id: "acqua-servicos", name: "ACQUA SERVIÇOS DE TRATAMENTO DE EFLUENTES", unitPrice: 20 },
    { id: "ete-metrosul", name: "ETE METROSUL CONCESSIONARIA DE SANEAMENTO", unitPrice: 36 },
  ],
  gordura: [
    { id: "green-service", name: "GREEN SERVICE TRATAMENTO DE RESIDUOS", unitPrice: 90 },
    { id: "tratho-efluentes", name: "TRATHO EFLUENTES", unitPrice: 19 },
    { id: "acqua-servicos", name: "ACQUA SERVIÇOS DE TRATAMENTO DE EFLUENTES", unitPrice: 50 },
    { id: "bio-c-centram", name: "BIO-C CENTRAM DE COMPOSTAGEM", unitPrice: 90 },
  ],
} as const

export function scheduleDisposalTotal(
  type: ScheduleDisposalType | "",
  stationId: string,
  quantityM3: number | null,
  catalog?: DisposalType[],
) {
  if (!type || !stationId || !quantityM3) return 0
  const items = catalog ? catalog.find((item) => item.id === type)?.items : SCHEDULE_DISPOSAL_STATIONS[type as keyof typeof SCHEDULE_DISPOSAL_STATIONS]
  const station = items?.find((item) => item.id === stationId)
  return station ? Math.round(station.unitPrice * quantityM3 * 100) / 100 : 0
}

export function formatScheduleDisposalCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function scheduleDisposalValidationMessage(
  type: ScheduleDisposalType | "",
  stationId: string,
  quantityM3: number | null,
  mtrNumber?: string,
) {
  if (!type) return null
  if (mtrNumber !== undefined && !mtrNumber.split("\n").some((number) => number.trim())) return "Informe o número do MTR para concluir um atendimento com descarte."
  if (!stationId) return "Selecione a estação de descarte."
  if (!quantityM3 || quantityM3 <= 0) return "Informe uma quantidade de descarte maior que zero."
  return null
}
