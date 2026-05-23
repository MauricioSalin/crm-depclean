type SearchParamValue = string | string[] | undefined
type SearchParamsRecord = Record<string, SearchParamValue>

export const getFirstSearchParam = (value: SearchParamValue) => (Array.isArray(value) ? value[0] : value)

export const isSafeInternalPath = (value?: string | null): value is string => {
  if (!value) return false
  if (!value.startsWith("/") || value.startsWith("//")) return false
  if (value.includes("\\") || value.includes("\u0000")) return false
  return true
}

export const getSafeReturnTo = (value: string | null | undefined, fallback: string) =>
  isSafeInternalPath(value) ? value : fallback

export const withReturnTo = (href: string, returnTo?: string | null) => {
  if (!isSafeInternalPath(returnTo)) return href

  const [pathAndSearch, hash = ""] = href.split("#", 2)
  const [pathname, search = ""] = pathAndSearch.split("?", 2)
  const params = new URLSearchParams(search)
  params.set("returnTo", returnTo)
  const query = params.toString()

  return `${pathname}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`
}

export const buildPathWithSearchParams = (
  pathname: string,
  searchParams: URLSearchParams | ReadonlyURLSearchParams,
  updates?: Record<string, string | null | undefined>,
) => {
  const params = new URLSearchParams(searchParams.toString())

  for (const [key, value] of Object.entries(updates ?? {})) {
    if (value === null || value === undefined || value === "") {
      params.delete(key)
    } else {
      params.set(key, value)
    }
  }

  const query = params.toString()
  return `${pathname}${query ? `?${query}` : ""}`
}

export const buildPathWithSearchRecord = (
  pathname: string,
  searchParams: SearchParamsRecord | null | undefined,
  updates?: Record<string, string | null | undefined>,
) => {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    const firstValue = getFirstSearchParam(value)
    if (firstValue) params.set(key, firstValue)
  }

  for (const [key, value] of Object.entries(updates ?? {})) {
    if (value === null || value === undefined || value === "") {
      params.delete(key)
    } else {
      params.set(key, value)
    }
  }

  const query = params.toString()
  return `${pathname}${query ? `?${query}` : ""}`
}

type ReadonlyURLSearchParams = {
  toString: () => string
}
