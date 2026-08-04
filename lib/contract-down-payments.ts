import { formatCivilDate } from "@/lib/date-utils"

export type ContractDownPaymentLike = {
  number?: number
  value: number
  dueDate: string | Date
}

const installmentOrdinals = [
  "primeira", "segunda", "terceira", "quarta", "quinta",
  "sexta", "sétima", "oitava", "nona", "décima",
  "décima primeira", "décima segunda", "décima terceira", "décima quarta", "décima quinta",
  "décima sexta", "décima sétima", "décima oitava", "décima nona", "vigésima",
]

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const units = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"]
const teens = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"]
const tens = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"]
const hundreds = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"]
const feminineHundreds = ["", "cento", "duzentas", "trezentas", "quatrocentas", "quinhentas", "seiscentas", "setecentas", "oitocentas", "novecentas"]

function underThousand(value: number, feminine = false): string {
  if (value < 10) {
    if (feminine && value === 1) return "uma"
    if (feminine && value === 2) return "duas"
    return units[value]
  }
  if (value < 20) return teens[value - 10]
  if (value < 100) {
    const remainder = value % 10
    return tens[Math.floor(value / 10)] + (remainder ? " e " + underThousand(remainder, feminine) : "")
  }
  if (value === 100) return "cem"
  const remainder = value % 100
  const names = feminine ? feminineHundreds : hundreds
  return names[Math.floor(value / 100)] + (remainder ? " e " + underThousand(remainder, feminine) : "")
}

function joinLargeNumber(prefix: string, remainder: number, feminine: boolean) {
  if (!remainder) return prefix
  const connector = remainder < 100 || remainder % 100 === 0 ? " e " : " "
  return prefix + connector + integerToPortuguese(remainder, feminine)
}

export function integerToPortuguese(value: number, feminine = false): string {
  const number = Math.max(0, Math.trunc(value))
  if (number < 1_000) return underThousand(number, feminine)
  if (number < 1_000_000) {
    const thousands = Math.floor(number / 1_000)
    const prefix = thousands === 1 ? "mil" : integerToPortuguese(thousands, feminine) + " mil"
    return joinLargeNumber(prefix, number % 1_000, feminine)
  }
  if (number < 1_000_000_000) {
    const millions = Math.floor(number / 1_000_000)
    const prefix = integerToPortuguese(millions) + (millions === 1 ? " milhão" : " milhões")
    return joinLargeNumber(prefix, number % 1_000_000, feminine)
  }
  const billions = Math.floor(number / 1_000_000_000)
  const prefix = integerToPortuguese(billions) + (billions === 1 ? " bilhão" : " bilhões")
  return joinLargeNumber(prefix, number % 1_000_000_000, feminine)
}

export function currencyToPortuguese(value: number) {
  const totalCents = Math.max(0, Math.round(value * 100))
  const reais = Math.floor(totalCents / 100)
  const centavos = totalCents % 100
  const parts: string[] = []

  if (reais > 0 || centavos === 0) {
    const connector = reais >= 1_000_000 && reais % 1_000_000 === 0 ? " de " : " "
    parts.push(integerToPortuguese(reais) + connector + (reais === 1 ? "real" : "reais"))
  }
  if (centavos > 0) {
    parts.push(integerToPortuguese(centavos) + (centavos === 1 ? " centavo" : " centavos"))
  }

  return parts.join(" e ")
}

function formatCurrencyWithWords(value: number) {
  return formatCurrency(value).replace(/[\u00a0\u202f]/g, " ") + " (" + currencyToPortuguese(value) + ")"
}

function formatCountWithWords(value: number) {
  return String(value).padStart(2, "0") + " (" + integerToPortuguese(value, true) + ")"
}

export function getInstallmentOrdinal(number: number) {
  return installmentOrdinals[number - 1] ?? `${number}ª`
}

export function buildDownPaymentsText(entries: ContractDownPaymentLike[]) {
  if (entries.length === 0) return ""

  const count = entries.length
  const countText = formatCountWithWords(count)
  const firstValueInCents = Math.round(entries[0].value * 100)
  const sameValue = entries.every((entry) => Math.round(entry.value * 100) === firstValueInCents)

  if (sameValue) {
    const parcelText = count === 1 ? "primeira parcela" : "primeiras parcelas"
    const suffix = count === 1 ? "" : " cada"
    return `${countText} ${parcelText} no valor de ${formatCurrencyWithWords(entries[0].value)}${suffix}`
  }

  const details = entries.map((entry, index) => {
    const number = entry.number ?? index + 1
    return `a ${getInstallmentOrdinal(number)} no valor de ${formatCurrencyWithWords(entry.value)}`
  })
  const joinedDetails = details.length > 1
    ? details.slice(0, -1).join(", ") + " e " + details[details.length - 1]
    : details[0]
  return `${countText} primeiras parcelas, sendo ${joinedDetails}`
}

export function buildInstallmentDueDatesText(firstDueDate: string | Date, paymentDay: number) {
  const normalizedPaymentDay = Math.trunc(paymentDay)
  if (!firstDueDate || normalizedPaymentDay < 1 || normalizedPaymentDay > 28) return ""

  const formattedDay = String(normalizedPaymentDay).padStart(2, "0")
  return `A primeira parcela terá vencimento em ${formatCivilDate(firstDueDate)}, vencendo as demais parcelas sempre no dia ${formattedDay} (${integerToPortuguese(normalizedPaymentDay)}) dos meses subsequentes.`
}

export function buildRemainingInstallmentsText(count: number, value: number, hasDownPayment: boolean) {
  const normalizedCount = Math.max(0, Math.trunc(count))
  if (!hasDownPayment || normalizedCount === 0 || !Number.isFinite(value) || value < 0) return ""

  const parcelText = normalizedCount === 1 ? "parcela subsequente" : "parcelas subsequentes"
  const suffix = normalizedCount === 1 ? "" : " cada"
  return `${formatCountWithWords(normalizedCount)} ${parcelText} no valor de ${formatCurrencyWithWords(value)}${suffix}`
}
