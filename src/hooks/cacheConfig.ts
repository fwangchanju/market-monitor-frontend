export const MARKET_DATA_CACHE = {
  staleTime: 60_000,
  refetchInterval: 60_000,
} as const

export const STATIC_REFERENCE_CACHE = {
  staleTime: Infinity,
  refetchInterval: false,
} as const
