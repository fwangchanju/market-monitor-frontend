import { useQuery } from '@tanstack/react-query'
import { getMarketMap } from '@/api/marketMap'
import { marketMapKeys } from './queryKeys'
import { MARKET_DATA_CACHE } from './cacheConfig'
import type { Market } from '@/types/api'

export function useMarketMap(market: Market, isExclude: boolean) {
  return useQuery({
    queryKey: marketMapKeys.map(market, isExclude),
    queryFn: () => getMarketMap(market, isExclude),
    ...MARKET_DATA_CACHE,
  })
}
