import { useQuery } from '@tanstack/react-query'
import { getWatchStocks } from '@/api/marketSummary'
import { watchStockKeys } from './queryKeys'
import { INFREQUENT_DATA_CACHE } from './cacheConfig'

export function useWatchStocks() {
  return useQuery({
    queryKey: watchStockKeys.list(),
    queryFn: getWatchStocks,
    ...INFREQUENT_DATA_CACHE,
  })
}
