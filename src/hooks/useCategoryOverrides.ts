import { useQuery } from '@tanstack/react-query'
import { getCategoryOverrides } from '@/api/marketMap'
import { marketMapKeys } from './queryKeys'
import { INFREQUENT_DATA_CACHE } from './cacheConfig'

export function useCategoryOverrides() {
  return useQuery({
    queryKey: marketMapKeys.categories(),
    queryFn: getCategoryOverrides,
    ...INFREQUENT_DATA_CACHE,
  })
}
