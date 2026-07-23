import { useQuery } from '@tanstack/react-query'
import { getExcludedStocks } from '@/api/marketMap'
import { marketMapKeys } from './queryKeys'
import { INFREQUENT_DATA_CACHE } from './cacheConfig'

export function useExcludedStocks() {
  return useQuery({
    queryKey: marketMapKeys.excludedStocks(),
    queryFn: getExcludedStocks,
    ...INFREQUENT_DATA_CACHE,
  })
}
