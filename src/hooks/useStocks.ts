import { useQuery } from '@tanstack/react-query'
import { getStocks } from '@/api/marketSummary'
import { stockKeys } from './queryKeys'
import { STATIC_REFERENCE_CACHE } from './cacheConfig'

export function useStocks() {
  return useQuery({
    queryKey: stockKeys.list(),
    queryFn: getStocks,
    ...STATIC_REFERENCE_CACHE,
  })
}
