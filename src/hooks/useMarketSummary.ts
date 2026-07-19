import { useQuery } from '@tanstack/react-query'
import { getMarketSummary } from '../api/dashboard'
import { marketSummaryKeys } from './queryKeys'
import { MARKET_DATA_CACHE } from './cacheConfig'

export function useMarketSummary() {
  return useQuery({
    queryKey: marketSummaryKeys.summary(),
    queryFn: getMarketSummary,
    ...MARKET_DATA_CACHE,
  })
}
