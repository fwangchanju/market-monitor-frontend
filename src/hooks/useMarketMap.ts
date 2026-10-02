import { useQuery } from '@tanstack/react-query'
import { getMarketMap, type ChangeRateBasis } from '@/api/marketMap'
import { marketMapKeys } from './queryKeys'
import { MARKET_DATA_CACHE } from './cacheConfig'
import type { MarketQuery } from '@/types/api'

export function useMarketMap(
  market: MarketQuery,
  isCustom: boolean,
  nxtOnly: boolean,
  options?: { enabled?: boolean; basis?: ChangeRateBasis },
) {
  const basis = options?.basis ?? 'daily'
  return useQuery({
    queryKey: marketMapKeys.map(market, isCustom, nxtOnly, basis),
    queryFn: () => getMarketMap(market, isCustom, undefined, nxtOnly, basis),
    enabled: options?.enabled ?? true,
    ...MARKET_DATA_CACHE,
  })
}
