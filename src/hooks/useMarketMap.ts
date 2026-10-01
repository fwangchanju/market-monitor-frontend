import { useQuery } from '@tanstack/react-query'
import { getMarketMap } from '@/api/marketMap'
import { marketMapKeys } from './queryKeys'
import { MARKET_DATA_CACHE } from './cacheConfig'
import type { MarketQuery } from '@/types/api'

export function useMarketMap(market: MarketQuery, isCustom: boolean, nxtOnly: boolean, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: marketMapKeys.map(market, isCustom, nxtOnly),
    queryFn: () => getMarketMap(market, isCustom, undefined, nxtOnly),
    enabled: options?.enabled ?? true,
    ...MARKET_DATA_CACHE,
  })
}
