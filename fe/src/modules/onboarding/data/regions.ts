"use client"

import { useQuery } from "@tanstack/react-query"

/**
 * Countries, provinces and cities for the company form, served from public/places/.
 * World data: Countries States Cities Database (ODbL v1.0). Indonesia is replaced with the
 * official Kemendagri list (38 provinces, 514 regencies and cities). See public/places/README.md.
 */
type PlacesIndex = {
  attribution: string[]
  countries: { iso2: string; name: string }[]
  states: Record<string, { id: string; name: string }[]>
}

async function load<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) throw new Error("We could not load the list of places. Please type it in.")
  return response.json() as Promise<T>
}

/** Options for the cascading country, province and city pickers. */
export function useRegions(country: string, province: string) {
  const index = useQuery({
    queryKey: ["places-index"],
    queryFn: () => load<PlacesIndex>("/places/index.json"),
    staleTime: Infinity,
  })
  const hasCities = !!country && !!index.data?.states[country]?.length
  const cities = useQuery({
    queryKey: ["places-cities", country],
    queryFn: () => load<Record<string, string[]>>(`/places/${country}.json`).catch(() => ({}) as Record<string, string[]>),
    enabled: hasCities,
    staleTime: Infinity,
  })
  const countries = (index.data?.countries ?? []).map((c) => ({ value: c.iso2, label: c.name }))
  const provinces = (index.data?.states[country] ?? []).map((s) => ({ value: s.id, label: s.name }))
  const cityOptions = (cities.data?.[province] ?? []).map((name) => ({ value: name, label: name }))
  return {
    loading: index.isLoading || (hasCities && cities.isLoading),
    countries,
    provinces,
    cities: cityOptions,
    countryName: (code: string) => countries.find((c) => c.value === code)?.label ?? code,
    provinceName: (id: string) => provinces.find((p) => p.value === id)?.label ?? id,
  }
}
