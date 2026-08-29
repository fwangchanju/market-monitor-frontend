import { useQuery } from '@tanstack/react-query'
import { getMarketValueTiers } from '@/api/marketMap'
import { marketMapKeys } from './queryKeys'
import { STATIC_REFERENCE_CACHE } from './cacheConfig'

export function useMarketValueTiers() {
  return useQuery({
    queryKey: marketMapKeys.valueTiers(),
    queryFn: getMarketValueTiers,
    ...STATIC_REFERENCE_CACHE,
  })
}
