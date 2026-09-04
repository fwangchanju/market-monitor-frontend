import { useQuery } from '@tanstack/react-query'
import { getCategoryChangeRates } from '@/api/marketMap'
import { marketMapKeys } from './queryKeys'
import { MARKET_DATA_CACHE } from './cacheConfig'
import type { MarketQuery } from '@/types/api'

export function useCategoryChangeRates(market: MarketQuery, beforeMinutes: number) {
  return useQuery({
    queryKey: marketMapKeys.categoryChangeRates(market, beforeMinutes),
    queryFn: () => getCategoryChangeRates(market, beforeMinutes),
    ...MARKET_DATA_CACHE,
  })
}
